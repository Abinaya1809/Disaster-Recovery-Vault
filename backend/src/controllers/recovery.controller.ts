import { Response } from 'express';
import { PrismaClient, FileStatus, RecoveryStatus, RecoveryType, AuditAction, BackupStatus } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { storage } from '../services/storage.service';
import { audit } from '../services/audit.service';
import { sns } from '../services/sns.service';
import { monitor } from '../services/monitoring.service';

const prisma = new PrismaClient();

// List all soft-deleted files and folders (Trash)
export const getTrashList = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const folders = await prisma.folder.findMany({
      where: { ownerId: userId, status: FileStatus.DELETED },
      orderBy: { name: 'asc' },
    });

    const files = await prisma.file.findMany({
      where: { ownerId: userId, status: FileStatus.DELETED },
      orderBy: { name: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    return res.json({ folders, files });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve trash' });
  }
};

// Restore a soft-deleted item (file or folder)
export const restoreItem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { type } = req.body; // 'file' | 'folder'
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const startTime = Date.now();

    if (type === 'folder') {
      const folder = await prisma.folder.findFirst({
        where: { id, ownerId: userId, status: FileStatus.DELETED },
      });
      if (!folder) return res.status(404).json({ error: 'Folder not found or not in trash' });

      // Restore folder
      await prisma.folder.update({
        where: { id },
        data: { status: FileStatus.ACTIVE, updatedAt: new Date() },
      });

      // Recursively restore files that were in this folder
      await prisma.file.updateMany({
        where: { folderId: id, ownerId: userId, status: FileStatus.DELETED },
        data: { status: FileStatus.ACTIVE, deletedAt: null },
      });

      // Log recovery request
      await prisma.recoveryRequest.create({
        data: {
          requestedById: userId,
          folderId: id,
          status: RecoveryStatus.COMPLETED,
          type: RecoveryType.FOLDER,
          restorePath: folder.name,
          logSummary: `One-click restoration of folder: ${folder.name} and nested files.`,
        },
      });

      await audit.logAction(userId, 'RESTORE', `Restored folder: ${folder.name}`, req.ip);
    } else {
      const file = await prisma.file.findFirst({
        where: { id, ownerId: userId, status: FileStatus.DELETED },
      });
      if (!file) return res.status(404).json({ error: 'File not found or not in trash' });

      // Restore file
      await prisma.file.update({
        where: { id },
        data: { status: FileStatus.ACTIVE, deletedAt: null, updatedAt: new Date() },
      });

      // Log recovery request
      await prisma.recoveryRequest.create({
        data: {
          requestedById: userId,
          fileId: id,
          status: RecoveryStatus.COMPLETED,
          type: RecoveryType.FILE,
          restorePath: file.name,
          logSummary: `Restored soft-deleted file: ${file.name}.`,
        },
      });

      await audit.logAction(userId, 'RESTORE', `Restored file: ${file.name}`, req.ip);
    }

    // Monitor & Notification
    await monitor.recordRecoverySuccess();
    await sns.sendNotification(
      userId,
      'RECOVERY',
      'Recovery Completed',
      `Restoration successfully finalized. Deleted item ${type} has been restored to your active workspace.`
    );

    return res.json({ message: 'Item successfully restored from trash' });
  } catch (err: any) {
    await monitor.recordRecoveryFailure();
    return res.status(500).json({ error: err.message || 'Restoration failed' });
  }
};

