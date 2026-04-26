import { useState } from 'react';
import ScannerFeature from './features/scanner/ScannerFeature';
import PanelControlFeature from './features/panelControl/PanelControlFeature';

function App() {
  const [activeTab, setActiveTab] = useState('scanner');

  return (
    <div className="landing-bg min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom scanner-navbar">
        <div className="container">
          <span className="navbar-brand fw-bold">LaClaudia</span>
          <div className="navbar-nav gap-1">
            <button
              type="button"
              className={`btn nav-tab-btn ${activeTab === 'scanner' ? 'nav-tab-btn-active' : ''}`}
              onClick={() => setActiveTab('scanner')}
            >
              Scanner
            </button>
            <button
              type="button"
              className={`btn nav-tab-btn ${activeTab === 'panel' ? 'nav-tab-btn-active' : ''}`}
              onClick={() => setActiveTab('panel')}
            >
              Panel Control
            </button>
          </div>
        </div>
      </nav>

      {activeTab === 'scanner' ? <ScannerFeature /> : <PanelControlFeature />}
    </div>
  );
}

export default App;
