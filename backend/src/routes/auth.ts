import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { register, login, getProfile, updateProfile } from '../controllers/authController';
import { UserRole } from '../models/types';

const router = Router();

// Public endpoints
router.post('/login', login);

// Protected endpoints
router.post('/register', authMiddleware, roleMiddleware(UserRole.ADMIN), register);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

export default router;
