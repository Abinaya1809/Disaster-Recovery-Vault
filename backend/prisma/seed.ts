import { PrismaClient, Role, FileStatus, BackupStatus, BackupHealth, RecoveryStatus, RecoveryType, AuditAction, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing database tables...');
  await prisma.sharedLink.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.backup.deleteMany();
  await prisma.recoveryRequest.deleteMany();
  await prisma.fileVersion.deleteMany();
  await prisma.file.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Database with mockup profiles...');

  // 1. Create Users
  const adminPassword = await bcrypt.hash('admin_password_123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@drvault.com',
      password: adminPassword,
      role: Role.ADMIN,
      employeeId: 'EMP-00001',
      firstName: 'Admin',
      lastName: 'System',
      phone: '+15550100',
      department: 'IT',
      designation: 'System Administrator',
      status: 'ACTIVE',
      storageLimit: 10240, // 10 GB
    },
  });

  const emp1Password = await bcrypt.hash('employee_password_123', 10);
  const employee = await prisma.user.create({
    data: {
      email: 'employee@drvault.com',
      password: emp1Password,
      role: Role.EMPLOYEE,
      employeeId: 'EMP-10001',
      firstName: 'Sarjeeth',
      lastName: 'S',
      phone: '+15550101',
      department: 'IT',
      designation: 'DevOps Engineer',
      status: 'ACTIVE',
      storageLimit: 5120, // 5 GB
    },
  });

  const emp2Password = await bcrypt.hash('employee_password_123', 10);
  await prisma.user.create({
    data: {
      email: 'hr@drvault.com',
      password: emp2Password,
      role: Role.EMPLOYEE,
      employeeId: 'EMP-10002',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15550102',
      department: 'HR',
      designation: 'HR Specialist',
      status: 'ACTIVE',
      storageLimit: 5120,
    },
  });

  const emp3Password = await bcrypt.hash('employee_password_123', 10);
  await prisma.user.create({
    data: {
      email: 'finance@drvault.com',
      password: emp3Password,
      role: Role.EMPLOYEE,
      employeeId: 'EMP-10003',
      firstName: 'John',
      lastName: 'Smith',
      phone: '+15550103',
      department: 'Finance',
      designation: 'Financial Analyst',
      status: 'ACTIVE',
      storageLimit: 5120,
    },
  });

  const emp4Password = await bcrypt.hash('employee_password_123', 10);
  await prisma.user.create({
    data: {
      email: 'ops@drvault.com',
      password: emp4Password,
      role: Role.EMPLOYEE,
      employeeId: 'EMP-10004',
      firstName: 'Alice',
      lastName: 'Johnson',
      phone: '+15550104',
      department: 'Operations',
      designation: 'Operations Manager',
      status: 'ACTIVE',
      storageLimit: 5120,
    },
  });

  const emp5Password = await bcrypt.hash('employee_password_123', 10);
  await prisma.user.create({
    data: {
      email: 'support@drvault.com',
      password: emp5Password,
      role: Role.EMPLOYEE,
      employeeId: 'EMP-10005',
      firstName: 'Bob',
      lastName: 'Wilson',
      phone: '+15550105',
      department: 'Support',
      designation: 'Support Lead',
      status: 'ACTIVE',
      storageLimit: 5120,
    },
  });

  console.log(`Created 1 Admin and 5 Employee accounts with realistic departments`);

  // Create Mock Data for Employee
  const user = employee;

  // 2. Create Folders
  const folderFinance = await prisma.folder.create({
    data: { name: 'Financials', ownerId: user.id, status: FileStatus.ACTIVE },
  });

  const folderLegal = await prisma.folder.create({
    data: { name: 'Legal Contracts', ownerId: user.id, status: FileStatus.ACTIVE },
  });

  const folderOperations = await prisma.folder.create({
    data: { name: 'Operations', ownerId: user.id, status: FileStatus.ACTIVE },
  });

  const folderDeleted = await prisma.folder.create({
    data: { name: 'Old Marketing Drafts', ownerId: user.id, status: FileStatus.DELETED },
  });

  // 3. Create active Files
  // File 1: Single version
  const file1 = await prisma.file.create({
    data: {
      name: 'Q3_Invoice_Sheet.xlsx',
      originalName: 'Q3_Invoice_Sheet.xlsx',
      size: 154200,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      folderId: folderFinance.id,
      ownerId: user.id,
    },
  });

  const file1v1 = await prisma.fileVersion.create({
    data: {
      fileId: file1.id,
      versionNumber: 1,
      size: 154200,
      s3Key: `vault/${file1.id}_v1.xlsx`,
      createdById: user.id,
    },
  });

  await prisma.backup.create({
    data: {
      fileVersionId: file1v1.id,
      status: BackupStatus.COMPLETED,
      s3Bucket: 'dr-vault-backups-free-tier',
      s3Key: file1v1.s3Key,
      backupHealth: BackupHealth.HEALTHY,
      lastBackupTime: new Date(Date.now() - 3600000 * 24 * 3), // 3 days ago
    },
  });

  // File 2: Multi-version file (demonstrating version restoration)
  const file2 = await prisma.file.create({
    data: {
      name: 'Service_Agreement_v2.pdf',
      originalName: 'Service_Agreement_v2.pdf',
      size: 2048500, // Size of latest version
      mimeType: 'application/pdf',
      folderId: folderLegal.id,
      ownerId: user.id,
    },
  });

  const file2v1 = await prisma.fileVersion.create({
    data: {
      fileId: file2.id,
      versionNumber: 1,
      size: 1980000,
      s3Key: `vault/${file2.id}_v1.pdf`,
      createdById: user.id,
      createdAt: new Date(Date.now() - 3600000 * 48), // 48 hours ago
    },
  });

  const file2v2 = await prisma.fileVersion.create({
    data: {
      fileId: file2.id,
      versionNumber: 2,
      size: 2048500,
      s3Key: `vault/${file2.id}_v2.pdf`,
      createdById: user.id,
      createdAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    },
  });

  await prisma.backup.create({
    data: {
      fileVersionId: file2v1.id,
      status: BackupStatus.COMPLETED,
      s3Bucket: 'dr-vault-backups-free-tier',
      s3Key: file2v1.s3Key,
      backupHealth: BackupHealth.HEALTHY,
      lastBackupTime: file2v1.createdAt,
    },
  });

  await prisma.backup.create({
    data: {
      fileVersionId: file2v2.id,
      status: BackupStatus.COMPLETED,
      s3Bucket: 'dr-vault-backups-free-tier',
      s3Key: file2v2.s3Key,
      backupHealth: BackupHealth.HEALTHY,
      lastBackupTime: file2v2.createdAt,
    },
  });

  // File 3: Operations details
  const file3 = await prisma.file.create({
    data: {
      name: 'Server_Configuration.json',
      originalName: 'Server_Configuration.json',
      size: 4500,
      mimeType: 'application/json',
      folderId: folderOperations.id,
      ownerId: user.id,
    },
  });

  const file3v1 = await prisma.fileVersion.create({
    data: {
      fileId: file3.id,
      versionNumber: 1,
      size: 4500,
      s3Key: `vault/${file3.id}_v1.json`,
      createdById: user.id,
    },
  });

  await prisma.backup.create({
    data: {
      fileVersionId: file3v1.id,
      status: BackupStatus.COMPLETED,
      s3Bucket: 'dr-vault-backups-free-tier',
      s3Key: file3v1.s3Key,
      backupHealth: BackupHealth.HEALTHY,
      lastBackupTime: new Date(),
    },
  });

  // 4. Create soft-deleted Files (Trash)
  const deletedFile = await prisma.file.create({
    data: {
      name: 'Ransomware_Phishing_Report_OLD.docx',
      originalName: 'Ransomware_Phishing_Report_OLD.docx',
      size: 512000,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ownerId: user.id,
      status: FileStatus.DELETED,
      deletedAt: new Date(Date.now() - 3600000 * 12), // 12 hours ago
    },
  });

  const deletedFileV1 = await prisma.fileVersion.create({
    data: {
      fileId: deletedFile.id,
      versionNumber: 1,
      size: 512000,
      s3Key: `vault/${deletedFile.id}_v1.docx`,
      createdById: user.id,
    },
  });

  await prisma.backup.create({
    data: {
      fileVersionId: deletedFileV1.id,
      status: BackupStatus.COMPLETED,
      s3Bucket: 'dr-vault-backups-free-tier',
      s3Key: deletedFileV1.s3Key,
      backupHealth: BackupHealth.HEALTHY,
      lastBackupTime: new Date(Date.now() - 3600000 * 24),
    },
  });

  // 5. Create Secure Shared Link
  await prisma.sharedLink.create({
    data: {
      fileId: file1.id,
      token: 'mock-share-token-123456789',
      expiresAt: new Date(Date.now() + 3600000 * 24 * 7), // 7 days from now
      passwordHash: await bcrypt.hash('shared_pass', 10), // Protected share
      allowDownload: true,
      createdById: user.id,
    },
  });

  // 6. Create Disaster Recovery logs (Recovery Requests)
  await prisma.recoveryRequest.create({
    data: {
      requestedById: user.id,
      fileId: file1.id,
      status: RecoveryStatus.COMPLETED,
      type: RecoveryType.FILE,
      restorePath: 'Financials/Q3_Invoice_Sheet.xlsx',
      logSummary: 'One-click restore triggered following accidental local directory format.',
      createdAt: new Date(Date.now() - 3600000 * 3),
      resolvedAt: new Date(Date.now() - 3600000 * 3 + 12000), // Resolved in 12s
    },
  });

  await prisma.recoveryRequest.create({
    data: {
      requestedById: user.id,
      status: RecoveryStatus.PENDING,
      type: RecoveryType.FOLDER,
      restorePath: 'Operations',
      logSummary: 'Scheduled replication recovery verify test.',
      createdAt: new Date(),
    },
  });

  // 7. Create Audit Logs
  const auditActions = [
    { action: AuditAction.LOGIN, details: 'User logged in from Google Chrome, Windows 11', time: new Date(Date.now() - 3600000 * 4) },
    { action: AuditAction.UPLOAD, details: 'Created directory: Financials', time: new Date(Date.now() - 3600000 * 3.8) },
    { action: AuditAction.UPLOAD, details: 'Uploaded document Q3_Invoice_Sheet.xlsx (v1)', time: new Date(Date.now() - 3600000 * 3.7) },
    { action: AuditAction.SHARE, details: 'Generated secure download link for Q3_Invoice_Sheet.xlsx', time: new Date(Date.now() - 3600000 * 2) },
    { action: AuditAction.RESTORE, details: 'Recovered document Q3_Invoice_Sheet.xlsx from backup vault', time: new Date(Date.now() - 3600000 * 1.5) },
  ];

  for (const act of auditActions) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: act.action,
        details: act.details,
        ipAddress: '192.168.1.45',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
        createdAt: act.time,
      },
    });
  }

  // Admin audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: AuditAction.ADMIN_ACTION,
      details: 'Audit report export generated by system administrator',
      ipAddress: '10.0.0.12',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      createdAt: new Date(),
    },
  });

  // 8. Create Notifications
  const alerts = [
    { type: NotificationType.BACKUP, title: 'Backup Successful', message: 'Operations/Server_Configuration.json successfully replicated to S3.' },
    { type: NotificationType.SECURITY_ALERT, title: 'Suspicious Login detected', message: 'Your account was accessed via cURL CLI from IP 89.23.45.109.' },
    { type: NotificationType.RECOVERY, title: 'Restoration complete', message: 'Restoring Q3_Invoice_Sheet.xlsx succeeded in 12 seconds.' },
  ];

  for (const alert of alerts) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        isRead: false,
      },
    });
  }

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
