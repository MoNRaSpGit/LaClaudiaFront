function ScannerInput({ barcode, onBarcodeChange, onSubmit, scanStatus, scanError }) {
  return (
    <div className="p-3 p-md-4 rounded-3 border bg-light">
      <p className="mb-3 fw-semibold">Escanear producto</p>
      <form
        className="d-flex flex-column flex-md-row gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Ej: 7730123456789"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={scanStatus === 'loading'}>
          {scanStatus === 'loading' ? 'Buscando...' : 'Agregar'}
        </button>
      </form>
      {scanError ? <p className="mb-0 mt-2 text-danger small">{scanError}</p> : null}
    </div>
  );
}

export default ScannerInput;
