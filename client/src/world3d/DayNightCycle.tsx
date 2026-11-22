import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameConfigDoc, GraphicsQuality, ZoneId } from '../types/game';
import { getGameClockInfo } from '../firebase/gameTime';
import { getPaletteMaterial } from './assets/paletteMaterials';
import type { WeatherKind } from './assets/WeatherEffects3D';

// Ref: /assets/aistudio/Low-poly_Indonesian_train_station_71fe8a4d_7732d0f7.jpg

interface DayNightCycleProps {
  serverOffsetMs: number;
  gameConfig: GameConfigDoc;
  quality: GraphicsQuality;
  currentZone?: ZoneId;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  droneMode?: boolean;
  weather?: WeatherKind;
  /** Offset jam opsional untuk debug/preview cepat (dalam jam, default 0) */
  timeOverrideHour?: number | null;
}

// Palet 4 Waktu resmi dari STYLE_GUIDE.md
const SKY_NIGHT = new THREE.Color('#161E38');
const FOG_NIGHT = new THREE.Color('#222C4D');
const SKY_DAWN = new THREE.Color('#B5D2E8');
const FOG_DAWN = new THREE.Color('#EFE2DB');
const SKY_DAY = new THREE.Color('#4AB8F2');
const FOG_DAY = new THREE.Color('#C9E8FA');
const SKY_DUSK = new THREE.Color('#8F73AD');
const FOG_DUSK = new THREE.Color('#F7A664');

const SUN_DAY_COLOR = new THREE.Color('#FFF5DC');
const SUN_DAWN_COLOR = new THREE.Color('#F7CCA4');
const SUN_DUSK_COLOR = new THREE.Color('#FF9C52');
const MOON_COLOR = new THREE.Color('#6078A8');

const HEMI_SKY_DAY = new THREE.Color('#B5E2FA');
const HEMI_SKY_DAWN = new THREE.Color('#DCE8F5');
const HEMI_SKY_DUSK = new THREE.Color('#C58FA6');
const HEMI_SKY_NIGHT = new THREE.Color('#243054');

const HEMI_GROUND_DAY = new THREE.Color('#7D9B5E');
const HEMI_GROUND_DAWN = new THREE.Color('#8E8078');
const HEMI_GROUND_DUSK = new THREE.Color('#6F5347');
const HEMI_GROUND_NIGHT = new THREE.Color('#181A26');

const AMBIENT_DAY = new THREE.Color('#DCE6F7');
const AMBIENT_DUSK = new THREE.Color('#A892B0');
const AMBIENT_NIGHT = new THREE.Color('#4E5B75');

const CLOUD_DAY = new THREE.Color('#FAF6F0');
const CLOUD_DUSK = new THREE.Color('#F9C9A7');
const CLOUD_NIGHT = new THREE.Color('#2E3B63');
const CLOUD_RAIN = new THREE.Color('#7C8FA3');

const SKY_RAIN = new THREE.Color('#6F859E');
const FOG_RAIN = new THREE.Color('#9BB0C4');
const SUN_RAIN = new THREE.Color('#B8C7D6');
const HEMI_SKY_RAIN = new THREE.Color('#8AA0B8');
const HEMI_GROUND_RAIN = new THREE.Color('#566370');

const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _lightColor = new THREE.Color();
const _hemiSkyColor = new THREE.Color();
const _hemiGroundColor = new THREE.Color();
const _ambientColor = new THREE.Color();
const _cloudColor = new THREE.Color();

export const STREET_LAMP_POSITIONS: [number, number, number][] = [
  [-9.2, 0, -1.2],
  [9.2, 0, -1.2],
  [-9.2, 0, 13.2],
  [9.2, 0, 13.2],
  [-12.5, 0, -46.5],
  [12.5, 0, -46.5],
];

