import { Router } from 'express';
import { login } from './controllers/authController';
import { createBookingHandler, listBookingsHandler } from './controllers/bookingController';
import { scanHandler } from './controllers/scanController';
import { authRequired } from './middleware/auth';

const router = Router();

router.post('/auth/login', login);
router.get('/health', (_req, res) => res.json({ ok: true }));

router.get('/bookings', authRequired, listBookingsHandler);
router.post('/bookings', authRequired, createBookingHandler);
router.post('/scan', authRequired, scanHandler);

export default router;
