import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

class StorageService {
  private s3Client: S3Client | null = null;
  private localDir: string = config.STORAGE_PATH;

  constructor() {
    // Ensure local storage directory exists
    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }

    if (!config.MOCK_AWS) {
      if (!config.AWS.ACCESS_KEY_ID || !config.AWS.SECRET_ACCESS_KEY || !config.AWS.REGION || !config.AWS.S3_BUCKET) {
        console.error('[Storage] FATAL: Missing one or more required AWS S3 environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME).');
        process.exit(1);
      }

      try {
        this.s3Client = new S3Client({
          region: config.AWS.REGION,
          credentials: {
            accessKeyId: config.AWS.ACCESS_KEY_ID,
            secretAccessKey: config.AWS.SECRET_ACCESS_KEY,
          },
        });
        console.log('[Storage] AWS S3 Storage Initialized.');
      } catch (err) {
        console.error('[Storage] FATAL: Failed to initialize AWS S3 client.', err);
        process.exit(1);
      }
    } else {
      console.log('[Storage] Storage Initialized in Local Fallback mode.');
    }
  }

  /**
   * Uploads a file version to S3 (or saves locally)
   * Returns metadata including S3 Key and VersionId (if available)
   */
  public async uploadFileVersion(
    fileId: string,
    versionNumber: number,
    originalName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<{ s3Key: string; s3VersionId?: string }> {
    const ext = path.extname(originalName);
    const key = `vault/${fileId}_v${versionNumber}${ext}`;

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: config.AWS.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          // Always use STANDARD storage class (Free Tier eligible)
          StorageClass: 'STANDARD',
        });
        
        const response = await this.s3Client.send(command);
        return {
          s3Key: key,
          s3VersionId: response.VersionId || undefined,
        };
      } catch (err: any) {
        console.error(`[Storage] AWS S3 Upload failed for key ${key}:`, err.name || err.message);
        throw err; // Propagate exact AWS error to the controller to trigger rollback
      }
    }

    // Local Fallback Storage
    const localFilePath = path.join(this.localDir, `${fileId}_v${versionNumber}${ext}`);
    await fs.promises.writeFile(localFilePath, buffer);
    return {
      s3Key: localFilePath, // Store local path as the identifier
      s3VersionId: 'local-version-v' + versionNumber,
    };
  }

  /**
   * Retrieve a file stream for downloading or previewing
   */
  public async getFileVersionStream(s3Key: string): Promise<Readable | Buffer> {
    if (this.s3Client && s3Key.startsWith('vault/')) {
      try {
        const command = new GetObjectCommand({
          Bucket: config.AWS.S3_BUCKET,
          Key: s3Key,
        });
        const response = await this.s3Client.send(command);
        return response.Body as Readable;
      } catch (err: any) {
        console.error(`[Storage] AWS S3 Get failed for key ${s3Key}:`, err.name || err.message);
        throw err; // Propagate exact AWS error to the controller
      }
    }

    // Local Fallback Retrieval
    if (fs.existsSync(s3Key)) {
      return fs.readFileSync(s3Key);
    }
    
    // If it's a relative/absolute path that exists in our default storage directory
    const checkRelativePath = path.join(this.localDir, path.basename(s3Key));
    if (fs.existsSync(checkRelativePath)) {
      return fs.readFileSync(checkRelativePath);
    }

    throw new Error('File not found in S3 or local fallback storage.');
  }

  /**
   * Deletes a file from S3 / Local storage
   */
  public async deleteFileVersion(s3Key: string): Promise<void> {
    if (this.s3Client && s3Key.startsWith('vault/')) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: config.AWS.S3_BUCKET,
          Key: s3Key,
        });
        await this.s3Client.send(command);
        return;
      } catch (err) {
        console.error('[Storage] AWS S3 Delete failed, attempting local delete fallback', err);
      }
    }

    // Local Fallback Delete
    try {
      if (fs.existsSync(s3Key)) {
        await fs.promises.unlink(s3Key);
      } else {
        const checkRelativePath = path.join(this.localDir, path.basename(s3Key));
        if (fs.existsSync(checkRelativePath)) {
          await fs.promises.unlink(checkRelativePath);
        }
      }
    } catch (err) {
      console.warn('[Storage] File did not exist on local disk or couldn\'t be deleted:', err);
    }
  }

  /**
   * Scans local directory storage sizes (or queries S3 details if connected)
   */
  public async getStorageMetrics(): Promise<{ storageBytes: number; fileCount: number }> {
    let sizeBytes = 0;
    let count = 0;

    try {
      if (fs.existsSync(this.localDir)) {
        const files = await fs.promises.readdir(this.localDir);
        for (const file of files) {
          const stats = await fs.promises.stat(path.join(this.localDir, file));
          if (stats.isFile()) {
            sizeBytes += stats.size;
            count++;
          }
        }
      }
    } catch (err) {
      console.error('[Storage] Failed to calculate local folder sizes', err);
    }

    return {
      storageBytes: sizeBytes,
      fileCount: count,
    };
  }
}

export const storage = new StorageService();
export default storage;
