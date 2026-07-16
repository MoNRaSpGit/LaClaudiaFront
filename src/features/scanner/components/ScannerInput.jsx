import { forwardRef } from 'react';

const ScannerInput = forwardRef(function ScannerInput(
  { barcode, onBarcodeChange, onSubmit, scanStatus, scanError = '', isShiftOpen = true, isShiftLoading = false, shiftLockMessage = '' },
  inputRef
) {
  return (
    <div className="scanner-input-dominant p-3 p-md-4 rounded-3 border bg-white shadow-sm">
      {!isShiftOpen && !isShiftLoading ? (
        <p className="scanner-inline-error mb-3 text-center">{shiftLockMessage || 'Abrir turno'}</p>
      ) : null}
      {isShiftLoading ? (
        <p className="scanner-sync-hint mb-3 text-center">Verificando turno...</p>
      ) : null}
      <form
        className="d-flex"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(inputRef?.current?.value || barcode || '');
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="form-control scanner-input-control text-center"
          placeholder={!isShiftOpen ? 'Abrir turno' : 'Escanear aqui'}
          value={barcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          disabled={scanStatus === 'loading' || !isShiftOpen}
          autoFocus
        />
      </form>
      {scanStatus === 'loading' ? <p className="mb-0 mt-2 text-muted small text-center">Buscando producto...</p> : null}
      {scanError ? <p className="mb-0 mt-2 text-danger small text-center">{scanError}</p> : null}
    </div>
  );
});

export default ScannerInput;
