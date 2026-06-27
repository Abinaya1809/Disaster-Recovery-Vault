import { Response } from 'express';
import { PrismaClient, BackupStatus, BackupHealth } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { storage } from '../services/storage.service';

const prisma = new PrismaClient();

// Get backup dashboard metrics
export const getBackupMetrics = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Storage usage & count calculations
    const usage = await storage.getStorageMetrics();

    // Query backups count in database
    const backups = await prisma.backup.findMany({
      where: {
        fileVersion: {
          file: {
            ownerId: userId,
          },
        },
      },
    });

    const totalBackups = backups.length;
    const completedBackups = backups.filter(b => b.status === BackupStatus.COMPLETED).length;
    const healthyBackups = backups.filter(b => b.backupHealth === BackupHealth.HEALTHY).length;
    
    // Calculate percentages safely
    const backupSuccessRate = totalBackups > 0 ? Math.round((completedBackups / totalBackups) * 100) : 100;
    const backupHealthRate = totalBackups > 0 ? Math.round((healthyBackups / totalBackups) * 100) : 100;

    return res.json({
      totalBackups,
      completedBackups,
      backupSuccessRate,
      backupHealthRate,
      storageUsedBytes: usage.storageBytes,
      totalFilesCount: usage.fileCount,
      storageLimitBytes: 5 * 1024 * 1024 * 1024, // 5GB standard S3 Free Tier
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve backup metrics' });
  }
};

// Retrieve a list of file backup histories
export const getBackupLogs = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const backupLogs = await prisma.backup.findMany({
      where: {
        fileVersion: {
          file: {
            ownerId: userId,
          },
        },
      },
      include: {
        fileVersion: {
          include: {
            file: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(backupLogs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch backup logs' });
  }
};

// Trigger manual integrity check (emulating CloudWatch metrics trigger / Lambda sync verification)
export const checkBackupIntegrity = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all user backups
    const backups = await prisma.backup.findMany({
      where: {
        fileVersion: {
          file: {
            ownerId: userId,
          },
        },
      },
      include: {
        fileVersion: true,
      },
    });

    // Check integrity of each file version
    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const backup of backups) {
      try {
        // Confirm path/stream exists
        const fileStreamOrBuffer = await storage.getFileVersionStream(backup.s3Key);
        
        // If stream fetched successfully, update to healthy if it wasn't
        if (backup.backupHealth !== BackupHealth.HEALTHY) {
          await prisma.backup.update({
            where: { id: backup.id },
            data: { backupHealth: BackupHealth.HEALTHY, errorMessage: null },
          });
        }
        healthyCount++;
      } catch (err: any) {
        // Log corrupted backup reference
        await prisma.backup.update({
          where: { id: backup.id },
          data: { backupHealth: BackupHealth.UNHEALTHY, errorMessage: 'Local file verification missing or unreadable.' },
        });
        unhealthyCount++;
      }
    }

    return res.json({
      message: 'Integrity scan completed successfully',
      healthyCount,
      unhealthyCount,
      scannedCount: backups.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Backup integrity check failed' });
  }
};
