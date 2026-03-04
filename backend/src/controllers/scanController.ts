import { Request, Response } from 'express';
import { getPool } from '../config/database';
import {
  getPackageByCode,
  createShipmentEvent,
  checkDuplicateScan,
  updateShipmentStatus,
} from '../utils/shipmentService';
import { logAudit } from '../utils/audit';
import { ScanPayload, ShipmentStatus, UserRole } from '../models/types';

export async function handleScan(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { code, location, latitude, longitude, device_id }: ScanPayload = req.body;

    if (!code || !device_id) {
      res.status(400).json({ error: 'Missing code or device_id' });
      return;
    }

    // Find package by barcode or QR code
    const result = await getPackageByCode(code);

    if (!result) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    const { package: pkg, shipment } = result;

    // Check if user is agent assigned to this shipment
    if (req.user.role === UserRole.AGENT) {
      if (shipment.assigned_agent_id !== req.user.userId) {
        res.status(403).json({ error: 'Not assigned to this shipment' });
        return;
      }
    }

    // Check for duplicate scan (idempotency)
    const isDuplicate = await checkDuplicateScan(shipment.id, code, ShipmentStatus.PICKED_UP);

    if (isDuplicate) {
      res.status(409).json({
        message: 'Duplicate scan detected',
        shipment,
        package: pkg,
        isDuplicate: true,
      });
      return;
    }

    // Create event for this scan
    const event = await createShipmentEvent(
      shipment.id,
      ShipmentStatus.PICKED_UP,
      req.user.userId,
      pkg.id,
      location,
      latitude,
      longitude,
      device_id,
      code,
      'Scanned by mobile device'
    );

    // Update shipment status if all pieces are scanned
    const pool = getPool();
    const { rows: scannedPackages } = await pool.query(
      `SELECT COUNT(*) as count FROM shipment_events 
       WHERE shipment_id = $1 AND event_type = $2`,
      [shipment.id, ShipmentStatus.PICKED_UP]
    );

    let updatedShipment = shipment;
    if (scannedPackages[0].count >= shipment.total_pieces) {
      updatedShipment = await updateShipmentStatus(shipment.id, ShipmentStatus.PICKED_UP);
    }

    await logAudit(
      req.user.userId,
      'SCAN_PACKAGE',
      'package',
      pkg.id,
      { shipmentId: shipment.id, code, location },
      req.ip
    );

    res.json({
      message: 'Scan recorded successfully',
      event,
      shipment: updatedShipment,
      package: pkg,
      allPiecesScanned: scannedPackages[0].count >= shipment.total_pieces,
    });
  } catch (error) {
    console.error('Error handling scan:', error);
    res.status(500).json({ error: 'Failed to process scan' });
  }
}

export async function batchScan(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { codes, location, latitude, longitude, device_id } = req.body;

    if (!Array.isArray(codes) || codes.length === 0) {
      res.status(400).json({ error: 'Invalid codes array' });
      return;
    }

    const results: unknown[] = [];
    const errors: unknown[] = [];

    for (const code of codes) {
      try {
        const result = await getPackageByCode(code);

        if (!result) {
          errors.push({ code, error: 'Package not found' });
          continue;
        }

        const { package: pkg, shipment } = result;

        const event = await createShipmentEvent(
          shipment.id,
          ShipmentStatus.PICKED_UP,
          req.user.userId,
          pkg.id,
          location,
          latitude,
          longitude,
          device_id,
          code
        );

        results.push({
          code,
          shipmentId: shipment.id,
          packageId: pkg.id,
          event,
        });
      } catch (error) {
        errors.push({ code, error: String(error) });
      }
    }

    res.json({
      message: `Batch scan completed: ${results.length} successful, ${errors.length} failed`,
      results,
      errors,
    });
  } catch (error) {
    console.error('Error handling batch scan:', error);
    res.status(500).json({ error: 'Failed to process batch scan' });
  }
}

export async function getPackageStatus(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.params;

    const result = await getPackageByCode(code);

    if (!result) {
      res.status(404).json({ error: 'Package not found' });
      return;
    }

    const { package: pkg, shipment } = result;

    const pool = getPool();
    const { rows: events } = await pool.query(
      'SELECT * FROM shipment_events WHERE package_id = $1 ORDER BY created_at ASC',
      [pkg.id]
    );

    res.json({
      package: pkg,
      shipment,
      events,
    });
  } catch (error) {
    console.error('Error retrieving package status:', error);
    res.status(500).json({ error: 'Failed to retrieve package status' });
  }
}
