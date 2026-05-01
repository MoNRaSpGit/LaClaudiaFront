import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Menu, UserRound, LogOut } from 'lucide-react';
import AuthGate from './features/auth/AuthGate';
import ScannerFeature from './features/scanner/ScannerFeature';
import PanelControlFeature from './features/panelControl/PanelControlFeature';
import PaymentsFeature from './features/payments/PaymentsFeature';
import { resetScannerState } from './features/scanner/scannerSlice';

function Workspace({ user, onLogout }) {
  const dispatch = useDispatch();
  const userRole = String(user?.role || 'operario').toLowerCase();
  const canAccessPanel = userRole === 'admin';
  const canAccessPayments = userRole === 'operario';
  const [activeTab, setActiveTab] = useState(canAccessPanel ? 'panel' : 'scanner');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!canAccessPanel && activeTab === 'panel') {
      setActiveTab('scanner');
    }
    if (!canAccessPayments && activeTab === 'payments') {
      setActiveTab(canAccessPanel ? 'panel' : 'scanner');
    }
  }, [activeTab, canAccessPanel, canAccessPayments]);

  function handleLogout() {
    setIsMenuOpen(false);
    dispatch(resetScannerState());
    onLogout();
  }

  return (
    <div className="landing-bg min-vh-100">
      <nav className="navbar scanner-navbar scanner-navbar-dark border-bottom">
        <div className="container">
          <div className="scanner-navbar-brand-wrap d-flex align-items-center">
            <span className="navbar-brand fw-bold mb-0 text-white">S{"\u00FA"}per Nova</span>
          </div>

          <div className="scanner-navbar-main d-flex align-items-center gap-2 flex-wrap ms-auto">
            <div className="scanner-navbar-tabs navbar-nav gap-1">
              <button
                type="button"
                className={`btn nav-tab-btn nav-tab-btn-dark ${activeTab === 'scanner' ? 'nav-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('scanner')}
                aria-current={activeTab === 'scanner' ? 'page' : undefined}
              >
                Scanner
              </button>
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

      {activeTab === 'scanner' && (
        <ScannerFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'panel' && canAccessPanel && (
        <PanelControlFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
      {activeTab === 'payments' && canAccessPayments && (
        <PaymentsFeature currentUser={user} onUnauthorized={handleLogout} />
      )}
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

