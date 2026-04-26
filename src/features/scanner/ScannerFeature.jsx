import { useEffect } from 'react';
import { useScannerController } from './model/useScannerController';
import ApiStatusCard from './components/ApiStatusCard';
import ScannerInput from './components/ScannerInput';
import ScannerPreview from './components/ScannerPreview';
import ScannerCart from './components/ScannerCart';

function ScannerFeature() {
  const {
    apiUrl,
    appState,
    scannerState,
    totals,
    apiBadgeClass,
    actions
  } = useScannerController();

  useEffect(() => {
    actions.checkBackend();
    actions.loadQuickProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="landing-bg min-vh-100 d-flex align-items-center">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <div className="card shadow-lg border-0 welcome-card">
              <div className="card-body p-4 p-md-5">
                <p className="text-uppercase text-muted small mb-2">LaClaudia Scanner</p>
                <h1 className="display-6 fw-bold mb-3">Flujo de escaneo tipo supermercado</h1>
                <p className="lead text-secondary mb-4">
                  Escanea un codigo de barras, valida contra base de datos y suma al ticket en tiempo real.
                </p>

                <ApiStatusCard
                  apiStatus={appState.apiStatus}
                  apiBadgeClass={apiBadgeClass}
                  apiMessage={appState.apiMessage}
                  apiError={appState.error}
                  lastCheckAt={appState.lastCheckAt}
                  onCheck={actions.checkBackend}
                />

                <ScannerInput
                  barcode={scannerState.scanBarcode}
                  scanStatus={scannerState.scanStatus}
                  scanError={scannerState.scanError}
                  onBarcodeChange={actions.setScanBarcode}
                  onSubmit={actions.scanCurrentBarcode}
                />

                <div className="mt-4">
                  <ScannerPreview
                    status={scannerState.quickProductsStatus}
                    error={scannerState.quickProductsError}
                    products={scannerState.quickProducts}
                    onReload={actions.loadQuickProducts}
                  />
                </div>

                <ScannerCart
                  items={scannerState.cartItems}
                  totals={totals}
                  onInc={actions.incrementCartItem}
                  onDec={actions.decrementCartItem}
                  onRemove={actions.removeCartItem}
                  onClear={actions.clearCart}
                />

                <hr className="my-4" />
                <p className="small text-muted mb-2">API configurada en: <code>{apiUrl}</code></p>
                <p className="small text-muted mb-0">Arquitectura: feature folders + controlador + Redux slice.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScannerFeature;
