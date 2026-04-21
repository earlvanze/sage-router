// OpenClaw Gateway agent bridge for Sage Router
// Dynamically resolves the OpenClaw SDK from NODE_PATH or the global npm install.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
let callGateway, GATEWAY_CLIENT_NAMES, GATEWAY_CLIENT_MODES;
try {
  // Try global openclaw installation
  const sdkBase = require.resolve('openclaw');
  const callMod = require(require.resolve('openclaw/dist/call-BA3do6C0.js', { paths: [sdkBase] }));
  const chanMod = require(require.resolve('openclaw/dist/message-channel-CBqCPFa_.js', { paths: [sdkBase] }));
  callGateway = callMod.r;
  GATEWAY_CLIENT_NAMES = chanMod.g;
  GATEWAY_CLIENT_MODES = chanMod.h;
} catch {
  // Fallback: require from known paths
  try {
    const homeDir = process.env.HOME || '/home/umbrel';
    const callMod = require(`${homeDir}/.nvm/versions/node/v25.8.1/lib/node_modules/openclaw/dist/call-BA3do6C0.js`);
    const chanMod = require(`${homeDir}/.nvm/versions/node/v25.8.1/lib/node_modules/openclaw/dist/message-channel-CBqCPFa_.js`);
    callGateway = callMod.r;
    GATEWAY_CLIENT_NAMES = chanMod.g;
    GATEWAY_CLIENT_MODES = chanMod.h;
  } catch (e) {
    console.error('Cannot load OpenClaw SDK. Ensure openclaw is installed globally.', e.message);
    process.exit(1);
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function extractText(result) {
  const payloads = result?.result?.payloads;
  if (!Array.isArray(payloads)) return '';
  return payloads
    .map((payload) => typeof payload?.text === 'string' ? payload.text : '')
    .filter(Boolean)
    .join('\n\n');
}

const raw = await readStdin();
const input = raw.trim() ? JSON.parse(raw) : {};

function buildRequest({ includeOverrides }) {
  const params = {
    agentId: input.agentId || 'main',
    message: input.message || '',
    idempotencyKey: randomUUID(),
  };
  if (includeOverrides && input.provider) params.provider = input.provider;
  if (includeOverrides && input.model) params.model = input.model;
  return {
    method: 'agent',
    params,
    expectFinal: true,
    timeoutMs: Number(input.timeoutMs) || 120000,
    clientName: GATEWAY_CLIENT_NAMES.CLI,
    mode: GATEWAY_CLIENT_MODES.CLI,
    ...(process.env.OPENCLAW_GATEWAY_TOKEN ? { token: process.env.OPENCLAW_GATEWAY_TOKEN } : {}),
  };
}

async function runRequest(includeOverrides) {
  const result = await callGateway(buildRequest({ includeOverrides }));
  console.log(JSON.stringify({
    ok: true,
    text: extractText(result),
    provider: result?.result?.meta?.agentMeta?.provider,
    model: result?.result?.meta?.agentMeta?.model,
    usedOverrides: includeOverrides,
  }));
}

const allowOverrides = process.env.SAGE_ROUTER_OPENCLAW_ALLOW_MODEL_OVERRIDE === '1';

try {
  await runRequest(allowOverrides);
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  const shouldRetryWithoutOverrides = allowOverrides && /sessions\.patch|gateway request timeout|model set failed/i.test(message);
  if (shouldRetryWithoutOverrides) {
    try {
      await runRequest(false);
      process.exit(0);
    } catch (retryError) {
      console.error(retryError instanceof Error ? retryError.stack || retryError.message : String(retryError));
      process.exit(1);
    }
  }
  console.error(message);
  process.exit(1);
}
