import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  limitToLast,
  onDisconnect,
  onValue,
  query,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import * as THREE from 'three';
import { callSavePosition } from '../firebase/api';
import { rtdb } from '../firebase/config';
import type {
  CharacterDoc,
  Gender,
  PlayerAnimState,
  RTDBLocalChat,
  RTDBPlayer,
  RTDBPresence,
  RTDBVehicle,
} from '../types/game';
import { ensureSafeSpawnPosition } from './layout/layoutHelpers';
import {
  cullRemoteVehicles,
  getTabSessionId,
  normalizeAngleRad,
  type CulledRemoteVehicle,
} from './vehicles/vehicleMultiplayer';
import type { TurnSignalMode } from './vehicles/vehiclePhysics';
import {
  distance2D,
  getZoneId,
  REMOTE_PLAYER_CULL_RADIUS,
  STATION_SPAWN,
} from './worldConstants';

export interface RemotePlayerAppearance {
  uid: string;
  name: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
}

export interface SyncVehicleTransformPayload {
  vehicleId: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  vx: number;
  vz: number;
  speed: number;
  steerAngle: number;
  headlights: boolean;
  turnSignal: TurnSignalMode;
  hornAtMs: number;
  maxSpeed: number;
}

export interface ActiveVehicleSyncContext {
  drivingVehicleId?: string | null;
  passengerVehicleId?: string | null;
  passengerSeatIndex?: number;
}

