import { Router } from 'express';
import { getTrashList, restoreItem, purgeItem, getFileVersions, rollbackVersion, getRecoveryLogs } from '../controllers/recovery.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.use(authenticateToken);

router.get('/trash', getTrashList);
router.post('/restore/:id', restoreItem);
router.post('/purge/:id', purgeItem);
router.get('/versions/:fileId', getFileVersions);
router.post('/versions/:fileId/rollback/:versionId', rollbackVersion);
router.get('/logs', getRecoveryLogs);

export default router;
