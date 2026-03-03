import { FormEvent, useState } from 'react';

type Props = {
  token: string;
};

export default function Scanner({ token }: Props) {
  const [bookingNo, setBookingNo] = useState('');
  const [scanPoint, setScanPoint] = useState('ARRIVED_AT_ORIGIN');
  const [result, setResult] = useState<string>('');

  async function submitScan(e: FormEvent) {
    e.preventDefault();
    setResult('Submitting...');
    const response = await fetch('http://localhost:4000/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ booking_no: bookingNo, scan_point: scanPoint })
    });

    const data = await response.json();
    setResult(response.ok ? `Updated ${data.booking_no} to ${data.status}` : data.message || 'Failed');
  }

  return (
    <form onSubmit={submitScan} style={{ display: 'grid', gap: 8 }}>
      <h3>Scanner</h3>
      <input
        placeholder="Booking No (e.g. TPL-0001)"
        value={bookingNo}
        onChange={(e) => setBookingNo(e.target.value)}
      />
      <select value={scanPoint} onChange={(e) => setScanPoint(e.target.value)}>
        <option value="ARRIVED_AT_ORIGIN">Arrived at Origin</option>
        <option value="IN_TRANSIT">In Transit</option>
        <option value="ARRIVED_AT_DESTINATION">Arrived at Destination</option>
        <option value="DELIVERED">Delivered</option>
      </select>
      <button type="submit">Submit Scan</button>
      <small>{result}</small>
    </form>
  );
}
