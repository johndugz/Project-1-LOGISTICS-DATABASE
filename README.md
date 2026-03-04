# TOPLIS Logistics - Forwarding Automation MVP

A comprehensive multi-user web system for TOPLIS LOGISTICS (domestic PH) to manage shipment bookings, documentation, monitoring, and final delivery updates using barcode/QR scans.

## 🎯 Features

- **Multi-user Auth & Role-based Access Control**
  - Admin, Operator, Agent, Customer, Auditor roles
  - JWT token-based authentication
  - Region-based agent assignment

- **Shipment Lifecycle Management**
  - Create bookings with automatic waybill number generation
  - Track shipment events (picked-up, at-depot, delivered, etc.)
  - Multi-piece package tracking
  - Automatic and manual event creation

- **Barcode/QR Code Scanning**
  - Real-time package scanning (camera or manual input)
  - Single and batch scan support
  - Duplicate scan detection (idempotency)
  - Offline queue support (client-side)
  - Geolocation tracking

- **Document Generation**
  - Waybill, AWB, House B/L templates
  - PDF generation and storage (S3/MinIO)
  - Document versioning

- **Monitoring Dashboard**
  - Real-time shipment list and filters
  - Status overview
  - Agent assignment tracking
  - Audit logs

- **API & Integrations**
  - RESTful API with role-based middleware
  - API key authentication for carriers
  - Webhook endpoints for carrier auto-updates
  - CSV export for reports

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Auth**: JWT + bcrypt
- **File Storage**: AWS S3 (or MinIO for dev)
- **Real-time**: Socket.IO (ready for implementation)

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Scanner**: @zxing/browser
- **State**: Zustand
- **Build**: Vite
- **Routing**: React Router v6

### DevOps
- **Container**: Docker & Docker Compose

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/        # Database config
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth & audit
│   │   ├── models/        # TypeScript types
│   │   ├── routes/        # API routes
│   │   ├── utils/         # Services (auth, shipment)
│   │   └── index.ts       # Express app
│   ├── migrations/        # SQL migrations
│   ├── tests/             # Unit tests
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client
│   │   ├── types/         # TypeScript types
│   │   ├── utils/         # Zustand stores
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 15+ (for local development)

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:5000
# - MinIO Console: http://localhost:9001
# - PostgreSQL: localhost:5432
```

### Local Development Setup

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your local settings

# Run migrations
npm run migrate

# Start dev server
npm run dev

# Terminal: http://localhost:5000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Opens: http://localhost:3000
```

## 📚 API Documentation

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@toplis.com",
  "password": "password"
}
```

Response:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@toplis.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin"
  }
}
```

### Bookings

#### Create Booking
```http
POST /api/bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "shipperName": "Shipper Corp",
  "shipperAddress": "123 Main St",
  "consigneeName": "Consignee Corp",
  "consigneeAddress": "456 Oak Ave",
  "originCity": "Manila",
  "originCountry": "PH",
  "destinationCity": "Cebu",
  "destinationCountry": "PH",
  "mode": "sea",
  "totalPieces": 10,
  "totalWeight": 500.50,
  "commodityDescription": "Electronics",
  "estimatedArrival": "2024-03-10T00:00:00Z"
}
```

#### Get Booking
```http
GET /api/bookings/:id
Authorization: Bearer <token>
```

#### List Bookings
```http
GET /api/bookings?offset=0&limit=20&status=delivered&mode=sea
Authorization: Bearer <token>
```

### Scanning

#### Scan Package
```http
POST /api/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "BARCODE123456",
  "device_id": "device-12345",
  "location": "Warehouse A",
  "latitude": 14.5994,
  "longitude": 120.9842
}
```

Response:
```json
{
  "message": "Scan recorded successfully",
  "event": { /* shipment event */ },
  "shipment": { /* updated shipment */ },
  "package": { /* scanned package */ },
  "allPiecesScanned": false
}
```

#### Batch Scan
```http
POST /api/scan/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "codes": ["CODE1", "CODE2", "CODE3"],
  "device_id": "device-12345",
  "location": "Warehouse A"
}
```

#### Get Package Status
```http
GET /api/scan/:code
```

## 🔐 Database Schema

### Key Tables

**users**
- id (UUID, PK)
- email, password_hash
- first_name, last_name
- role (enum: admin, operator, agent, customer, auditor)
- region
- is_active
- created_at, updated_at

**shipments**
- id (UUID, PK)
- booking_ref, waybill_number (unique)
- shipper/consignee details
- origin/destination cities & countries
- mode (sea, air, land)
- total_pieces, total_weight
- current_status (enum)
- assigned_agent_id (FK → agents)
- estimated_arrival, actual_arrival
- created_by (FK → users)

**packages**
- id (UUID, PK)
- shipment_id (FK → shipments)
- barcode, qr_code (unique)
- piece_number
- weight, dimensions
- status

