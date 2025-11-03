import { describe, it, expect } from 'vitest';
import { calculateDependenciesHash, extractImageCacheConfig, shouldCacheImage } from './imageCache';
import { ContainerConfig } from './docker';

describe('imageCache', () => {
  describe('calculateDependenciesHash', () => {
    it('should generate consistent hash for same configuration', () => {
      const config1 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['express', 'typescript'],
        pipPackages: ['numpy', 'pandas'],
        aptPackages: ['git', 'curl'],
      };

      const config2 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['express', 'typescript'],
        pipPackages: ['numpy', 'pandas'],
        aptPackages: ['git', 'curl'],
      };

      const hash1 = calculateDependenciesHash(config1);
      const hash2 = calculateDependenciesHash(config2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different configurations', () => {
      const config1 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['express'],
      };

      const config2 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['typescript'],
      };

      const hash1 = calculateDependenciesHash(config1);
      const hash2 = calculateDependenciesHash(config2);

      expect(hash1).not.toBe(hash2);
    });

    it('should sort arrays to ensure order independence', () => {
      const config1 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['express', 'typescript', 'zod'],
      };

      const config2 = {
        baseImage: 'ubuntu:22.04',
        npmPackages: ['zod', 'express', 'typescript'],
      };

      const hash1 = calculateDependenciesHash(config1);
      const hash2 = calculateDependenciesHash(config2);

      expect(hash1).toBe(hash2);
    });

    it('should handle empty dependencies', () => {
      const config = {
        baseImage: 'ubuntu:22.04',
      };

      const hash = calculateDependenciesHash(config);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should include system config in hash', () => {
      const config1 = {
        baseImage: 'ubuntu:22.04',
        systemConfig: { NODE_ENV: 'production' },
      };

      const config2 = {
        baseImage: 'ubuntu:22.04',
        systemConfig: { NODE_ENV: 'development' },
      };

      const hash1 = calculateDependenciesHash(config1);
      const hash2 = calculateDependenciesHash(config2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('extractImageCacheConfig', () => {
    it('should extract base configuration from ContainerConfig', () => {
      const containerConfig: ContainerConfig = {
        image: 'claude-code:latest',
        resources: {
          memory: 2048,
          cpus: 2,
          timeout: 3600,
        },
        environment: {
          NODE_ENV: 'production',
          API_KEY: 'secret',
        },
        workingDir: '/workspace',
      };

      const cacheConfig = extractImageCacheConfig(containerConfig);

      expect(cacheConfig.baseImage).toBe('claude-code:latest');
      expect(cacheConfig.systemConfig?.environment).toEqual(containerConfig.environment);
      expect(cacheConfig.systemConfig?.workingDir).toBe('/workspace');
    });

    it('should handle minimal configuration', () => {
      const containerConfig: ContainerConfig = {
        image: 'ubuntu:22.04',
        resources: {
          memory: 1024,
          cpus: 1,
          timeout: 1800,
        },
      };

      const cacheConfig = extractImageCacheConfig(containerConfig);

      expect(cacheConfig.baseImage).toBe('ubuntu:22.04');
      expect(cacheConfig.npmPackages).toEqual([]);
      expect(cacheConfig.pipPackages).toEqual([]);
      expect(cacheConfig.aptPackages).toEqual([]);
    });
  });

  describe('shouldCacheImage', () => {
    it('should return true for cacheable configurations', () => {
      const config: ContainerConfig = {
        image: 'claude-code:latest',
        resources: {
          memory: 2048,
          cpus: 2,
          timeout: 3600,
        },
      };

      expect(shouldCacheImage(config)).toBe(true);
    });

    it('should return false when NO_CACHE is set', () => {
      const config: ContainerConfig = {
        image: 'claude-code:latest',
        resources: {
          memory: 2048,
          cpus: 2,
          timeout: 3600,
        },
        environment: {
          NO_CACHE: 'true',
        },
      };

      expect(shouldCacheImage(config)).toBe(false);
    });

    it('should return true when NO_CACHE is false', () => {
      const config: ContainerConfig = {
        image: 'claude-code:latest',
        resources: {
          memory: 2048,
          cpus: 2,
          timeout: 3600,
        },
        environment: {
          NO_CACHE: 'false',
        },
      };

      expect(shouldCacheImage(config)).toBe(true);
    });
  });
});
