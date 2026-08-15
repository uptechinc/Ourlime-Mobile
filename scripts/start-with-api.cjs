const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(mobileRoot, '..');
const children = [];

const apiPort = 3000;
const apiStartupTimeoutMs = 45_000;

function isApiListening() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: apiPort });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    const finishUnavailable = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once('error', finishUnavailable);
    socket.once('timeout', finishUnavailable);
  });
}

function resolveLanHost() {
  const configuredHost = process.env.OURLIME_DEV_API_HOST?.trim();
  if (configuredHost) return configuredHost;

  const candidates = Object.values(os.networkInterfaces())
    .flatMap((network) => network || [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
  const preferred = candidates.find((address) => address.startsWith('192.168.'))
    || candidates.find((address) => address.startsWith('10.'))
    || candidates.find((address) => address.startsWith('172.'));
  if (!preferred) {
    throw new Error('No LAN IPv4 address was found. Set OURLIME_DEV_API_HOST to the address your phone can reach.');
  }
  return preferred;
}

function isApiHealthy(apiBaseUrl) {
  return new Promise((resolve) => {
    const request = http.get(`${apiBaseUrl}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
  });
}

async function waitForApi(apiBaseUrl) {
  const deadline = Date.now() + apiStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (await isApiHealthy(apiBaseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The Ourlime API did not become reachable at ${apiBaseUrl}. Check Windows Firewall and ensure port ${apiPort} is available.`);
}

function start(command, args, cwd, label, environment = process.env) {
  const child = spawn(command, args, { cwd, shell: true, stdio: 'inherit', env: environment });
  children.push(child);
  child.once('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

function shutdown(exitCode = 0) {
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exit(exitCode);
}

async function main() {
  const lanHost = resolveLanHost();
  const apiBaseUrl = `http://${lanHost}:${apiPort}`;
  if (!(await isApiListening())) {
    console.log(`[Ourlime] Starting the Next.js web API at ${apiBaseUrl}...`);
    start('npm', ['run', 'dev', '--', '--hostname', '0.0.0.0', '--port', String(apiPort)], webRoot, 'Web API');
  } else {
    console.log(`[Ourlime] A web API process is already listening on port ${apiPort}.`);
  }

  console.log(`[Ourlime] Waiting for ${apiBaseUrl}/api/health...`);
  await waitForApi(apiBaseUrl);
  console.log(`[Ourlime] API ready. Starting Expo with EXPO_PUBLIC_WEB_API_URL=${apiBaseUrl}`);
  start('npm', ['run', 'start'], mobileRoot, 'Expo', {
    ...process.env,
    EXPO_PUBLIC_WEB_API_URL: apiBaseUrl,
    EXPO_PUBLIC_OURLIME_API_BASE_URL: apiBaseUrl,
  });
}

process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());
void main().catch((error) => {
  console.error(`[Ourlime] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});
