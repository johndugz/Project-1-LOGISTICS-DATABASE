import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { generateQRCode, generateBarcode } from '../utils/auth';
import { createShipment, createPackage } from '../utils/shipmentService';
import { logAudit } from '../utils/audit';
import { ShipmentMode, ShipmentStatus, UserRole } from '../models/types';
import { emitAdminActivityNotification, emitOperationsActivityNotification } from '../socket';
import path from 'path';
import fs from 'fs';

function getModePrefix(mode: ShipmentMode): string {
  if (mode === ShipmentMode.AIR) return 'AIR';
  if (mode === ShipmentMode.SEA) return 'SEA';
  return 'LAND';
}

function getDatePart(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function extractCommodityValue(description: string | null | undefined, key: string): string | null {
  if (!description) return null;

  const parts = description.split(' | ');
  for (const part of parts) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex < 0) continue;

    const parsedKey = part.slice(0, separatorIndex).trim().toLowerCase();
    const parsedValue = part.slice(separatorIndex + 1).trim();
    if (parsedKey === key.toLowerCase() && parsedValue) {
      return parsedValue;
    }
  }

  return null;
}

async function generateModeBookingRef(mode: ShipmentMode): Promise<string> {
  const pool = getPool();
  const prefix = getModePrefix(mode);
  const datePart = getDatePart(new Date());

  const { rows } = await pool.query(
    `SELECT booking_ref FROM shipments WHERE mode = $1 AND created_at::date = CURRENT_DATE`,
    [mode]
  );

  const sequenceRegex = new RegExp(`^${prefix}-(?:\\((\\d{5})\\)|(\\d{5}))-\\d{2}\\/\\d{2}\\/\\d{4}$`);
  const maxSequence = rows.reduce((max: number, row: { booking_ref: string }) => {
    const match = row.booking_ref?.match(sequenceRegex);
    if (!match) return max;
    const parsed = Number(match[1] || match[2]);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 0);

  const nextSequence = String(maxSequence + 1).padStart(5, '0');
  return `${prefix}-${nextSequence}-${datePart}`;
}

export async function createBooking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      waybillNumber,
      shipperName,
      shipperAddress,
      consigneeName,
      consigneeAddress,
      originCity,
      originCountry,
      destinationCity,
      destinationCountry,
      mode,
      totalPieces,
      totalWeight,
      commodityDescription,
      assignedAgentId,
      estimatedArrival,
    } = req.body;

    // Validate required fields
    if (
      !shipperName ||
      !consigneeName ||
      !waybillNumber ||
      !originCity ||
      !destinationCity ||
      !mode ||
      !totalPieces ||
      !totalWeight
    ) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const selectedMode = mode as ShipmentMode;
    const normalizedWaybill = String(waybillNumber).trim();

    const { rows: existingWaybill } = await getPool().query(
      'SELECT id FROM shipments WHERE waybill_number = $1',
      [normalizedWaybill]
    );

    if (existingWaybill.length > 0) {
      res.status(400).json({ error: "You can't enter the same waybill number." });
      return;
    }

    const bookingRef = await generateModeBookingRef(selectedMode);
    const shipment = await createShipment(
      bookingRef,
      normalizedWaybill,
      shipperName,
      shipperAddress,
      consigneeName,
      consigneeAddress,
      originCity,
      originCountry,
      destinationCity,
      destinationCountry,
      selectedMode,
      totalPieces,
      totalWeight,
      commodityDescription,
      assignedAgentId || null,
      new Date(estimatedArrival),
      req.user.userId
    );

    // Create packages
    for (let i = 1; i <= totalPieces; i++) {
      const qrCode = generateQRCode(shipment.id, i);
      const barcode = generateBarcode();
      await createPackage(shipment.id, barcode, qrCode, i);
    }

    await logAudit(
      req.user.userId,
      'CREATE_BOOKING',
      'shipment',
      shipment.id,
      { bookingRef, mode, totalPieces },
      req.ip
    );

    res.status(201).json({
      message: 'Booking created successfully',
      data: shipment,
    });

    emitAdminActivityNotification({
      type: 'booking_created',
      message: `Booking created: ${shipment.booking_ref}`,
      createdAt: new Date().toISOString(),
      shipmentId: shipment.id,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
}

export async function getBooking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);

    if (shipments.length === 0) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const shipment = shipments[0];

    // Check permissions
    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.AUDITOR &&
      req.user.role !== UserRole.OPERATOR &&
      req.user.userId !== shipment.created_by
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get packages and events
    const { rows: packages } = await pool.query(
      'SELECT * FROM packages WHERE shipment_id = $1',
      [id]
    );

    const { rows: events } = await pool.query(
      `SELECT
          se.*,
          u.email AS created_by_email,
          u.first_name AS created_by_first_name,
          u.last_name AS created_by_last_name,
          sea.file_url AS attachment_url,
          sea.file_name AS attachment_name,
          sea.mime_type AS attachment_mime_type,
          sea.file_size AS attachment_file_size,
          sea.created_at AS attachment_created_at
       FROM shipment_events se
       LEFT JOIN users u ON se.created_by = u.id
       LEFT JOIN shipment_event_attachments sea ON sea.shipment_event_id = se.id
       WHERE se.shipment_id = $1
       ORDER BY se.created_at ASC`,
      [id]
    );

    res.json({
      shipment,
      packages,
      events,
    });
  } catch (error) {
    console.error('Error retrieving booking:', error);
    res.status(500).json({ error: 'Failed to retrieve booking' });
  }
}

