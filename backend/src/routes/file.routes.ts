import { Router } from 'express';
import multer from 'multer';
import { createFolder, uploadFile, listDirectory, downloadFileVersion, renameItem, moveItem, deleteItem } from '../controllers/file.controller';
import { authenticateToken } from '../middlewares/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // Limit to 100MB
  },
});

router.use(authenticateToken);

router.post('/folder', createFolder);
router.post('/upload', upload.single('file'), uploadFile);
router.get('/list', listDirectory);
router.get('/download/:fileId', downloadFileVersion);
router.put('/rename/:id', renameItem);
router.put('/move/:id', moveItem);
router.post('/delete/:id', deleteItem);

export default router;
