# 📂 Project File Structure & Index

## Directory Tree

```
Project-1/
├── README.md ............................ Main project documentation
├── SUMMARY.md ........................... Quick summary of deliverables
├── .gitignore ........................... Git exclusion rules
├── docker-compose.yml ................... Complete stack orchestration
│
├── backend/ ............................. Node.js Express API
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.json
│   ├── .env.example
│   ├── .eslintrc.json
│   ├── .prettierrc
│   ├── .gitignore
│   ├── Dockerfile
│   │
│   ├── src/
│   │   ├── index.ts ..................... Express server entry point
│   │   │
│   │   ├── config/
│   │   │   └── database.ts .............. PostgreSQL connection & migrations
│   │   │
│   │   ├── models/
│   │   │   └── types.ts ................. TypeScript interfaces for all entities
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.ts .................. JWT verification & role middleware
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.ts ........ User registration & login
│   │   │   ├── bookingController.ts ..... Shipment CRUD endpoints
│   │   │   └── scanController.ts ........ Barcode scanning endpoints
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.ts .................. /api/auth/* routes
│   │   │   ├── bookings.ts .............. /api/bookings/* routes
│   │   │   └── scan.ts .................. /api/scan/* routes
│   │   │
│   │   ├── utils/
│   │   │   ├── auth.ts .................. Password hashing, JWT, waybill generation
│   │   │   ├── audit.ts ................. Audit logging utilities
│   │   │   ├── errors.ts ................ Error classes and handling
│   │   │   └── shipmentService.ts ....... Shipment & package database service
│   │   │
│   │   └── types/
│   │       └── express.d.ts ............. Express request type augmentation
│   │
│   ├── migrations/
│   │   ├── 001_create_users.sql ......... Users table & roles
│   │   ├── 002_create_agents.sql ........ Agents table
│   │   ├── 003_create_shipments.sql ..... Shipments table
│   │   ├── 004_create_packages.sql ...... Packages table
│   │   ├── 005_create_shipment_events.sql ........... Events table
│   │   ├── 006_create_documents.sql .... Documents table
│   │   ├── 007_create_api_keys.sql ..... API keys table
│   │   ├── 008_create_audit_logs.sql ... Audit logs table
│   │   └── migrate.ts ................... Migration runner
│   │
│   ├── seeds/
│   │   └── seed.ts ...................... Demo data generator
│   │
│   └── tests/
│       ├── scan.test.ts ................. Unit tests for scanning
│       └── (more tests to be added)
│
├── frontend/ ............................ React TypeScript SPA
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── nginx.conf
│   ├── .gitignore
│   ├── index.html
│   ├── Dockerfile
│   │
│   ├── src/
│   │   ├── main.tsx ..................... React entry point
│   │   ├── App.tsx ...................... Main app component with routing
│   │   ├── index.css .................... Tailwind CSS imports
│   │   ├── vite-env.d.ts ................ Vite type definitions
│   │   │
│   │   ├── pages/
│   │   │   ├── Login.tsx ................ Authentication page
│   │   │   ├── Dashboard.tsx ............ Shipment list with filters
│   │   │   └── ScannerPage.tsx .......... Scanner UI with stats
│   │   │
│   │   ├── components/
│   │   │   └── Scanner.tsx .............. ⭐ Full-featured barcode/QR scanner
│   │   │       - Camera detection
│   │   │       - Manual input fallback
│   │   │       - Geolocation tracking
│   │   │       - Audio feedback
│   │   │       - Duplicate detection
│   │   │       - Session stats
│   │   │
│   │   ├── services/
│   │   │   └── api.ts ................... Axios HTTP client with JWT auth
│   │   │
│   │   ├── types/
│   │   │   └── index.ts ................. TypeScript interfaces matching backend
│   │   │
│   │   └── utils/
│   │       └── authStore.ts ............ Zustand state management
│   │
│   └── public/
│       └── (static assets go here)
│
└── docs/ ................................ Documentation
    ├── ARCHITECTURE.md .................. System design & scalability
    ├── DEPLOYMENT.md .................... Production deployment guide
    ├── LOCAL_SETUP.md ................... Local development setup
    └── TOPLIS-Logistics.postman_collection.json
        └── API endpoints for testing
```

---

## File Descriptions & Purpose

### Core Backend Files

| File | Purpose |
|------|---------|
| `backend/src/index.ts` | Express server initialization, route registration |
| `backend/src/config/database.ts` | PostgreSQL connection pool, migration runner |
| `backend/src/models/types.ts` | TypeScript interfaces for User, Shipment, Package, Event, etc. |
| `backend/src/utils/auth.ts` | Utilities: password hashing, JWT generation, waybill creation |
| `backend/src/utils/shipmentService.ts` | Database operations for shipments (CRUD, status updates) |
| `backend/src/middleware/auth.ts` | JWT verification, role-based authorization |
| `backend/src/controllers/authController.ts` | Login, register, profile endpoints |
| `backend/src/controllers/bookingController.ts` | Booking list, create, details endpoints |
| `backend/src/controllers/scanController.ts` | Scan handling with duplicate detection |

### Database Migration Files

