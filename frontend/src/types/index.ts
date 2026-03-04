export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  AGENT = 'agent',
  CUSTOMER = 'customer',
  AUDITOR = 'auditor',
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

export enum ShipmentMode {
  SEA = 'sea',
  AIR = 'air',
  LAND = 'land',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  region?: string;
  phone?: string;
  isActive: boolean;
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
  current_status: ShipmentStatus;
  estimated_arrival: string;
  actual_arrival?: string;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  shipment_id: string;
  barcode: string;
  qr_code: string;
  piece_number: number;
  weight?: number;
  status: ShipmentStatus;
  created_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  package_id?: string;
  event_type: ShipmentStatus;
  location?: string;
  latitude?: number;
  longitude?: number;
  device_id?: string;
  scan_code?: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ScanResult {
  message: string;
  event: ShipmentEvent;
  shipment: Shipment;
  package: Package;
  allPiecesScanned: boolean;
  isDuplicate?: boolean;
}
