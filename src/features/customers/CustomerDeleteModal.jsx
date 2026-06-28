function CustomerDeleteModal({ customer, deletingCustomerId, onCancel, onConfirm }) {
  if (!customer) {
    return null;
  }

  return (
    <div className="customers-delete-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="customers-delete-title">
      <div className="customers-delete-modal-card">
        <p className="customers-kicker mb-2">Confirmacion</p>
        <h3 id="customers-delete-title" className="h5 mb-2">Eliminar cliente</h3>
        <p className="text-muted mb-3">
          Vas a ocultar a <strong>{customer.name}</strong> de la lista de clientes.
        </p>
        <p className="text-muted mb-4">Su historial queda guardado, pero ya no aparecera como cliente activo.</p>
        <div className="customers-delete-modal-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={Boolean(deletingCustomerId)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={Boolean(deletingCustomerId)}
          >
            {deletingCustomerId === customer.id ? 'Eliminando...' : 'Confirmar eliminacion'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerDeleteModal;
