import { Router } from 'express';
import { getUsers, toggleUserStatus, getGlobalAuditLogs, getSystemStats, exportAuditLogsCSV, exportStorageReportCSV } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Apply auth and admin requirements globally to these routes
router.use(authenticateToken);
router.use(requireRole([Role.ADMIN]));

router.get('/users', getUsers);
router.put('/users/:id/status', toggleUserStatus);
router.get('/audits', getGlobalAuditLogs);
router.get('/stats', getSystemStats);
router.get('/export/audits', exportAuditLogsCSV);
router.get('/export/storage', exportStorageReportCSV);

export default router;