export function useMultiplayerSync(
  character: CharacterDoc | null,
  playerPosRef: React.MutableRefObject<THREE.Vector3>,
  inHomeId: string | null = null,
  activeVehicleCtx?: ActiveVehicleSyncContext
) {
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [remotePlayers, setRemotePlayers] = useState<RTDBPlayer[]>([]);
  const [remoteVehicles, setRemoteVehicles] = useState<CulledRemoteVehicle[]>([]);
  const [rtdbVehiclesMap, setRtdbVehiclesMap] = useState<Record<string, RTDBVehicle>>({});
  const [rtdbVehiclesReady, setRtdbVehiclesReady] = useState(false);
  const [playerAppearances, setPlayerAppearances] = useState<Record<string, RemotePlayerAppearance>>({});
  const [localBubbles, setLocalBubbles] = useState<Record<string, string>>({});
  const [onlineCount, setOnlineCount] = useState(1);

  const tabSessionId = useMemo(() => getTabSessionId(), []);
  const drivingVehicleId = activeVehicleCtx?.drivingVehicleId ?? null;
  const passengerVehicleId = activeVehicleCtx?.passengerVehicleId ?? null;
  const passengerSeatIndex = activeVehicleCtx?.passengerSeatIndex ?? 1;

  const currentZone = character?.currentZone || 'cicalengka';
  const inTrain = Boolean(character?.activeTrip);
  const isHomeless = Boolean(character?.homeless);

  const initialSafePos =
    currentZone === 'cicalengka'
      ? ensureSafeSpawnPosition(character?.lastPosition ?? STATION_SPAWN, {
          isJailed: Boolean(character?.sentence?.active),
        }).position
      : character?.lastPosition ?? STATION_SPAWN;

  const latestPosRef = useRef({
    x: initialSafePos.x,
    y: initialSafePos.y,
    z: initialSafePos.z,
    rotY: initialSafePos.rotY ?? 0,
  });
  const dirtyForSaveRef = useRef(false);
  const presenceMapRef = useRef<Record<string, RTDBPresence>>({});
  const rawPlayersRef = useRef<Record<string, RTDBPlayer>>({});
  const rawVehiclesRef = useRef<Record<string, RTDBVehicle>>({});
  const appearanceSigRef = useRef<string>('');
  const lastVehicleUpdatedAtRef = useRef<Record<string, number>>({});

  const recomputeCulledEntities = useCallback(() => {
    if (!character) return;
    const myPos = playerPosRef.current;
    const myZone = character.currentZone || 'cicalengka';
    const now = Date.now() + serverOffsetMs;
    const list: RTDBPlayer[] = [];
    let activeOnline = 1;

    for (const [uid, p] of Object.entries(rawPlayersRef.current)) {
      if (uid === character.uid) continue;
      const pres = presenceMapRef.current[uid];
      if (pres && !pres.online) continue;
      if (now - p.updatedAt > 90_000) continue;

      activeOnline += 1;
      const otherZone = p.currentZone || 'cicalengka';
      if (
        otherZone === myZone &&
        !pres?.inTrain &&
        !pres?.inHomeId &&
        distance2D(myPos.x, myPos.z, p.x, p.z) <= REMOTE_PLAYER_CULL_RADIUS
      ) {
        list.push(p);
      }
    }

    const culledVehicles = cullRemoteVehicles(rawVehiclesRef.current, {
      myUid: character.uid,
      myZone,
      myX: myPos.x,
      myZ: myPos.z,
      activeDriveVehicleId: drivingVehicleId,
      nowMs: now,
    });

    // Perbarui map tampilan karakter hanya bila daftar uid / pakaian berubah agar hemat re-render
    const nextAppEntries: Array<[string, RemotePlayerAppearance]> = [];
    for (const [uid, p] of Object.entries(rawPlayersRef.current)) {
      nextAppEntries.push([
        uid,
        {
          uid: p.uid,
          name: p.name,
          gender: p.gender,
          skinColor: p.skinColor,
          hairColor: p.hairColor,
          shirtColor: p.shirtColor,
          pantsColor: p.pantsColor,
        },
      ]);
    }
    const nextSig = nextAppEntries
      .map(([, a]) => `${a.uid}:${a.name}:${a.gender}:${a.skinColor}:${a.hairColor}:${a.shirtColor}:${a.pantsColor}`)
      .sort()
      .join('|');
    if (nextSig !== appearanceSigRef.current) {
      appearanceSigRef.current = nextSig;
      setPlayerAppearances(Object.fromEntries(nextAppEntries));
    }

    setOnlineCount(activeOnline);
    setRemotePlayers(list);
    setRemoteVehicles(culledVehicles);
  }, [character, drivingVehicleId, playerPosRef, serverOffsetMs]);

  useEffect(() => {
    if (!character || !rtdb) {
      setRtdbVehiclesReady(true);
      return;
    }

    const offsetRef = ref(rtdb, '.info/serverTimeOffset');
    const unsubOffset = onValue(offsetRef, (snap) => {
      if (typeof snap.val() === 'number') {
        setServerOffsetMs(snap.val());
      }
    });

    const connectedRef = ref(rtdb, '.info/connected');
    const presenceRef = ref(rtdb, `presence/${character.uid}`);
    const myPlayerRef = ref(rtdb, `players/${character.uid}`);

    const buildPresencePayload = (online: boolean) => {
      const payload: Record<string, unknown> = {
        online,
        lastSeen: serverTimestamp(),
        inTrain: online ? inTrain : false,
        currentZone,
        isHomeless,
        sessionId: tabSessionId,
      };
      if (online && inHomeId) {
        payload.inHomeId = inHomeId;
      }
      if (online && drivingVehicleId) {
        payload.drivingVehicleId = drivingVehicleId;
      }
      if (online && passengerVehicleId) {
        payload.passengerVehicleId = passengerVehicleId;
      }
      return payload;
    };

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).set(buildPresencePayload(false)).catch(() => {});
        onDisconnect(myPlayerRef).remove().catch(() => {});
        if (drivingVehicleId) {
          onDisconnect(ref(rtdb!, `vehicles/${drivingVehicleId}`)).remove().catch(() => {});
        }
        if (passengerVehicleId) {
          onDisconnect(ref(rtdb!, `vehicles/${passengerVehicleId}/passengers/${character.uid}`))
            .remove()
            .catch(() => {});
        }

        set(presenceRef, buildPresencePayload(true)).catch(() => {});

        const lp = latestPosRef.current;
        const playerPayload: Record<string, unknown> = {
          uid: character.uid,
          name: character.name,
          gender: character.gender,
          skinColor: character.skinColor,
          hairColor: character.hairColor,
          shirtColor: character.shirtColor,
          pantsColor: character.pantsColor,
          x: Number(lp.x.toFixed(2)),
          y: Number(lp.y.toFixed(2)),
          z: Number(lp.z.toFixed(2)),
          rotY: Number(normalizeAngleRad(lp.rotY).toFixed(3)),
          anim: drivingVehicleId ? 'driving' : passengerVehicleId ? 'passenger' : 'idle',
          zone: getZoneId(lp.x, lp.z),
          currentZone,
          updatedAt: Date.now() + serverOffsetMs,
        };
        if (drivingVehicleId) {
          playerPayload.vehicleId = drivingVehicleId;
          playerPayload.seatIndex = 0;
        } else if (passengerVehicleId) {
          playerPayload.vehicleId = passengerVehicleId;
          playerPayload.seatIndex =
            rawVehiclesRef.current[passengerVehicleId]?.passengers?.[character.uid]?.seatIndex ??
            passengerSeatIndex;
        }
        set(myPlayerRef, playerPayload).catch(() => {});
      }
    });

    const unsubPresence = onValue(ref(rtdb, 'presence'), (snap) => {
      presenceMapRef.current = (snap.val() as Record<string, RTDBPresence>) || {};
      recomputeCulledEntities();
    });

    const unsubPlayers = onValue(ref(rtdb, 'players'), (snap) => {
      rawPlayersRef.current = (snap.val() as Record<string, RTDBPlayer>) || {};
      recomputeCulledEntities();
    });

    const unsubVehicles = onValue(ref(rtdb, 'vehicles'), (snap) => {
      const val = (snap.val() as Record<string, RTDBVehicle>) || {};
      rawVehiclesRef.current = val;
      setRtdbVehiclesMap(val);
      setRtdbVehiclesReady(true);
      recomputeCulledEntities();
    });

    const chatQuery = query(ref(rtdb, 'localChat'), limitToLast(25));
    const unsubLocalChat = onValue(chatQuery, (snap) => {
      const val = (snap.val() as Record<string, RTDBLocalChat>) || {};
      const now = Date.now() + serverOffsetMs;
      const myPos = playerPosRef.current;
      const bubbles: Record<string, string> = {};

      Object.values(val)
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((msg) => {
          if (now - msg.createdAt <= 7000 && distance2D(myPos.x, myPos.z, msg.x, msg.z) <= 35) {
            bubbles[msg.senderUid] = msg.message;
          }
        });

      setLocalBubbles(bubbles);
    });

    const interval = window.setInterval(() => {
      recomputeCulledEntities();
    }, 1000);

    return () => {
      unsubOffset();
      unsubConnected();
      unsubPresence();
      unsubPlayers();
      unsubVehicles();
      unsubLocalChat();
      window.clearInterval(interval);
    };
  }, [
    character,
    currentZone,
    drivingVehicleId,
    inHomeId,
    inTrain,
    isHomeless,
    passengerSeatIndex,
    passengerVehicleId,
    playerPosRef,
    recomputeCulledEntities,
    serverOffsetMs,
    tabSessionId,
  ]);

  // Daftarkan onDisconnect otomatis saat mulai mengemudikan kendaraan
  useEffect(() => {
    if (!character || !rtdb || !drivingVehicleId) return;
    const vRef = ref(rtdb, `vehicles/${drivingVehicleId}`);
    void onDisconnect(vRef).remove().catch(() => {});
    return () => {
      void onDisconnect(vRef).cancel().catch(() => {});
    };
  }, [character, drivingVehicleId]);

  // Daftarkan onDisconnect otomatis saat menumpang kendaraan lain
  useEffect(() => {
    if (!character || !rtdb || !passengerVehicleId) return;
    const pRef = ref(rtdb, `vehicles/${passengerVehicleId}/passengers/${character.uid}`);
    void onDisconnect(pRef).remove().catch(() => {});
    return () => {
      void onDisconnect(pRef).cancel().catch(() => {});
    };
  }, [character, passengerVehicleId]);

  useEffect(() => {
    if (!character || !rtdb) return;
    const payload: Record<string, unknown> = {
      online: true,
      lastSeen: serverTimestamp(),
      inTrain,
      currentZone,
      isHomeless,
      sessionId: tabSessionId,
    };
    if (inHomeId) {
      payload.inHomeId = inHomeId;
    }
    if (drivingVehicleId) {
      payload.drivingVehicleId = drivingVehicleId;
    }
    if (passengerVehicleId) {
      payload.passengerVehicleId = passengerVehicleId;
    }
    set(ref(rtdb, `presence/${character.uid}`), payload).catch(() => {});
  }, [
    character,
    currentZone,
    drivingVehicleId,
    inHomeId,
    inTrain,
    isHomeless,
    passengerVehicleId,
    tabSessionId,
  ]);

  // Simpan posisi permanen ke Firestore secara berkala (tiap 20s) dan saat keluar
  useEffect(() => {
    if (!character) return;
    const saveInterval = window.setInterval(() => {
      if (dirtyForSaveRef.current) {
        dirtyForSaveRef.current = false;
        void callSavePosition(latestPosRef.current).catch(() => {});
      }
    }, 20_000);

    const handleBeforeUnload = () => {
      if (dirtyForSaveRef.current) {
        void callSavePosition(latestPosRef.current).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(saveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (dirtyForSaveRef.current) {
        void callSavePosition(latestPosRef.current).catch(() => {});
      }
    };
  }, [character]);

  const syncTransform = useCallback(
    (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => {
      const clampedX = Math.max(-85, Math.min(85, x));
      const clampedY = Math.max(-5, Math.min(45, y));
      const clampedZ = Math.max(-85, Math.min(85, z));
      const normRotY = normalizeAngleRad(rotY);

      latestPosRef.current = { x: clampedX, y: clampedY, z: clampedZ, rotY: normRotY };
      dirtyForSaveRef.current = true;
      if (!character || !rtdb) return;

      const playerRef = ref(rtdb, `players/${character.uid}`);
      const payload: Record<string, unknown> = {
        uid: character.uid,
        name: character.name,
        gender: character.gender,
        skinColor: character.skinColor,
        hairColor: character.hairColor,
        shirtColor: character.shirtColor,
        pantsColor: character.pantsColor,
        x: Number(clampedX.toFixed(2)),
        y: Number(clampedY.toFixed(2)),
        z: Number(clampedZ.toFixed(2)),
        rotY: Number(normRotY.toFixed(3)),
        anim,
        zone: getZoneId(clampedX, clampedZ),
        currentZone,
        updatedAt: Date.now() + serverOffsetMs,
      };
      if (anim === 'driving' && drivingVehicleId) {
        payload.vehicleId = drivingVehicleId;
        payload.seatIndex = 0;
      } else if (anim === 'passenger' && passengerVehicleId) {
        payload.vehicleId = passengerVehicleId;
        payload.seatIndex =
          rawVehiclesRef.current[passengerVehicleId]?.passengers?.[character.uid]?.seatIndex ??
          passengerSeatIndex;
      }
      set(playerRef, payload).catch(() => {});
    },
    [character, currentZone, drivingVehicleId, passengerSeatIndex, passengerVehicleId, serverOffsetMs]
  );

  const syncVehicleTransform = useCallback(
    (payload: SyncVehicleTransformPayload) => {
      if (!character || !rtdb) return;
      const existing = rawVehiclesRef.current[payload.vehicleId];
      if (!existing || existing.driverId !== character.uid) return;
      if (existing.sessionId && existing.sessionId !== tabSessionId) return;

      const safeMaxSpeed = Math.max(5, Math.min(30, existing.maxSpeed || payload.maxSpeed || 15));
      const speedCap = safeMaxSpeed + 1.2;
      const nowServerMs = Date.now() + serverOffsetMs;
      const prevTs = Math.max(
        Number(existing.updatedAt || 0),
        lastVehicleUpdatedAtRef.current[payload.vehicleId] || 0
      );
      const nextUpdatedAt = Math.min(
        nowServerMs + 1500,
        Math.max(nowServerMs, prevTs)
      );
      lastVehicleUpdatedAtRef.current[payload.vehicleId] = nextUpdatedAt;

      const clampedX = Math.max(-85, Math.min(85, payload.x));
      const clampedY = Math.max(-5, Math.min(45, payload.y));
      const clampedZ = Math.max(-85, Math.min(85, payload.z));
      const normRotY = normalizeAngleRad(payload.rotY);
      const safeSpeed = Math.max(0, Math.min(speedCap, Math.abs(payload.speed)));
      const safeVx = Math.max(-speedCap, Math.min(speedCap, payload.vx));
      const safeVz = Math.max(-speedCap, Math.min(speedCap, payload.vz));
      const safeSteer = Math.max(-1.4, Math.min(1.4, payload.steerAngle));
      const safeHornAt = Math.max(0, Math.min(nowServerMs + 2000, Math.round(payload.hornAtMs)));

      const vehRef = ref(rtdb, `vehicles/${payload.vehicleId}`);
      update(vehRef, {
        x: Number(clampedX.toFixed(2)),
        y: Number(clampedY.toFixed(2)),
        z: Number(clampedZ.toFixed(2)),
        rotY: Number(normRotY.toFixed(3)),
        vx: Number(safeVx.toFixed(2)),
        vz: Number(safeVz.toFixed(2)),
        speed: Number(safeSpeed.toFixed(2)),
        steerAngle: Number(safeSteer.toFixed(3)),
        headlights: Boolean(payload.headlights),
        turnSignal: payload.turnSignal || 'off',
        hornAtMs: safeHornAt,
        updatedAt: nextUpdatedAt,
      }).catch(() => {});
    },
    [character, serverOffsetMs, tabSessionId]
  );

  return {
    tabSessionId,
    serverOffsetMs,
    remotePlayers,
    remoteVehicles,
    rtdbVehiclesMap,
    rtdbVehiclesReady,
    playerAppearances,
    localBubbles,
    onlineCount,
    syncTransform,
    syncVehicleTransform,
  };
}
