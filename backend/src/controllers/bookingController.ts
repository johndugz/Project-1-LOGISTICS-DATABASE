import { Request, Response } from 'express';
import { createBooking, listShipments } from '../services/shipmentService';

export async function createBookingHandler(req: Request, res: Response) {
  const required = ['booking_no', 'port_origin', 'port_destination', 'shipper_name', 'consignee_name'];
  const missing = required.filter((f) => !req.body[f]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
  }

  try {
    const shipment = await createBooking(req.body);
    return res.status(201).json(shipment);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking', error });
  }
}

export async function listBookingsHandler(_req: Request, res: Response) {
  const data = await listShipments();
  return res.json(data);
}
