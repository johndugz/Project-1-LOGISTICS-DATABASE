import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { handleScan, batchScan, getPackageStatus } from '../controllers/scanController';
import { UserRole } from '../models/types';

const router = Router();

// Scan endpoint - can be called by agents and operators
router.post('/', authMiddleware, roleMiddleware(UserRole.AGENT, UserRole.OPERATOR), handleScan);

// Batch scan
router.post(
  '/batch',
  authMiddleware,
  roleMiddleware(UserRole.AGENT, UserRole.OPERATOR),
  batchScan
);

// Get package status by code
router.get('/:code', getPackageStatus);

export default router;