const CLOUD_SPECS: { pos: [number, number, number]; scale: number; speed: number }[] = [
  { pos: [-55, 36, -85], scale: 1.3, speed: 0.45 },
  { pos: [-12, 42, -98], scale: 1.6, speed: 0.32 },
  { pos: [42, 38, -90], scale: 1.4, speed: 0.4 },
  { pos: [88, 35, -72], scale: 1.2, speed: 0.36 },
  { pos: [-82, 34, -45], scale: 1.15, speed: 0.42 },
];

const HUB_POINT_LIGHTS_CICALENGKA: { pos: [number, number, number]; distance: number; weight: number }[] = [
  { pos: [0, 6.8, 6], distance: 48, weight: 3.4 },
  { pos: [0, 6.8, -48], distance: 52, weight: 3.6 },
  { pos: [38, 6.8, -8], distance: 50, weight: 3.4 },
  { pos: [-42, 6.8, -4], distance: 50, weight: 3.4 },
  { pos: [-6, 6.8, 36], distance: 48, weight: 3.0 },
];

const HUB_POINT_LIGHTS_LOW: { pos: [number, number, number]; distance: number; weight: number }[] = [
  { pos: [0, 8, 2], distance: 68, weight: 3.6 },
  { pos: [0, 8, -48], distance: 58, weight: 3.4 },
];

const HUB_POINT_LIGHTS_DEST: { pos: [number, number, number]; distance: number; weight: number }[] = [
  { pos: [0, 7, -44], distance: 52, weight: 3.6 },
  { pos: [0, 7, -12], distance: 56, weight: 3.4 },
];

