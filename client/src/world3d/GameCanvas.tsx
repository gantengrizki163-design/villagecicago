import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import type { PlayerInputState } from '../components/MobileControls';
import type { ClientDeterministicNpcPose, ClientLawAlert } from '../firebase/npcDeterminism';
import type {
  BusinessDoc,
  BusinessStockDoc,
  CharacterDoc,
  ConstructionDoc,
  FurniturePlacement,
  GameConfigDoc,
  GraphicsQuality,
  LandPlotDoc,
  PlayerAnimState,
  PropertyDoc,
  PropertyListingDoc,
  RTDBPlayer,
  RTDBVehicle,
  SecurityInstallDoc,
  TrainScheduleConfig,
  VehicleDoc,
  ZoneId,
} from '../types/game';
import { BusinessInterior3D } from './BusinessInterior3D';
import { CicalengkaWorld } from './CicalengkaWorld';
import { CourierMarkers3D, type CourierTarget } from './CourierMarkers3D';
import { DayNightCycle } from './DayNightCycle';
import { DestinationGuide3D, type OffscreenTargetIndicator } from './DestinationGuide3D';
import { DestinationZoneWorld } from './DestinationZoneWorld';
import { InstancedProps } from './InstancedProps';
import type { ActiveNavigationState } from './interactions/useLocationGate';
import { InteriorScene3D } from './InteriorScene3D';
import { LocalPlayer, type NearbyInteractTarget } from './LocalPlayer';
import { NpcCrowd, type NpcWorldPositionEntry } from './NpcCrowd';
import { RemotePlayers } from './RemotePlayers';
import {
  ThirdPersonCamera,
  type CameraOrbitState,
  type DroneCameraState,
  type DroneTelemetry,
} from './ThirdPersonCamera';
import { Train3D } from './Train3D';
import { WeatherEffects3D, type WeatherKind } from './assets/WeatherEffects3D';
import type { RemotePlayerAppearance, SyncVehicleTransformPayload } from './useMultiplayerSync';
import { ParkedVehicles3D, type NearbyVehicleTarget } from './vehicles/ParkedVehicles3D';
import { NpcTraffic3D, type NpcTrafficPositionEntry } from './vehicles/NpcTraffic3D';
import {
  RemoteVehicles3D,
  type NearbyPassengerVehicleTarget,
} from './vehicles/RemoteVehicles3D';
import type { CulledRemoteVehicle } from './vehicles/vehicleMultiplayer';
import {
  PlayerVehicleController,
  type ActiveDriveVehicle,
  type ExitVehiclePayload,
  type PedestrianCollisionInfo,
} from './vehicles/PlayerVehicleController';
import type { DrivingTelemetrySnapshot, TurnSignalMode } from './vehicles/vehiclePhysics';

export interface InteriorSessionProps {
  property: PropertyDoc;
  mode: 'resident' | 'preview';
  decorationMode: boolean;
  draftFurniture: FurniturePlacement[];
  selectedInstanceId: string | null;
  pendingFurnitureId: string | null;
  pendingRotation: 0 | 90 | 180 | 270;
  hoverCell: { gx: number; gz: number } | null;
  onHoverCell: (cell: { gx: number; gz: number } | null) => void;
  onSelectPlaced: (instanceId: string) => void;
  onTapGridCell: (gx: number, gz: number) => void;
}

export interface BusinessSessionProps {
  business: BusinessDoc;
  stock: BusinessStockDoc[];
}

