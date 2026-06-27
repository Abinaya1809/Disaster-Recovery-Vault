import { Request, Response } from 'express';
import { PrismaClient, FileStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { storage } from '../services/storage.service';
import { audit } from '../services/audit.service';
import { sns } from '../services/sns.service';

const prisma = new PrismaClient();

// Create a secure shareable link
export const createSharedLink = async (req: any, res: Response) => {
  const { fileId, expiresInMinutes, password, isReadOnly, allowDownload } = req.body;
  const userId = req.user?.id;

  if (!fileId || !userId) {
    return res.status(400).json({ error: 'File ID is required' });
  }

  try {
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: userId, status: FileStatus.ACTIVE },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found or inactive' });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiry date
    let expiresAt: Date | null = null;
    if (expiresInMinutes) {
      expiresAt = new Date(Date.now() + parseInt(expiresInMinutes, 10) * 60 * 1000);
    }

    // Secure password
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const sharedLink = await prisma.sharedLink.create({
      data: {
        fileId,
        token,
        expiresAt,
        passwordHash,
        isReadOnly: isReadOnly !== undefined ? isReadOnly : true,
        allowDownload: allowDownload !== undefined ? allowDownload : true,
        createdById: userId,
      },
    });

    await audit.logAction(
      userId,
      'SHARE',
      `Generated secure shared link for file: ${file.name} (Password protected: ${!!password})`,
      req.ip
    );

    // Notify user of file sharing
    await sns.sendNotification(
      userId,
      'SHARE',
      'Secure Share Created',
      `Secure link generated for: ${file.name}. Link Token: ${token}`
    );

    return res.status(201).json({
      message: 'Secure sharing link generated',
      token: sharedLink.token,
      expiresAt: sharedLink.expiresAt,
      isPasswordProtected: !!password,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create shared link' });
  }
};

// Validate secure shared link details (Public access)
export const validateSharedLink = async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const sharedLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        file: {
          select: { name: true, size: true, mimeType: true, ownerId: true },
        },
      },
    });

    if (!sharedLink) {
      return res.status(404).json({ error: 'Shared link not found or expired' });
    }

    // Check expiration
    if (sharedLink.expiresAt && new Date() > sharedLink.expiresAt) {
      // Clean up expired links automatically
      await prisma.sharedLink.delete({ where: { id: sharedLink.id } });
      return res.status(410).json({ error: 'This shared link has expired' });
    }

    // Check password protection
    if (sharedLink.passwordHash) {
      if (!password) {
        return res.json({ isPasswordRequired: true, file: { name: sharedLink.file.name, size: sharedLink.file.size } });
      }

      const isMatch = await bcrypt.compare(password, sharedLink.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect passcode provided' });
      }
    }

    return res.json({
      isPasswordRequired: false,
      isReadOnly: sharedLink.isReadOnly,
      allowDownload: sharedLink.allowDownload,
      file: sharedLink.file,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Verification failed' });
  }
};

// Download file via shared link (Public access)
export const downloadSharedFile = async (req: Request, res: Response) => {
  const { token } = req.params;
  const password = req.query.pass as string || '';

  try {
    const sharedLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        file: {
          include: {
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!sharedLink) {
      return res.status(404).json({ error: 'Shared link not found' });
    }

    if (!sharedLink.allowDownload) {
      return res.status(403).json({ error: 'Download permission denied for this shared link' });
    }

    // Validate Expiration
    if (sharedLink.expiresAt && new Date() > sharedLink.expiresAt) {
      return res.status(410).json({ error: 'Shared link expired' });
    }

    // Validate Password
    if (sharedLink.passwordHash) {
      const isMatch = await bcrypt.compare(password, sharedLink.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Authentication passcode failed' });
      }
    }

    const latestVersion = sharedLink.file.versions[0];
    if (!latestVersion) {
      return res.status(404).json({ error: 'File content not found' });
    }

    // Increment download metrics
    await prisma.sharedLink.update({
      where: { id: sharedLink.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Fetch and stream from storage (S3 / Local disk fallback)
    const fileStreamOrBuffer = await storage.getFileVersionStream(latestVersion.s3Key);

    await audit.logAction(
      sharedLink.file.ownerId,
      'DOWNLOAD',
      `Shared link download for file: ${sharedLink.file.name} (Link token: ${token})`,
      req.ip
    );

    res.setHeader('Content-Disposition', `attachment; filename="${sharedLink.file.name}"`);
    res.setHeader('Content-Type', sharedLink.file.mimeType);

    if (fileStreamOrBuffer instanceof Buffer) {
      return res.send(fileStreamOrBuffer);
    } else {
      return (fileStreamOrBuffer as any).pipe(res);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Shared download failed' });
  }
};
