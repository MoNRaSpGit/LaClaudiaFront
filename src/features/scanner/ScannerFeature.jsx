import { useState } from 'react';
import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';
import ScannerCheckout from './components/ScannerCheckout';
import ScannerManualModal from './components/ScannerManualModal';

function ScannerFeature() {
  const { scannerState, totals, actions } = useScannerController();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

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

      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-9">
            <ScannerInput
              barcode={scannerState.scanBarcode}
              scanStatus={scannerState.scanStatus}
              scanError={scannerState.scanError}
              onBarcodeChange={actions.setScanBarcode}
              onSubmit={actions.scanCurrentBarcode}
            />

            <div className="text-center mt-4">
              <button
                type="button"
                className="btn scanner-manual-btn"
                onClick={() => setIsManualModalOpen(true)}
              >
                Producto Manual
              </button>
            </div>

            <ScannerCart
              items={scannerState.cartItems}
              lastScannedItemId={scannerState.lastScannedItemId}
              onRemoveOne={actions.removeOneFromCart}
            />

            {scannerState.cartItems.length > 0 ? (
              <ScannerCheckout total={totals.total} onCharge={actions.chargeCart} />
            ) : null}
          </div>
        </div>
      </div>

      <ScannerManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onConfirm={actions.addManualProduct}
      />
    </div>
  );
}

export default ScannerFeature;
