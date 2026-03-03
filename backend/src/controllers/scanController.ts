import { Request, Response } from 'express';
import { scanShipment } from '../services/shipmentService';

export async function scanHandler(req: Request, res: Response) {
  const { booking_no, scan_point } = req.body;

  if (!booking_no || !scan_point) {
    return res.status(400).json({ message: 'booking_no and scan_point are required' });
  }

  const updated = await scanShipment(booking_no, scan_point);
  if (!updated) {
    return res.status(404).json({ message: 'Shipment not found' });
  }

  return res.json(updated);
}