**shipment_events**
- id (UUID, PK)
- shipment_id, package_id (FK)
- event_type
- location, latitude, longitude
- created_by (FK → users)
- device_id, scan_code
- created_at

**audit_logs**
- id (UUID, PK)
- user_id, action, resource_type, resource_id
- changes (JSONB)
- ip_address, user_agent
- created_at

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend (recommended: Vitest, Playwright)
cd frontend
npm test
```

## 📋 Sample Data

### Demo User Credentials

```
Admin User:
  Email: admin@toplis.com
  Password: password
  Role: admin

Agent User (Metro Manila):
  Email: agent.manila@toplis.com
  Password: password
  Role: agent
  Region: NCR

Operator User:
  Email: operator@toplis.com
  Password: password
  Role: operator

Customer User:
  Email: customer@toplis.com
  Password: password
  Role: customer
```

To seed demo data, run:
```bash
cd backend
npm run seed  # (create seed script if needed)
```

## 🌐 Postman Collection

A Postman collection is available in `docs/TOPLIS-Logistics.postman_collection.json`

Import it in Postman:
1. File → Import
2. Select the JSON file
3. Set the base URL variable to `http://localhost:5000`

## 🔗 Real-time Features (Socket.IO - Ready)

Socket events prepared for future implementation:
- `shipment:status-update` - Real-time shipment status changes
- `scan:event` - Live scan events
- `dashboard:shipment-filter` - Live dashboard updates

## 📱 Mobile Considerations

- **Responsive Design**: All UI is mobile-first with Tailwind CSS
- **Camera Access**: HTTPS required in production for camera API
- **Offline Support**: Scan queue stored in localStorage for offline sync
- **Geolocation**: Optional, requests user permission

## 🔒 Security Features

- ✅ JWT token-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Password hashing (bcrypt)
- ✅ Audit logging (all user actions)
- ✅ Rate limiting ready (use express-rate-limit)
- ✅ CORS configured
- ✅ PII data protection (documents on S3)
- ✅ API key authentication for carriers

## 🚢 Production Deployment

For a free-tier deployment path (Neon + Render + Cloudflare Pages), see `docs/FREE_HOSTING.md`.

### Pre-deployment Checklist

1. **Environment Variables**
   ```bash
   # Update .env
   JWT_SECRET=<strong-random-key>
   DB_PASSWORD=<strong-db-password>
   # AWS S3 credentials
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=ap-southeast-1
   ```

2. **Database**
   ```bash
   # Backup production database before migrations
   # Run migrations in order
   ```

3. **SSL/TLS**
   ```bash
   # Use nginx-certbot for Let's Encrypt SSL
   # Update docker-compose with SSL volume
   ```

4. **Monitoring**
   ```bash
   # Set up logging aggregation (ELK, Datadog, etc.)
   # Configure error tracking (Sentry)
   ```

### Docker Production Build

```bash
# Build optimized images
docker-compose -f docker-compose.yml build --no-cache

# Tag for registry
docker tag toplis-backend <registry>/toplis-backend:1.0.0
docker push <registry>/toplis-backend:1.0.0

# Deploy to ECS, K8s, or VM
```

## 📝 Logging & Monitoring

- **Audit Logs**: All user actions logged in audit_logs table
- **Application Logs**: Structured logging to console (redirect to ELK/CloudWatch in prod)
- **Performance**: Track slow queries, API response times
- **Alerts**: Set up alerts for: delivery exceptions, payment failures, high error rates

## 🛣️ Roadmap

- [ ] Real-time updates with Socket.IO
- [ ] SMS/Email notifications (Twilio)
- [ ] Advanced reporting & analytics (Metabase)
- [ ] Multi-language support (i18n)
- [ ] Mobile native apps (React Native)
- [ ] Customs integration APIs
- [ ] AI-powered route optimization
- [ ] Blockchain for document verification

## 🤝 Contributing

1. Create a feature branch
2. Commit changes with descriptive messages
3. Push and create a Pull Request
4. Ensure all tests pass

## 📄 License

This project is proprietary to TOPLIS LOGISTICS. All rights reserved.

## 📞 Support

- **Email**: support@toplis.com
- **Documentation**: https://docs.toplis.com
- **Issues**: Create an issue in this repository

---

### Key Implementation Notes

- **Waybill Generation**: Format `TOPLIS-YYYYMMDD-XXXXXX` where X is random 6-digit counter
- **Idempotency**: Duplicate scans within 5 minutes are rejected with 409 status
- **Permissions**: Agents see only their assigned region's shipments
- **Offline Sync**: Client caches scans → syncs on connection restore
- **Documents**: All PDFs stored as S3 objects with presigned URLs for secure access
- **Rate Limiting**: Implement for `/api/scan` to prevent abuse
- **Pagination**: All LIST endpoints paginated with offset/limit
