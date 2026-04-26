function ScannerInput({ barcode, onBarcodeChange, onSubmit, scanStatus, scanError }) {
  return (
    <div className="p-3 p-md-4 rounded-3 border bg-light">
      <p className="mb-3 fw-semibold">Escanear producto</p>
      <form
        className="d-flex"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Escanea o escribe un codigo de barras"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          disabled={scanStatus === 'loading'}
          autoFocus
        />
      </form>
      {scanStatus === 'loading' ? <p className="mb-0 mt-2 text-muted small">Buscando producto...</p> : null}
      {scanError ? <p className="mb-0 mt-2 text-danger small">{scanError}</p> : null}
    </div>
  );
}

export default ScannerInput;
