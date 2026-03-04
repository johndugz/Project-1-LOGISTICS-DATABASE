# TOPLIS Logistics - Deployment Guide

## Production Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           End Users                            │
│            (Agents, Operators, Customers, Auditors)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼────────┐       ┌───────▼────────┐
        │   Frontend      │       │   Mobile Browser
        │  (React + TS)   │       │   (PWA Ready)
        │  Port 3000      │       │
        └────────┬────────┘       └────────┬────────┘
                 │                         │
                 └────────────┬────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Nginx Reverse     │
                    │  Proxy (SSL/TLS)   │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Express API       │
                    │  (Node.js 20)      │
                    │  Port 5000         │
                    └─────────┬──────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐ ┌───▼────┐ ┌───▼──────┐
        │ PostgreSQL   │ │ Redis  │ │ AWS S3   │
        │ Database     │ │(Cache) │ │ (Docs)   │
        │ Primary      │ │        │ │ + Backup │
        └──────────────┘ └────────┘ └──────────┘
```

## Pre-Deployment Checklist

### Infrastructure Setup

- [ ] AWS Account with proper IAM roles
- [ ] RDS PostgreSQL 15+ instance (Multi-AZ for HA)
- [ ] S3 bucket for document storage with versioning
- [ ] CloudFront CDN for static assets
- [ ] ElastiCache Redis for session/cache (optional)
- [ ] Secrets Manager for sensitive data
- [ ] VPC with public/private subnets
- [ ] Application Load Balancer (ALB)
- [ ] Route 53 DNS records
- [ ] CloudWatch for monitoring/logging

### Security Configuration

- [ ] SSL/TLS certificates (ACM)
- [ ] Security groups configured (whitelist IPs)
- [ ] Database encryption at rest
- [ ] Enable CloudTrail for audit logs
- [ ] Set up KMS for encryption keys
- [ ] WAF rules for common attacks
- [ ] Enable VPC Flow Logs
- [ ] Backup strategy in place

### Application Configuration

```env
# Production .env
NODE_ENV=production
PORT=5000

# Database
DB_HOST=<rds-endpoint.amazonaws.com>
DB_PORT=5432
DB_NAME=toplis_logistics_prod
DB_USER=<secure-username>
DB_PASSWORD=<secure-password>
DB_SSL=require

# JWT
JWT_SECRET=<generate-strong-random-key>
JWT_EXPIRE=24h

# AWS S3
USE_MINIO=false
AWS_ACCESS_KEY_ID=<from-secrets-manager>
AWS_SECRET_ACCESS_KEY=<from-secrets-manager>
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=toplis-logistics-prod

# Redis
REDIS_HOST=<elasticache-endpoint>
REDIS_PORT=6379
REDIS_PASSWORD=<enable-auth>

# Monitoring
LOG_LEVEL=info
DATADOG_API_KEY=<if-using-datadog>
SENTRY_DSN=<error-tracking>

# Email
SMTP_HOST=<ses-endpoint>
SMTP_PORT=587
SMTP_USER=<ses-username>
SMTP_PASSWORD=<ses-password>

# CORS
CORS_ORIGIN=https://logistics.toplis.com

# API Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment Options

### Option 1: AWS ECS (Recommended for this scale)

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name toplis-prod

# Build docker images
docker build -t toplis-backend:1.0.0 ./backend
docker build -t toplis-frontend:1.0.0 ./frontend

# Push to ECR
aws ecr create-repository --repository-name toplis-backend
aws ecr create-repository --repository-name toplis-frontend

docker tag toplis-backend:1.0.0 <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/toplis-backend:1.0.0
docker push <account-id>.dkr.ecr.ap-southeast-1.amazonaws.com/toplis-backend:1.0.0

# Create task definition and service
# Use ECS console or CloudFormation template
```

### Option 2: AWS Elastic Beanstalk

```bash
eb init -p docker toplis-logistics
eb create toplis-prod
eb deploy
```

### Option 3: AWS App Runner (Easiest for small teams)

```bash
aws apprunner create-service \
  --service-name toplis-backend \
  --source-configuration "ImageRepository={ImageIdentifier=<ecr-image>,ImageRepositoryType=ECR}"
```

### Option 4: Self-hosted on EC2

```bash
# Launch EC2 instance (Ubuntu 22.04, t3.medium or larger)
# SSH into instance

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Deploy with Docker Compose
scp docker-compose.yml ubuntu@<ec2-ip>:~/
ssh ubuntu@<ec2-ip>
cd ~
docker-compose up -d

# Set up systemd service to auto-start
# Configure Nginx reverse proxy with SSL
```

## Database Migration Strategy

### Pre-Production Testing

```bash
# Test migrations in staging
npm run migrate

# Verify schema
psql -c "\\dt" toplis_logistics

