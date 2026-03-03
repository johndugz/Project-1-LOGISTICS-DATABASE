import { query } from '../db';

export async function createBooking(payload: Record<string, unknown>) {
  const sql = `
    INSERT INTO shipments (
      booking_no, port_origin, port_destination, service_mode, commodity,
      declared_value, item_count, weight, cbm, dimension,
      pickup_datetime, remarks, shipper_name, shipper_address, shipper_contact_person,
      shipper_telephone, consignee_name, consignee_address, consignee_contact_person,
      consignee_telephone, return_documents, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,
      $16,$17,$18,$19,
      $20,$21,$22
    ) RETURNING *;
  `;

  const values = [
    payload.booking_no,
    payload.port_origin,
    payload.port_destination,
    payload.service_mode,
    payload.commodity,
    payload.declared_value,
    payload.item_count,
    payload.weight,
    payload.cbm,
    payload.dimension,
    payload.pickup_datetime,
    payload.remarks,
    payload.shipper_name,
    payload.shipper_address,
    payload.shipper_contact_person,
    payload.shipper_telephone,
    payload.consignee_name,
    payload.consignee_address,
    payload.consignee_contact_person,
    payload.consignee_telephone,
    payload.return_documents,
    payload.status || 'BOOKED'
  ];

  const result = await query(sql, values);
  return result.rows[0];
}

export async function listShipments() {
  const result = await query('SELECT * FROM shipments ORDER BY created_at DESC');
  return result.rows;
}

export async function scanShipment(bookingNo: string, scanPoint: string) {
  const result = await query(
    `UPDATE shipments
     SET status = $2, updated_at = NOW()
     WHERE booking_no = $1
     RETURNING *`,
    [bookingNo, scanPoint]
  );
  return result.rows[0] || null;
}
