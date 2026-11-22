import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getAssetEntry, type AssetFootprint } from '../../assets/assetManifest';
import type { GraphicsQuality } from '../../types/game';

interface GlbTemplateEntry {
  scene: THREE.Group;
  source: 'glb';
}

const glbProbeCache = new Map<string, Promise<GlbTemplateEntry | null>>();
const resolvedSourceRegistry = new Map<string, 'glb' | 'procedural'>();

let sharedGltfLoader: GLTFLoader | null = null;

function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    draco.preload();
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    sharedGltfLoader = loader;
  }
  return sharedGltfLoader;
}

function isGlbMagicHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  // Magic bytes "glTF" (little-endian 0x46546C67)
  return view.getUint32(0, true) === 0x46546c67;
}

/**
 * Mencoba memuat file GLB dari /public/models/{id}.glb.
 * Menggunakan validasi header biner agar fallback SPA index.html tidak ikut ter-parse.
 */
export function loadNormalizedGlbTemplate(
  assetId: string,
  targetFootprint?: AssetFootprint
): Promise<GlbTemplateEntry | null> {
  const entry = getAssetEntry(assetId);
  const glbUrl = entry?.glbPath ?? `/models/${assetId}.glb`;
  if (!glbUrl) {
    resolvedSourceRegistry.set(assetId, 'procedural');
    return Promise.resolve(null);
  }

  const cacheKey = `${assetId}:${glbUrl}`;
  const existing = glbProbeCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<GlbTemplateEntry | null> => {
    try {
      const response = await fetch(glbUrl, { method: 'GET' });
      if (!response.ok) {
        resolvedSourceRegistry.set(assetId, 'procedural');
        return null;
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        resolvedSourceRegistry.set(assetId, 'procedural');
        return null;
      }

      const buffer = await response.arrayBuffer();
      if (!isGlbMagicHeader(buffer)) {
        resolvedSourceRegistry.set(assetId, 'procedural');
        return null;
      }

      const loader = getGltfLoader();
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.parse(buffer, '', resolve, reject);
      });

      const root = new THREE.Group();
      const model = gltf.scene;
      root.add(model);

      // Normalisasi skala & pivot ke bottom-center sesuai footprint manifest
      const footprint = targetFootprint ?? entry?.footprint;
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = new THREE.Vector3();
      const rawCenter = new THREE.Vector3();
      rawBox.getSize(rawSize);
      rawBox.getCenter(rawCenter);

      if (footprint && footprint.width > 0 && footprint.depth > 0 && footprint.height > 0) {
        const sx = rawSize.x > 0.001 ? footprint.width / rawSize.x : 1;
        const sy = rawSize.y > 0.001 ? footprint.height / rawSize.y : 1;
        const sz = rawSize.z > 0.001 ? footprint.depth / rawSize.z : 1;
        const uniformScale = Math.min(sx, sy, sz);
        model.scale.multiplyScalar(uniformScale);
      }

      // Hitung ulang bounding box sesudah scale agar pivot tepat di tengah-bawah (y = 0)
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);

      model.position.x -= scaledCenter.x;
      model.position.z -= scaledCenter.z;
      model.position.y -= scaledBox.min.y;

      resolvedSourceRegistry.set(assetId, 'glb');
      return { scene: root, source: 'glb' };
    } catch {
      resolvedSourceRegistry.set(assetId, 'procedural');
      return null;
    }
  })();

  glbProbeCache.set(cacheKey, promise);
  return promise;
}

export function getResolvedAssetSource(assetId: string): 'glb' | 'procedural' {
  return resolvedSourceRegistry.get(assetId) ?? 'procedural';
}

export function resetGlbProbeCache(): void {
  glbProbeCache.clear();
  resolvedSourceRegistry.clear();
}

export interface AssetModelLoaderProps {
  assetId: string;
  quality?: GraphicsQuality;
  castShadow?: boolean;
  receiveShadow?: boolean;
  overrideFootprint?: AssetFootprint;
  enableLod?: boolean;
  playerPosRef?: React.MutableRefObject<THREE.Vector3>;
  worldPosition?: [number, number, number];
  children: React.ReactNode;
}

const QUALITY_LOD_MULTIPLIER: Record<GraphicsQuality, number> = {
  low: 0.65,
  medium: 0.85,
  high: 1.0,
};

/**
 * Wrapper aset terpusat: otomatis memakai /public/models/{assetId}.glb bila tersedia,
 * dengan normalisasi skala & pivot bottom-center, atau fallback mulus ke komponen prosedural.
 * Mendukung culling jarak (LOD) berbasis manifest untuk menjaga 30+ FPS di HP.
 */
export const AssetModelLoader: React.FC<AssetModelLoaderProps> = ({
  assetId,
  quality = 'medium',
  castShadow,
  receiveShadow = true,
  overrideFootprint,
  enableLod = false,
  playerPosRef,
  worldPosition,
  children,
}) => {
  const [glbTemplate, setGlbTemplate] = useState<THREE.Group | null>(null);
  const lodGroupRef = useRef<THREE.Group>(null);
  const frameSkipRef = useRef(0);

  const shouldCastShadow = castShadow ?? quality !== 'low';
  const entry = getAssetEntry(assetId);
  const cullRadius = useMemo(() => {
    const base = entry?.lodDistances?.cull ?? 180;
    return base * QUALITY_LOD_MULTIPLIER[quality];
  }, [entry, quality]);

  useEffect(() => {
    let mounted = true;
    loadNormalizedGlbTemplate(assetId, overrideFootprint).then((res) => {
      if (!mounted) return;
      if (res?.scene) {
        setGlbTemplate(res.scene);
      } else {
        setGlbTemplate(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [assetId, overrideFootprint]);

  const clonedGlb = useMemo(() => {
    if (!glbTemplate) return null;
    const copy = glbTemplate.clone(true);
    copy.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = shouldCastShadow;
        child.receiveShadow = receiveShadow;
      }
    });
    return copy;
  }, [glbTemplate, shouldCastShadow, receiveShadow]);

  useFrame(() => {
    if (!enableLod || !playerPosRef?.current || !lodGroupRef.current) return;
    frameSkipRef.current = (frameSkipRef.current + 1) % 6;
    if (frameSkipRef.current !== 0) return;

    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const ox = worldPosition ? worldPosition[0] : lodGroupRef.current.position.x;
    const oz = worldPosition ? worldPosition[2] : lodGroupRef.current.position.z;
    const dx = px - ox;
    const dz = pz - oz;
    const distSq = dx * dx + dz * dz;
    lodGroupRef.current.visible = distSq <= cullRadius * cullRadius;
  });

  return (
    <group ref={lodGroupRef}>
      {clonedGlb ? <primitive object={clonedGlb} /> : children}
    </group>
  );
};
