# TOPLIS Logistics - Architecture & Design Documents

## System Architecture

### Components Overview

**Frontend**
- React 18 SPA with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Vite for fast development & optimized builds
- @zxing/browser for barcode/QR scanning

**Backend**
- Express.js with TypeScript
- RESTful API with role-based middleware
- PostgreSQL 15 for data persistence
- JWT + bcrypt for secure authentication
- AWS S3/MinIO for document storage

**Infrastructure**
- Docker & Docker Compose for containerization
- PostgreSQL for primary database
- Redis for session/cache (optional)
- Nginx reverse proxy
- ALB for load balancing (production)

### Data Flow

```
User (Agent/Operator)
    │
    └─> Mobile Camera / Scanner
        │
        ├─> QR Code / Barcode
        │
        └─> POST /api/scan
            {
              code: "ABC123",
              device_id: "device-123",
              latitude: 14.599,
              longitude: 120.984
            }
            │
            ├─> Backend receives
            │    - Validate JWT token
            │    - Check user permissions
            │    - Verify device ID
            │
            ├─> Database lookup
            │    - Find package by barcode/QR code
            │    - Get shipment details
            │    - Check for duplicate scans (5min window)
            │
            ├─> Create shipment_event
            │    - Record timestamp
            │    - Store location (lat/lon)
            │    - Log device_id
            │
            ├─> Update shipment status (if all pieces scanned)
            │
            ├─> Audit log
            │    - User action
            │    - Resource changes
            │    - IP address
            │
            └─> Response
                {
                  event: { ... },
                  shipment: { ... current_status },
                  allPiecesScanned: true/false
                }
```

## Database Schema

### Entity Relationship Diagram

```
users (1) ──── (M) agents
  │              │
  │              └─ (assigned to) shipments
  │
  ├─── (1) (M) ──> shipments
  │                    │
  │                    ├─── (1) (M) ──> packages
  │                    │                    │
  │                    └─── (1) (M) ──> shipment_events <── (services/API keys)
  │
  ├─── (1) (M) ──> shipment_events
  │
  ├─── (1) (M) ──> audit_logs
  │
  └─── (1) (M) ──> api_keys
       └─── (1) (M) ──> webhook_logs
```

### Key Indexes for Performance

```sql
-- Foreign keys
shipments(assigned_agent_id)
shipments(created_by)
packages(shipment_id)
shipment_events(shipment_id)
shipment_events(created_by)
audit_logs(user_id)

-- Query optimization
shipments(current_status, created_at)
packages(barcode)  -- Unique
packages(qr_code)  -- Unique
shipment_events(shipment_id, created_at DESC)
audit_logs(created_at DESC)
```

## API Design Patterns

### RESTful Conventions

```
GET    /api/bookings              - List (paginated)
POST   /api/bookings              - Create
GET    /api/bookings/:id          - Retrieve
PUT    /api/bookings/:id          - Update (full)
PATCH  /api/bookings/:id          - Update (partial)
DELETE /api/bookings/:id          - Delete

GET    /api/scan/:code            - Get package status
POST   /api/scan                  - Single scan
POST   /api/scan/batch            - Batch scan
```

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "meta": {
    "timestamp": "2024-03-10T10:30:45Z",
    "requestId": "req-uuid"
  }
}
```

### Error Handling

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SCAN",
    "message": "Duplicate scan detected",
    "statusCode": 409
  }
}
```

## Security Architecture

### Authentication Flow

```
1. User submits credentials (email, password)
   │
2. Backend hashes password with bcrypt
   │
3. Compares with stored hash
   │
4. Generate JWT token
   payload = {
     userId: "uuid",
     email: "user@toplis.com",
     role: "agent",
     region: "NCR"
   }
   signed with HS256 + SECRET_KEY
   │
5. Token sent to client
   │
6. Client stores in localStorage (insecure, use httpOnly in prod)
   │
7. Client includes in Authorization header for future requests
   │
8. Backend validates:
   - Token signature valid
   - Token not expired
   - User still active in DB
```

### Permission Model

