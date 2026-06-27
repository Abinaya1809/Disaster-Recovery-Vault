import { Response } from 'express';
import { PrismaClient, Role, AuditAction } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { storage } from '../services/storage.service';
import { audit } from '../services/audit.service';

const prisma = new PrismaClient();

// Helper to convert arrays of objects to CSV strings
const convertToCSV = (data: any[], headers: string[], keys: string[]): string => {
  const headRow = headers.join(',');
  const bodyRows = data.map(row => {
    return keys.map(key => {
      let val = row;
      // Handle nested fields like user.email
      if (key.includes('.')) {
        const parts = key.split('.');
        for (const part of parts) {
          val = val ? val[part] : '';
        }
      } else {
        val = val[key];
      }
      
      const valStr = val === null || val === undefined ? '' : String(val);
      // Escape quotes and wrap in quotes
      const escaped = valStr.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });
  return [headRow, ...bodyRows].join('\n');
};

// List all users in system (Admin only)
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { email: 'asc' },
    });
    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list users' });
  }
};

// Suspend/Reactivate user (Admin only)
export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const adminId = req.user?.id;

  if (isActive === undefined || !adminId) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // Prevent admin suspending themselves
    if (id === adminId) {
      return res.status(400).json({ error: 'You cannot change your own status' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
    });

    const statusText = isActive ? 'reactivated' : 'suspended';
    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin toggled status of user ${updatedUser.email} to ${statusText}`,
      req.ip
    );

    return res.json({ message: `User status changed to ${statusText}`, user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update user' });
  }
};

// Retrieve Global Audit Logs (Admin only)
export const getGlobalAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch global audits' });
  }
};

// Fetch global system stats (Admin only)
export const getSystemStats = async (req: AuthRequest, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    const activeUserCount = await prisma.user.count({ where: { isActive: true } });
    
    // Storage metrics from storage service
    const diskStats = await storage.getStorageMetrics();
    
    // File counts
    const fileCount = await prisma.file.count({ where: { status: 'ACTIVE' } });
    const deletedFileCount = await prisma.file.count({ where: { status: 'DELETED' } });
    
    // Backups metrics
    const backupsCount = await prisma.backup.count();
    const backupsCompleted = await prisma.backup.count({ where: { status: 'COMPLETED' } });
    const backupSuccessRate = backupsCount > 0 ? Math.round((backupsCompleted / backupsCount) * 100) : 100;

    // Recovery metrics
    const recoveryCount = await prisma.recoveryRequest.count();
    const recoverySuccessCount = await prisma.recoveryRequest.count({ where: { status: 'COMPLETED' } });
    const recoverySuccessRate = recoveryCount > 0 ? Math.round((recoverySuccessCount / recoveryCount) * 100) : 100;

    // System Health states (Mock Lambda performance and AWS Free Tier limits status)
    const health = {
      s3Connection: diskStats ? 'HEALTHY' : 'DEGRADED',
      snsConnection: 'HEALTHY',
      lambdaStatus: 'ACTIVE',
      lambdaAvgDurationMs: 145,
      cloudWatchStatus: 'ACTIVE',
      storageLimitBytes: 5 * 1024 * 1024 * 1024, // 5GB Free Tier
      currentStorageBytes: diskStats.storageBytes,
    };

    return res.json({
      userCount,
      activeUserCount,
      fileCount,
      deletedFileCount,
      backupsCount,
      backupSuccessRate,
      recoveryCount,
      recoverySuccessRate,
      health,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to load system stats' });
  }
};

// Export audit logs in CSV format (Admin only)
export const exportAuditLogsCSV = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Log ID', 'User Email', 'Action type', 'Details', 'IP Address', 'User Agent', 'Date Created'];
    const keys = ['id', 'user.email', 'action', 'details', 'ipAddress', 'userAgent', 'createdAt'];

    const csvContent = convertToCSV(logs, headers, keys);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dr-vault-audit-report.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export CSV' });
  }
};

// Export active file and S3 backup status report (Admin only)
export const exportStorageReportCSV = async (req: AuthRequest, res: Response) => {
  try {
    const files = await prisma.file.findMany({
      include: {
        owner: { select: { email: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: { backups: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Flatten to format files + their latest backup status
    const reportData = files.map(file => {
      const latestVer = file.versions[0];
      const latestBackup = latestVer?.backups?.[0];
      return {
        id: file.id,
        name: file.name,
        ownerEmail: file.owner.email,
        sizeBytes: file.size,
        mimeType: file.mimeType,
        status: file.status,
        versionCount: file.versions.length,
        s3Key: latestVer?.s3Key || 'N/A',
        backupStatus: latestBackup?.status || 'NOT_BACKED_UP',
        backupHealth: latestBackup?.backupHealth || 'N/A',
        lastBackupTime: latestBackup?.lastBackupTime || 'N/A',
      };
    });

    const headers = [
      'File ID', 'File Name', 'Owner', 'Size (Bytes)', 'Mime Type', 
      'Work Area Status', 'Versions Total', 'AWS S3 Key', 'Backup Sync Status', 'Backup Health', 'Backup Timestamp'
    ];
    const keys = [
      'id', 'name', 'ownerEmail', 'sizeBytes', 'mimeType', 
      'status', 'versionCount', 's3Key', 'backupStatus', 'backupHealth', 'lastBackupTime'
    ];

    const csvContent = convertToCSV(reportData, headers, keys);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dr-vault-storage-report.csv"');
    return res.send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to export storage report' });
  }
};
