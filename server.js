require('dotenv').config();
const { exec } = require('child_process');
const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const speedTest = require('speedtest-net');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const PING_TARGET = process.env.PING_TARGET
const PING_INTERVAL = process.env.PING_INTERVAL || 5000;
const GENERAL_RATE_LIMIT = process.env.GENERAL_RATE_LIMIT || 100;
const HEALTH_RATE_LIMIT = process.env.HEALTH_RATE_LIMIT || 1;

// File paths
const RESULTS_DIR = path.join(__dirname, 'results');
const HISTORY_DIR = path.join(__dirname, 'history');
const STATS_FILE = path.join(RESULTS_DIR, 'ping_stats.json');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');
const FAILED_FILE = path.join(HISTORY_DIR, 'failed.json');
const SPEEDTEST_FILE = path.join(RESULTS_DIR, 'speedtest.json');
let latestSpeedtest = null;

// Verify directories exist
[RESULTS_DIR, HISTORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// In-memory stats
let stats = {
    tenMinutes: { count: 0, success: 0, fail: 0, ttlSum: 0, timeSum: 0 },
    hour: { count: 0, success: 0, fail: 0, ttlSum: 0, timeSum: 0 },
    day: { count: 0, success: 0, fail: 0, ttlSum: 0, timeSum: 0 },
    week: { count: 0, success: 0, fail: 0, ttlSum: 0, timeSum: 0 },
    month: { count: 0, success: 0, fail: 0, ttlSum: 0, timeSum: 0 },
    history: [] // { timestamp, success, ttl, time }
};

// Load stats from file if exists
if (fs.existsSync(STATS_FILE)) {
    stats = JSON.parse(fs.readFileSync(STATS_FILE));
    // Ensure history exists
    if (!stats.history) stats.history = [];
} else if (fs.existsSync(HISTORY_FILE)) {
    // If only history exists, load it
    stats.history = JSON.parse(fs.readFileSync(HISTORY_FILE));
}

// Load latest speedtest result if exists
if (fs.existsSync(SPEEDTEST_FILE)) {
    latestSpeedtest = JSON.parse(fs.readFileSync(SPEEDTEST_FILE));
}

function pruneHistory() {
    const now = Date.now();
    stats.history = stats.history.filter(
        h => h.timestamp >= now - 31 * 24 * 60 * 60 * 1000 // keep 31 days of history
    );
}

function updateStats() {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const calc = (since) => {
        const filtered = stats.history.filter(h => h.timestamp >= since);
        const count = filtered.length;
        const success = filtered.filter(h => h.success).length;
        const fail = count - success;
        const ttlSum = filtered.reduce((sum, h) => sum + (h.ttl || 0), 0);
        const timeSum = filtered.reduce((sum, h) => sum + (h.time || 0), 0);
        return {
            count,
            success,
            fail,
            avgTTL: count ? Number((ttlSum / count).toFixed(3)) : 0,
            avgTime: count ? Number((timeSum / count).toFixed(3)) : 0,
            packetLoss: count ? (fail / count) * 100 : 0
        };
    };

    stats.tenMinutes = calc(tenMinutesAgo);
    stats.hour = calc(hourAgo);
    stats.day = calc(dayAgo);
    stats.week = calc(weekAgo);
    stats.month = calc(monthAgo);
}

function saveStats() {
    // Save rolling stats to /results/ping_stats.json
    const { tenMinutes, hour, day, week, month } = stats;
    fs.writeFileSync(STATS_FILE, JSON.stringify({ tenMinutes, hour, day, week, month }, null, 2));
    // Save full history to /history/history.json
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(stats.history, null, 2));
    // Save only failed pings to /history/failed.json
    const failed = stats.history.filter(h => !h.success);
    fs.writeFileSync(FAILED_FILE, JSON.stringify(failed, null, 2));
}

function parsePing(stdout) {
    const ttlMatch = stdout.match(/ttl=(\d+)/);
    const timeMatch = stdout.match(/time=([\d.]+)/);
    return {
        ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : null,
        time: timeMatch ? parseFloat(timeMatch[1]) : null
    };
}

function formatDateTime(ts) {
    const d = new Date(ts);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ping() {
    exec(`ping -c 1 ${PING_TARGET}`, (error, stdout, stderr) => {
        const now = Date.now();
        let success = !error;
        let { ttl, time } = parsePing(stdout);
        stats.history.push({
            timestamp: now,
            datetime: formatDateTime(now),
            success,
            ttl,
            time
        });
        pruneHistory();
        updateStats();
        saveStats();
        if (error) {
            console.error(`Ping error: ${error.message}`);
        }
        if (stderr) {
            console.error(`Ping stderr: ${stderr}`);
        }
        // Uncomment the next line to log the ping output in the console
        // console.log(`Ping output:\n${stdout}`);
    });
}

setInterval(ping, PING_INTERVAL);

function apiKeyMiddleware(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    next();
}

// Rate limiter: 100 requests per minute for all endpoints except /health
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: GENERAL_RATE_LIMIT,
    message: { error: 'Too many requests, please try again later.' }
});

// Rate limiter: 1 request per minute for /health
const healthLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: HEALTH_RATE_LIMIT,
    message: { error: 'Too many requests, please try again later.' }
});

function uptimeStats(statsObj) {
    const { count, success, fail } = statsObj;
    const uptime = count ? ((success / count) * 100).toFixed(2) : "0.00";
    const downtime = count ? ((fail / count) * 100).toFixed(2) : "0.00";
    return { ...statsObj, uptime: Number(uptime), downtime: Number(downtime) };
}

// Run speedtest and save result
async function runSpeedtest() {
    try {
        const result = await speedTest({ acceptLicense: true, acceptGdpr: true });
        latestSpeedtest = {
            ping: result.ping.latency,
            download: result.download.bandwidth * 8 / 1e6, // Mbps
            upload: result.upload.bandwidth * 8 / 1e6,     // Mbps
            isp: result.isp,
            server: result.server.name,
            timestamp: result.timestamp
        };
        fs.writeFileSync(SPEEDTEST_FILE, JSON.stringify(latestSpeedtest, null, 2));
        //console.log('Speedtest completed and saved.');
    } catch (err) {
        console.error('Speedtest failed:', err.message);
    }
}

// Run speedtest every 10 minutes (600,000 ms)
setInterval(runSpeedtest, 10 * 60 * 1000);
// Optionally run once at startup
runSpeedtest();

// HTTP endpoints with general rate limiter
app.get('/results/10m', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(uptimeStats(stats.tenMinutes));
});
app.get('/results/hour', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(uptimeStats(stats.hour));
});
app.get('/results/day', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(uptimeStats(stats.day));
});
app.get('/results/week', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(uptimeStats(stats.week));
});
app.get('/results/month', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(uptimeStats(stats.month));
});
app.get('/results/history', generalLimiter, apiKeyMiddleware, (req, res) => {
    res.json(stats.history);
});
app.get('/results/failed', generalLimiter, apiKeyMiddleware, (req, res) => {
    const failed = stats.history.filter(h => !h.success);
    res.json(failed);
});

// Speedtest endpoint (protected by API key and general rate limiter)
app.get('/speedtest', generalLimiter, apiKeyMiddleware, (req, res) => {
    if (latestSpeedtest) {
        res.json(latestSpeedtest);
    } else {
        res.status(503).json({ error: 'No speedtest result available yet.' });
    }
});

// Health endpoint with its own limiter
app.get('/health', healthLimiter, (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`pingitV2 server listening on port ${PORT}`);
});