```
User Role Matrix:

                | View  | Create | Update | Delete | View Admin
─────────────────────────────────────────────────────────────
Admin           |   ✓   |   ✓    |   ✓    |   ✓    |   ✓
Operator        |   ✓   |   ✓    |   ✓    |   ✗    |   ✗
Agent           |   ✓   |   ✗    |   ✓    |   ✗    |   ✗
Customer        |   ✓*  |   ✗    |   ✗    |   ✗    |   ✗
Auditor         |   ✓   |   ✗    |   ✗    |   ✗    |   ✓

* Customers see only their own shipments
  Agents see only their assigned region
```

### Scan Validation Rules

```
1. User must be AGENT or OPERATOR
2. If AGENT: 
   - Must be assigned to shipment
   - Region must match shipment's agent region
3. Code must be valid barcode or QR
4. Package must exist
5. Duplicate scan check:
   - Same code + event_type
   - Within 5-minute window
   - Return 409 Conflict if duplicate
6. Location data optional but recommended
```

## Scalability Considerations

### Horizontal Scaling

**Stateless API**
- Each server instance independent
- No session affinity needed
- Load distribute via ALB

**Session Management**
- Use Redis for distributed sessions
- Not required for MVP (JWT is stateless)

**Database**
- Read replicas for reporting queries
- Connection pooling (PgBouncer)
- Sharding by region if needed in future

### Caching Strategy

```
Layer 1: Browser cache (static assets, 1 day)
Layer 2: CDN (CloudFront, 1 hour)
Layer 3: API response cache (Redis, 5 min)
  - GET /api/bookings
  - Invalidated on POST/PUT
```

### Rate Limiting

```
/api/scan: 100 requests/minute (prevent abuse)
/api/auth/login: 5 failed attempts → 15 minute lockout
/api/webhooks: 1000 requests/minute (carrier integrations)
Public endpoints: 60 requests/minute
```

## Testing Strategy

### Unit Tests

```typescript
- Auth utilities (hash, verify, token generation)
- Shipment service (status transitions)
- Scan validation logic
- Permission checks
- Error handling
```

### Integration Tests

```typescript
- Full auth flow (register → login → profile)
- Booking creation with package generation
- Scan endpoint with database
- Event creation and shipment status update
- Audit log recording
```

### E2E Tests (Future)

```typescript
- User login → create booking → scan package → view status
- Agent pickup → scan → system update → customer notification
- Admin dashboard → view all shipments → generate report
```

### Performance Tests

```
- 1000 concurrent users
- Average response time < 200ms
- 95th percentile < 500ms
- Database query time < 100ms
- Scan throughput: 100 scans/second
```

## Disaster Recovery Plan

### RTO & RPO

```
RTO (Recovery Time Objective): 1 hour
  - Time to restore service after failure
  - Multi-AZ RDS: automatic failover (~2 min)
  - Load balancer: automatic instance replacement (~5 min)

RPO (Recovery Point Objective): 15 minutes
  - Maximum data loss acceptable
  - Database backups: every 15 minutes
  - Transaction logs: continuous replication
```

### Failure Scenarios

**Database Down**
- Automated failover to multi-AZ replica
- Alert ops team
- Customer-facing: read-only mode, no new bookings

**API Server Down**
- ALB routes to healthy instance
- Auto-scaling replaces failed instance
- No data loss (stateless)

**S3 Down**
- All documents cached in CloudFront
- Fallback local storage temporarily
- Sync to S3 when available

**Network Partition**
- Scan operations queue locally
- Retry with exponential backoff
- Maximum 1000 scans queued (then fail)

## Future Enhancements

### Phase 2
- Mobile native apps (React Native)
- Real-time updates (WebSocket/Socket.IO)
- SMS/Email notifications (Twilio/SES)
- Advanced reporting (Metabase)

### Phase 3
- AI route optimization
- Blockchain document verification
- Customs integration (API)
- Multi-language support (i18n)

### Phase 4
- IoT integration (GPS trackers)
- Predictive analytics (delivery time estimation)
- Integration with carrier APIs (tracking)
- Automated invoicing

---

Architecture Version: 1.0.0
Last Updated: 2024-03-10
Maintained By: TOPLIS Logistics Dev Team
