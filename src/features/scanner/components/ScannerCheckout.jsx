function ScannerCheckout({ total, onCharge }) {
  return (
    <div className="scanner-checkout mt-4">
      <div className="scanner-total-row mb-3">
        <span className="scanner-total-label">Total</span>
        <span className="scanner-total">${Number(total || 0).toFixed(2)}</span>
      </div>

      <button type="button" className="btn scanner-charge-btn w-100" onClick={onCharge}>
        Cobrar
      </button>
    </div>
  );
}

export default ScannerCheckout;
