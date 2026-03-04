export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  AGENT = 'agent',
  CUSTOMER = 'customer',
  AUDITOR = 'auditor',
}

export enum ShipmentMode {
  SEA = 'sea',
  AIR = 'air',
  LAND = 'land',
}

export enum ShipmentStatus {
  CREATED = 'created',
  PICKED_UP = 'picked_up',
  AT_DEPOT = 'at_depot',
  LOADED = 'loaded',
  DEPARTED = 'departed',
  ARRIVED = 'arrived',
  CUSTOMS_HOLD = 'customs_hold',
  CLEARED = 'cleared',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  region?: string;
  phone?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: string;
  user_id: string;
  region: string;
  assigned_modes: ShipmentMode[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Shipment {
  id: string;
  booking_ref: string;
  waybill_number: string;
  shipper_name: string;
  shipper_address: string;
  consignee_name: string;
  consignee_address: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  mode: ShipmentMode;
  total_pieces: number;
  total_weight: number;
  commodity_description: string;
  assigned_agent_id: string;
  current_status: ShipmentStatus;
  estimated_arrival: Date;
  actual_arrival?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Package {
  id: string;
  shipment_id: string;
  barcode: string;
  qr_code: string;
  piece_number: number;
  weight: number;
  dimensions?: string;
  status: ShipmentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  package_id?: string;
  event_type: ShipmentStatus;
  location?: string;
  latitude?: number;
  longitude?: number;
  created_by: string;
  device_id?: string;
  scan_code?: string;
  notes?: string;
  created_at: Date;
}

export interface Document {
  id: string;
  shipment_id: string;
  document_type: 'waybill' | 'awb' | 'bl' | 'invoice' | 'customs';
  file_path: string;
  s3_key?: string;
  file_size: number;
  created_by: string;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  is_active: boolean;
  last_used_at?: Date;
  created_at: Date;
  expires_at?: Date;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  region?: string;
}

export interface ScanPayload {
  code: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  device_id: string;
}
