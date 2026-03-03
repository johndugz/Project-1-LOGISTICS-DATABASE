import { FormEvent, useEffect, useState } from 'react';
import Scanner from './components/Scanner';

type Shipment = {
  booking_no: string;
  port_origin: string;
  port_destination: string;
  shipper_name: string;
  consignee_name: string;
  status: string;
};

const demoBooking = {
  booking_no: 'TPL-0002',
  port_origin: 'Manila',
  port_destination: 'Cebu',
  service_mode: 'Airfreight',
  commodity: 'Auto parts',
  declared_value: 8000,
  item_count: '1 crate',
  weight: 2,
  cbm: 0.025,
  dimension: '40x25x25',
  pickup_datetime: '2026-03-01 09:00:00',
  remarks: 'Handle with care',
  shipper_name: 'Toplis Main Hub',
  shipper_address: 'Taguig City',
  shipper_contact_person: 'Ana Cruz',
  shipper_telephone: '09170000000',
  consignee_name: 'Dealer Cebu',
  consignee_address: 'Cebu City',
  consignee_contact_person: 'Juan Dela Cruz',
  consignee_telephone: '09171111111',
  return_documents: 'Signed POD'
};

export default function App() {
  const [token, setToken] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [message, setMessage] = useState('Use admin/password to login.');

  async function login(e: FormEvent) {
    e.preventDefault();
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    const data = await response.json();
    if (response.ok) {
      setToken(data.token);
      setMessage('Login successful');
    } else {
      setMessage(data.message || 'Login failed');
    }
  }

  async function loadBookings(jwt: string) {
    const response = await fetch('http://localhost:4000/api/bookings', {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    const data = await response.json();
    if (response.ok) {
      setShipments(data);
    }
  }

  async function createDemoBooking() {
    const response = await fetch('http://localhost:4000/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(demoBooking)
    });
    if (response.ok) {
      setMessage('Demo booking created');
      loadBookings(token);
    } else {
      const data = await response.json();
      setMessage(data.message || 'Failed to create booking');
    }
  }

  useEffect(() => {
    if (token) {
      loadBookings(token);
    }
  }, [token]);

  return (
    <main style={{ fontFamily: 'Arial', maxWidth: 920, margin: '1.5rem auto', padding: '0 1rem' }}>
      <h1>TOPLIS Logistics – Domestic Forwarding MVP</h1>
      <p>{message}</p>
      {!token ? (
        <button onClick={login}>Login as Admin</button>
      ) : (
        <>
          <button onClick={createDemoBooking}>Create Demo Booking</button>
          <h3>Shipments</h3>
          <table width="100%" cellPadding={8} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Booking No</th>
                <th align="left">Route</th>
                <th align="left">Shipper</th>
                <th align="left">Consignee</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.booking_no}>
                  <td>{s.booking_no}</td>
                  <td>{s.port_origin} → {s.port_destination}</td>
                  <td>{s.shipper_name}</td>
                  <td>{s.consignee_name}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Scanner token={token} />
        </>
      )}
    </main>
  );
}
