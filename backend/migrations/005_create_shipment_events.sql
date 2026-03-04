-- Migration: 005_create_shipment_events_table

CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_by UUID NOT NULL REFERENCES users(id),
  device_id VARCHAR(100),
  scan_code VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipment_events_shipment_id ON shipment_events(shipment_id);
CREATE INDEX idx_shipment_events_package_id ON shipment_events(package_id);
CREATE INDEX idx_shipment_events_event_type ON shipment_events(event_type);
CREATE INDEX idx_shipment_events_created_by ON shipment_events(created_by);
CREATE INDEX idx_shipment_events_created_at ON shipment_events(created_at);
