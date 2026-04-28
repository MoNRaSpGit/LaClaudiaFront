const FRONTEND_URL = String(process.env.SMOKE_FRONTEND_URL || 'https://monraspgit.github.io/LaClaudiaFront/').trim();
const BACKEND_URL = String(process.env.SMOKE_BACKEND_URL || 'https://laclaudiabackend.onrender.com').trim();
const LOGIN_USER = String(process.env.SMOKE_LOGIN_USER || '').trim();
const LOGIN_PASS = String(process.env.SMOKE_LOGIN_PASS || '').trim();
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

async function main() {
  console.log(`[smoke] Frontend target: ${FRONTEND_URL}`);
  console.log(`[smoke] Backend target: ${BACKEND_URL}`);

  await ensureOk('frontend home', FRONTEND_URL);
  await ensureOk('backend health', `${BACKEND_URL}/api/health`);

  if (LOGIN_USER && LOGIN_PASS) {
    const loginResponse = await ensureOk('auth login', `${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: LOGIN_USER,
        password: LOGIN_PASS
      })
    });

    const loginPayload = await loginResponse.json().catch(() => ({}));
    const sessionToken = String(loginPayload?.session?.token || '').trim();
    if (!sessionToken) {
      throw new Error('auth login fallo: respuesta sin session.token');
    }
    console.log('[smoke] OK auth session token recibido');
  } else {
    console.log('[smoke] login check omitido (defini SMOKE_LOGIN_USER y SMOKE_LOGIN_PASS para habilitarlo)');
  }

  console.log('[smoke] PASS');
}

main().catch((error) => {
  console.error(`[smoke] FAIL: ${error?.message || error}`);
  process.exit(1);
});
