import { useEffect, useMemo, useState } from 'react';
import { bootAuthShell, loginReal, logoutReal } from '../services/authShell.api';
import { pingBackend, startBackendHeartbeat } from '../../../shared/services/platform.api';

const REMEMBER_KEY = 'laclau_auth_remember_v1';
const SESSION_KEY = 'laclau_auth_session_v1';
const SCANNER_STATE_KEY = 'scanner_state_v1';
const SCANNER_QUEUE_KEY = 'scanner_sales_queue_v1';

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
      setError(loginError?.message || 'No se pudo iniciar sesión.');
      setPhase('login');
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    await runLogin(username, password);
  }

  async function quickLoginOperario() {
    const quickUsername = 'operario';
    const quickPassword = '1234';
    setUsername(quickUsername);
    setPassword(quickPassword);
    await runLogin(quickUsername, quickPassword);
  }

  async function quickLoginAdmin() {
    const quickUsername = 'admin';
    const quickPassword = '1234';
    setUsername(quickUsername);
    setPassword(quickPassword);
    await runLogin(quickUsername, quickPassword);
  }

  function logout() {
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
      user
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