| File | Purpose |
|------|---------|
| `001_create_users.sql` | Users table with roles (admin, operator, agent, customer, auditor) |
| `002_create_agents.sql` | Agents with region and assigned transportation modes |
| `003_create_shipments.sql` | Main shipments table with 9 status types |
| `004_create_packages.sql` | Individual packages with barcode/QR codes |
| `005_create_shipment_events.sql` | Immutable event log for tracking history |
| `006_create_documents.sql` | Document references for waybills, invoices, etc. |
| `007_create_api_keys.sql` | API key authentication for carrier integrations |
| `008_create_audit_logs.sql` | Comprehensive audit trail (JSONB support) |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | Main component with routing (Login, Dashboard, Scanner) |
| `frontend/src/pages/Login.tsx` | Authentication page with demo credentials |
| `frontend/src/pages/Dashboard.tsx` | Shipment list view with status/mode filters |
| `frontend/src/pages/ScannerPage.tsx` | Scanner interface with session statistics |
| `frontend/src/components/Scanner.tsx` | **⭐ Full barcode/QR scanner implementation** |
| `frontend/src/services/api.ts` | Axios client with JWT authentication |
| `frontend/src/utils/authStore.ts` | Zustand store for authentication state |
| `frontend/src/types/index.ts` | TypeScript interfaces (User, Shipment, ScanResult, etc.) |

### Configuration Files

| File | Purpose |
|------|---------|
| `backend/package.json` | Dependencies (Express, JWT, bcrypt, PG, etc.) |
| `backend/tsconfig.json` | TypeScript strict mode configuration |
| `backend/.env.example` | Environment variable template |
| `frontend/vite.config.ts` | Vite bundler with API proxy |
| `frontend/tailwind.config.js` | Tailwind CSS theme customization |
| `docker-compose.yml` | PostgreSQL, Backend, Frontend, MinIO orchestration |

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Complete project overview, getting started, API docs |
| `SUMMARY.md` | Quick reference of all deliverables |
| `docs/ARCHITECTURE.md` | System design, database schema, security model |
| `docs/DEPLOYMENT.md` | Production deployment with 4 options (ECS, EB, AppRunner, EC2) |
| `docs/LOCAL_SETUP.md` | Step-by-step local development setup |
| `docs/TOPLIS-Logistics.postman_collection.json` | Postman/Thunder Client API collection |

---

## API Endpoints Reference

### Authentication
```
POST   /api/auth/login               - User login
POST   /api/auth/register            - Create user (admin only)
GET    /api/auth/profile             - Get current user
PUT    /api/auth/profile             - Update current user
```

### Shipment Bookings
```
POST   /api/bookings                 - Create new booking
GET    /api/bookings                 - List bookings (with filters)
GET    /api/bookings/:id             - Get booking details
```

### Scanning
```
POST   /api/scan                     - Scan single package
POST   /api/scan/batch               - Batch scan multiple codes
GET    /api/scan/:code               - Get package status
```

---

## Database Tables Reference

| Table | Purpose | Records |
|-------|---------|---------|
| `users` | User accounts with roles | 6 demo users |
| `agents` | Regional agents | 2 demo agents |
| `shipments` | Main shipment records | 5 demo shipments |
| `packages` | Individual packages (pieces) | ~75 demo packages |
| `shipment_events` | Immutable event log | Auto-populated on scans |
| `documents` | Document storage references | For D/A, invoices |
| `api_keys` | Carrier API authentication | Empty (ready) |
| `audit_logs` | Audit trail | Auto-logged actions |
| `migrations` | Migration tracking | Managed by runner |

---

## Technology Stack Checklist

✅ **Backend**
- Node.js 20 LTS
- Express 4.18
- TypeScript 5.2
- PostgreSQL 15
- JWT authentication
- bcrypt password hashing
- Docker

✅ **Frontend**
- React 18
- TypeScript 5
- Tailwind CSS 3.3
- Vite 5.0
- React Router 6
- Zustand state management
- @zxing/browser for scanning
- Axios HTTP client

✅ **DevOps**
- Docker & Docker Compose
- Nginx reverse proxy
- MinIO S3-compatible storage
- Database persistence volumes

✅ **Development Tools**
- ESLint & Prettier
- Jest for testing
- Postman collection
- Docker for containerization

---

## Quick Navigation

### For Developers
1. **Local Setup**: See `docs/LOCAL_SETUP.md`
2. **Code Structure**: See this file (FILE_INDEX.md)
3. **API Testing**: Import `docs/TOPLIS-Logistics.postman_collection.json`

### For DevOps/Deployment
1. **Architecture**: See `docs/ARCHITECTURE.md`
2. **Production Deployment**: See `docs/DEPLOYMENT.md`
3. **Docker Setup**: Use `docker-compose.yml`

### For Project Managers
1. **Overview**: See `README.md`
2. **What's Delivered**: See `SUMMARY.md`
3. **Files List**: You're reading it! 📄

### For Stakeholders
1. **Features**: See `README.md` → Features section
2. **Tech Stack**: See `README.md` → Tech Stack section
3. **Demo Credentials**: See `README.md` → Sample Data section

---

## File Count Summary

```
├── Configuration Files: 15+
├── Backend Source Files: 12
├── Frontend Source Files: 10
├── Database Migrations: 8
├── Documentation Files: 5
├── Docker Files: 3
└── Test Files: 1
─────────────────────────
Total Files: ~54 files organized & ready
```

---

## Notes

- All files are production-ready with error handling
- TypeScript strict mode enabled throughout
- Security best practices implemented (password hashing, JWT, RBAC)
- Database indexed for query performance
- Code is well-organized and easily extensible
- Comprehensive documentation for developers and operators

**Start here**: Read `README.md` first, then follow `docs/LOCAL_SETUP.md` for development.

---

Generated: 2024-03-10
Version: 1.0.0 MVP Complete
