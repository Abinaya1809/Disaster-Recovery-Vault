import { Response } from 'express';
import { PrismaClient, FileStatus, BackupStatus, BackupHealth } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { storage } from '../services/storage.service';
import { audit } from '../services/audit.service';
import { sns } from '../services/sns.service';
import { monitor } from '../services/monitoring.service';
import path from 'path';

const prisma = new PrismaClient();

// Create a folder
export const createFolder = async (req: AuthRequest, res: Response) => {
  const { name, parentId } = req.body;
  const ownerId = req.user?.id;

  if (!name || !ownerId) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  try {
    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        ownerId,
      },
    });

    await audit.logAction(ownerId, 'UPLOAD', `Created folder: ${name}`, req.ip, req.headers['user-agent']);
    return res.status(201).json(folder);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Folder creation failed' });
  }
};

// Upload file (single or multi handled by multer)
export const uploadFile = async (req: AuthRequest, res: Response) => {
  const ownerId = req.user?.id;
  const folderId = req.body.folderId || null;

  if (!req.file || !ownerId) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const fileData = req.file;
  const originalName = fileData.originalname;
  const size = fileData.size;
  const mimeType = fileData.mimetype;
  const startTime = Date.now();

  try {
    // Check if file with same name exists in this folder for this owner
    let file = await prisma.file.findFirst({
      where: {
        name: originalName,
        folderId: folderId || null,
        ownerId,
        status: FileStatus.ACTIVE,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    let versionNumber = 1;
    let fileId = '';
    let isNewFile = false;

    if (file) {
      // Increment version number
      fileId = file.id;
      if (file.versions.length > 0) {
        versionNumber = file.versions[0].versionNumber + 1;
      }
    } else {
      // Create new file row
      const newFile = await prisma.file.create({
        data: {
          name: originalName,
          originalName,
          size,
          mimeType,
          folderId: folderId || null,
          ownerId,
        },
      });
      fileId = newFile.id;
      isNewFile = true;
    }

    // Upload content to Storage (S3 / Local disk fallback)
    let uploadResult;
    try {
      uploadResult = await storage.uploadFileVersion(
        fileId,
        versionNumber,
        originalName,
        fileData.buffer,
        mimeType
      );
    } catch (uploadError: any) {
      // Rollback database if S3 upload fails
      if (isNewFile) {
        await prisma.file.delete({ where: { id: fileId } });
      }
      throw uploadError; // Trigger the outer catch block
    }

    console.log(`[Upload] Success:
File ID: ${fileId}
S3 Bucket: ${process.env.AWS_S3_BUCKET || 'default'}
S3 Key: ${uploadResult.s3Key}
Version ID: ${uploadResult.s3VersionId || 'N/A'}`);

    // Create File Version Record
    const versionRecord = await prisma.fileVersion.create({
      data: {
        fileId,
        versionNumber,
        size,
        s3Key: uploadResult.s3Key,
        s3VersionId: uploadResult.s3VersionId || null,
        createdById: ownerId,
      },
    });

    // Create Backup entry (Emulating automatic backup sync)
    const backupRecord = await prisma.backup.create({
      data: {
        fileVersionId: versionRecord.id,
        status: BackupStatus.COMPLETED, // Set immediately for simple demo flow
        s3Bucket: process.env.AWS_S3_BUCKET || 'dr-vault-backups-free-tier',
        s3Key: uploadResult.s3Key,
        storageClass: 'STANDARD',
        lastBackupTime: new Date(),
        backupHealth: BackupHealth.HEALTHY,
      },
    });

    // Update main File metadata
    await prisma.file.update({
      where: { id: fileId },
      data: {
        size,
        mimeType,
        updatedAt: new Date(),
      },
    });

    // Track Audit Log
    await audit.logAction(
      ownerId,
      'UPLOAD',
      `Uploaded file: ${originalName} (Version ${versionNumber}, Size ${size} bytes)`,
      req.ip,
      req.headers['user-agent']
    );

    // Record upload metrics
    const uploadDuration = Date.now() - startTime;
    await monitor.recordUploadTime(uploadDuration);
    await monitor.recordBackupSuccess();

    // Trigger SNS alert
    await sns.sendNotification(
      ownerId,
      'BACKUP',
      'Backup Completed',
      `File ${originalName} (v${versionNumber}) was successfully synchronized to the AWS S3 Backup vault.`
    );

    return res.status(201).json({
      message: 'File uploaded and backed up successfully',
      fileId,
      versionNumber,
      backupId: backupRecord.id,
    });
  } catch (err: any) {
    await monitor.recordBackupFailure();
    console.error(`[Upload Endpoint] Failed to upload: ${err.message}`);
    return res.status(500).json({ error: err.message || 'File upload failed due to server error' });
  }
};

// List files and folders in a directory
export const listDirectory = async (req: AuthRequest, res: Response) => {
  const ownerId = req.user?.id;
  const folderId = req.query.folderId as string || null;
  const search = req.query.search as string || '';
  const sort = req.query.sort as string || 'name'; // name, date, size

  if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let folderWhere: any = { ownerId, status: FileStatus.ACTIVE };
    let fileWhere: any = { ownerId, status: FileStatus.ACTIVE };

    // Navigate nested folders (unless search query is specified, which searches globally)
    if (search) {
      folderWhere.name = { contains: search, mode: 'insensitive' };
      fileWhere.name = { contains: search, mode: 'insensitive' };
    } else {
      folderWhere.parentId = folderId;
      fileWhere.folderId = folderId;
    }

    // Set sorting behavior
    let orderBy: any = {};
    if (sort === 'date') {
      orderBy = { updatedAt: 'desc' };
    } else if (sort === 'size') {
      orderBy = { size: 'desc' };
    } else {
      orderBy = { name: 'asc' };
    }

    const folders = await prisma.folder.findMany({
      where: folderWhere,
      orderBy: { name: 'asc' },
    });

    const files = await prisma.file.findMany({
      where: fileWhere,
      orderBy,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true, createdAt: true },
        },
      },
    });

    // Get current breadcrumbs
    let breadcrumbs: Array<{ id: string; name: string }> = [];
    if (folderId && !search) {
      let currentFolder = await prisma.folder.findUnique({ where: { id: folderId } });
      while (currentFolder) {
        breadcrumbs.unshift({ id: currentFolder.id, name: currentFolder.name });
        if (currentFolder.parentId) {
          currentFolder = await prisma.folder.findUnique({ where: { id: currentFolder.parentId } });
        } else {
          break;
        }
      }
    }

    return res.json({ folders, files, breadcrumbs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list directory' });
  }
};

// Download a specific file version
export const downloadFileVersion = async (req: AuthRequest, res: Response) => {
  const { fileId } = req.params;
  const versionNumberStr = req.query.version as string;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: userId },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Database record not found' });
    }

    // Find the requested file version, defaulting to latest
    let fileVersion;
    if (versionNumberStr) {
      const versionNumber = parseInt(versionNumberStr, 10);
      fileVersion = await prisma.fileVersion.findFirst({
        where: { fileId, versionNumber },
      });
    } else {
      fileVersion = await prisma.fileVersion.findFirst({
        where: { fileId },
        orderBy: { versionNumber: 'desc' },
      });
    }

    if (!fileVersion) {
      return res.status(404).json({ success: false, message: 'Database record not found (File version)' });
    }

    if (!fileVersion.s3Key || fileVersion.s3Key.trim() === '') {
      return res.status(500).json({ success: false, message: 'Invalid or missing S3 Key in database' });
    }

    // Fetch stream from Storage (S3 or local disk fallback)
    let fileStreamOrBuffer;
    try {
      fileStreamOrBuffer = await storage.getFileVersionStream(fileVersion.s3Key);
    } catch (storageErr: any) {
      // Parse AWS Errors
      const errName = storageErr.name || '';
      console.error(`Downloading file:
File ID: ${fileId}
S3 Bucket: ${process.env.AWS_S3_BUCKET || 'default'}
S3 Key: ${fileVersion.s3Key}
AWS Response: ${errName} - ${storageErr.message}`);

      if (errName === 'NoSuchKey' || errName === 'NotFound') {
        return res.status(404).json({ success: false, message: 'File does not exist in S3.' });
      }
      if (errName === 'AccessDenied' || errName === 'Forbidden') {
        return res.status(403).json({ success: false, message: 'Access denied to S3 object.' });
      }
      return res.status(500).json({ success: false, message: 'Unexpected server error while retrieving file.' });
    }

    await audit.logAction(
      userId,
      'DOWNLOAD',
      `Downloaded file: ${file.name} (Version ${fileVersion.versionNumber})`,
      req.ip,
      req.headers['user-agent']
    );

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', file.mimeType);

    if (fileStreamOrBuffer instanceof Buffer) {
      return res.send(fileStreamOrBuffer);
    } else {
      return (fileStreamOrBuffer as any).pipe(res);
    }
  } catch (err: any) {
    console.error(`[Download Endpoint] Unexpected Error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
};

// Rename a file or folder
export const renameItem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, type } = req.body; // type: 'file' | 'folder'
  const userId = req.user?.id;

  if (!name || !userId) {
    return res.status(400).json({ error: 'New name is required' });
  }

  try {
    if (type === 'folder') {
      const folder = await prisma.folder.findFirst({ where: { id, ownerId: userId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      const updatedFolder = await prisma.folder.update({
        where: { id },
        data: { name, updatedAt: new Date() },
      });
      await audit.logAction(userId, 'ADMIN_ACTION', `Renamed folder from ${folder.name} to ${name}`, req.ip);
      return res.json(updatedFolder);
    } else {
      const file = await prisma.file.findFirst({ where: { id, ownerId: userId } });
      if (!file) return res.status(404).json({ error: 'File not found' });

      const updatedFile = await prisma.file.update({
        where: { id },
        data: { name, updatedAt: new Date() },
      });
      await audit.logAction(userId, 'ADMIN_ACTION', `Renamed file from ${file.name} to ${name}`, req.ip);
      return res.json(updatedFile);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Rename failed' });
  }
};

// Move a file or folder to another folder
export const moveItem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { targetFolderId, type } = req.body; // type: 'file' | 'folder'
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // If targetFolderId is provided, verify it exists and is owned by the user
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: { id: targetFolderId, ownerId: userId, status: FileStatus.ACTIVE },
      });
      if (!targetFolder) {
        return res.status(404).json({ error: 'Target folder not found' });
      }
    }

    if (type === 'folder') {
      // Prevent circular moving (moving a folder inside itself)
      if (id === targetFolderId) {
        return res.status(400).json({ error: 'Cannot move folder inside itself' });
      }
      
      const folder = await prisma.folder.findFirst({ where: { id, ownerId: userId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      const updatedFolder = await prisma.folder.update({
        where: { id },
        data: { parentId: targetFolderId || null, updatedAt: new Date() },
      });
      return res.json(updatedFolder);
    } else {
      const file = await prisma.file.findFirst({ where: { id, ownerId: userId } });
      if (!file) return res.status(404).json({ error: 'File not found' });

      const updatedFile = await prisma.file.update({
        where: { id },
        data: { folderId: targetFolderId || null, updatedAt: new Date() },
      });
      return res.json(updatedFile);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Move failed' });
  }
};

// Soft Delete a file or folder (Move to trash)
export const deleteItem = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { type } = req.body; // 'file' | 'folder'
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (type === 'folder') {
      const folder = await prisma.folder.findFirst({ where: { id, ownerId: userId } });
      if (!folder) return res.status(404).json({ error: 'Folder not found' });

      await prisma.folder.update({
        where: { id },
        data: { status: FileStatus.DELETED, updatedAt: new Date() },
      });
      
      // Soft-delete files within this folder as well
      await prisma.file.updateMany({
        where: { folderId: id, ownerId: userId },
        data: { status: FileStatus.DELETED, deletedAt: new Date() },
      });

      await audit.logAction(userId, 'DELETE', `Soft-deleted folder: ${folder.name}`, req.ip);
    } else {
      const file = await prisma.file.findFirst({ where: { id, ownerId: userId } });
      if (!file) return res.status(404).json({ error: 'File not found' });

      await prisma.file.update({
        where: { id },
        data: { status: FileStatus.DELETED, deletedAt: new Date() },
      });

      await audit.logAction(userId, 'DELETE', `Soft-deleted file: ${file.name}`, req.ip);
    }

    return res.json({ message: 'Item successfully moved to trash' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Delete failed' });
  }
};
