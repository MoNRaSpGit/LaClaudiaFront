import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadLocalEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] != null) {
      continue;
    }

    process.env[key] = value;
  }
}

loadLocalEnvFile();

const FRONTEND_URL = String(process.env.SMOKE_FRONTEND_URL || 'https://monraspgit.github.io/LaClaudiaFront/').trim();
const BACKEND_URL = String(process.env.SMOKE_BACKEND_URL || 'https://laclaudiabackend.onrender.com').trim();
const LOGIN_USER = String(process.env.SMOKE_LOGIN_USER || '').trim();
const LOGIN_PASS = String(process.env.SMOKE_LOGIN_PASS || '').trim();
const ADMIN_USER = String(process.env.SMOKE_ADMIN_USER || '').trim();
const ADMIN_PASS = String(process.env.SMOKE_ADMIN_PASS || '').trim();
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);
const RETRIES = Number(process.env.SMOKE_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.SMOKE_RETRY_DELAY_MS || 5000);

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOk(name, url, options = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      console.log(`[smoke] OK ${name}: HTTP ${response.status} (attempt ${attempt}/${RETRIES})`);
      return response;
    } catch (error) {
      lastError = error;
      console.log(`[smoke] retry ${name}: attempt ${attempt}/${RETRIES} fallo (${error?.message || error})`);
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(`${name} fallo tras ${RETRIES} intentos (${url}): ${lastError?.message || lastError}`);
}

async function loginAndValidate({ label, username, password, expectDashboard = false }) {
  if (!username || !password) {
    return;
  }

  const loginResponse = await ensureOk(`${label} auth login`, `${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password
    })
  });

  const loginPayload = await loginResponse.json().catch(() => ({}));
  const sessionToken = String(loginPayload?.session?.token || '').trim();
  if (!sessionToken) {
    throw new Error(`${label} auth login fallo: respuesta sin session.token`);
  }
  console.log(`[smoke] OK ${label} auth session token recibido`);

  await ensureOk(`${label} auth session`, `${BACKEND_URL}/api/auth/session`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`
    }
  });

  if (expectDashboard) {
    await ensureOk(`${label} dashboard`, `${BACKEND_URL}/api/scanner/dashboard`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`
      }
    });
  }
}

async function main() {
  console.log(`[smoke] Frontend target: ${FRONTEND_URL}`);
  console.log(`[smoke] Backend target: ${BACKEND_URL}`);

  await ensureOk('frontend home', FRONTEND_URL);
  await ensureOk('backend health', `${BACKEND_URL}/api/health`);

  if (LOGIN_USER && LOGIN_PASS) {
    await loginAndValidate({
      label: 'operario',
      username: LOGIN_USER,
      password: LOGIN_PASS,
      expectDashboard: false
    });
  } else {
    console.log('[smoke] login check omitido (defini SMOKE_LOGIN_USER y SMOKE_LOGIN_PASS para habilitarlo)');
  }

  if (ADMIN_USER && ADMIN_PASS) {
    await loginAndValidate({
      label: 'admin',
      username: ADMIN_USER,
      password: ADMIN_PASS,
      expectDashboard: true
    });
  } else {
    console.log('[smoke] admin check omitido (defini SMOKE_ADMIN_USER y SMOKE_ADMIN_PASS para habilitarlo)');
  }

  console.log('[smoke] PASS');
}

main().catch((error) => {
  console.error(`[smoke] FAIL: ${error?.message || error}`);
  process.exit(1);
});