export async function listBookings(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { offset = '0', limit = '20', status, mode } = req.query;
    const pool = getPool();

    let query = 'SELECT * FROM shipments WHERE 1=1';
    const params: (string | number)[] = [];

    // Add filters
    if (status) {
      query += ` AND current_status = $${params.length + 1}`;
      params.push(status as string);
    }

    if (mode) {
      query += ` AND mode = $${params.length + 1}`;
      params.push(mode as string);
    }

    // Filter by user role
    if (req.user.role === UserRole.CUSTOMER) {
      query += ` AND created_by = $${params.length + 1}`;
      params.push(req.user.userId);
    }

    if (req.user.role === UserRole.AGENT) {
      query += ` AND assigned_agent_id IN (SELECT id FROM agents WHERE user_id = $${params.length + 1})`;
      params.push(req.user.userId);
    }

    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*) as count'),
      params
    );

    const result = await pool.query(
      `${query} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      offset: parseInt(offset as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('Error listing bookings:', error);
    res.status(500).json({ error: 'Failed to list bookings' });
  }
}

export async function updateBooking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);

    if (shipments.length === 0) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const existingShipment = shipments[0];

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.OPERATOR &&
      req.user.userId !== existingShipment.created_by
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const {
      waybillNumber,
      shipperName,
      shipperAddress,
      consigneeName,
      consigneeAddress,
      originCity,
      originCountry,
      destinationCity,
      destinationCountry,
      mode,
      totalPieces,
      totalWeight,
      commodityDescription,
      estimatedArrival,
      assignedAgentId,
    } = req.body;

    if (!waybillNumber) {
      res.status(400).json({ error: 'Waybill number is required' });
      return;
    }

    if (typeof totalPieces === 'number' && totalPieces !== existingShipment.total_pieces) {
      res.status(400).json({ error: 'Updating total pieces is not supported after booking creation' });
      return;
    }

    const normalizedWaybill = String(waybillNumber).trim();
    const { rows: existingWaybill } = await getPool().query(
      'SELECT id FROM shipments WHERE waybill_number = $1 AND id <> $2',
      [normalizedWaybill, id]
    );

    if (existingWaybill.length > 0) {
      res.status(400).json({ error: "You can't enter the same waybill number." });
      return;
    }

    const { rows: updated } = await pool.query(
      `UPDATE shipments
       SET waybill_number = COALESCE($1, waybill_number),
           shipper_name = COALESCE($2, shipper_name),
           shipper_address = COALESCE($3, shipper_address),
           consignee_name = COALESCE($4, consignee_name),
           consignee_address = COALESCE($5, consignee_address),
           origin_city = COALESCE($6, origin_city),
           origin_country = COALESCE($7, origin_country),
           destination_city = COALESCE($8, destination_city),
           destination_country = COALESCE($9, destination_country),
           mode = COALESCE($10, mode),
           total_weight = COALESCE($11, total_weight),
           commodity_description = COALESCE($12, commodity_description),
           estimated_arrival = COALESCE($13, estimated_arrival),
           assigned_agent_id = COALESCE($14, assigned_agent_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $15
       RETURNING *`,
      [
        normalizedWaybill,
        shipperName,
        shipperAddress,
        consigneeName,
        consigneeAddress,
        originCity,
        originCountry,
        destinationCity,
        destinationCountry,
        mode,
        totalWeight,
        commodityDescription,
        estimatedArrival ? new Date(estimatedArrival) : null,
        assignedAgentId || null,
        id,
      ]
    );

    await logAudit(
      req.user.userId,
      'UPDATE_BOOKING',
      'shipment',
      id,
      { shipperName, consigneeName, originCity, destinationCity, mode },
      req.ip
    );

    res.json({
      message: 'Booking updated successfully',
      data: updated[0],
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
}

export async function deleteBooking(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const pool = getPool();

    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);

    if (shipments.length === 0) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const shipment = shipments[0];

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.OPERATOR &&
      req.user.userId !== shipment.created_by
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await pool.query('DELETE FROM shipments WHERE id = $1', [id]);

    await logAudit(
      req.user.userId,
      'DELETE_BOOKING',
      'shipment',
      id,
      { bookingRef: shipment.booking_ref, waybillNumber: shipment.waybill_number },
      req.ip
    );

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
}

export async function addBookingEvent(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { eventType, location, notes, actualArrival } = req.body;
    const requestWithFile = req as Request & { file?: Express.Multer.File };

    if (!eventType) {
      res.status(400).json({ error: 'Event type is required' });
      return;
    }

    if (!Object.values(ShipmentStatus).includes(eventType as ShipmentStatus)) {
      res.status(400).json({ error: 'Invalid event type' });
      return;
    }

    let parsedActualArrival: Date | null = null;
    if (eventType === ShipmentStatus.COMPLETED) {
      if (!actualArrival) {
        res.status(400).json({ error: 'Actual arrival is required when status is completed' });
        return;
      }

      const converted = new Date(actualArrival);
      if (Number.isNaN(converted.getTime())) {
        res.status(400).json({ error: 'Invalid actual arrival date' });
        return;
      }
      parsedActualArrival = converted;
    }

    const attachment = requestWithFile.file;
    const attachmentUrl = attachment ? `/uploads/events/${attachment.filename}` : null;
    const finalNotes = [
      notes || null,
      attachment ? `Attachment: ${attachment.originalname}` : null,
      attachment ? `Attachment URL: ${attachmentUrl}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    const pool = getPool();
    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);

    if (shipments.length === 0) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const shipment = shipments[0];

    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.OPERATOR &&
      req.user.userId !== shipment.created_by
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { rows: eventRows } = await pool.query(
      `INSERT INTO shipment_events (shipment_id, event_type, location, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, eventType, location || null, finalNotes || null, req.user.userId]
    );

    if (attachment && attachmentUrl) {
      await pool.query(
        `INSERT INTO shipment_event_attachments (
            shipment_event_id,
            file_name,
            stored_file_name,
            file_url,
            mime_type,
            file_size,
            uploaded_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventRows[0].id,
          attachment.originalname,
          attachment.filename,
          attachmentUrl,
          attachment.mimetype || null,
          attachment.size || null,
          req.user.userId,
        ]
      );
    }

    const { rows: updatedShipmentRows } = await pool.query(
      `UPDATE shipments
       SET current_status = $1::shipment_status,
           actual_arrival = CASE
             WHEN $1::shipment_status = 'completed'::shipment_status THEN $2::timestamp
             ELSE actual_arrival
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [eventType, parsedActualArrival ? parsedActualArrival.toISOString() : null, id]
    );

    await logAudit(
      req.user.userId,
      'ADD_SHIPMENT_EVENT',
      'shipment_event',
      eventRows[0].id,
      { shipmentId: id, eventType, location: location || null, actualArrival: parsedActualArrival },
      req.ip
    );

    res.status(201).json({
      message: 'Transit event added successfully',
      event: eventRows[0],
      shipment: updatedShipmentRows[0],
      attachmentUrl,
    });

    const clientName =
      extractCommodityValue(shipment.commodity_description as string | null | undefined, 'Customer') ||
      shipment.shipper_name ||
      'Unknown Client';

    const waybill = shipment.waybill_number || 'N/A';

    emitOperationsActivityNotification({
      type: 'transit_event_updated',
      message: `Transit event updated (${eventType}) for WAYBILL ${waybill} - Client ${clientName}`,
      createdAt: new Date().toISOString(),
      shipmentId: id,
    });
  } catch (error) {
    console.error('Error adding booking event:', error);
    const dbError = error as { code?: string; message?: string };
    if (dbError.code === '22P02' || dbError.code === '42804') {
      res.status(400).json({
        error:
          'Invalid completed event data. Ensure Actual Arrival is provided and shipment status supports completed.',
      });
      return;
    }
    res.status(500).json({ error: 'Failed to add transit event' });
  }
}

export async function deleteBookingEvent(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, eventId } = req.params;
    const pool = getPool();

    const { rows: shipments } = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);
    if (shipments.length === 0) {
      res.status(404).json({ error: 'Shipment not found' });
      return;
    }

    const shipment = shipments[0];
    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.OPERATOR &&
      req.user.userId !== shipment.created_by
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { rows: eventRows } = await pool.query(
      `SELECT id, shipment_id, event_type FROM shipment_events WHERE id = $1 AND shipment_id = $2`,
      [eventId, id]
    );

    if (eventRows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const { rows: attachmentRows } = await pool.query(
      `SELECT file_url FROM shipment_event_attachments WHERE shipment_event_id = $1`,
      [eventId]
    );

    await pool.query('DELETE FROM shipment_events WHERE id = $1 AND shipment_id = $2', [eventId, id]);

    const { rows: latestEventRows } = await pool.query(
      `SELECT event_type FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    const nextStatus =
      latestEventRows.length > 0
        ? (latestEventRows[0].event_type as ShipmentStatus)
        : ShipmentStatus.CREATED;

    const { rows: updatedShipmentRows } = await pool.query(
      `UPDATE shipments
       SET current_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [nextStatus, id]
    );

    if (attachmentRows.length > 0) {
      const fileUrl = attachmentRows[0].file_url as string;
      if (fileUrl && fileUrl.startsWith('/uploads/')) {
        const relativePath = fileUrl.replace(/^\/uploads\//, '');
        const absolutePath = path.join(process.cwd(), 'uploads', relativePath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }
    }

    await logAudit(
      req.user.userId,
      'DELETE_SHIPMENT_EVENT',
      'shipment_event',
      eventId,
      { shipmentId: id, deletedEventType: eventRows[0].event_type },
      req.ip
    );

    res.json({
      message: 'Transit event deleted successfully',
      shipment: updatedShipmentRows[0],
    });
  } catch (error) {
    console.error('Error deleting booking event:', error);
    res.status(500).json({ error: 'Failed to delete transit event' });
  }
}
