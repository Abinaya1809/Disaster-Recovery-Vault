import { Router } from 'express';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser, 
  changeUserStatus, 
  resetPassword 
} from '../controllers/user.controller';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Apply auth and admin requirements globally to all user management routes
router.use(authenticateToken);
router.use(requireRole([Role.ADMIN]));

router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/status', changeUserStatus);
router.patch('/reset-password', resetPassword);
router.get('/:id', getUserById);

export default router;
