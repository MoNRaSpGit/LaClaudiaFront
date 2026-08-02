import { useState } from 'react';

function CustomerPaymentConfirmModal({ customer, debtTotal, isSubmitting, onCancel, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('efectivo');

  if (!customer) {
    return null;
  }

  return (
    <div className="customers-delete-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="customers-payment-confirm-title">
      <div className="customers-delete-modal-card">
        <p className="customers-kicker mb-2">Confirmacion</p>
        <h3 id="customers-payment-confirm-title" className="h5 mb-2">Registrar pago</h3>
        <p className="text-muted mb-3">
          Vas a saldar la deuda de <strong>{customer.name}</strong> por <strong>${Number(debtTotal || 0).toFixed(2)}</strong>.
        </p>

        <div className="mb-4">
          <label className="form-label" htmlFor="customer-payment-method">Medio de pago</label>
          <select
            id="customer-payment-method"
            className="form-select"
            value={paymentMethod}
            disabled={isSubmitting}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>

        <div className="customers-delete-modal-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => onConfirm(paymentMethod)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerPaymentConfirmModal;
