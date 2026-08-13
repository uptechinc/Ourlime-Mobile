#!/usr/bin/env node
/**
 * scripts/log-receiver.js
 *
 * Lightweight HTTP server that runs alongside `expo start`.
 * Receives POST /log from ErrorLogService (DEV mode only) and writes
 * grouped Markdown entries to logs/runtime-errors.md in the project root.
 *
 * Start via: node scripts/log-receiver.js
 * (package.json "dev" script runs this + expo start together)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 19101;
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'runtime-errors.md');
const MAX_ENTRIES = 500;

// Ensure logs/ directory exists.
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/** @type {Map<string, Array<{level: string, timestamp: string, message: string, stack: string}>>} */
const grouped = new Map();
let totalCount = 0;
let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 600);
}

function flush() {
  flushTimer = null;
  const lines = [
    '# Ourlime Mobile — Runtime Error Log',
    '',
    `> Last updated: ${new Date().toISOString()}`,
    `> Total entries: ${totalCount} (max ${MAX_ENTRIES} kept)`,
    '',
    '---',
    '',
  ];

  if (grouped.size === 0) {
    lines.push('_No errors or warnings captured yet._');
  } else {
    for (const [source, entries] of grouped) {
      lines.push(`## \`${source}\``);
      lines.push('');
      for (const e of entries) {
        const badge = e.level === 'error' ? '🔴 ERROR' : '🟡 WARN';
        lines.push(`### ${badge} — ${e.timestamp}`);
        lines.push('');
        lines.push('**Message:**');
        lines.push('```');
        lines.push(e.message);
        lines.push('```');
        lines.push('');
        if (e.stack) {
          lines.push('<details><summary>Stack trace</summary>');
          lines.push('');
          lines.push('```');
          lines.push(e.stack);
          lines.push('```');
          lines.push('</details>');
          lines.push('');
        }
      }
      lines.push('---');
      lines.push('');
    }
  }

  fs.writeFileSync(LOG_FILE, lines.join('\n'), 'utf8');
}

const server = http.createServer((req, res) => {
  // Allow all origins so the RN app can reach this from the device.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        /** @type {{ level: string, timestamp: string, message: string, source: string, stack: string }[]} */
        const entries = JSON.parse(body);
        for (const entry of entries) {
          const key = entry.source || 'unknown';
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key).push(entry);
          totalCount++;
          // Rolling window: trim oldest from first group if over limit.
          if (totalCount > MAX_ENTRIES) {
            const firstKey = grouped.keys().next().value;
            const firstBucket = grouped.get(firstKey);
            firstBucket.shift();
            if (firstBucket.length === 0) grouped.delete(firstKey);
            totalCount--;
          }
        }
        scheduleFlush();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch {
        res.writeHead(400);
        res.end('bad json');
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/clear') {
    grouped.clear();
    totalCount = 0;
    flush();
    res.writeHead(200);
    res.end('cleared');
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n📋 Log receiver listening on http://0.0.0.0:${PORT}`);
  console.log(`   Errors will be written to: logs/runtime-errors.md\n`);
});
