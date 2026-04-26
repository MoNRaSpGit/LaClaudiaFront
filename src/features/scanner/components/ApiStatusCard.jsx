function ApiStatusCard({ apiStatus, apiBadgeClass, apiMessage, apiError, lastCheckAt, onCheck }) {
  return (
    <div className="p-3 p-md-4 rounded-3 border bg-light mb-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div>
          <p className="mb-1 fw-semibold">Estado de API</p>
          <span className={`badge ${apiBadgeClass}`}>{apiStatus}</span>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCheck}>
          Probar conexion backend
        </button>
      </div>

      {apiMessage ? <p className="mb-0 mt-3 text-success">{apiMessage}</p> : null}
      {apiError ? <p className="mb-0 mt-3 text-danger">{apiError}</p> : null}
      {lastCheckAt ? <p className="mb-0 mt-2 small text-muted">Ultima prueba: {new Date(lastCheckAt).toLocaleString()}</p> : null}
    </div>
  );
}

export default ApiStatusCard;