interface GameCanvasProps {
  character: CharacterDoc;
  gameConfig: GameConfigDoc;
  trainSchedule: TrainScheduleConfig;
  properties?: PropertyDoc[];
  listings?: PropertyListingDoc[];
  businesses?: BusinessDoc[];
  landPlots?: LandPlotDoc[];
  constructions?: ConstructionDoc[];
  securityInstalls?: SecurityInstallDoc[];
  lawAlerts?: ClientLawAlert[];
  businessSession?: BusinessSessionProps | null;
  interiorSession?: InteriorSessionProps | null;
  serverOffsetMs: number;
  isNight: boolean;
  gameHour?: number;
  weather?: WeatherKind;
  isCriticalStats: boolean;
  movementLocked: boolean;
  quality: GraphicsQuality;
  remotePlayers: RTDBPlayer[];
  localBubbles: Record<string, string>;
  visitedCourierIds: string[];
  inputRef: React.MutableRefObject<PlayerInputState>;
  cameraOrbitRef: React.MutableRefObject<CameraOrbitState>;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  droneMode?: boolean;
  droneControlRef?: React.MutableRefObject<DroneCameraState>;
  onDroneTelemetry?: (telemetry: DroneTelemetry) => void;
  onVisitCourierTarget: (target: CourierTarget) => void;
  onNearbyTargetChange: (target: NearbyInteractTarget) => void;
  onNearbyNpcChange?: (npc: ClientDeterministicNpcPose | null) => void;
  onSyncTransform: (x: number, y: number, z: number, rotY: number, anim: PlayerAnimState) => void;
  onWorldReady: () => void;
  activeNav?: ActiveNavigationState | null;
  onAutoWalkCancel?: (reason?: string) => void;
  onScreenIndicatorUpdate?: (indicator: OffscreenTargetIndicator) => void;
  vehicles?: VehicleDoc[];
  activeDriveVehicle?: ActiveDriveVehicle | null;
  activePassengerVehicle?: RTDBVehicle | null;
  remoteVehicles?: CulledRemoteVehicle[];
  rtdbVehiclesMap?: Record<string, RTDBVehicle>;
  playerAppearances?: Record<string, RemotePlayerAppearance>;
  vehicleHeadingRef?: React.MutableRefObject<number>;
  vehicleSpeedRef?: React.MutableRefObject<number>;
  vehicleHornNonce?: number;
  vehicleDismountNonce?: number;
  vehicleHeadlightsManual?: boolean | null;
  vehicleTurnSignal?: TurnSignalMode;
  onToggleTurnSignal?: (mode: 'left' | 'right' | 'hazard') => void;
  onPedestrianCollision?: (info: PedestrianCollisionInfo) => void;
  onNearbyVehicleChange?: (target: NearbyVehicleTarget | null) => void;
  onNearbyPassengerTargetChange?: (target: NearbyPassengerVehicleTarget | null) => void;
  onDismountPassenger?: () => void;
  onSyncVehicleTransform?: (payload: SyncVehicleTransformPayload) => void;
  onDrivingTelemetry?: (telemetry: DrivingTelemetrySnapshot) => void;
  onExitVehicle?: (payload: ExitVehiclePayload) => void;
  onNotify?: (msg: string) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  character,
  gameConfig,
  trainSchedule,
  properties,
  listings,
  businesses,
  landPlots,
  constructions,
  securityInstalls,
  lawAlerts,
  businessSession,
  interiorSession,
  serverOffsetMs,
  isNight,
  gameHour = 12,
  weather = 'cerah',
  isCriticalStats,
  movementLocked,
  quality,
  remotePlayers,
  localBubbles,
  visitedCourierIds,
  inputRef,
  cameraOrbitRef,
  playerPosRef,
  droneMode = false,
  droneControlRef,
  onDroneTelemetry,
  onVisitCourierTarget,
  onNearbyTargetChange,
  onNearbyNpcChange,
  onSyncTransform,
  onWorldReady,
  activeNav = null,
  onAutoWalkCancel,
  onScreenIndicatorUpdate,
  vehicles = [],
  activeDriveVehicle = null,
  activePassengerVehicle = null,
  remoteVehicles = [],
  rtdbVehiclesMap = {},
  playerAppearances = {},
  vehicleHeadingRef,
  vehicleSpeedRef,
  vehicleHornNonce = 0,
  vehicleDismountNonce = 0,
  vehicleHeadlightsManual = null,
  vehicleTurnSignal = 'off',
  onToggleTurnSignal,
  onPedestrianCollision,
  onNearbyVehicleChange,
  onNearbyPassengerTargetChange,
  onDismountPassenger,
  onSyncVehicleTransform,
  onDrivingTelemetry,
  onExitVehicle,
  onNotify,
}) => {
  const [nearbyNpc, setNearbyNpc] = useState<ClientDeterministicNpcPose | null>(null);
  const npcWorldPosMapRef = useRef<Record<string, NpcWorldPositionEntry>>({});
  const npcTrafficPosMapRef = useRef<Record<string, NpcTrafficPositionEntry>>({});
  const knockedNpcUntilRef = useRef<Record<string, number>>({});
  const wasInVehicleRef = useRef(false);
  const isInVehicleNow = Boolean(activeDriveVehicle || activePassengerVehicle);

  useEffect(() => {
    wasInVehicleRef.current = isInVehicleNow;
  }, [isInVehicleNow]);

  const activeDrivePassengers = useMemo(() => {
    if (!activeDriveVehicle) return [];
    const rv = rtdbVehiclesMap[activeDriveVehicle.vehicleId];
    return rv?.passengers ? Object.values(rv.passengers) : [];
  }, [activeDriveVehicle, rtdbVehiclesMap]);

  const seatedRemoteUids = useMemo(() => {
    const hidden = new Set<string>();
    for (const entry of remoteVehicles) {
      if (entry.vehicle.driverId) hidden.add(entry.vehicle.driverId);
      if (entry.vehicle.passengers) {
        for (const puid of Object.keys(entry.vehicle.passengers)) {
          hidden.add(puid);
        }
      }
    }
    for (const pass of activeDrivePassengers) {
      hidden.add(pass.uid);
    }
    return hidden;
  }, [remoteVehicles, activeDrivePassengers]);

  const handleNearestNpcChange = useCallback(
    (npc: ClientDeterministicNpcPose | null) => {
      setNearbyNpc(npc);
      onNearbyNpcChange?.(npc);
    },
    [onNearbyNpcChange]
  );

  const dpr: [number, number] =
    quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [0.85, 1];
  const currentZone: ZoneId = character.currentZone || 'cicalengka';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onWorldReady();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [onWorldReady]);

  return (
    <Canvas
      shadows={quality !== 'low'}
      dpr={dpr}
      camera={{ position: [0, 7, -33], fov: 55, near: 0.2, far: 420 }}
      gl={{
        antialias: quality !== 'low',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      className="h-full w-full"
    >
      <DayNightCycle
        serverOffsetMs={serverOffsetMs}
        gameConfig={gameConfig}
        quality={quality}
        currentZone={currentZone}
        playerPosRef={playerPosRef}
        droneMode={droneMode}
        weather={weather}
      />
      <Suspense fallback={null}>
        {interiorSession ? (
          <Physics key={`interior_${interiorSession.property.id}`} gravity={[0, -18, 0]}>
            <InteriorScene3D
              property={interiorSession.property}
              character={character}
              mode={interiorSession.mode}
              decorationMode={interiorSession.decorationMode}
              draftFurniture={interiorSession.draftFurniture}
              selectedInstanceId={interiorSession.selectedInstanceId}
              pendingFurnitureId={interiorSession.pendingFurnitureId}
              pendingRotation={interiorSession.pendingRotation}
              hoverCell={interiorSession.hoverCell}
              quality={quality}
              isNight={isNight}
              movementLocked={movementLocked}
              isCriticalStats={isCriticalStats}
              localChatBubble={localBubbles[character.uid] ?? null}
              inputRef={inputRef}
              cameraOrbitRef={cameraOrbitRef}
              playerPosRef={playerPosRef}
              onHoverCell={interiorSession.onHoverCell}
              onSelectPlaced={interiorSession.onSelectPlaced}
              onTapGridCell={interiorSession.onTapGridCell}
              onNearbyTargetChange={onNearbyTargetChange}
            />
          </Physics>
        ) : businessSession ? (
          <Physics key={`biz_interior_${businessSession.business.id}`} gravity={[0, -18, 0]}>
            <BusinessInterior3D
              business={businessSession.business}
              stock={businessSession.stock}
              character={character}
              quality={quality}
              movementLocked={movementLocked}
              isCriticalStats={isCriticalStats}
              localChatBubble={localBubbles[character.uid] ?? null}
              inputRef={inputRef}
              cameraOrbitRef={cameraOrbitRef}
              playerPosRef={playerPosRef}
              onNearbyTargetChange={onNearbyTargetChange}
            />
          </Physics>
        ) : (
          <Physics key={currentZone} gravity={[0, -18, 0]}>
            {currentZone === 'cicalengka' ? (
              <>
                <CicalengkaWorld
                  quality={quality}
                  isNight={isNight}
                  hour={gameHour}
                  properties={properties}
                  listings={listings}
                  businesses={businesses}
                  landPlots={landPlots}
                  constructions={constructions}
                  securityInstalls={securityInstalls}
                  lawAlerts={lawAlerts}
                  serverNowMs={Date.now() + serverOffsetMs}
                  serverOffsetMs={serverOffsetMs}
                  trainSchedule={trainSchedule}
                  epochMs={gameConfig.epochMs}
                  currentHomeId={character.currentHomeId}
                  currentUid={character.uid}
                />
                <InstancedProps quality={quality} />
              </>
            ) : (
              <DestinationZoneWorld zone={currentZone} quality={quality} isNight={isNight} />
            )}

            <WeatherEffects3D
              weather={weather}
              quality={quality}
              currentZone={currentZone}
              playerPosRef={playerPosRef}
              droneMode={droneMode}
            />

            <Train3D
              serverOffsetMs={serverOffsetMs}
              schedule={trainSchedule}
              epochMs={gameConfig.epochMs}
              zTrack={currentZone === 'cicalengka' ? -61.5 : -53.5}
              labelPosZ={currentZone === 'cicalengka' ? -54.5 : -46.5}
              quality={quality}
              isNight={isNight}
            />

            <NpcCrowd
              zone={currentZone}
              serverOffsetMs={serverOffsetMs}
              quality={quality}
              playerPosRef={playerPosRef}
              activeAlerts={lawAlerts}
              onNearestNpcChange={handleNearestNpcChange}
              npcWorldPosMapRef={npcWorldPosMapRef}
              knockedNpcUntilRef={knockedNpcUntilRef}
            />

            {currentZone === 'cicalengka' && (
              <>
                <CourierMarkers3D
                  activeShift={character.activeShift}
                  visitedIds={visitedCourierIds}
                  playerPosRef={playerPosRef}
                  activeDriveVehicle={activeDriveVehicle}
                  onVisitTarget={onVisitCourierTarget}
                  onNotify={onNotify}
                />
                <NpcTraffic3D
                  zone={currentZone}
                  serverOffsetMs={serverOffsetMs}
                  trainSchedule={trainSchedule}
                  epochMs={gameConfig.epochMs}
                  quality={quality}
                  isNight={isNight}
                  playerPosRef={playerPosRef}
                  npcTrafficPosMapRef={npcTrafficPosMapRef}
                />
              </>
            )}

            <DestinationGuide3D
              activeNav={activeNav}
              playerPosRef={playerPosRef}
              onScreenIndicatorUpdate={onScreenIndicatorUpdate}
            />

            {onNearbyVehicleChange && (
              <ParkedVehicles3D
                vehicles={vehicles}
                currentZone={currentZone}
                activeVehicleId={activeDriveVehicle?.vehicleId ?? null}
                playerPosRef={playerPosRef}
                isNight={isNight}
                quality={quality}
                isOnFoot={
                  !activeDriveVehicle &&
                  !activePassengerVehicle &&
                  !interiorSession &&
                  !businessSession
                }
                onNearbyVehicleChange={onNearbyVehicleChange}
              />
            )}

            <RemoteVehicles3D
              remoteVehicles={remoteVehicles}
              localCharacter={character}
              isNight={isNight}
              quality={quality}
              serverOffsetMs={serverOffsetMs}
              playerAppearances={playerAppearances}
              localBubbles={localBubbles}
              playerPosRef={playerPosRef}
              vehicleHeadingRef={vehicleHeadingRef}
              vehicleSpeedRef={vehicleSpeedRef}
              isOnFoot={
                !activeDriveVehicle &&
                !activePassengerVehicle &&
                !interiorSession &&
                !businessSession
              }
              isPassengerNow={Boolean(activePassengerVehicle)}
              onSyncTransform={onSyncTransform}
              onNearbyPassengerTargetChange={onNearbyPassengerTargetChange}
              onDismountPassenger={onDismountPassenger}
            />

            {activeDriveVehicle && vehicleHeadingRef && vehicleSpeedRef && onExitVehicle ? (
              <PlayerVehicleController
                key={`drive_${activeDriveVehicle.vehicleId}_${activeDriveVehicle.mode}`}
                character={character}
                vehicle={activeDriveVehicle}
                currentZone={currentZone}
                serverOffsetMs={serverOffsetMs}
                isNight={isNight}
                weather={weather}
                quality={quality}
                movementLocked={movementLocked}
                localChatBubble={localBubbles[character.uid] ?? null}
                inputRef={inputRef}
                playerPosRef={playerPosRef}
                vehicleHeadingRef={vehicleHeadingRef}
                vehicleSpeedRef={vehicleSpeedRef}
                hornNonce={vehicleHornNonce}
                dismountNonce={vehicleDismountNonce}
                headlightsManual={vehicleHeadlightsManual}
                turnSignal={vehicleTurnSignal}
                onToggleTurnSignal={onToggleTurnSignal}
                remotePlayers={remotePlayers}
                rtdbPassengers={activeDrivePassengers}
                playerAppearances={playerAppearances}
                localBubbles={localBubbles}
                npcWorldPosMapRef={npcWorldPosMapRef}
                knockedNpcUntilRef={knockedNpcUntilRef}
                onPedestrianCollision={onPedestrianCollision}
                onSyncTransform={onSyncTransform}
                onSyncVehicleTransform={onSyncVehicleTransform}
                onDrivingTelemetry={onDrivingTelemetry}
                onExitVehicle={onExitVehicle}
                onNotify={onNotify}
              />
            ) : activePassengerVehicle ? null : (
              <LocalPlayer
                key={`player_${currentZone}_${character.faintedCount ?? 0}_${character.uid}`}
                character={character}
                currentZone={currentZone}
                properties={properties}
                businesses={businesses}
                landPlots={landPlots}
                constructions={constructions}
                nearbyNpc={nearbyNpc}
                movementLocked={movementLocked}
                isCriticalStats={isCriticalStats}
                localChatBubble={localBubbles[character.uid] ?? null}
                inputRef={inputRef}
                cameraOrbitRef={cameraOrbitRef}
                playerPosRef={playerPosRef}
                onNearbyTargetChange={onNearbyTargetChange}
                onSyncTransform={onSyncTransform}
                activeNav={activeNav}
                onAutoWalkCancel={onAutoWalkCancel}
                preferLivePos={wasInVehicleRef.current}
                castShadow={quality !== 'low'}
              />
            )}
            <RemotePlayers
              players={remotePlayers}
              localBubbles={localBubbles}
              hiddenUids={seatedRemoteUids}
              castShadow={quality !== 'low'}
            />
          </Physics>
        )}
      </Suspense>
      <ThirdPersonCamera
        targetRef={playerPosRef}
        cameraOrbitRef={cameraOrbitRef}
        inputRef={inputRef}
        allowTouchOrbit={Boolean(interiorSession?.decorationMode)}
        droneMode={droneMode}
        droneControlRef={droneControlRef}
        currentZone={currentZone}
        onDroneTelemetry={onDroneTelemetry}
        isDriving={Boolean(
          (activeDriveVehicle || activePassengerVehicle) && !interiorSession && !businessSession
        )}
        vehicleCategory={
          activeDriveVehicle?.category ?? activePassengerVehicle?.category ?? 'motor'
        }
        vehicleHeadingRef={vehicleHeadingRef}
        vehicleSpeedRef={vehicleSpeedRef}
      />
    </Canvas>
  );
};

export default GameCanvas;
