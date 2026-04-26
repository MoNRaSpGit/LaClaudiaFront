import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';

function ScannerFeature() {
  const { apiUrl, scannerState, actions } = useScannerController();

  return (
    <div className="landing-bg min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom scanner-navbar">
        <div className="container">
          <span className="navbar-brand fw-bold">LaClaudia</span>
          <div className="navbar-nav">
            <span className="nav-link active fw-semibold" aria-current="page">Scanner</span>
          </div>
        </div>
      </nav>

      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-xl-9">
            <div className="card shadow-lg border-0 welcome-card">
              <div className="card-body p-4 p-md-5">
                <p className="text-uppercase text-muted small mb-2">Scanner</p>
                <h1 className="display-6 fw-bold mb-4">Lectura de productos</h1>

                <ScannerInput
                  barcode={scannerState.scanBarcode}
                  scanStatus={scannerState.scanStatus}
                  scanError={scannerState.scanError}
                  onBarcodeChange={actions.setScanBarcode}
                  onSubmit={actions.scanCurrentBarcode}
                />

                <div className="text-center mt-4">
                  <button type="button" className="btn btn-outline-dark px-4" onClick={actions.openManualProduct}>
                    Producto Manual
                  </button>
                </div>

                <ScannerCart items={scannerState.cartItems} />

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

export default ScannerFeature;
