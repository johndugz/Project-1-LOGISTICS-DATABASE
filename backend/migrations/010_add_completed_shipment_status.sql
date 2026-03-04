-- Migration: 010_add_completed_shipment_status

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'shipment_status'
      AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE shipment_status ADD VALUE 'completed';
  END IF;
END$$;