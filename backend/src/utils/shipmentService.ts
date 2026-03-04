import { getPool } from '../config/database';
import {
  Shipment,
  ShipmentStatus,
  Package,
  ShipmentEvent,
  ShipmentMode,
} from '../models/types';

export async function createShipment(
  bookingRef: string,
  waybillNumber: string,
  shipperName: string,
  shipperAddress: string,
  consigneeName: string,
  consigneeAddress: string,
  originCity: string,
  originCountry: string,
  destinationCity: string,
  destinationCountry: string,
  mode: ShipmentMode,
  totalPieces: number,
  totalWeight: number,
  commodityDescription: string,
  assignedAgentId: string | null,
  estimatedArrival: Date,
  createdBy: string
): Promise<Shipment> {
  const pool = getPool();

  const { rows } = await pool.query(
    `INSERT INTO shipments (
      booking_ref, waybill_number, shipper_name, shipper_address, 
      consignee_name, consignee_address, origin_city, origin_country, 
      destination_city, destination_country, mode, total_pieces, 
      total_weight, commodity_description, assigned_agent_id, 
      estimated_arrival, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      bookingRef,
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
      createdBy,
    ]
  );

  return rows[0];
}

export async function getShipmentById(shipmentId: string): Promise<Shipment | null> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
  return rows[0] || null;
}

export async function getShipmentByWaybill(waybillNumber: string): Promise<Shipment | null> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM shipments WHERE waybill_number = $1', [
    waybillNumber,
  ]);
  return rows[0] || null;
}

export async function getShipmentByBooking(bookingRef: string): Promise<Shipment | null> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM shipments WHERE booking_ref = $1', [
    bookingRef,
  ]);
  return rows[0] || null;
}

export async function listShipments(
  offset: number = 0,
  limit: number = 20,
  filters?: {
    mode?: ShipmentMode;
    status?: ShipmentStatus;
    agentId?: string;
  }
): Promise<{ data: Shipment[]; total: number }> {
  const pool = getPool();
  let query = 'SELECT * FROM shipments WHERE 1=1';
  const params: (string | number)[] = [];

  if (filters?.mode) {
    query += ` AND mode = $${params.length + 1}`;
    params.push(filters.mode);
  }

  if (filters?.status) {
    query += ` AND current_status = $${params.length + 1}`;
    params.push(filters.status);
  }

  if (filters?.agentId) {
    query += ` AND assigned_agent_id = $${params.length + 1}`;
    params.push(filters.agentId);
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM shipments WHERE 1=1${
      filters?.mode ? ` AND mode = $1` : ''
    }${filters?.status ? ` AND current_status = $${filters?.mode ? 2 : 1}` : ''}${
      filters?.agentId ? ` AND assigned_agent_id = $${filters?.mode || filters?.status ? 2 : 1}` : ''
    }`,
    params
  );

  const result = await pool.query(
    `${query} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
}

export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: ShipmentStatus,
  actualArrival?: Date
): Promise<Shipment> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE shipments 
     SET current_status = $1, actual_arrival = COALESCE($2, actual_arrival), updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING *`,
    [newStatus, actualArrival, shipmentId]
  );
  return rows[0];
}

export async function createPackage(
  shipmentId: string,
  barcode: string,
  qrCode: string,
  pieceNumber: number,
  weight?: number,
  dimensions?: string
): Promise<Package> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO packages (shipment_id, barcode, qr_code, piece_number, weight, dimensions)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [shipmentId, barcode, qrCode, pieceNumber, weight, dimensions]
  );
  return rows[0];
}

export async function getPackageByCode(
  code: string
): Promise<{ package: Package; shipment: Shipment } | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
      p.id AS package_id,
      p.shipment_id AS package_shipment_id,
      p.barcode AS package_barcode,
      p.qr_code AS package_qr_code,
      p.piece_number AS package_piece_number,
      p.weight AS package_weight,
      p.dimensions AS package_dimensions,
      p.status AS package_status,
      p.created_at AS package_created_at,
      p.updated_at AS package_updated_at,
      s.*
     FROM packages p
     JOIN shipments s ON p.shipment_id = s.id
     WHERE p.barcode = $1 OR p.qr_code = $1`,
    [code]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    package: {
      id: row.package_id,
      shipment_id: row.package_shipment_id,
      barcode: row.package_barcode,
      qr_code: row.package_qr_code,
      piece_number: row.package_piece_number,
      weight: row.package_weight,
      dimensions: row.package_dimensions,
      status: row.package_status,
      created_at: row.package_created_at,
      updated_at: row.package_updated_at,
    },
    shipment: row,
  };
}

export async function createShipmentEvent(
  shipmentId: string,
  eventType: ShipmentStatus,
  createdBy: string,
  packageId?: string,
  location?: string,
  latitude?: number,
  longitude?: number,
  deviceId?: string,
  scanCode?: string,
  notes?: string
): Promise<ShipmentEvent> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO shipment_events (
      shipment_id, package_id, event_type, created_by, location, 
      latitude, longitude, device_id, scan_code, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      shipmentId,
      packageId || null,
      eventType,
      createdBy,
      location,
      latitude,
      longitude,
      deviceId,
      scanCode,
      notes,
    ]
  );
  return rows[0];
}

export async function getShipmentEvents(shipmentId: string): Promise<ShipmentEvent[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at ASC`,
    [shipmentId]
  );
  return rows;
}

// Check for duplicate scan (idempotency)
export async function checkDuplicateScan(
  shipmentId: string,
  scanCode: string,
  eventType: ShipmentStatus
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM shipment_events 
     WHERE shipment_id = $1 AND scan_code = $2 AND event_type = $3
     AND created_at > NOW() - INTERVAL '5 minutes'`,
    [shipmentId, scanCode, eventType]
  );
  return rows.length > 0;
}
