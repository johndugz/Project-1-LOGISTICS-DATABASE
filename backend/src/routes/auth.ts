import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import {
	register,
	signup,
	verifyEmail,
	listPendingUsers,
	listCurrentUsers,
	approveUser,
	updateUser,
	updateUserRole,
	deleteUser,
	login,
	getProfile,
	updateProfile,
} from '../controllers/authController';
import { UserRole } from '../models/types';

const router = Router();

// Public endpoints
router.post('/login', login);
router.post('/signup', signup);
router.post('/verify-email', verifyEmail);

// Protected endpoints
router.post('/register', authMiddleware, roleMiddleware(UserRole.ADMIN), register);
router.get('/pending-users', authMiddleware, roleMiddleware(UserRole.ADMIN), listPendingUsers);
router.get('/users', authMiddleware, roleMiddleware(UserRole.ADMIN), listCurrentUsers);
router.post('/users/:userId/approve', authMiddleware, roleMiddleware(UserRole.ADMIN), approveUser);
router.put('/users/:userId', authMiddleware, roleMiddleware(UserRole.ADMIN), updateUser);
router.put('/users/:userId/role', authMiddleware, roleMiddleware(UserRole.ADMIN), updateUserRole);
router.delete('/users/:userId', authMiddleware, roleMiddleware(UserRole.ADMIN), deleteUser);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;
