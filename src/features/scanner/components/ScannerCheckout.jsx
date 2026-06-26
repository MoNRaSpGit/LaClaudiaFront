import { useCallback, useEffect, useRef, useState } from 'react';

const ENTER_CONFIRM_GUARD_MS = 350;

function ScannerCheckout({
  total,
  pendingSalesCount = 0,
  isChargeBlocked = false,
  chargeBlockMessage = '',
  customerOptions = [],
  isCustomerAccountsAvailable = true,
  onCharge,
  openConfirmSignal = 0,
  confirmByEnterSignal = 0,
  onConfirmModalOpenChange
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpenedAt, setConfirmOpenedAt] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const lastHandledOpenSignalRef = useRef(0);
  const lastHandledConfirmSignalRef = useRef(0);
  const isAccountPayment = paymentMethod === 'cuenta';
  const isMissingCustomer = isAccountPayment && !selectedCustomerId;
  const paymentMethodOptions = [
    { value: 'efectivo', label: 'Efectivo', className: 'scanner-payment-method-btn-cash' },
    { value: 'tarjeta', label: 'Tarjeta', className: 'scanner-payment-method-btn-card' },
    { value: 'cuenta', label: 'Cuenta', className: 'scanner-payment-method-btn-account', disabled: !isCustomerAccountsAvailable }
  ];

  const handleConfirm = useCallback(async () => {
    if (isSubmitting || isChargeBlocked || isMissingCustomer) {
      return;
    }
    setIsSubmitting(true);
    const ok = await onCharge({
      paymentMethod,
      customerId: isAccountPayment ? Number(selectedCustomerId) : null
    });
    setIsSubmitting(false);
    if (ok) {
      setIsConfirmOpen(false);
      setPaymentMethod('efectivo');
      setSelectedCustomerId('');
    }
  }, [isAccountPayment, isChargeBlocked, isMissingCustomer, isSubmitting, onCharge, paymentMethod, selectedCustomerId]);

  useEffect(() => {
    if (openConfirmSignal <= 0) {
      return;
    }
    if (openConfirmSignal === lastHandledOpenSignalRef.current) {
      return;
    }
    if (isChargeBlocked) {
      return;
    }
    lastHandledOpenSignalRef.current = openConfirmSignal;
    setConfirmOpenedAt(Date.now());
    setIsConfirmOpen(true);
  }, [isChargeBlocked, openConfirmSignal]);

  useEffect(() => {
    if (confirmByEnterSignal <= 0) {
      return;
    }
    if (confirmByEnterSignal === lastHandledConfirmSignalRef.current) {
      return;
    }
    lastHandledConfirmSignalRef.current = confirmByEnterSignal;
    if (!isConfirmOpen) {
      return;
    }
    if (Date.now() - confirmOpenedAt < ENTER_CONFIRM_GUARD_MS) {
      return;
    }
    handleConfirm();
  }, [confirmByEnterSignal, handleConfirm, isConfirmOpen, confirmOpenedAt]);

  useEffect(() => {
    onConfirmModalOpenChange?.(isConfirmOpen);
  }, [isConfirmOpen, onConfirmModalOpenChange]);

  useEffect(() => {
    if (!isCustomerAccountsAvailable && paymentMethod === 'cuenta') {
      setPaymentMethod('efectivo');
      setSelectedCustomerId('');
    }
  }, [isCustomerAccountsAvailable, paymentMethod]);

  return (
    <>
      <div className="scanner-checkout mt-4">
        <div className="scanner-total-row mb-3">
          <span className="scanner-total-label">Total</span>
          <span className="scanner-total">${Number(total || 0).toFixed(2)}</span>
        </div>

        {pendingSalesCount > 0 ? (
          <p className="scanner-sync-hint mb-2">
            Pendientes de sincronizar: <strong>{pendingSalesCount}</strong>
          </p>
        ) : (
          <p className="scanner-sync-hint scanner-sync-hint-ok mb-2">Sincronizacion al dia</p>
        )}

        {isChargeBlocked && chargeBlockMessage ? (
          <p className="scanner-sync-hint mb-2">{chargeBlockMessage}</p>
        ) : null}

        <button
          type="button"
          className="btn scanner-charge-btn w-100"
          disabled={isChargeBlocked}
          onClick={() => {
            if (isChargeBlocked) {
              return;
            }
            setConfirmOpenedAt(Date.now());
            setIsConfirmOpen(true);
          }}
        >
          Cobrar
        </button>
      </div>

      {isConfirmOpen ? (
        <div className="scanner-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar cobro">
          <div className="scanner-modal-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 mb-0">Confirmar cobro</h2>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                X
              </button>
            </div>

            <p className="mb-1 text-muted">Total a cobrar</p>
            <p className="h3 mb-4">${Number(total || 0).toFixed(2)}</p>

            <div className="mb-4">
              <p className="mb-2 text-muted">Medio de cobro</p>
              <div className="scanner-payment-method-grid">
                {paymentMethodOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`scanner-payment-method-btn ${option.className} ${paymentMethod === option.value ? 'scanner-payment-method-btn-active' : ''} ${option.disabled ? 'scanner-payment-method-btn-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="sale-payment-method"
                      className="scanner-payment-method-input"
                      value={option.value}
                      checked={paymentMethod === option.value}
                      disabled={isSubmitting || option.disabled}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setPaymentMethod(nextValue);
                        if (nextValue !== 'cuenta') {
                          setSelectedCustomerId('');
                        }
                      }}
                    />
                    <span className="scanner-payment-method-label">{option.label}</span>
                  </label>
                ))}
              </div>
              {!isCustomerAccountsAvailable ? (
                <p className="scanner-sync-hint mt-2 mb-0">
                  Cuenta corriente no disponible: el backend actual todavia no publico la ruta de clientes.
                </p>
              ) : null}
            </div>

            {isAccountPayment ? (
              <div className="mb-4">
                <label className="form-label fw-semibold" htmlFor="scanner-account-customer">
                  Cliente
                </label>
                <select
                  id="scanner-account-customer"
                  className="form-select scanner-customer-select"
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Seleccionar cliente</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}{customer.debtTotal > 0 ? ` - Debe $${Number(customer.debtTotal || 0).toFixed(2)}` : ''}
                    </option>
                  ))}
                </select>
                {isMissingCustomer ? (
                  <p className="scanner-inline-error mt-2">Selecciona un cliente para cargar la venta en cuenta.</p>
                ) : null}
                {!customerOptions.length ? (
                  <p className="scanner-sync-hint mt-2 mb-0">No hay clientes cargados todavia.</p>
                ) : null}
              </div>
            ) : null}

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-50"
                onClick={() => {
                  setIsConfirmOpen(false);
                  setPaymentMethod('efectivo');
                  setSelectedCustomerId('');
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-dark w-50"
                disabled={isSubmitting || isChargeBlocked || isMissingCustomer}
                onClick={handleConfirm}
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default ScannerCheckout;
