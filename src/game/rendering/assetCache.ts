import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

interface CacheEntry<T> {
  resource: T;
  refCount: number;
  dispose: () => void;
}

const geometryCache = new Map<string, CacheEntry<THREE.BufferGeometry>>();
const materialCache = new Map<string, CacheEntry<THREE.Material>>();
const textureCache = new Map<string, CacheEntry<THREE.Texture>>();

export function acquireGeometry<T extends THREE.BufferGeometry>(
  key: string,
  factory: () => T,
): T {
  const existing = geometryCache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.resource as T;
  }
  const resource = factory();
  if (!resource.boundingSphere) {
    resource.computeBoundingSphere();
  }
  geometryCache.set(key, {
    resource,
    refCount: 1,
    dispose: () => resource.dispose(),
  });
  return resource;
}

export function releaseGeometry(key: string): void {
  const entry = geometryCache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.dispose();
    geometryCache.delete(key);
  }
}

export function acquireMaterial<T extends THREE.Material>(
  key: string,
  factory: () => T,
): T {
  const existing = materialCache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.resource as T;
  }
  const resource = factory();
  materialCache.set(key, {
    resource,
    refCount: 1,
    dispose: () => resource.dispose(),
  });
  return resource;
}

export function releaseMaterial(key: string): void {
  const entry = materialCache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.dispose();
    materialCache.delete(key);
  }
}

export function acquireTexture<T extends THREE.Texture>(
  key: string,
  factory: () => T,
): T {
  const existing = textureCache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.resource as T;
  }
  const resource = factory();
  textureCache.set(key, {
    resource,
    refCount: 1,
    dispose: () => resource.dispose(),
  });
  return resource;
}

export function releaseTexture(key: string): void {
  const entry = textureCache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.dispose();
    textureCache.delete(key);
  }
}

export function useCachedGeometry<T extends THREE.BufferGeometry>(
  key: string,
  factory: () => T,
): T {
  const geo = useMemo(() => acquireGeometry(key, factory), [key]);
  useEffect(() => {
    return () => {
      releaseGeometry(key);
    };
  }, [key]);
  return geo;
}

export function useCachedMaterial<T extends THREE.Material>(
  key: string,
  factory: () => T,
): T {
  const mat = useMemo(() => acquireMaterial(key, factory), [key]);
  useEffect(() => {
    return () => {
      releaseMaterial(key);
    };
  }, [key]);
  return mat;
}

export function useCachedTexture<T extends THREE.Texture>(
  key: string,
  factory: () => T,
): T {
  const tex = useMemo(() => acquireTexture(key, factory), [key]);
  useEffect(() => {
    return () => {
      releaseTexture(key);
    };
  }, [key]);
  return tex;
}

export interface AssetCacheStats {
  geometries: number;
  materials: number;
  textures: number;
  totalRefs: number;
}

export function getAssetCacheStats(): AssetCacheStats {
  let totalRefs = 0;
  for (const e of geometryCache.values()) totalRefs += e.refCount;
  for (const e of materialCache.values()) totalRefs += e.refCount;
  for (const e of textureCache.values()) totalRefs += e.refCount;
  return {
    geometries: geometryCache.size,
    materials: materialCache.size,
    textures: textureCache.size,
    totalRefs,
  };
}

export function clearAllCachedAssets(): void {
  for (const e of geometryCache.values()) e.dispose();
  for (const e of materialCache.values()) e.dispose();
  for (const e of textureCache.values()) e.dispose();
  geometryCache.clear();
  materialCache.clear();
  textureCache.clear();
}
