import { useState } from 'react';
import { useScannerController } from './model/useScannerController';
import ScannerInput from './components/ScannerInput';
import ScannerCart from './components/ScannerCart';
import ScannerCheckout from './components/ScannerCheckout';
import ScannerManualModal from './components/ScannerManualModal';

function ScannerFeature() {
  const { scannerState, totals, actions } = useScannerController();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [checkoutAlignOffsetPx, setCheckoutAlignOffsetPx] = useState(34);

  return (
    <>
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
              <ScannerCheckout
                total={totals.total}
                onCharge={actions.chargeCart}
                alignOffsetPx={checkoutAlignOffsetPx}
                onAdjustOffset={(delta) => setCheckoutAlignOffsetPx((prev) => Math.max(0, prev + delta))}
              />
            ) : null}
          </div>
        </div>
      </div>

      <ScannerManualModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onConfirm={actions.addManualProduct}
      />
    </>
  );
}

export default ScannerFeature;
