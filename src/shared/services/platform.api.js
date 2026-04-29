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

export function startBackendHeartbeat({ intervalMs = 240000, timeoutMs = 2500 } = {}) {
  let stopped = false;

  async function tick() {
    if (stopped) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    await pingBackend({ timeoutMs });
  }

  tick().catch(() => {});
  const intervalId = setInterval(() => {
    tick().catch(() => {});
  }, Math.max(60000, Number(intervalMs) || 240000));

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
