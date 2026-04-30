import { useEffect, useRef } from 'react';

function LoginCard({
  username,
  password,
  rememberCredentials,
  error,
  backendReady,
  isAuthenticating,
  adminFocusPasswordSignal,
  onUsernameChange,
  onPasswordChange,
  onRememberCredentialsChange,
  onSubmit,
  onQuickAdminLogin,
  onQuickOperarioLogin
}) {
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (!adminFocusPasswordSignal) {
      return;
    }

    setTimeout(() => {
      passwordInputRef.current?.focus();
      passwordInputRef.current?.select?.();
    }, 0);
  }, [adminFocusPasswordSignal]);

  return (
    <div className="auth-shell">
      <section className="auth-login-card">
        <h1 className="auth-title mb-1">Iniciar sesi{"\u00F3"}n</h1>
        <p className="auth-subtitle mb-4">
          {backendReady
            ? 'Sistema listo para operar.'
            : 'Arranque asistido activo. Si el servidor demora, la app sigue de forma fluida.'}
        </p>

        <form className="d-grid gap-3" onSubmit={onSubmit}>
          <div>
            <label className="form-label auth-label">Usuario</label>
            <input
              type="text"
              className="form-control auth-input"
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              placeholder="admin"
              autoFocus
              disabled={isAuthenticating}
            />
          </div>

          <div>
            <label className="form-label auth-label">Clave</label>
            <input
              ref={passwordInputRef}
              type="password"
              className="form-control auth-input"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="********"
              disabled={isAuthenticating}
            />
          </div>

          <label className="auth-remember-row">
            <input
              type="checkbox"
              checked={rememberCredentials}
              onChange={(event) => onRememberCredentialsChange(event.target.checked)}
              disabled={isAuthenticating}
            />
            <span>Recordar usuario y clave en este dispositivo</span>
          </label>

          {error ? <small className="text-danger">{error}</small> : null}

          <button type="submit" className="btn auth-submit-btn" disabled={isAuthenticating}>
            {isAuthenticating ? 'Entrando...' : 'Entrar al sistema'}
          </button>

          <div className="d-grid gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={isAuthenticating}
              onClick={onQuickAdminLogin}
            >
              Entrar como Admin
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={isAuthenticating}
              onClick={onQuickOperarioLogin}
            >
              Entrar como Operario
            </button>
          </div>
        </form>

        <p className="auth-footnote mt-3 mb-0">
          Acceso r{"\u00E1"}pido disponible para operaci{"\u00F3"}n de caja. Admin precarga usuario; operario entra completo.
        </p>
      </section>
    </div>
  );
}

export default LoginCard;
