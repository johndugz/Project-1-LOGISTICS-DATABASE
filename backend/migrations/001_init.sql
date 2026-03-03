CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'operator',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  booking_no VARCHAR(50) UNIQUE NOT NULL,
  port_origin VARCHAR(120) NOT NULL,
  port_destination VARCHAR(120) NOT NULL,
  service_mode VARCHAR(60),
  commodity TEXT,
  declared_value NUMERIC(12, 2),
  item_count VARCHAR(120),
  weight NUMERIC(10, 2),
  cbm NUMERIC(10, 4),
  dimension VARCHAR(120),
  pickup_datetime TIMESTAMP,
  remarks TEXT,
  shipper_name VARCHAR(150),
  shipper_address TEXT,
  shipper_contact_person VARCHAR(120),
  shipper_telephone VARCHAR(50),
  consignee_name VARCHAR(150),
  consignee_address TEXT,
  consignee_contact_person VARCHAR(120),
  consignee_telephone VARCHAR(50),
  return_documents TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'BOOKED',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO users (username, password_hash, role)
VALUES
  ('admin', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6h7qDpiRnbV0wweAV/QXpVZl8vL1y', 'admin'),
  ('scanner1', '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi6h7qDpiRnbV0wweAV/QXpVZl8vL1y', 'scanner')
ON CONFLICT (username) DO NOTHING;

INSERT INTO shipments (
  booking_no, port_origin, port_destination, service_mode, commodity,
  declared_value, item_count, weight, cbm, dimension,
  pickup_datetime, remarks, shipper_name, shipper_address, shipper_contact_person,
  shipper_telephone, consignee_name, consignee_address, consignee_contact_person,
  consignee_telephone, return_documents, status
)
VALUES (
  'TPL-0001', 'Manila', 'Talisay Cebu City', 'Airfreight', 'Unit Assy - IBU / Pump Assy-Vacuum',
  12500.00, '2 items / 1 box', 1, 0.010336, '34x16x19',
  '2026-02-25 08:00:00', '', 'FAST Warehouse', 'Levi Mariano Taguig City', 'Sir Mark',
  '', 'Hyundai Talisay Cebu', 'SRP ROAD, BRGY SAN ROQUE, TALISAY CITY CEBU 6045', 'Lloyd James Diocampo',
  '09353242512', 'POD with Dealer acknowledgement (full name, signature and date)', 'BOOKED'
)
ON CONFLICT (booking_no) DO NOTHING;
