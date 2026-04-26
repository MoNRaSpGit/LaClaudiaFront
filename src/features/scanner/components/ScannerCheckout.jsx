function ScannerCheckout({ total, onCharge, alignOffsetPx, onAdjustOffset }) {
  return (
    <div className="scanner-checkout mt-4">
      <div className="scanner-total-row mb-2" style={{ paddingRight: `${alignOffsetPx}px` }}>
        <span className="scanner-total-label">Total</span>
        <span className="scanner-total">${Number(total || 0).toFixed(2)}</span>
      </div>

      <div className="scanner-align-control mb-3">
        <span>Correr a la izquierda: {alignOffsetPx}px</span>
        <div className="btn-group btn-group-sm">
          <button type="button" className="btn btn-outline-secondary" onClick={() => onAdjustOffset(-1)}>-</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => onAdjustOffset(1)}>+</button>
        </div>
      </div>

      <button type="button" className="btn scanner-charge-btn w-100" onClick={onCharge}>
        Cobrar
      </button>
    </div>
  );
}

export default ScannerCheckout;
