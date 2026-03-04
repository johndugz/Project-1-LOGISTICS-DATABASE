-- Migration: 009_create_shipment_event_attachments

CREATE TABLE shipment_event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_event_id UUID NOT NULL UNIQUE REFERENCES shipment_events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(255),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipment_event_attachments_event_id ON shipment_event_attachments(shipment_event_id);
CREATE INDEX idx_shipment_event_attachments_uploaded_by ON shipment_event_attachments(uploaded_by);
CREATE INDEX idx_shipment_event_attachments_created_at ON shipment_event_attachments(created_at);