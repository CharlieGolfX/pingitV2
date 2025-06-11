# pingitV2

A simple Node.js server that monitors network connectivity by periodically pinging a target host and exposing statistics and history via a REST API.

## Features

- Periodically pings a configurable target (IP, hostname, or URL)
- Stores ping history and statistics (10 minutes, hour, day, week, month)
- Automatically runs a speedtest every 10 minutes
- REST API for retrieving stats, full history, failed pings, and speedtest results
- API key authentication
- Configurable rate limiting
- Health check endpoint

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/CharlieGolfX/pingitV2.git
    cd pingitV2
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

3. Copy `.env.example` to `.env` and configure your environment variables:
    ```sh
    cp .env.example .env
    ```

### Configuration

Edit the `.env` file to set:

- `API_KEY`: Your API key for authentication
- `PING_TARGET`: The IP, hostname, or URL to ping (e.g., `1.1.1.1`)
- `PORT`: Port for the server (default: 3000)
- `PING_INTERVAL`: Ping interval in milliseconds (default: 5000)
- `GENERAL_RATE_LIMIT`: Requests per minute for most endpoints (default: 100)
- `HEALTH_RATE_LIMIT`: Requests per minute for `/health` (default: 1)

### Running the Server

```sh
node server.js
```

The server will start pinging the target, running speedtests, and listening for API requests.

## API Documentation

See [docs/api.md](docs/api.md) for full details.

## Data Storage

- Ping stats: [`results/ping_stats.json`](results/ping_stats.json)
- Full history: [`history/history.json`](history/history.json)
- Failed pings: [`history/failed.json`](history/failed.json)
- **Latest speedtest result: [`results/speedtest.json`](results/speedtest.json)**

## License

MIT License. See [LICENSE](LICENSE).