# Run backup before production migration
pg_dump toplis_logistics > backup_$(date +%Y%m%d).sql
```

### Production Migration (Zero-downtime)

```bash
# 1. Enable read-only mode
UPDATE schema_settings SET read_only = true WHERE id = 1;

# 2. Create backup
pg_dump toplis_logistics | gzip > backup_pre_migration.sql.gz
aws s3 cp backup_pre_migration.sql.gz s3://toplis-backups/

# 3. Run migrations
npm run migrate

# 4. Verify
npm run migrate:verify

# 5. Re-enable read/write
UPDATE schema_settings SET read_only = false WHERE id = 1;

# 6. Monitor for errors
tail -f /var/log/app/production.log
```

## Monitoring & Alerting

### CloudWatch Dashboard

```javascript
// Monitor key metrics
- API Response Time (p50, p90, p99)
- Error Rate by Endpoint
- Database Connection Pool
- Scan Success Rate
- Active Users
- Document Storage Size
```

### Alerts

```
- High Error Rate: > 5% errors in 5 minutes
- API Latency: > 2s average response time
- Database CPU: > 80% for 10 minutes
- Disk Space: < 20% remaining
- Authentication Failures: > 10 in 5 minutes
```

### Logs

```bash
# Aggregate logs to CloudWatch Logs
# Use structured logging (JSON format)
{
  "timestamp": "2024-03-10T10:30:45Z",
  "level": "INFO",
  "user_id": "uuid",
  "action": "scan_package",
  "shipment_id": "uuid",
  "response_time_ms": 234,
  "status_code": 200
}
```

## Backup & Disaster Recovery

### Daily Backup Strategy

```bash
# Database backups (automated RDS)
- Retention: 30 days
- Copy to S3 for long-term storage

# S3 document backups
- Enable versioning
- Enable cross-region replication
- Lifecycle policy: Archive to Glacier after 90 days

# Application backup
- Container images tagged with version
- Infrastructure as Code (Terraform/CloudFormation)
```

### Disaster Recovery (RTO: 1 hour, RPO: 15 minutes)

```bash
# Point-in-time restore
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier toplis-db-prod \
  --target-db-instance-identifier toplis-db-restore \
  --restore-time 2024-03-10T10:00:00Z

# Switch application to restore DB
# Update Route 53 DNS if needed
```

## Performance Tuning

### Database Optimization

```sql
-- Index on frequently filtered columns
CREATE INDEX CONCURRENTLY idx_shipments_status_agent 
  ON shipments(current_status, assigned_agent_id);

CREATE INDEX CONCURRENTLY idx_events_shipment_created 
  ON shipment_events(shipment_id, created_at DESC);

-- Connection pooling
-- Use PgBouncer (3 connections per core recommended)
-- Pool size: min=10, max=100
```

### API Caching

```
- Redis cache for frequently accessed shipments
- TTL: 5 minutes for shipment list
- Invalidate on status update
- Cache control headers for static assets (1 day)
```

### Code-level Performance

```typescript
// Use database query optimization
- Pagination for large result sets
- Select only needed columns
- Use EXPLAIN ANALYZE to profile queries
- Batch inserts for multiple events
```

## Rollback Strategy

### Canary Deployment (Recommended)

```
1. Deploy new version to 10% of traffic
2. Monitor error rates and performance
3. If successful: increase to 50%, then 100%
4. If issues: rollback to previous version
```

### Blue-Green Deployment

```
Blue (Current):     toplis-api-v1.0.0
Green (New):        toplis-api-v1.1.0

1. Deploy to Green
2. Run smoke tests
3. Switch Route 53 from Blue to Green
4. Keep Blue running for 30 minutes in case of issues
5. Decommission Blue if stable
```

## Cost Optimization

- Use Reserved Instances for stable workloads (33% savings)
- Spot Instances for batch processing (70% savings)
- Right-size RDS instances based on metrics
- Use S3 Intelligent-Tiering for documents
- Consolidate CloudWatch logs (aggregation)
- Use Lambda@Edge for API request throttling

## Compliance & Security

- Ensure GDPR compliance (data residency)
- Enable encryption in transit (TLS 1.3)
- PII encryption at rest
- Audit all user actions (immutable logs)
- Annual penetration testing
- Regular dependency updates (Dependabot)
- OWASP Top 10 security checks

## Post-Deployment Verification

```bash
✓ Health check endpoint responding (/health)
✓ Database connectivity verified
✓ S3 document storage accessible
✓ JWT tokens generating correctly
✓ Sample scan operation successful
✓ Email notifications working
✓ Logs aggregating to CloudWatch
✓ Metrics visible in CloudWatch dashboard
✓ SSL/TLS certificate valid
✓ Rate limiting active
```

## Maintenance Window

**Weekly**: Database maintenance (VACUUM, ANALYZE)
**Monthly**: Security patches and dependency updates
**Quarterly**: Full backup restore test
**Annually**: Security audit and penetration testing

---

For production support, contact: devops@toplis.com
