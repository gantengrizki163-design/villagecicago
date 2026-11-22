import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlayerInputState } from '../components/MobileControls';
import type { ZoneId } from '../types/game';

export interface CameraOrbitState {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface DroneCameraState {
  targetX: number;
  targetZ: number;
  altitude: number;
  yaw: number;
  pitch: number;
  autoOrbit: boolean;
  goalX: number | null;
  goalZ: number | null;
  goalAltitude: number | null;
  goalPitch: number | null;
  goalYaw: number | null;
}

export interface DroneTelemetry {
  altitude: number;
  x: number;
  z: number;
  pitchDeg: number;
}

interface ThirdPersonCameraProps {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  cameraOrbitRef: React.MutableRefObject<CameraOrbitState>;
  inputRef: React.MutableRefObject<PlayerInputState>;
  allowTouchOrbit?: boolean;
  droneMode?: boolean;
  droneControlRef?: React.MutableRefObject<DroneCameraState>;
  currentZone?: ZoneId;
  onDroneTelemetry?: (telemetry: DroneTelemetry) => void;
  isDriving?: boolean;
  vehicleCategory?: 'motor' | 'mobil';
  vehicleHeadingRef?: React.MutableRefObject<number>;
  vehicleSpeedRef?: React.MutableRefObject<number>;
}

const _desiredCamPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

/**
 * Kamera third-person, kamera kejar kendaraan, & Mode Drone kota dengan damping eksponensial.
 * Mendukung drag mouse, scroll wheel, WASD/panah & E/Q saat Mode Drone, serta kontrol sentuh HP.
 */
export const ThirdPersonCamera: React.FC<ThirdPersonCameraProps> = ({
  targetRef,
  cameraOrbitRef,
  inputRef,
  allowTouchOrbit = false,
  droneMode = false,
  droneControlRef,
  currentZone = 'cicalengka',
  onDroneTelemetry,
  isDriving = false,
  vehicleCategory = 'motor',
  vehicleHeadingRef,
  vehicleSpeedRef,
}) => {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const currentCamPos = useRef(new THREE.Vector3(0, 6, -34));
  const smoothedLookTarget = useRef(new THREE.Vector3(0, 1.3, -42));
  const initializedRef = useRef(false);
  const keysRef = useRef<Record<string, boolean>>({});
  const prevDroneModeRef = useRef(false);
  const exitGlideTimerRef = useRef(0);
  const telemetryTimerRef = useRef(0);
  const manualOrbitCooldownRef = useRef(0);
  const lastTelemetryRef = useRef<DroneTelemetry>({
    altitude: 32,
    x: 0,
    z: 0,
    pitchDeg: 37,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !allowTouchOrbit) return;
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      if (e.pointerType === 'touch' && !allowTouchOrbit) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      if (droneMode && droneControlRef?.current) {
        const d = droneControlRef.current;
        d.yaw -= dx * 0.0055;
        d.pitch = THREE.MathUtils.clamp(d.pitch + dy * 0.005, 0.2, 1.46);
        d.goalYaw = null;
        d.goalPitch = null;
      } else {
        manualOrbitCooldownRef.current = 1.4;
        cameraOrbitRef.current.yaw -= dx * 0.006;
        cameraOrbitRef.current.pitch = THREE.MathUtils.clamp(
          cameraOrbitRef.current.pitch + dy * 0.005,
          0.15,
          1.28
        );
      }
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (droneMode && droneControlRef?.current) {
        const d = droneControlRef.current;
        const baseAlt = d.goalAltitude ?? d.altitude;
        d.goalAltitude = THREE.MathUtils.clamp(baseAlt + e.deltaY * 0.035, 10, 95);
      } else {
        cameraOrbitRef.current.distance = THREE.MathUtils.clamp(
          cameraOrbitRef.current.distance + e.deltaY * 0.006,
          4.2,
          16
        );
      }
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl, cameraOrbitRef, allowTouchOrbit, droneMode, droneControlRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (prevDroneModeRef.current && !droneMode) {
      exitGlideTimerRef.current = 1.4;
    }
    prevDroneModeRef.current = droneMode;
    if (exitGlideTimerRef.current > 0) {
      exitGlideTimerRef.current = Math.max(0, exitGlideTimerRef.current - dt);
    }

    if (droneMode && droneControlRef?.current) {
      const d = droneControlRef.current;

      // Konsumsi delta kamera dari kontrol sentuh HP
      if (inputRef.current.camDeltaYaw !== 0 || inputRef.current.camDeltaPitch !== 0) {
        d.yaw -= inputRef.current.camDeltaYaw;
        d.pitch = THREE.MathUtils.clamp(d.pitch + inputRef.current.camDeltaPitch, 0.2, 1.46);
        d.goalYaw = null;
        d.goalPitch = null;
        inputRef.current.camDeltaYaw = 0;
        inputRef.current.camDeltaPitch = 0;
      }

      // Kontrol terbang horizontal drone (WASD / Arrow / Joystick HP)
      const k = keysRef.current;
      let ix = inputRef.current.moveX;
      let iz = inputRef.current.moveY;
      if (k['KeyA'] || k['ArrowLeft']) ix -= 1;
      if (k['KeyD'] || k['ArrowRight']) ix += 1;
      if (k['KeyW'] || k['ArrowUp']) iz -= 1;
      if (k['KeyS'] || k['ArrowDown']) iz += 1;

      const moveLen = Math.hypot(ix, iz);
      const zoneBound = currentZone === 'cicalengka' ? 92 : 68;

      if (moveLen > 0.08) {
        ix /= Math.max(1, moveLen);
        iz /= Math.max(1, moveLen);
        const sinY = Math.sin(d.yaw);
        const cosY = Math.cos(d.yaw);
        const flySpeed = 14 + d.altitude * 0.45;
        d.targetX = THREE.MathUtils.clamp(
          d.targetX + (ix * cosY + iz * sinY) * flySpeed * dt,
          -zoneBound,
          zoneBound
        );
        d.targetZ = THREE.MathUtils.clamp(
          d.targetZ + (-ix * sinY + iz * cosY) * flySpeed * dt,
          -zoneBound,
          zoneBound
        );
        d.goalX = null;
        d.goalZ = null;
      }

      // Kontrol ketinggian manual (E / Space naik, Q / Shift turun)
      let altDir = 0;
      if (k['KeyE'] || k['Space']) altDir += 1;
      if (k['KeyQ'] || k['ShiftLeft'] || k['ShiftRight']) altDir -= 1;
      if (altDir !== 0) {
        d.altitude = THREE.MathUtils.clamp(d.altitude + altDir * 24 * dt, 10, 95);
        d.goalAltitude = null;
      }

      // Interpolasi mulus menuju titik preset waypoint / ketinggian target
      const flyDamp = 1 - Math.exp(-5.5 * dt);
      if (d.goalX !== null) {
        d.targetX = THREE.MathUtils.lerp(d.targetX, d.goalX, flyDamp);
        if (Math.abs(d.targetX - d.goalX) < 0.05) {
          d.targetX = d.goalX;
          d.goalX = null;
        }
      }
      if (d.goalZ !== null) {
        d.targetZ = THREE.MathUtils.lerp(d.targetZ, d.goalZ, flyDamp);
        if (Math.abs(d.targetZ - d.goalZ) < 0.05) {
          d.targetZ = d.goalZ;
          d.goalZ = null;
        }
      }
      if (d.goalAltitude !== null) {
        d.altitude = THREE.MathUtils.lerp(d.altitude, d.goalAltitude, flyDamp);
        if (Math.abs(d.altitude - d.goalAltitude) < 0.08) {
          d.altitude = d.goalAltitude;
          d.goalAltitude = null;
        }
      }
      if (d.goalPitch !== null) {
        d.pitch = THREE.MathUtils.lerp(d.pitch, d.goalPitch, flyDamp);
        if (Math.abs(d.pitch - d.goalPitch) < 0.005) {
          d.pitch = d.goalPitch;
          d.goalPitch = null;
        }
      }
      if (d.goalYaw !== null) {
        let diff = d.goalYaw - d.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        d.yaw += diff * flyDamp;
        if (Math.abs(diff) < 0.008) {
          d.yaw = d.goalYaw;
          d.goalYaw = null;
        }
      } else if (d.autoOrbit && !isDragging.current) {
        d.yaw += dt * 0.22;
      }

      _lookTarget.set(d.targetX, 1.5, d.targetZ);
      const lookDamp = 1 - Math.exp(-12 * dt);
      if (!initializedRef.current) {
        smoothedLookTarget.current.copy(_lookTarget);
      } else {
        smoothedLookTarget.current.lerp(_lookTarget, lookDamp);
      }

      const safePitch = THREE.MathUtils.clamp(d.pitch, 0.2, 1.46);
      const horiz = Math.max(2.5, (d.altitude - 1.5) / Math.tan(safePitch));
      const lt = smoothedLookTarget.current;

      _desiredCamPos.set(
        lt.x + Math.sin(d.yaw) * horiz,
        d.altitude,
        lt.z + Math.cos(d.yaw) * horiz
      );

      const camDamp = 1 - Math.exp(-10 * dt);
      if (!initializedRef.current) {
        currentCamPos.current.copy(_desiredCamPos);
        initializedRef.current = true;
      } else {
        currentCamPos.current.lerp(_desiredCamPos, camDamp);
      }

      camera.position.copy(currentCamPos.current);
      camera.lookAt(lt);

      if (onDroneTelemetry) {
        telemetryTimerRef.current += dt;
        if (telemetryTimerRef.current >= 0.1) {
          telemetryTimerRef.current = 0;
          const nextAlt = Math.round(d.altitude);
          const nextX = Math.round(d.targetX);
          const nextZ = Math.round(d.targetZ);
          const nextPitchDeg = Math.round(THREE.MathUtils.radToDeg(safePitch));
          const prev = lastTelemetryRef.current;
          if (
            prev.altitude !== nextAlt ||
            prev.x !== nextX ||
            prev.z !== nextZ ||
            prev.pitchDeg !== nextPitchDeg
          ) {
            lastTelemetryRef.current = {
              altitude: nextAlt,
              x: nextX,
              z: nextZ,
              pitchDeg: nextPitchDeg,
            };
            onDroneTelemetry(lastTelemetryRef.current);
          }
        }
      }
      return;
    }

    // Konsumsi delta kamera dari kontrol sentuh HP
    if (inputRef.current.camDeltaYaw !== 0 || inputRef.current.camDeltaPitch !== 0) {
      manualOrbitCooldownRef.current = 1.4;
      cameraOrbitRef.current.yaw -= inputRef.current.camDeltaYaw;
      cameraOrbitRef.current.pitch = THREE.MathUtils.clamp(
        cameraOrbitRef.current.pitch + inputRef.current.camDeltaPitch,
        0.15,
        1.15
      );
      inputRef.current.camDeltaYaw = 0;
      inputRef.current.camDeltaPitch = 0;
    }

    if (manualOrbitCooldownRef.current > 0) {
      manualOrbitCooldownRef.current = Math.max(0, manualOrbitCooldownRef.current - dt);
    }

    // Kamera kejar otomatis saat mengendarai kendaraan
    if (isDriving && vehicleHeadingRef && !isDragging.current && manualOrbitCooldownRef.current <= 0) {
      const vehSpeed = Math.abs(vehicleSpeedRef?.current ?? 0);
      if (vehSpeed > 0.65) {
        const behindYaw = vehicleHeadingRef.current + Math.PI;
        let yawDiff = behindYaw - cameraOrbitRef.current.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        cameraOrbitRef.current.yaw += yawDiff * (1 - Math.exp(-3.4 * dt));
      }
    }

    const { yaw, pitch, distance } = cameraOrbitRef.current;
    const t = targetRef.current;
    const vehSpeed = isDriving ? Math.abs(vehicleSpeedRef?.current ?? 0) : 0;
    const categoryBaseDist = isDriving ? (vehicleCategory === 'mobil' ? 8.8 : 6.5) : distance;
    const effectiveDistance = isDriving
      ? THREE.MathUtils.clamp(
          Math.max(categoryBaseDist, distance) + Math.min(2.2, vehSpeed * 0.1),
          5.2,
          17.5
        )
      : distance;
    const effectivePitch = isDriving
      ? THREE.MathUtils.clamp(pitch, vehicleCategory === 'mobil' ? 0.24 : 0.22, 0.95)
      : pitch;
    const lookHeight = isDriving ? (vehicleCategory === 'mobil' ? 1.65 : 1.4) : 1.3;

    _lookTarget.set(t.x, t.y + lookHeight, t.z);
    const lookJump = smoothedLookTarget.current.distanceTo(_lookTarget);
    const shouldSnap = !initializedRef.current || (lookJump > 12 && exitGlideTimerRef.current <= 0);
    if (shouldSnap) {
      smoothedLookTarget.current.copy(_lookTarget);
    } else {
      const lookSpeed = isDriving ? 26 : exitGlideTimerRef.current > 0 ? 9 : 22;
      const lookDamp = 1 - Math.exp(-lookSpeed * dt);
      smoothedLookTarget.current.lerp(_lookTarget, lookDamp);
    }

    const horiz = Math.cos(effectivePitch) * effectiveDistance;
    const vert = Math.sin(effectivePitch) * effectiveDistance;
    const lt = smoothedLookTarget.current;

    _desiredCamPos.set(
      lt.x + Math.sin(yaw) * horiz,
      lt.y + 0.05 + vert,
      lt.z + Math.cos(yaw) * horiz
    );

    if (shouldSnap) {
      currentCamPos.current.copy(_desiredCamPos);
      initializedRef.current = true;
    } else {
      const camSpeed = isDriving ? 20 : exitGlideTimerRef.current > 0 ? 8 : 18;
      const camDamp = 1 - Math.exp(-camSpeed * dt);
      currentCamPos.current.lerp(_desiredCamPos, camDamp);
    }

    camera.position.copy(currentCamPos.current);
    camera.lookAt(lt);
  }, 0);

  return null;
};
