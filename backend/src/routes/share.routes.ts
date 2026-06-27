import { Router } from 'express';
import { createSharedLink, validateSharedLink, downloadSharedFile } from '../controllers/share.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

// Create shared link requires auth
router.post('/', authenticateToken, createSharedLink);

// Public verification & downloading do NOT require auth headers
router.post('/validate/:token', validateSharedLink);
router.get('/download/:token', downloadSharedFile);

export default router;
