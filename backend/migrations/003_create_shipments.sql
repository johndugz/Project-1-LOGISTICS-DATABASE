-- Migration: 003_create_shipments_table

CREATE TYPE shipment_mode AS ENUM ('sea', 'air', 'land');
CREATE TYPE shipment_status AS ENUM (
  'created',
  'picked_up',
  'at_depot',
  'loaded',
  'departed',
  'arrived',
  'customs_hold',
  'cleared',
  'out_for_delivery',
  'delivered'
);

CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref VARCHAR(50) UNIQUE NOT NULL,
  waybill_number VARCHAR(50) UNIQUE NOT NULL,
  shipper_name VARCHAR(255) NOT NULL,
  shipper_address TEXT NOT NULL,
  consignee_name VARCHAR(255) NOT NULL,
  consignee_address TEXT NOT NULL,
  origin_city VARCHAR(100) NOT NULL,
  origin_country VARCHAR(100) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  destination_country VARCHAR(100) NOT NULL,
  mode shipment_mode NOT NULL,
  total_pieces INTEGER NOT NULL,
  total_weight DECIMAL(10, 2) NOT NULL,
  commodity_description TEXT,
  assigned_agent_id UUID REFERENCES agents(id),
  current_status shipment_status DEFAULT 'created',
  estimated_arrival TIMESTAMP,
  actual_arrival TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipments_booking_ref ON shipments(booking_ref);
CREATE INDEX idx_shipments_waybill_number ON shipments(waybill_number);
CREATE INDEX idx_shipments_assigned_agent_id ON shipments(assigned_agent_id);
CREATE INDEX idx_shipments_current_status ON shipments(current_status);
CREATE INDEX idx_shipments_mode ON shipments(mode);
CREATE INDEX idx_shipments_created_by ON shipments(created_by);
