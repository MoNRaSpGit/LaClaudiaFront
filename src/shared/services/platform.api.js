const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pingBackend({ timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiUrl}/api/health`, {
      signal: controller.signal
    });

    return {
      ok: response.ok,
      status: response.status
    };
  } catch (_error) {
    return {
      ok: false,
      status: 0
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function warmupBackend({ minDelayMs = 1600 } = {}) {
  const [health] = await Promise.all([
    pingBackend(),
    wait(minDelayMs)
  ]);

  return health;
}

