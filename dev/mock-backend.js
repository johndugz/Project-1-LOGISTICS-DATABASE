const http = require('http');

const mockShipments = [
  {
    id: 'shp-001',
    booking_ref: 'BKG-MNL-2026-0001',
    waybill_number: 'WB-PH-9876543210',
    shipper_name: 'JRS Industrial Supplies Inc.',
    shipper_address: '1828 Rizal Ave, Manila, NCR',
    consignee_name: 'Cebu BuildTech Trading',
    consignee_address: 'A.S. Fortuna St, Mandaue City, Cebu',
    origin_city: 'Manila',
    origin_country: 'PH',
    destination_city: 'Cebu',
    destination_country: 'PH',
    mode: 'sea',
    total_pieces: 24,
    total_weight: 1280.5,
    commodity_description: 'Construction fasteners and hand tools',
    current_status: 'at_depot',
    estimated_arrival: '2026-03-06T08:00:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-01T02:22:00.000Z',
    updated_at: '2026-03-03T05:10:00.000Z',
  },
  {
    id: 'shp-002',
    booking_ref: 'BKG-DVO-2026-0044',
    waybill_number: 'WB-PH-9876543211',
    shipper_name: 'Mindanao Fresh Produce Cooperative',
    shipper_address: 'Buhangin District, Davao City',
    consignee_name: 'Metro Cold Chain Hub',
    consignee_address: 'North Harbor, Tondo, Manila',
    origin_city: 'Davao',
    origin_country: 'PH',
    destination_city: 'Manila',
    destination_country: 'PH',
    mode: 'air',
    total_pieces: 12,
    total_weight: 420.75,
    commodity_description: 'Temperature-sensitive fresh fruit pallets',
    current_status: 'departed',
    estimated_arrival: '2026-03-03T18:30:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-02T00:15:00.000Z',
    updated_at: '2026-03-03T08:40:00.000Z',
  },
  {
    id: 'shp-003',
    booking_ref: 'BKG-BCD-2026-0118',
    waybill_number: 'WB-PH-9876543212',
    shipper_name: 'Negros Pharma Distribution',
    shipper_address: 'Lacson St, Bacolod City',
    consignee_name: 'Iloilo Medical Center Supply Unit',
    consignee_address: 'Mandurriao, Iloilo City',
    origin_city: 'Bacolod',
    origin_country: 'PH',
    destination_city: 'Iloilo',
    destination_country: 'PH',
    mode: 'land',
    total_pieces: 8,
    total_weight: 198.2,
    commodity_description: 'Pharmaceutical consumables',
    current_status: 'out_for_delivery',
    estimated_arrival: '2026-03-03T12:00:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-02T09:10:00.000Z',
    updated_at: '2026-03-03T09:00:00.000Z',
  },
  {
    id: 'shp-004',
    booking_ref: 'BKG-CRK-2026-0191',
    waybill_number: 'WB-PH-9876543213',
    shipper_name: 'Clark Electronics Components Ltd.',
    shipper_address: 'Clark Freeport Zone, Pampanga',
    consignee_name: 'Laguna Device Assembly Plant',
    consignee_address: 'Biñan, Laguna',
    origin_city: 'Pampanga',
    origin_country: 'PH',
    destination_city: 'Laguna',
    destination_country: 'PH',
    mode: 'land',
    total_pieces: 36,
    total_weight: 910.0,
    commodity_description: 'Semiconductor trays and ESD packaging',
    current_status: 'delivered',
    estimated_arrival: '2026-03-02T17:00:00.000Z',
    actual_arrival: '2026-03-02T15:48:00.000Z',
    created_at: '2026-02-28T03:50:00.000Z',
    updated_at: '2026-03-02T15:48:00.000Z',
  },
  {
    id: 'shp-005',
    booking_ref: 'BKG-GEN-2026-0233',
    waybill_number: 'WB-PH-9876543214',
    shipper_name: 'General Santos Tuna Processors',
    shipper_address: 'Tambler, General Santos City',
    consignee_name: 'Cagayan Food Distribution Center',
    consignee_address: 'Macasandig, Cagayan de Oro',
    origin_city: 'General Santos',
    origin_country: 'PH',
    destination_city: 'Cagayan de Oro',
    destination_country: 'PH',
    mode: 'sea',
    total_pieces: 18,
    total_weight: 1540.3,
    commodity_description: 'Frozen seafood cartons',
    current_status: 'picked_up',
    estimated_arrival: '2026-03-07T04:30:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-03T01:12:00.000Z',
    updated_at: '2026-03-03T02:00:00.000Z',
  },
  {
    id: 'shp-006',
    booking_ref: 'BKG-ILO-2026-0255',
    waybill_number: 'WB-PH-9876543215',
    shipper_name: 'Western Visayas Retail Group',
    shipper_address: 'Jaro, Iloilo City',
    consignee_name: 'Ormoc Central Warehouse',
    consignee_address: 'Ormoc City, Leyte',
    origin_city: 'Iloilo',
    origin_country: 'PH',
    destination_city: 'Ormoc',
    destination_country: 'PH',
    mode: 'sea',
    total_pieces: 27,
    total_weight: 735.45,
    commodity_description: 'Retail dry goods and FMCG assortments',
    current_status: 'loaded',
    estimated_arrival: '2026-03-05T10:00:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-02T14:43:00.000Z',
    updated_at: '2026-03-03T06:33:00.000Z',
  },
  {
    id: 'shp-007',
    booking_ref: 'BKG-MNL-2026-0301',
    waybill_number: 'WB-PH-9876543216',
    shipper_name: 'Pasig Textile Imports Corp.',
    shipper_address: 'Ortigas Center, Pasig City',
    consignee_name: 'Baguio Apparel Manufacturing',
    consignee_address: 'PEZA Economic Zone, Baguio City',
    origin_city: 'Pasig',
    origin_country: 'PH',
    destination_city: 'Baguio',
    destination_country: 'PH',
    mode: 'land',
    total_pieces: 15,
    total_weight: 560.0,
    commodity_description: 'Fabric rolls and garment accessories',
    current_status: 'created',
    estimated_arrival: '2026-03-04T13:00:00.000Z',
    actual_arrival: null,
    created_at: '2026-03-03T04:05:00.000Z',
    updated_at: '2026-03-03T04:05:00.000Z',
  },
  {
    id: 'shp-008',
    booking_ref: 'BKG-ZAM-2026-0338',
    waybill_number: 'WB-PH-9876543217',
    shipper_name: 'Zamboanga Marine Equipment',
    shipper_address: 'Canelar, Zamboanga City',
    consignee_name: 'Palawan Harbor Maintenance Unit',
    consignee_address: 'Puerto Princesa City, Palawan',
    origin_city: 'Zamboanga',
    origin_country: 'PH',
    destination_city: 'Puerto Princesa',
    destination_country: 'PH',
    mode: 'sea',
    total_pieces: 10,
    total_weight: 860.9,
    commodity_description: 'Marine spare parts and safety kits',
    current_status: 'arrived',
    estimated_arrival: '2026-03-03T07:00:00.000Z',
    actual_arrival: '2026-03-03T06:47:00.000Z',
    created_at: '2026-03-01T10:20:00.000Z',
    updated_at: '2026-03-03T06:47:00.000Z',
  },
];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', timestamp: new Date() }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      // very small mock: accept any credentials and return a fake token
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          token: 'mocked-jwt-token',
          user: {
            id: 'mock-user-1',
            email: 'admin@toplis.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isActive: true,
          },
        })
      );
    });
    return;
  }

  if (req.method === 'GET' && req.url && req.url.startsWith('/api/bookings')) {
    const requestUrl = new URL(req.url, 'http://localhost:5000');
    const status = requestUrl.searchParams.get('status');
    const mode = requestUrl.searchParams.get('mode');
    const offset = Number(requestUrl.searchParams.get('offset') || 0);
    const limit = Number(requestUrl.searchParams.get('limit') || 20);

    const filteredShipments = mockShipments.filter((shipment) => {
      const statusMatch = status ? shipment.current_status === status : true;
      const modeMatch = mode ? shipment.mode === mode : true;
      return statusMatch && modeMatch;
    });

    const paginatedShipments = filteredShipments.slice(offset, offset + limit);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        data: paginatedShipments,
        total: filteredShipments.length,
      })
    );
    return;
  }

  // fallback for other API calls used by frontend
  if (req.method === 'GET' && req.url && req.url.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'mock response' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(5000, () => console.log('Mock backend listening on http://localhost:5000'));
