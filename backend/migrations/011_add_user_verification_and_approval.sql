-- Migration: 011_add_user_verification_and_approval
-- Adds email verification and admin approval controls for user onboarding

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_verification_code_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_users_pending_approval ON users(admin_approved, email_verified);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_code_hash ON users(email_verification_code_hash);
