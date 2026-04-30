function PaymentsFormCard({
  paymentAmount,
  paymentDescription,
  paymentError,
  isRegisteringPayment,
  onChangeAmount,
  onChangeDescription,
  onSubmit
}) {
  return (
    <article className="panel-block-v2 panel-block-accent-orange">
      <div className="panel-block-header panel-block-title-cell">
        <h3 className="h6 mb-2">Registrar pago</h3>
        <p className="panel-help mb-0">Carga un egreso manual para que impacte en movimientos y caja del admin.</p>
      </div>
      <div className="panel-block-content panel-block-data-cell">
        <form className="d-grid gap-2" onSubmit={onSubmit}>
          <input
            className="form-control"
            placeholder="Monto"
            value={paymentAmount}
            disabled={isRegisteringPayment}
            onChange={(event) => onChangeAmount(event.target.value)}
            autoFocus
          />
          <input
            className="form-control"
            placeholder="Descripcion"
            value={paymentDescription}
            disabled={isRegisteringPayment}
            onChange={(event) => onChangeDescription(event.target.value)}
          />
          {paymentError ? <p className="app-inline-error mb-0">{paymentError}</p> : null}
          <button type="submit" className="btn btn-dark" disabled={isRegisteringPayment}>
            {isRegisteringPayment ? 'Registrando...' : 'Registrar pago'}
          </button>
        </form>
      </div>
    </article>
  );
}

export default PaymentsFormCard;
