import { Router } from 'express';
import { getBackupMetrics, getBackupLogs, checkBackupIntegrity } from '../controllers/backup.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);

router.get('/metrics', getBackupMetrics);
router.get('/logs', getBackupLogs);
router.post('/integrity-check', checkBackupIntegrity);

export default router;
