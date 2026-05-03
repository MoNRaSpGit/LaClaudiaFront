import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Menu, UserRound, LogOut, BellRing } from 'lucide-react';
import AuthGate from './features/auth/AuthGate';
import ScannerFeature from './features/scanner/ScannerFeature';
import PanelControlFeature from './features/panelControl/PanelControlFeature';
import PaymentsFeature from './features/payments/PaymentsFeature';
import ProductsFeature from './features/products/ProductsFeature';
import StockFeature from './features/stock/StockFeature';
import { resetScannerState } from './features/scanner/scannerSlice';
import {
  checkForAppUpdate,
  clearDismissedUpdate,
  dismissAvailableUpdate,
  getAppUpdateSnapshot,
  reloadToApplyUpdate,
  subscribeToUpdateChanges
} from './shared/lib/appUpdate';

function Workspace({ user, onLogout }) {
  const dispatch = useDispatch();
  const userRole = String(user?.role || 'operario').toLowerCase();
  const canAccessPanel = userRole === 'admin';
  const canAccessProducts = userRole === 'admin';
  const canAccessStock = userRole === 'admin' || userRole === 'operario';
  const canAccessPayments = userRole === 'operario';
  const canAccessScannerTab = userRole !== 'admin';
  const [activeTab, setActiveTab] = useState(canAccessPanel ? 'panel' : 'scanner');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [updateState, setUpdateState] = useState(() => getAppUpdateSnapshot());
  const [isUpdatePromptOpen, setIsUpdatePromptOpen] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [shouldResetSessionOnApply, setShouldResetSessionOnApply] = useState(false);

  useEffect(() => {
    if (!canAccessPanel && activeTab === 'panel') {
      setActiveTab('scanner');
    }
    if (!canAccessProducts && activeTab === 'products') {
      setActiveTab(canAccessPanel ? 'panel' : 'scanner');
    }
    if (!canAccessStock && activeTab === 'stock') {
      setActiveTab(canAccessPanel ? 'panel' : 'scanner');
    }
    if (!canAccessPayments && activeTab === 'payments') {
      setActiveTab(canAccessPanel ? 'panel' : 'scanner');
    }
  }, [activeTab, canAccessPanel, canAccessPayments, canAccessProducts, canAccessStock]);

  useEffect(() => {
    function syncUpdateState() {
      setUpdateState(getAppUpdateSnapshot());
    }

    syncUpdateState();
    const unsubscribe = subscribeToUpdateChanges(syncUpdateState);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.sessionToken) {
      return undefined;
    }

    let isCancelled = false;

    async function refreshAvailableUpdate() {
      await checkForAppUpdate();
      if (!isCancelled) {
        setUpdateState(getAppUpdateSnapshot());
      }
    }

    refreshAvailableUpdate();

    const intervalId = window.setInterval(refreshAvailableUpdate, 120000);
    const handleFocus = () => {
      refreshAvailableUpdate();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshAvailableUpdate();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.sessionToken]);

  useEffect(() => {
    if (!user?.sessionToken) {
      return;
    }

    if (updateState.hasPendingUpdate && updateState.dismissedVersion !== updateState.availableVersion) {
      setIsUpdatePromptOpen(true);
      return;
    }

    if (!updateState.hasPendingUpdate) {
      setIsUpdatePromptOpen(false);
    }
  }, [updateState.availableVersion, updateState.dismissedVersion, updateState.hasPendingUpdate, user?.sessionToken]);

  function handleLogout() {
    setIsMenuOpen(false);
    dispatch(resetScannerState());
    onLogout();
  }

  function handleApplyUpdate() {
    if (isApplyingUpdate) {
      return;
    }

    clearDismissedUpdate();
    setIsUpdatePromptOpen(false);
    setShouldResetSessionOnApply(updateState.requiresSessionReset);
    setIsApplyingUpdate(true);
    setUpdateProgress(0);
  }

  function handleDismissUpdate() {
    dismissAvailableUpdate(updateState.availableVersion);
    setIsUpdatePromptOpen(false);
  }

  useEffect(() => {
    if (!isApplyingUpdate) {
      return undefined;
    }

    const startedAt = Date.now();
    const durationMs = 1400;

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setUpdateProgress(nextProgress);
      if (nextProgress >= 100) {
        window.clearInterval(intervalId);
        if (shouldResetSessionOnApply) {
          onLogout();
        }
        reloadToApplyUpdate();
      }
    }, 60);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isApplyingUpdate, onLogout, shouldResetSessionOnApply]);

  return (
    <div className="landing-bg min-vh-100">
      <nav className="navbar scanner-navbar scanner-navbar-dark border-bottom">
        <div className="container">
          <div className="scanner-navbar-brand-wrap d-flex align-items-center">
            <span className="navbar-brand fw-bold mb-0 text-white">S{"\u00FA"}per Nova</span>
          </div>

          <div className="scanner-navbar-main d-flex align-items-center gap-2 flex-wrap ms-auto">
            <div className="scanner-navbar-tabs navbar-nav gap-1">
              {canAccessScannerTab ? (
                <button
                  type="button"
                  className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'scanner' ? 'nav-tab-btn-active' : ''}`}
                  onClick={() => setActiveTab('scanner')}
                  aria-current={activeTab === 'scanner' ? 'page' : undefined}
                >
                  Scanner
                </button>
              ) : null}
              {canAccessPanel ? (
                <button
                  type="button"
                  className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'panel' ? 'nav-tab-btn-active' : ''}`}
                  onClick={() => setActiveTab('panel')}
                  aria-current={activeTab === 'panel' ? 'page' : undefined}
                >
                  Panel de control
                </button>
              ) : null}
              {canAccessProducts ? (
                <button
                  type="button"
                  className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'products' ? 'nav-tab-btn-active' : ''}`}
                  onClick={() => setActiveTab('products')}
                  aria-current={activeTab === 'products' ? 'page' : undefined}
                >
                  Productos
                </button>
              ) : null}
              {canAccessStock ? (
                <button
                  type="button"
                  className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'stock' ? 'nav-tab-btn-active' : ''}`}
                  onClick={() => setActiveTab('stock')}
                  aria-current={activeTab === 'stock' ? 'page' : undefined}
                >
                  Stock
                </button>
              ) : null}
              {canAccessPayments ? (
                <button
                  type="button"
                  className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'payments' ? 'nav-tab-btn-active' : ''}`}
                  onClick={() => setActiveTab('payments')}
                  aria-current={activeTab === 'payments' ? 'page' : undefined}
                >
                  Pagos
                </button>
              ) : null}
            </div>

            <div className="scanner-user-menu scanner-navbar-user">
              <button
                type="button"
                className="btn scanner-user-menu-btn"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-expanded={isMenuOpen}
                aria-label="Abrir menú de usuario"
              >
                <UserRound size={16} />
                <span className="auth-user-pill auth-user-pill-dark">{user?.name || 'Admin'}</span>
                <Menu size={16} />
              </button>

              {isMenuOpen ? (
                <div className="scanner-user-dropdown">
                  {canAccessScannerTab ? (
                    <button
                      type="button"
                      className={`scanner-user-dropdown-item scanner-user-dropdown-nav-item ${activeTab === 'scanner' ? 'scanner-user-dropdown-nav-item-active' : ''}`}
                      onClick={() => {
                        setActiveTab('scanner');
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>Scanner</span>
                    </button>
                  ) : null}
                  {canAccessPanel ? (
                    <button
                      type="button"
                      className={`scanner-user-dropdown-item scanner-user-dropdown-nav-item ${activeTab === 'panel' ? 'scanner-user-dropdown-nav-item-active' : ''}`}
                      onClick={() => {
                        setActiveTab('panel');
                        setIsMenuOpen(false);
                      }}
                  >
                    <span>Panel de control</span>
                  </button>
                  ) : null}
                  {canAccessProducts ? (
                    <button
                      type="button"
                      className={`scanner-user-dropdown-item scanner-user-dropdown-nav-item ${activeTab === 'products' ? 'scanner-user-dropdown-nav-item-active' : ''}`}
                      onClick={() => {
                        setActiveTab('products');
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>Productos</span>
                    </button>
                  ) : null}
                  {canAccessStock ? (
                    <button
                      type="button"
                      className={`scanner-user-dropdown-item scanner-user-dropdown-nav-item ${activeTab === 'stock' ? 'scanner-user-dropdown-nav-item-active' : ''}`}
                      onClick={() => {
                        setActiveTab('stock');
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>Stock</span>
                    </button>
                  ) : null}
                  {canAccessPayments ? (
                    <button
                      type="button"
                      className={`scanner-user-dropdown-item scanner-user-dropdown-nav-item ${activeTab === 'payments' ? 'scanner-user-dropdown-nav-item-active' : ''}`}
                      onClick={() => {
                        setActiveTab('payments');
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>Pagos</span>
                    </button>
                  ) : null}
                  <div className="scanner-user-dropdown-divider" />
                  <button type="button" className="scanner-user-dropdown-item" onClick={handleLogout}>
                    <LogOut size={14} />
                    <span>Salir</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      {updateState.hasPendingUpdate && !isUpdatePromptOpen ? (
        <div className="app-update-mini-banner">
          <div className="container app-update-mini-banner-inner">
            <div className="app-update-mini-copy">
              <BellRing size={14} />
              <span>Nueva version disponible</span>
            </div>
            <div className="app-update-mini-actions">
              <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setIsUpdatePromptOpen(true)}>
                Ver
              </button>
              <button type="button" className="btn btn-sm btn-light" onClick={handleApplyUpdate} disabled={isApplyingUpdate}>
                Actualizar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'scanner' && (
        <ScannerFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'panel' && canAccessPanel && (
        <PanelControlFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'products' && canAccessProducts && (
        <ProductsFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'stock' && canAccessStock && (
        <StockFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'payments' && canAccessPayments && (
        <PaymentsFeature currentUser={user} onUnauthorized={handleLogout} />
      )}

      {isUpdatePromptOpen && updateState.hasPendingUpdate ? (
        <div className="app-update-modal-backdrop" role="presentation">
          <section className="app-update-modal-card" role="dialog" aria-modal="true" aria-labelledby="app-update-title">
            <p className="app-update-modal-kicker app-update-modal-kicker-simple mb-2">Actualizacion disponible</p>
            <h2 id="app-update-title" className="app-update-modal-title app-update-modal-title-simple mb-2">
              Hay una nueva actualizacion.
            </h2>
            <p className="app-update-modal-copy app-update-modal-copy-simple mb-3">
              Podemos aplicarla ahora o dejarla para despues.
            </p>
            {updateState.requiresSessionReset ? (
              <p className="app-update-modal-note app-update-modal-note-simple mb-3">
                Esta actualizacion requiere volver a ingresar.
              </p>
            ) : null}
            <div className="app-update-modal-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={handleDismissUpdate} disabled={isApplyingUpdate}>
                Mas tarde
              </button>
              <button type="button" className="btn btn-dark" onClick={handleApplyUpdate} disabled={isApplyingUpdate}>
                Actualizar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isApplyingUpdate ? (
        <div className="app-update-progress-shell" role="status" aria-live="polite">
          <div className="app-update-progress-card">
            <p className="app-update-progress-kicker mb-1">Actualizando</p>
            <strong className="app-update-progress-title d-block mb-2">
              {shouldResetSessionOnApply ? 'Aplicando nueva version y reiniciando sesion...' : 'Aplicando nueva version...'}
            </strong>
            <div className="app-update-progress-track" aria-hidden="true">
              <div className="app-update-progress-bar" style={{ width: `${updateProgress}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <AuthGate>
      {({ user, onLogout }) => <Workspace user={user} onLogout={onLogout} />}
    </AuthGate>
  );
}

export default App;