export const DayNightCycle: React.FC<DayNightCycleProps> = ({
  serverOffsetMs,
  gameConfig,
  quality,
  currentZone = 'cicalengka',
  playerPosRef,
  droneMode = false,
  weather = 'cerah',
  timeOverrideHour = null,
}) => {
  const { scene, gl } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const sunMeshRef = useRef<THREE.Mesh>(null);
  const moonMeshRef = useRef<THREE.Mesh>(null);
  const starsMatRef = useRef<THREE.PointsMaterial>(null);
  const lampBulbRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const hubLightRefs = useRef<(THREE.PointLight | null)[]>([]);
  const playerLightRef = useRef<THREE.PointLight>(null);
  const cloudGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const fogNearRef = useRef(60);
  const fogFarRef = useRef(175);

  const shadowMapSize = quality === 'high' ? 1024 : quality === 'medium' ? 512 : 256;
  const castShadows = quality !== 'low';

  const postMat = getPaletteMaterial('trim_colonial_green');
  const plinthMat = getPaletteMaterial('wall_plinth_grey');
  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#FAF6F0',
        roughness: 0.92,
        metalness: 0.0,
        flatShading: true,
      }),
    []
  );

  const fog = useMemo(() => new THREE.Fog('#C9E8FA', 58, 175), []);
  scene.fog = fog;

  const starGeometry = useMemo(() => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = ((i * 137.508) % 360) * (Math.PI / 180);
      const phi = Math.acos(0.18 + ((i * 29) % 82) / 100);
      const r = 135;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const hubLights = useMemo(() => {
    if (currentZone !== 'cicalengka') return HUB_POINT_LIGHTS_DEST;
    return quality === 'low' ? HUB_POINT_LIGHTS_LOW : HUB_POINT_LIGHTS_CICALENGKA;
  }, [currentZone, quality]);

  useFrame((_, delta) => {
    const serverNow = Date.now() + serverOffsetMs;
    const clock = getGameClockInfo(serverNow, gameConfig);

    const dayProgress =
      timeOverrideHour !== null
        ? (((timeOverrideHour % 24) + 24) % 24) / 24
        : clock.dayProgress;

    // 0.25 = 06:00 (terbit), 0.5 = 12:00 (puncak), 0.75 = 18:00 (terbenam)
    const sunAngle = (dayProgress - 0.25) * Math.PI * 2;
    const orbitRadius = 78;
    const sunX = Math.cos(sunAngle) * orbitRadius;
    const sunY = Math.sin(sunAngle) * orbitRadius;
    // Sudut cahaya isometrik 3/4 dari depan-kiri-atas agar sisi depan hangat & sisi samping berbayangan
    const sunZ = -26;

    if (sunMeshRef.current) {
      sunMeshRef.current.position.set(sunX, sunY, sunZ);
      sunMeshRef.current.visible = sunY > -8;
    }
    if (moonMeshRef.current) {
      moonMeshRef.current.position.set(-sunX, -sunY, sunZ);
      moonMeshRef.current.visible = -sunY > -8;
    }

    const elevation = Math.sin(sunAngle); // -1 malam .. +1 siang
    const nightFactor = THREE.MathUtils.clamp((0.06 - elevation) / 0.28, 0, 1);
    const isMorningSide = sunX >= 0;
    const horizonSky = isMorningSide ? SKY_DAWN : SKY_DUSK;
    const horizonFog = isMorningSide ? FOG_DAWN : FOG_DUSK;
    const horizonSun = isMorningSide ? SUN_DAWN_COLOR : SUN_DUSK_COLOR;
    const horizonHemiSky = isMorningSide ? HEMI_SKY_DAWN : HEMI_SKY_DUSK;
    const horizonHemiGround = isMorningSide ? HEMI_GROUND_DAWN : HEMI_GROUND_DUSK;

    if (elevation > 0.28) {
      _skyColor.copy(SKY_DAY);
      _fogColor.copy(FOG_DAY);
      _hemiSkyColor.copy(HEMI_SKY_DAY);
      _hemiGroundColor.copy(HEMI_GROUND_DAY);
      _ambientColor.copy(AMBIENT_DAY);
      _cloudColor.copy(CLOUD_DAY);
    } else if (elevation > -0.06) {
      const t = THREE.MathUtils.clamp((elevation + 0.06) / 0.34, 0, 1);
      _skyColor.lerpColors(horizonSky, SKY_DAY, t);
      _fogColor.lerpColors(horizonFog, FOG_DAY, t);
      _hemiSkyColor.lerpColors(horizonHemiSky, HEMI_SKY_DAY, t);
      _hemiGroundColor.lerpColors(horizonHemiGround, HEMI_GROUND_DAY, t);
      _ambientColor.lerpColors(AMBIENT_DUSK, AMBIENT_DAY, t);
      _cloudColor.lerpColors(isMorningSide ? CLOUD_DAY : CLOUD_DUSK, CLOUD_DAY, t);
    } else {
      const t = THREE.MathUtils.clamp((elevation + 0.32) / 0.26, 0, 1);
      _skyColor.lerpColors(SKY_NIGHT, horizonSky, t);
      _fogColor.lerpColors(FOG_NIGHT, horizonFog, t);
      _hemiSkyColor.lerpColors(HEMI_SKY_NIGHT, horizonHemiSky, t);
      _hemiGroundColor.lerpColors(HEMI_GROUND_NIGHT, horizonHemiGround, t);
      _ambientColor.lerpColors(AMBIENT_NIGHT, AMBIENT_DUSK, t);
      _cloudColor.lerpColors(CLOUD_NIGHT, isMorningSide ? CLOUD_DAY : CLOUD_DUSK, t);
    }

    const rainMix = weather === 'hujan_deras' ? 0.82 : weather === 'gerimis' ? 0.44 : 0;
    if (rainMix > 0) {
      const skyMix = rainMix * (1 - nightFactor * 0.65);
      _skyColor.lerp(SKY_RAIN, skyMix);
      _fogColor.lerp(FOG_RAIN, skyMix);
      _hemiSkyColor.lerp(HEMI_SKY_RAIN, skyMix);
      _hemiGroundColor.lerp(HEMI_GROUND_RAIN, skyMix);
      _cloudColor.lerp(CLOUD_RAIN, rainMix * 0.85);
    }

    scene.background = _skyColor;
    fog.color.copy(_fogColor);
    const rainFogScale = 1 - rainMix * 0.28;
    const targetNear = droneMode
      ? THREE.MathUtils.lerp(145, 165, nightFactor)
      : THREE.MathUtils.lerp(60, 72, nightFactor) * rainFogScale;
    const targetFar = droneMode
      ? THREE.MathUtils.lerp(310, 360, nightFactor)
      : THREE.MathUtils.lerp(172, 210, nightFactor) * rainFogScale;
    const fogDamp = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    fogNearRef.current = THREE.MathUtils.lerp(fogNearRef.current, targetNear, fogDamp);
    fogFarRef.current = THREE.MathUtils.lerp(fogFarRef.current, targetFar, fogDamp);
    fog.near = fogNearRef.current;
    fog.far = fogFarRef.current;
    cloudMat.color.copy(_cloudColor);

    gl.toneMappingExposure = THREE.MathUtils.lerp(1.06, 1.24, nightFactor);

    // 1 Directional Light utama (Matahari hangat saat siang/sore, Bulan kebiruan saat malam)
    if (dirLightRef.current) {
      if (elevation >= -0.02) {
        // Jaga posisi cahaya dominan 3/4 dari kiri-depan-atas saat siang agar shading bangunan mirip diorama referensi
        const blendedX = THREE.MathUtils.lerp(-42, sunX * 0.7, 0.45);
        dirLightRef.current.position.set(blendedX, Math.max(18, sunY), 28);
        const dayRatio = THREE.MathUtils.clamp((elevation + 0.02) / 0.5, 0, 1);
        _lightColor.lerpColors(horizonSun, SUN_DAY_COLOR, dayRatio);
        if (rainMix > 0) _lightColor.lerp(SUN_RAIN, rainMix * 0.8);
        dirLightRef.current.color.copy(_lightColor);
        dirLightRef.current.intensity = (0.72 + dayRatio * 0.98) * (1 - rainMix * 0.38);
      } else {
        dirLightRef.current.position.set(-34, Math.max(24, -sunY), 22);
        dirLightRef.current.color.copy(MOON_COLOR);
        dirLightRef.current.intensity = THREE.MathUtils.lerp(0.55, 0.78, nightFactor) * (1 - rainMix * 0.25);
      }
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.color.copy(_hemiSkyColor);
      hemiLightRef.current.groundColor.copy(_hemiGroundColor);
      hemiLightRef.current.intensity =
        elevation >= 0
          ? 0.68 + elevation * 0.18
          : THREE.MathUtils.lerp(0.66, 0.44, nightFactor);
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.color.copy(_ambientColor);
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(0.22, 0.42, nightFactor) + rainMix * 0.08;
    }

    if (starsMatRef.current) {
      starsMatRef.current.opacity = Math.max(0, (nightFactor - 0.25) / 0.75) * 0.85 * (1 - rainMix);
    }

    // Nyalakan lampu jalan & penerangan hangat (#FFBE55) otomatis saat sore/malam atau saat hujan deras
    const lampGlow = Math.max(
      THREE.MathUtils.clamp((0.14 - elevation) / 0.24, 0, 1),
      rainMix * 0.75
    );
    for (const mat of lampBulbRefs.current) {
      if (mat) {
        mat.emissiveIntensity = 0.12 + lampGlow * 2.8;
      }
    }

    for (let i = 0; i < hubLights.length; i++) {
      const light = hubLightRefs.current[i];
      if (light) {
        light.intensity = lampGlow * hubLights[i].weight;
      }
    }

    if (playerLightRef.current && playerPosRef?.current) {
      playerLightRef.current.position.set(
        playerPosRef.current.x,
        playerPosRef.current.y + 4.2,
        playerPosRef.current.z
      );
      playerLightRef.current.intensity = lampGlow * 1.5;
    }

    // Gerakkan awan low-poly perlahan di langit
    for (let i = 0; i < CLOUD_SPECS.length; i++) {
      const grp = cloudGroupRefs.current[i];
      if (grp) {
        grp.position.x += CLOUD_SPECS[i].speed * delta;
        if (grp.position.x > 125) grp.position.x = -125;
      }
    }
  });

  return (
    <group>
      <ambientLight ref={ambientLightRef} color="#DCE6F7" intensity={0.22} />
      <hemisphereLight ref={hemiLightRef} args={['#B5E2FA', '#7D9B5E', 0.72]} />

      <directionalLight
        ref={dirLightRef}
        position={[-42, 55, 28]}
        intensity={1.55}
        castShadow={castShadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={170}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />

      {/* Bintang Malam */}
      <points geometry={starGeometry} frustumCulled={false}>
        <pointsMaterial
          ref={starsMatRef}
          color="#EFE2DB"
          size={1.25}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>

      {/* Matahari & Bulan Low-Poly */}
      <mesh ref={sunMeshRef}>
        <icosahedronGeometry args={[3.8, 1]} />
        <meshBasicMaterial color="#FFF5DC" />
      </mesh>
      <mesh ref={moonMeshRef}>
        <icosahedronGeometry args={[3.0, 1]} />
        <meshBasicMaterial color="#DCE8F5" />
      </mesh>

      {/* Awan Puffy Low-Poly Tropis */}
      {quality !== 'low' &&
        CLOUD_SPECS.map((cloud, idx) => (
          <group
            key={idx}
            ref={(el) => {
              cloudGroupRefs.current[idx] = el;
            }}
            position={cloud.pos}
            scale={cloud.scale}
          >
            <mesh position={[0, 0, 0]} material={cloudMat}>
              <icosahedronGeometry args={[2.8, 1]} />
            </mesh>
            <mesh position={[-2.4, -0.45, 0.2]} material={cloudMat}>
              <icosahedronGeometry args={[2.0, 1]} />
            </mesh>
            <mesh position={[2.4, -0.35, -0.2]} material={cloudMat}>
              <icosahedronGeometry args={[2.1, 1]} />
            </mesh>
          </group>
        ))}

      {/* Lampu Penerangan Area Utama Saat Malam (tanpa shadow demi FPS HP) */}
      {hubLights.map((hub, idx) => (
        <pointLight
          key={`${currentZone}-hub-${idx}`}
          ref={(el) => {
            hubLightRefs.current[idx] = el;
          }}
          position={hub.pos}
          color="#FFBE55"
          distance={hub.distance}
          decay={1}
          intensity={0}
        />
      ))}

      {/* Penerangan Lembut Mengikuti Pemain Saat Malam */}
      <pointLight
        ref={playerLightRef}
        position={[0, 5, 0]}
        color="#FFBE55"
        distance={28}
        decay={1}
        intensity={0}
      />

      {/* Tiang Lampu Jalan Kolonial Cicalengka */}
      {currentZone === 'cicalengka' &&
        STREET_LAMP_POSITIONS.map((pos, idx) => (
          <group key={idx} position={pos}>
            <mesh position={[0, 0.25, 0]} material={plinthMat}>
              <cylinderGeometry args={[0.22, 0.28, 0.5, 6]} />
            </mesh>
            <mesh position={[0, 2.35, 0]} material={postMat} castShadow={quality === 'high'}>
              <cylinderGeometry args={[0.09, 0.13, 4.2, 6]} />
            </mesh>
            <mesh position={[0, 4.68, 0]} material={postMat}>
              <coneGeometry args={[0.42, 0.24, 6]} />
            </mesh>
            <mesh position={[0, 4.46, 0]}>
              <boxGeometry args={[0.38, 0.36, 0.38]} />
              <meshStandardMaterial
                ref={(el) => {
                  lampBulbRefs.current[idx] = el;
                }}
                color="#FFF5DC"
                emissive="#FFBE55"
                emissiveIntensity={0.15}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}
    </group>
  );
};
