import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Menu, UserRound, LogOut, ShieldCheck } from 'lucide-react';
import AuthGate from './features/auth/AuthGate';
import ScannerFeature from './features/scanner/ScannerFeature';
import PanelControlFeature from './features/panelControl/PanelControlFeature';
import { resetScannerState } from './features/scanner/scannerSlice';

function Workspace({ user, onLogout }) {
  const dispatch = useDispatch();
  const userRole = String(user?.role || 'operario').toLowerCase();
  const canAccessPanel = userRole === 'admin';
  const [activeTab, setActiveTab] = useState(canAccessPanel ? 'panel' : 'scanner');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {    if (!canAccessPanel && activeTab === 'panel') {
      setActiveTab('scanner');
    }
  }, [activeTab, canAccessPanel]);

  const roleLabel = useMemo(() => (canAccessPanel ? 'Admin' : 'Operario'), [canAccessPanel]);

  function handleLogout() {
    setIsMenuOpen(false);
    dispatch(resetScannerState());
    onLogout();
  }

  return (
    <div className="landing-bg min-vh-100">
      <nav className="navbar navbar-expand-lg scanner-navbar scanner-navbar-dark border-bottom">
        <div className="container">
          <div className="d-flex align-items-center">
            <span className="navbar-brand fw-bold mb-0 text-white">S{"\u00FA"}per Nova</span>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap ms-auto">
            <div className="navbar-nav gap-1">
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
            </div>

            <div className="scanner-user-menu">
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
                  <div className="scanner-user-dropdown-head">
                    <ShieldCheck size={16} />
                    <span>Sesión iniciada ({roleLabel})</span>
                  </div>
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

      {activeTab === 'scanner' || !canAccessPanel
        ? <ScannerFeature currentUser={user} />
        : <PanelControlFeature currentUser={user} />}
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

