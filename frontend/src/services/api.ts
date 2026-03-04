import axios, { AxiosInstance } from 'axios';
import { User, LoginResponse, Shipment } from '../types';

// Vite exposes environment variables prefixed with VITE_
// you can define VITE_API_URL in a .env file or rely on the fallback below
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on init
    this.token = localStorage.getItem('authToken');
    if (this.token) {
      this.setAuthHeader(this.token);
    }
  }

  private setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', {
      email,
      password,
    });

    this.token = response.data.token;
    localStorage.setItem('authToken', this.token);
    this.setAuthHeader(this.token);

    return response.data;
  }

  async logout(): Promise<void> {
    this.token = null;
    localStorage.removeItem('authToken');
    delete this.client.defaults.headers.common['Authorization'];
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get<User>('/auth/profile');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.put<User>('/auth/profile', data);
    return response.data;
  }

  async createBooking(bookingData: Record<string, unknown>): Promise<Shipment> {
    const response = await this.client.post<{ data: Shipment }>('/bookings', bookingData);
    return response.data.data;
  }

  async updateBooking(shipmentId: string, bookingData: Record<string, unknown>): Promise<Shipment> {
    const response = await this.client.put<{ data: Shipment }>(`/bookings/${shipmentId}`, bookingData);
    return response.data.data;
  }

  async deleteBooking(shipmentId: string): Promise<void> {
    await this.client.delete(`/bookings/${shipmentId}`);
  }

  async addBookingEvent(
    shipmentId: string,
    eventData: FormData
  ): Promise<Record<string, unknown>> {
    const response = await this.client.post(`/bookings/${shipmentId}/events`, eventData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteBookingEvent(shipmentId: string, eventId: string): Promise<Record<string, unknown>> {
    const response = await this.client.delete(`/bookings/${shipmentId}/events/${eventId}`);
    return response.data;
  }

  async getShipment(shipmentId: string): Promise<Record<string, unknown>> {
    const response = await this.client.get(`/bookings/${shipmentId}`);
    return response.data;
  }

  async listShipments(
    offset = 0,
    limit = 20,
    filters?: Record<string, unknown>
  ): Promise<{ data: Shipment[]; total: number }> {
    const response = await this.client.get<{ data: Shipment[]; total: number }>('/bookings', {
      params: {
        offset,
        limit,
        ...filters,
      },
    });
    return response.data;
  }

  async scan(
    code: string,
    deviceId: string,
    location?: string,
    latitude?: number,
    longitude?: number
  ): Promise<Record<string, unknown>> {
    const response = await this.client.post('/scan', {
      code,
      device_id: deviceId,
      location,
      latitude,
      longitude,
    });
    return response.data;
  }

  async batchScan(
    codes: string[],
    deviceId: string,
    location?: string
  ): Promise<Record<string, unknown>> {
    const response = await this.client.post('/scan/batch', {
      codes,
      device_id: deviceId,
      location,
    });
    return response.data;
  }

  async getPackageStatus(code: string): Promise<Record<string, unknown>> {
    const response = await this.client.get(`/scan/${code}`);
    return response.data;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export default new ApiService();
