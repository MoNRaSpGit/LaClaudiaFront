function AppBootScreen({ message }) {
  return (
    <div className="auth-shell">
      <section className="auth-boot-card">
        <h1 className="auth-welcome-head mb-2">
          <span className="auth-welcome-text">Bienvenida</span>{' '}
          <span className="auth-welcome-name">S{"\u00FA"}per Nova</span>
        </h1>
        <h1 className="auth-title mb-2">Creando tu espacio de trabajo</h1>
        <p className="auth-subtitle mb-4">{message}</p>
        <div className="auth-loader-track" aria-hidden="true">
          <span className="auth-loader-progress" />
        </div>
      </section>
    </div>
  );
}

export default AppBootScreen;
