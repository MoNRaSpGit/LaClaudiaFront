import { useEffect, useMemo, useState } from 'react';
import { bootAuthShell, loginReal, logoutReal } from '../services/authShell.api';

const REMEMBER_KEY = 'laclau_auth_remember_v1';

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
      setPhase('login');
    }

    runBoot();

    return () => {
      cancelled = true;
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
      const loginResult = await loginReal({
        username: normalizedUser,
        password: normalizedPassword
      });
      persistCredentials({
        rememberCredentials,
        username: normalizedUser,
        password: normalizedPassword
      });

      setUser({
        id: loginResult?.user?.id || null,
        name: loginResult?.user?.display_name || normalizedUser || 'Admin',
        username: loginResult?.user?.username || normalizedUser,
        role: loginResult?.user?.role || 'operario',
        sessionToken: loginResult?.session?.token || ''
      });
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

  function logout() {
    const token = String(user?.sessionToken || '').trim();
    if (token) {
      logoutReal({ token }).catch(() => {});
    }
    setUser(null);
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
      quickLoginOperario,
      logout
    }
  };
}
