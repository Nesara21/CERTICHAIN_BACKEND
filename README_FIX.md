# CertiChain Backend - Reliability Fix

This document describes the reliability improvements made to the CertiChain backend to ensure deterministic and idempotent certificate issuance.

## Architecture Changes

### Key Components

1. **Correlation ID Logging** - Every request gets a unique ID tracked through logs
2. **Idempotency** - Duplicate requests with same `Idempotency-Key` return cached responses
3. **Retry with Backoff** - External service calls (S3, Blockchain) retry on failure
4. **Blockchain Queue** - Serialized transaction submissions to avoid nonce collisions
5. **Deterministic PDF** - Backend PDF generation with fixed timestamps
6. **Hash-based Verification** - SHA-256 hash of PDF content stored on blockchain

## How to Use

### Idempotency

Include an `Idempotency-Key` header in your requests to ensure duplicate requests are handled safely:

```bash
curl -X PUT 'http://localhost:5000/api/institute/requests/123' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'Content-Type: application/json' \
  -d '{"status": "Approved"}'
```

If you send the same request twice with the same `Idempotency-Key`, you'll get the cached response without re-processing.

### Correlation ID

Track requests across logs using the `X-Correlation-ID` header (auto-generated if not provided).

## Environment Variables

Required environment variables for deployment:

```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=certichain

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET_NAME=your-bucket-name

# Blockchain (Ethereum/Polygon etc.)
RPC_URL=https://your-rpc-endpoint.com
PRIVATE_KEY=0xyour_private_key_hex
WALLET_ADDRESS=0xYourWalletAddress

# JWT
JWT_SECRET=your_jwt_secret

# Logging
LOG_LEVEL=info

# QR Codes (optional)
QR_BASE_URL=https://your-domain.com

# Retry Configuration (optional)
RETRY_ATTEMPTS=3
RETRY_BASE_MS=1000
```

## How to Run Tests

```bash
cd backend
npm ci
npm test
```

Tests include:
- Unit tests for retry logic and PDF generation
- Integration tests for full certificate issuance flow (with mocked S3/Blockchain)

## How to Deploy

### Docker

```bash
cd backend
docker build -t certichain-backend .
docker run -p 5000:5000 --env-file .env certichain-backend
```

### Direct Node

```bash
cd backend
npm ci --only=production
node server.js
```

## Blockchain Queue

The blockchain queue ensures transactions are sent serially to avoid nonce collisions. It:

1. Maintains a FIFO queue of transaction tasks
2. Gets the current nonce before each transaction
3. Waits for 2 confirmations before marking as complete
4. Retries on transient failures (network errors, gas issues)

This prevents race conditions when multiple requests try to publish certificates simultaneously.

## Logging & Debugging

All logs include the `correlationId` field. To debug a specific request:

```bash
grep "YOUR_CORRELATION_ID" combined.log
```

Error logs are in `error.log`, all logs in `combined.log`.

## API Changes

The `/api/institute/requests/:id` endpoint now:

- **Generates PDF on the backend** (not frontend)
- **Uploads to S3** and returns `pdfUrl`
- **Publishes hash to blockchain** and returns `txHash`
- **Supports idempotency** via `Idempotency-Key` header

Response format:
```json
{
  "message": "Request updated",
  "hash": "abc123...",
  "pdfUrl": "https://bucket.s3.amazonaws.com/certificates/123.pdf",
  "txHash": "0xdef456..."
}
```

## Security Notes

- **Never commit `.env` files** containing secrets to git
- **Rotate private keys** regularly and store securely (e.g., AWS Secrets Manager, HashiCorp Vault)
- **Use environment-specific keys** (dev, staging, prod)
- The `PRIVATE_KEY` env var should only have funds for transaction gas fees

## Known Limitations

- PDF binary determinism depends on PDFKit's internal date handling (we set creation date to epoch 0)
- S3 upload failures after 3 retries will cause the entire approval to fail (by design for consistency)
- Blockchain transactions require the wallet to have sufficient gas

## Sample curl Commands

### Happy Path (with idempotency)
```bash
# First call - processes and caches
curl -X PUT 'http://localhost:5000/api/institute/requests/1' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'Content-Type: application/json' \
  -d '{"status": "Approved"}'

# Second call - returns cached response
curl -X PUT 'http://localhost:5000/api/institute/requests/1' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'Content-Type: application/json' \
  -d '{"status": "Approved"}'
```

### With Custom Correlation ID
```bash
curl -X PUT 'http://localhost:5000/api/institute/requests/1' \
  -H 'Authorization: Bearer TOKEN' \
  -H 'X-Correlation-ID: my-tracking-id-123' \
  -H 'Content-Type: application/json' \
  -d '{"status": "Approved"}'
```

## Monitoring

Recommended monitoring setup:
- **Logs**: Ship `combined.log` to centralized logging (e.g., CloudWatch, Datadog)
- **Errors**: Integrate Sentry (stub included, set `SENTRY_DSN` env var)
- **Metrics**: Track S3 upload success rate, blockchain confirmation times
- **Alerts**: Alert on repeated retry failures or blockchain queue backup

---

**For questions or issues**, check logs with correlation ID and review the blockchain queue status.
