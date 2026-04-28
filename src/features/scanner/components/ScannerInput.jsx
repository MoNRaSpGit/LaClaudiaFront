import { forwardRef } from 'react';

const ScannerInput = forwardRef(function ScannerInput(
  { barcode, onBarcodeChange, onSubmit, scanStatus, scanError = '' },
  inputRef
) {
  return (
    <div className="scanner-input-dominant p-3 p-md-4 rounded-3 border bg-white shadow-sm">
      <form
        className="d-flex"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="form-control scanner-input-control text-center"
          placeholder="Escanear aquí"
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          disabled={scanStatus === 'loading'}
          autoFocus
        />
      </form>
      {scanStatus === 'loading' ? <p className="mb-0 mt-2 text-muted small text-center">Buscando producto...</p> : null}
      {scanError ? <p className="mb-0 mt-2 text-danger small text-center">{scanError}</p> : null}
    </div>
  );
});

export default ScannerInput;
