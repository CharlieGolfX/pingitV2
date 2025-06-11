# pingitV2 API Documentation

This API monitors network connectivity by periodically pinging a target host. It exposes statistics and history of ping results. Most endpoints require API key authentication.

---

## Authentication

All endpoints (except `/health`) require an API key.  
**Send your API key via:**
- HTTP header: `x-api-key`
- OR query parameter: `?api_key=YOUR_API_KEY`

If the API key is missing or invalid, a `401 Unauthorized` response is returned.

**Example:**
```bash
curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/results/10m
```

---

## Rate Limiting

To ensure fair usage and protect the service, the following rate limits are enforced.  
Limits can be configured via environment variables in your `.env` file:

- **All endpoints except `/health`**:  
  Default is **100 requests per minute** per client (`GENERAL_RATE_LIMIT`).
- **`/health` endpoint**:  
  Default is **1 request per minute** per client (`HEALTH_RATE_LIMIT`).

If not set in the environment, these defaults will be used.

---

## Endpoints

### 1. Get Ping Stats

**GET** `/results/10m`  
**GET** `/results/hour`  
**GET** `/results/day`  
**GET** `/results/week`  
**GET** `/results/month`

Returns statistics for the specified time window.

**Response:**
```json
{
  "count": 720,
  "success": 715,
  "fail": 5,
  "avgTTL": 56.2,
  "avgTime": 12.34,
  "packetLoss": 0.694,
  "uptime": 99.31,
  "downtime": 0.69
}
```

---

### 2. Get Full Ping History

**GET** `/results/history`

Returns the full ping history for the last 31 days.

**Response:**
```json
[
  {
    "timestamp": 1749591235046,
    "datetime": "2025-06-10 23:33:55",
    "success": true,
    "ttl": 56,
    "time": 41.64
  }
  // ...
]
```

---

### 3. Get Failed Pings Only

**GET** `/results/failed`

Returns only failed ping attempts from the last 31 days.

**Response:**
```json
[
  {
    "timestamp": 1749591240051,
    "datetime": "2025-06-10 23:34:00",
    "success": false,
    "ttl": null,
    "time": null
  }
  // ...
]
```

---

### 4. Health Check

**GET** `/health`

Returns API health status.  
**No authentication required.**

**Response:**
```json
{
  "status": "ok",
  "time": "2025-06-10T23:36:00.123Z"
}
```

---

### 5. Get Latest Speedtest Result

**GET** `/speedtest`

Returns the most recent speedtest result (automatically run every 10 minutes and stored in `/results/speedtest.json`).

**Response:**
```json
{
  "ping": 12.34,
  "download": 94.56,
  "upload": 18.23,
  "isp": "Example ISP",
  "server": "Speedtest Server Name",
  "timestamp": "2025-06-10T23:40:00.123Z"
}
```

If no result is available yet:
```json
{
  "error": "No speedtest result available yet."
}
```

---

## Error Responses

- `401 Unauthorized` – Missing or invalid API key.
- `500 Internal Server Error` – Unexpected server error.

---

## Notes

- Only the last 31 days of history are retained.
- The target host, ping interval, and API key are configured via environment variables.
- Speedtests are run automatically every 10 minutes

---