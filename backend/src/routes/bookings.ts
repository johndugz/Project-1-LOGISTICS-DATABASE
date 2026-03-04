import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { uploadEventAttachment } from '../middleware/upload';
import {
  createBooking,
  getBooking,
  listBookings,
  updateBooking,
  deleteBooking,
  addBookingEvent,
  deleteBookingEvent,
} from '../controllers/bookingController';
import { UserRole } from '../models/types';

const router = Router();

// All booking endpoints require authentication
router.use(authMiddleware);

// Create booking (operator, admin)
router.post('/', roleMiddleware(UserRole.OPERATOR, UserRole.ADMIN), createBooking);

// Get specific booking
router.get('/:id', getBooking);

// Update booking (operator, admin)
router.put('/:id', roleMiddleware(UserRole.OPERATOR, UserRole.ADMIN), updateBooking);

// Delete booking (operator, admin)
router.delete('/:id', roleMiddleware(UserRole.OPERATOR, UserRole.ADMIN), deleteBooking);

// Add booking transit event (operator, admin)
router.post(
  '/:id/events',
  roleMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  uploadEventAttachment.single('attachment'),
  addBookingEvent
);

router.delete(
  '/:id/events/:eventId',
  roleMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  deleteBookingEvent
);

// List bookings with filters
router.get('/', listBookings);

export default router;
