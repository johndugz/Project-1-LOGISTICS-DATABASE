-- Migration: 004_create_packages_table

CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  barcode VARCHAR(100) UNIQUE,
  qr_code VARCHAR(255) UNIQUE,
  piece_number INTEGER NOT NULL,
  weight DECIMAL(10, 2),
  dimensions VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_packages_shipment_id ON packages(shipment_id);
CREATE INDEX idx_packages_barcode ON packages(barcode);
CREATE INDEX idx_packages_qr_code ON packages(qr_code);
CREATE INDEX idx_packages_status ON packages(status);
