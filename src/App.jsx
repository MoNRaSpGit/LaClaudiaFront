import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setApiChecking, setApiError, setApiSuccess } from './features/app/appSlice';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const dispatch = useDispatch();
  const { apiStatus, apiMessage, lastCheckAt, error } = useSelector((state) => state.app);

  const badgeClass = useMemo(() => {
    if (apiStatus === 'online') return 'bg-success';
    if (apiStatus === 'offline') return 'bg-danger';
    if (apiStatus === 'checking') return 'bg-warning text-dark';
    return 'bg-secondary';
  }, [apiStatus]);

  async function checkBackend() {
    dispatch(setApiChecking());
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      dispatch(setApiSuccess(data.message || 'Backend online'));
    } catch (requestError) {
      dispatch(setApiError(requestError.message || 'No se pudo conectar al backend'));
    }
  }

  return (
    <div className="landing-bg min-vh-100 d-flex align-items-center">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="card shadow-lg border-0">
              <div className="card-body p-4 p-md-5">
                <p className="text-uppercase text-muted small mb-2">LaClaudia stack base</p>
                <h1 className="display-5 fw-bold mb-3">Frontend + Backend listos para produccion</h1>
                <p className="lead text-secondary mb-4">
                  Esta base usa React, Vite, Redux Toolkit y Bootstrap en frontend, con Node + Express en backend.
                </p>

                <div className="d-flex flex-wrap gap-2 mb-4">
                  <span className="badge rounded-pill text-bg-dark">React</span>
                  <span className="badge rounded-pill text-bg-dark">Vite</span>
                  <span className="badge rounded-pill text-bg-dark">Redux Toolkit</span>
                  <span className="badge rounded-pill text-bg-dark">Bootstrap</span>
                  <span className="badge rounded-pill text-bg-dark">Express</span>
                </div>

                <div className="p-3 p-md-4 rounded-3 border bg-light">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                      <p className="mb-1 fw-semibold">Estado de API</p>
                      <span className={`badge ${badgeClass}`}>{apiStatus}</span>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={checkBackend}>
                      Probar conexion backend
                    </button>
                  </div>

                  {apiMessage ? <p className="mb-0 mt-3 text-success">{apiMessage}</p> : null}
                  {error ? <p className="mb-0 mt-3 text-danger">{error}</p> : null}
                  {lastCheckAt ? (
                    <p className="mb-0 mt-2 small text-muted">Ultima prueba: {new Date(lastCheckAt).toLocaleString()}</p>
                  ) : null}
                </div>

                <hr className="my-4" />
                <p className="small text-muted mb-0">API configurada en: <code>{apiUrl}</code></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
