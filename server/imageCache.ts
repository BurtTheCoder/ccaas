import { createHash } from 'crypto';
import { ContainerConfig } from './docker';
import * as db from './db';
import { InsertContainerImageCache, InsertImageDependency } from '../drizzle/schema';
import { nanoid } from 'nanoid';

export interface ImageCacheConfig {
  baseImage: string;
  npmPackages?: string[];
  pipPackages?: string[];
  aptPackages?: string[];
  systemConfig?: Record<string, any>;
  claudeCodeVersion?: string;
}

export interface CachedImage {
  imageId: string;
  tag: string;
  dependenciesHash: string;
  size: number;
  createdAt: Date;
  lastUsedAt: Date | null;
  cacheHits: number;
}

export interface ImageMetadata {
  imageId: string;
  tag: string;
  baseImage: string;
  size: number;
  dependencies: Array<{
    type: string;
    name: string;
    version?: string;
  }>;
  digestHash?: string;
  buildStatus: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  cacheHits: number;
}

/**
 * Calculate a hash of the container configuration and dependencies
 * This hash is used to determine if a pre-built image exists
 */
export function calculateDependenciesHash(config: ImageCacheConfig): string {
  const hashInput = {
    baseImage: config.baseImage,
    npmPackages: config.npmPackages?.sort() || [],
    pipPackages: config.pipPackages?.sort() || [],
    aptPackages: config.aptPackages?.sort() || [],
    systemConfig: config.systemConfig || {},
    claudeCodeVersion: config.claudeCodeVersion || 'latest',
  };

  const hash = createHash('sha256');
  hash.update(JSON.stringify(hashInput));
  return hash.digest('hex');
}

/**
 * Get cached image by dependencies hash
 * Returns null if no matching image found
 */
export async function getCachedImage(dependenciesHash: string): Promise<CachedImage | null> {
  const cached = await db.getContainerImageCacheByHash(dependenciesHash);

  if (!cached) {
    return null;
  }

  return {
    imageId: cached.imageId,
    tag: cached.tag,
    dependenciesHash: cached.dependenciesHash,
    size: cached.size,
    createdAt: cached.createdAt,
    lastUsedAt: cached.lastUsedAt,
    cacheHits: cached.cacheHits,
  };
}

/**
 * Get image metadata including dependencies
 */
export async function getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
  const cached = await db.getContainerImageCacheById(imageId);

  if (!cached) {
    return null;
  }

  const dependencies = await db.listImageDependencies(imageId);

  return {
    imageId: cached.imageId,
    tag: cached.tag,
    baseImage: cached.baseImage,
    size: cached.size,
    dependencies: dependencies.map(dep => ({
      type: dep.dependencyType,
      name: dep.packageName,
      version: dep.version || undefined,
    })),
    digestHash: cached.digestHash || undefined,
    buildStatus: cached.buildStatus,
    createdAt: cached.createdAt,
    lastUsedAt: cached.lastUsedAt,
    cacheHits: cached.cacheHits,
  };
}

/**
 * Save a newly built image to the cache
 */
export async function saveCachedImage(
  config: ImageCacheConfig,
  imageInfo: {
    tag: string;
    size: number;
    digestHash?: string;
  }
): Promise<string> {
  const dependenciesHash = calculateDependenciesHash(config);
  const imageId = nanoid();

  // Create the cache entry
  const cacheEntry: InsertContainerImageCache = {
    imageId,
    tag: imageInfo.tag,
    baseImage: config.baseImage,
    dependenciesHash,
    size: imageInfo.size,
    digestHash: imageInfo.digestHash,
    buildStatus: 'completed',
    metadata: {
      claudeCodeVersion: config.claudeCodeVersion,
      systemConfig: config.systemConfig,
    },
  };

  await db.createContainerImageCache(cacheEntry);

  // Save dependencies
  if (config.npmPackages && config.npmPackages.length > 0) {
    for (const pkg of config.npmPackages) {
      const [name, version] = pkg.includes('@') && !pkg.startsWith('@')
        ? pkg.split('@')
        : [pkg, undefined];

      await db.createImageDependency({
        imageId,
        dependencyType: 'npm',
        packageName: name,
        version,
      });
    }
  }

  if (config.pipPackages && config.pipPackages.length > 0) {
    for (const pkg of config.pipPackages) {
      const [name, version] = pkg.includes('==')
        ? pkg.split('==')
        : [pkg, undefined];

      await db.createImageDependency({
        imageId,
        dependencyType: 'pip',
        packageName: name,
        version,
      });
    }
  }

  if (config.aptPackages && config.aptPackages.length > 0) {
    for (const pkg of config.aptPackages) {
      const [name, version] = pkg.includes('=')
        ? pkg.split('=')
        : [pkg, undefined];

      await db.createImageDependency({
        imageId,
        dependencyType: 'apt',
        packageName: name,
        version,
      });
    }
  }

  return imageId;
}

/**
 * Record a cache hit when an image is used
 */
export async function recordCacheHit(imageId: string): Promise<void> {
  await db.recordImageCacheHit(imageId);
}

/**
 * Invalidate cache entries for a specific base image
 * This is useful when the base image is updated
 */
export async function invalidateCache(baseImage: string): Promise<void> {
  await db.invalidateImageCacheByBaseImage(baseImage);
}

/**
 * List all cached images
 */
export async function listCachedImages(limit: number = 100): Promise<ImageMetadata[]> {
  const images = await db.listContainerImageCache(limit);

  return Promise.all(
    images.map(async (img) => {
      const dependencies = await db.listImageDependencies(img.imageId);

      return {
        imageId: img.imageId,
        tag: img.tag,
        baseImage: img.baseImage,
        size: img.size,
        dependencies: dependencies.map(dep => ({
          type: dep.dependencyType,
          name: dep.packageName,
          version: dep.version || undefined,
        })),
        digestHash: img.digestHash || undefined,
        buildStatus: img.buildStatus,
        createdAt: img.createdAt,
        lastUsedAt: img.lastUsedAt,
        cacheHits: img.cacheHits,
      };
    })
  );
}

/**
 * Delete a cached image
 */
export async function deleteCachedImage(imageId: string): Promise<void> {
  await db.deleteContainerImageCache(imageId);
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  return await db.getImageCacheStats();
}

/**
 * Extract image cache config from ContainerConfig
 */
export function extractImageCacheConfig(config: ContainerConfig): ImageCacheConfig {
  // Parse the base image
  const baseImage = config.image || 'claude-code:latest';

  // For now, we'll use a simple config
  // In the future, this could be extended to parse Dockerfile or environment variables
  const cacheConfig: ImageCacheConfig = {
    baseImage,
    npmPackages: [],
    pipPackages: [],
    aptPackages: [],
    systemConfig: {
      environment: config.environment,
      workingDir: config.workingDir,
    },
  };

  return cacheConfig;
}

/**
 * Check if image should be cached based on configuration
 */
export function shouldCacheImage(config: ContainerConfig): boolean {
  // Don't cache if image is temporary or has unique characteristics
  if (config.environment?.NO_CACHE === 'true') {
    return false;
  }

  // Cache if there are custom dependencies or configurations
  return true;
}
