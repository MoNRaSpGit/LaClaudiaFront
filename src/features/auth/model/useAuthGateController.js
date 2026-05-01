import { useCallback, useEffect, useMemo, useState } from 'react';
import { bootAuthShell, loginReal, logoutReal, touchSession } from '../services/authShell.api';
import { pingBackend, startBackendHeartbeat } from '../../../shared/services/platform.api';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';

const REMEMBER_KEY = 'laclau_auth_remember_v1';
const SESSION_KEY = 'laclau_auth_session_v1';
const SCANNER_STATE_KEY = 'scanner_state_v1';
const SCANNER_QUEUE_KEY = 'scanner_sales_queue_v1';
const AUTH_KEEPALIVE_INTERVAL_MS = 3 * 60 * 1000;
const AUTH_KEEPALIVE_RETRY_DELAY_MS = 15000;
const AUTH_KEEPALIVE_MAX_UNAUTHORIZED = 2;

function readRememberedCredentials() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const username = String(parsed?.username || '').trim();
    const password = String(parsed?.password || '').trim();
    if (!username || !password) {
      return null;
    }
    return { username, password };
  } catch (_error) {
    return null;
  }
}

function persistCredentials({ rememberCredentials, username, password }) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!rememberCredentials) {
    window.localStorage.removeItem(REMEMBER_KEY);
    return;
  }

  window.localStorage.setItem(
    REMEMBER_KEY,
    JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || '').trim()
    })
  );
}

function readSavedSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const sessionToken = String(parsed?.sessionToken || '').trim();
    const role = String(parsed?.role || '').trim();
    if (!sessionToken || !role) {
      return null;
    }

    return {
      id: parsed?.id || null,
      name: String(parsed?.name || '').trim() || 'Operario',
      username: String(parsed?.username || '').trim() || 'operario',
      role,
      sessionToken
    };
  } catch (_error) {
    return null;
  }
}

function persistSession(user) {
  if (typeof window === 'undefined') {
    return;
  }

  const token = String(user?.sessionToken || '').trim();
  if (!token) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearLocalSessionData() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
  window.localStorage.removeItem(SCANNER_STATE_KEY);
  window.localStorage.removeItem(SCANNER_QUEUE_KEY);
}

export function useAuthGateController() {
  const [phase, setPhase] = useState('booting');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [error, setError] = useState('');
  const [backendReady, setBackendReady] = useState(false);
  const [user, setUser] = useState(null);
  const [adminFocusPasswordSignal, setAdminFocusPasswordSignal] = useState(0);

  const logout = useCallback(() => {
    const token = String(user?.sessionToken || '').trim();
    if (token) {
      logoutReal({ token }).catch(() => {});
    }
    clearLocalSessionData();
    setUser(null);
    setUsername('');
    setPassword('');
    setRememberCredentials(false);
    setPhase('login');
    setError('');
  }, [user?.sessionToken]);

  useEffect(() => {
    const remembered = readRememberedCredentials();
    const savedSession = readSavedSession();

    if (savedSession) {
      setUser(savedSession);
      setPhase('ready');
    }

    if (remembered) {
      setUsername(remembered.username);
      setPassword(remembered.password);
      setRememberCredentials(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function runBoot() {
      const boot = await bootAuthShell();
      if (cancelled) {
        return;
      }

      setBackendReady(Boolean(boot.backendReady));
      setPhase((current) => (current === 'ready' ? current : 'login'));
    }

    runBoot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stopHeartbeat = startBackendHeartbeat({
      intervalMs: Number(import.meta.env.VITE_BACKEND_HEARTBEAT_MS || 240000),
      timeoutMs: 2500
    });

    return () => {
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let intervalId = null;
    let retryTimeoutId = null;
    let unauthorizedCount = 0;

    async function keepaliveTick() {
      if (stopped) {
        return;
      }
      if (phase !== 'ready') {
        return;
      }
      const token = String(user?.sessionToken || '').trim();
      if (!token) {
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }

      try {
        await touchSession({ token });
        unauthorizedCount = 0;
      } catch (error) {
        const status = Number(error?.status || 0);
        if (status === 401) {
          unauthorizedCount += 1;
          if (unauthorizedCount >= AUTH_KEEPALIVE_MAX_UNAUTHORIZED) {
            logout();
            return;
          }
          retryTimeoutId = setTimeout(() => {
            keepaliveTick().catch(() => {});
          }, AUTH_KEEPALIVE_RETRY_DELAY_MS);
          return;
        }

        retryTimeoutId = setTimeout(() => {
          keepaliveTick().catch(() => {});
        }, AUTH_KEEPALIVE_RETRY_DELAY_MS);
      }
    }

    intervalId = setInterval(() => {
      keepaliveTick().catch(() => {});
    }, AUTH_KEEPALIVE_INTERVAL_MS);
    keepaliveTick().catch(() => {});

    return () => {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [logout, phase, user?.sessionToken]);

  const bootMessage = useMemo(() => {
    if (phase === 'authenticating') {
      return 'Preparando sesión segura...';
    }
    return 'Preparando conexión...';
  }, [phase]);

  async function runLogin(rawUsername, rawPassword) {
    const normalizedUser = String(rawUsername || '').trim();
    const normalizedPassword = String(rawPassword || '').trim();

    if (!normalizedUser || !normalizedPassword) {
      setError('Ingresa usuario y clave para continuar.');
      return;
    }

    setError('');
    setPhase('authenticating');

    try {
      // Pre-warm corto para aprovechar tiempo previo al login.
      pingBackend({ timeoutMs: 2200 }).catch(() => {});
      const loginResult = await loginReal({
        username: normalizedUser,
        password: normalizedPassword
      });
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SCANNER_STATE_KEY);
      }
      persistCredentials({
        rememberCredentials,
        username: normalizedUser,
        password: normalizedPassword
      });

      const nextUser = {
        id: loginResult?.user?.id || null,
        name: loginResult?.user?.display_name || normalizedUser || 'Admin',
        username: loginResult?.user?.username || normalizedUser,
        role: loginResult?.user?.role || 'operario',
        sessionToken: loginResult?.session?.token || ''
      };
      setUser(nextUser);
      persistSession(nextUser);
      setPhase('ready');
    } catch (loginError) {
      setError(toUserErrorMessage(loginError, { context: 'login' }));
      setPhase('login');
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    await runLogin(username, password);
  }

  async function quickLoginOperario() {
    const quickUsername = 'nova';
    const quickPassword = 'nova123';
    setUsername(quickUsername);
    setPassword(quickPassword);
    await runLogin(quickUsername, quickPassword);
  }

  function quickLoginAdmin() {
    const quickUsername = 'admin';
    setUsername(quickUsername);
    setPassword('');
    setError('');
    setAdminFocusPasswordSignal((value) => value + 1);
  }

  return {
    state: {
      phase,
      username,
      password,
      rememberCredentials,
      error,
      backendReady,
      bootMessage,
      user,
      adminFocusPasswordSignal
    },
    actions: {
      setUsername,
      setPassword,
      setRememberCredentials,
      submitLogin,
      quickLoginAdmin,
      quickLoginOperario,
      logout
    }
  };
}
