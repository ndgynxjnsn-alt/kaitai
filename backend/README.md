# Kaitai Backend

NestJS backend for storing files in S3-compatible object storage and decoding binary files with [Kaitai Struct](https://kaitai.io/) parsers.

## Prerequisites

- Node.js v24+
- Docker (for MinIO)

## Quick Start

```bash
# Start MinIO (S3-compatible storage)
docker compose up -d

# Install dependencies
npm install

# Start in development mode
npm run dev
```

The server starts on `http://localhost:3001`.
Swagger UI is available at `http://localhost:3001/docs`.

## Authentication

All endpoints require an `x-api-key` header.

| Header | Default Value |
|--------|--------------|
| `x-api-key` | `kaitai-dev-key` |

Override via the `API_KEY` environment variable.

## API Endpoints

### Files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/files` | List all file paths |
| `GET` | `/files/*path` | Get a file's content |
| `PUT` | `/files/*path` | Create or overwrite a file |
| `DELETE` | `/files/*path` | Delete a file |

### Decode

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/decode` | Decode a binary file with all registered parsers |

**Request body:**

```json
{ "file": "/path/to/binary.bin" }
```

**Response:**

```json
{
  "file": "/path/to/binary.bin",
  "parsers": [
    {
      "id": "simple_packet",
      "success": true,
      "objectTree": { "name": "simple_packet", "type": "object", "children": [...] }
    },
    {
      "id": "png",
      "success": false,
      "error": "not equal, expected [137,80,78,71], but got [202,254,0,4]"
    }
  ]
}
```

## Parser Management

Parsers are compiled automatically from `.ksy` files stored in S3:

- **On startup**: all existing `.ksy` files are compiled into parsers.
- **On PUT of a `.ksy` file**: the parser is compiled/updated.
- **On DELETE of a `.ksy` file**: the parser is removed.

Parsers are identified by their `meta.id` field in the `.ksy` file.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | `kaitai-dev-key` | API key for authentication |
| `S3_ENDPOINT` | `http://localhost:9000` | S3-compatible endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |

## Scripts

```bash
npm run dev       # Start with ts-node (development)
npm run build     # Compile TypeScript
npm run start     # Run compiled JS (production)
npm test          # Run tests
npm run test:cov  # Run tests with coverage
```

## Testing

```bash
npm test
```

Unit tests use Jest. Integration tests use supertest with `@nestjs/testing`.
Tests mock the S3 layer so no running MinIO instance is needed.
