function ScannerCheckout({ total, onCharge }) {
  return (
    <div className="scanner-checkout mt-4">
      <p className="mb-2 text-uppercase small text-muted">Total</p>
      <p className="scanner-total mb-3">${Number(total || 0).toFixed(2)}</p>
      <button type="button" className="btn scanner-charge-btn w-100" onClick={onCharge}>
        Cobrar
      </button>
    </div>
  );
}

export default ScannerCheckout;