// Permanently delete a file or folder (Purge from database and physical disks)
export const purgeItem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { type } = req.body; // 'file' | 'folder'
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (type === 'folder') {
      const folder = await prisma.folder.findFirst({ where: { id, ownerId: userId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      // Get all child files to delete physical versions from storage
      const files = await prisma.file.findMany({
        where: { folderId: id, ownerId: userId },
        include: { versions: true },
      });

      for (const file of files) {
        for (const version of file.versions) {
          await storage.deleteFileVersion(version.s3Key);
        }
      }

      await prisma.folder.delete({ where: { id } });
      await audit.logAction(userId, 'DELETE', `Permanently purged folder and nested files: ${folder.name}`, req.ip);
    } else {
      const file = await prisma.file.findFirst({
        where: { id, ownerId: userId },
        include: { versions: true },
      });
      if (!file) return res.status(404).json({ error: 'File not found' });

      // Delete physical versions from storage
      for (const version of file.versions) {
        await storage.deleteFileVersion(version.s3Key);
      }

      await prisma.file.delete({ where: { id } });
      await audit.logAction(userId, 'DELETE', `Permanently purged file: ${file.name}`, req.ip);
    }

    return res.json({ message: 'Item permanently deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Purging failed' });
  }
};

// List all versions of a specific file
export const getFileVersions = async (req: AuthRequest, res: Response) => {
  const { fileId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: userId },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
      include: {
        createdBy: {
          select: { email: true },
        },
        backups: true,
      },
    });

    return res.json({ file, versions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list versions' });
  }
};

// Restore a historical version of a file
export const rollbackVersion = async (req: AuthRequest, res: Response) => {
  const { fileId, versionId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: userId },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const sourceVersion = await prisma.fileVersion.findFirst({
      where: { id: versionId, fileId },
    });
    if (!sourceVersion) return res.status(404).json({ error: 'Source version not found' });

    // Fetch historical version payload stream/buffer
    const payload = await storage.getFileVersionStream(sourceVersion.s3Key);
    let buffer: Buffer;

    if (payload instanceof Buffer) {
      buffer = payload;
    } else {
      // Stream helper to load into buffer
      const chunks: any[] = [];
      for await (const chunk of payload) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }

    // Get current version count to increment
    const latestVersion = await prisma.fileVersion.findFirst({
      where: { fileId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Save as new version clone
    const uploadResult = await storage.uploadFileVersion(
      fileId,
      nextVersionNumber,
      file.name,
      buffer,
      file.mimeType
    );

    // Save FileVersion database entry
    const newVersion = await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber: nextVersionNumber,
        size: sourceVersion.size,
        s3Key: uploadResult.s3Key,
        s3VersionId: uploadResult.s3VersionId || null,
        createdById: userId,
      },
    });

    // Create Backup log
    await prisma.backup.create({
      data: {
        fileVersionId: newVersion.id,
        status: BackupStatus.COMPLETED,
        s3Bucket: process.env.AWS_S3_BUCKET || 'dr-vault-backups-free-tier',
        s3Key: uploadResult.s3Key,
        storageClass: 'STANDARD',
        lastBackupTime: new Date(),
      },
    });

    // Update parent file properties
    await prisma.file.update({
      where: { id: fileId },
      data: {
        size: sourceVersion.size,
        updatedAt: new Date(),
      },
    });

    // Record recovery request
    await prisma.recoveryRequest.create({
      data: {
        requestedById: userId,
        fileId,
        fileVersionId: newVersion.id,
        status: RecoveryStatus.COMPLETED,
        type: RecoveryType.FILE,
        restorePath: file.name,
        logSummary: `Rolled back file: ${file.name} to version ${sourceVersion.versionNumber} (New v${nextVersionNumber} created).`,
      },
    });

    await audit.logAction(
      userId,
      'RESTORE',
      `Rolled back file ${file.name} to version ${sourceVersion.versionNumber}`,
      req.ip
    );

    await monitor.recordRecoverySuccess();
    await sns.sendNotification(
      userId,
      'RECOVERY',
      'Version Rolled Back',
      `File ${file.name} has been rolled back. Version ${sourceVersion.versionNumber} cloned as new version ${nextVersionNumber}.`
    );

    return res.json({ message: `Successfully rolled back to version ${sourceVersion.versionNumber}` });
  } catch (err: any) {
    await monitor.recordRecoveryFailure();
    return res.status(500).json({ error: err.message || 'Rollback version failed' });
  }
};

// Retrieve historical Disaster Recovery logs
export const getRecoveryLogs = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const recoveryRequests = await prisma.recoveryRequest.findMany({
      where: { requestedById: userId },
      include: {
        file: true,
        folder: true,
        fileVersion: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(recoveryRequests);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch recovery logs' });
  }
};
