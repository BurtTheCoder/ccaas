import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ImageCacheConfig, saveCachedImage } from './imageCache';
import * as db from './db';
import { nanoid } from 'nanoid';

export interface BuildProgress {
  imageId: string;
  status: 'pending' | 'building' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  logs: string[];
}

export interface BuildResult {
  success: boolean;
  imageId: string;
  tag: string;
  size: number;
  digestHash?: string;
  error?: string;
  logs: string[];
}

/**
 * Build a Docker image with specified dependencies
 */
export async function buildImage(
  config: ImageCacheConfig,
  onProgress?: (progress: BuildProgress) => void
): Promise<BuildResult> {
  const imageId = nanoid();
  const tag = `claude-code-cached:${imageId}`;

  const buildLogs: string[] = [];
  let currentProgress = 0;

  const updateProgress = (status: BuildProgress['status'], step: string, progress: number) => {
    currentProgress = progress;
    buildLogs.push(`[${new Date().toISOString()}] ${step}`);

    if (onProgress) {
      onProgress({
        imageId,
        status,
        progress,
        currentStep: step,
        logs: [...buildLogs],
      });
    }
  };

  try {
    // Create temporary directory for build context
    const buildDir = join(tmpdir(), `docker-build-${imageId}`);
    await fs.mkdir(buildDir, { recursive: true });

    updateProgress('building', 'Generating Dockerfile', 10);

    // Generate Dockerfile
    const dockerfile = generateDockerfile(config);
    await fs.writeFile(join(buildDir, 'Dockerfile'), dockerfile);

    updateProgress('building', 'Building Docker image', 30);

    // Build the image
    const buildSuccess = await buildDockerImage(buildDir, tag, (log) => {
      buildLogs.push(log);
    });

    if (!buildSuccess) {
      updateProgress('failed', 'Build failed', 100);
      return {
        success: false,
        imageId,
        tag,
        size: 0,
        error: 'Docker build failed',
        logs: buildLogs,
      };
    }

    updateProgress('building', 'Getting image metadata', 80);

    // Get image size and digest
    const imageInfo = await getImageInfo(tag);

    updateProgress('building', 'Saving to cache', 90);

    // Save to cache
    await saveCachedImage(config, {
      tag,
      size: imageInfo.size,
      digestHash: imageInfo.digest,
    });

    // Cleanup build directory
    await fs.rm(buildDir, { recursive: true, force: true });

    updateProgress('completed', 'Build completed', 100);

    return {
      success: true,
      imageId,
      tag,
      size: imageInfo.size,
      digestHash: imageInfo.digest,
      logs: buildLogs,
    };
  } catch (error) {
    updateProgress('failed', `Error: ${error instanceof Error ? error.message : String(error)}`, 100);

    return {
      success: false,
      imageId,
      tag,
      size: 0,
      error: error instanceof Error ? error.message : String(error),
      logs: buildLogs,
    };
  }
}

/**
 * Generate Dockerfile content based on configuration
 */
function generateDockerfile(config: ImageCacheConfig): string {
  const lines: string[] = [];

  // Base image
  lines.push(`FROM ${config.baseImage}`);
  lines.push('');

  // Install system packages
  if (config.aptPackages && config.aptPackages.length > 0) {
    lines.push('# Install system packages');
    lines.push('RUN apt-get update && apt-get install -y \\');
    lines.push('    ' + config.aptPackages.join(' \\\n    '));
    lines.push('    && rm -rf /var/lib/apt/lists/*');
    lines.push('');
  }

  // Install npm packages
  if (config.npmPackages && config.npmPackages.length > 0) {
    lines.push('# Install npm packages globally');
    lines.push('RUN npm install -g \\');
    lines.push('    ' + config.npmPackages.join(' \\\n    '));
    lines.push('');
  }

  // Install pip packages
  if (config.pipPackages && config.pipPackages.length > 0) {
    lines.push('# Install pip packages');
    lines.push('RUN pip3 install \\');
    lines.push('    ' + config.pipPackages.join(' \\\n    '));
    lines.push('');
  }

  // Install specific Claude Code version if specified
  if (config.claudeCodeVersion && config.claudeCodeVersion !== 'latest') {
    lines.push('# Install specific Claude Code CLI version');
    lines.push(`RUN npm install -g @anthropic-ai/claude-code@${config.claudeCodeVersion}`);
    lines.push('');
  }

  // System configuration
  if (config.systemConfig) {
    lines.push('# System configuration');
    for (const [key, value] of Object.entries(config.systemConfig)) {
      if (key !== 'environment' && key !== 'workingDir') {
        lines.push(`# ${key}: ${JSON.stringify(value)}`);
      }
    }
    lines.push('');
  }

  // Default workspace
  lines.push('# Create workspace directory');
  lines.push('RUN mkdir -p /workspace');
  lines.push('WORKDIR /workspace');
  lines.push('');

  // Default command
  lines.push('CMD ["/bin/bash"]');

  return lines.join('\n');
}

/**
 * Build Docker image from build directory
 */
function buildDockerImage(
  buildDir: string,
  tag: string,
  onLog: (log: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['build', '-t', tag, '.'], {
      cwd: buildDir,
    });

    proc.stdout.on('data', (data) => {
      const log = data.toString();
      onLog(log);
      console.log('[Docker Build]', log);
    });

    proc.stderr.on('data', (data) => {
      const log = data.toString();
      onLog(log);
      console.error('[Docker Build Error]', log);
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    // Timeout after 30 minutes
    setTimeout(() => {
      proc.kill();
      onLog('Build timeout after 30 minutes');
      resolve(false);
    }, 30 * 60 * 1000);
  });
}

/**
 * Get image size and digest hash
 */
async function getImageInfo(tag: string): Promise<{ size: number; digest: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['inspect', tag]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to inspect image: ${stderr}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        if (info.length > 0) {
          const size = info[0].Size || 0;
          const digest = info[0].RepoDigests?.[0] || info[0].Id || '';

          resolve({
            size: Math.round(size / (1024 * 1024)), // Convert to MB
            digest,
          });
        } else {
          reject(new Error('No image info found'));
        }
      } catch (error) {
        reject(error);
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Image inspection timeout'));
    }, 10000);
  });
}

/**
 * Build images in the background with database tracking
 */
export async function buildImageInBackground(
  config: ImageCacheConfig
): Promise<string> {
  const imageId = nanoid();

  // Create initial database entry
  await db.createContainerImageCache({
    imageId,
    tag: `claude-code-cached:${imageId}`,
    baseImage: config.baseImage,
    dependenciesHash: '', // Will be updated after build
    size: 0,
    buildStatus: 'pending',
  });

  // Start build in background
  buildImage(config, async (progress) => {
    await db.updateContainerImageCache(imageId, {
      buildStatus: progress.status,
      buildLog: progress.logs.join('\n'),
    });
  }).then(async (result) => {
    if (result.success) {
      await db.updateContainerImageCache(imageId, {
        buildStatus: 'completed',
        size: result.size,
        digestHash: result.digestHash,
      });
    } else {
      await db.updateContainerImageCache(imageId, {
        buildStatus: 'failed',
        buildLog: result.logs.join('\n'),
      });
    }
  });

  return imageId;
}

/**
 * Check if Docker is available and ready to build
 */
export async function checkDockerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['version']);

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Remove a Docker image from the local registry
 */
export async function removeImage(tag: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['rmi', tag]);

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 10000);
  });
}

/**
 * Prune unused Docker images to free up space
 */
export async function pruneUnusedImages(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', ['image', 'prune', '-f']);

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Failed to prune images'));
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Prune timeout'));
    }, 30000);
  });
}
