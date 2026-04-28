function PaymentFormPanel({
  paymentAmount,
  paymentDescription,
  paymentError,
  onChangeAmount,
  onChangeDescription,
  onSubmit
}) {
  return (
    <article className="panel-block-v2 panel-side-block panel-block-accent-orange">
      <div className="panel-block-header panel-block-title-cell">
        <h3 className="h6 mb-2">Registrar pago</h3>
        <p className="panel-help mb-0">Movimientos manuales, en formato liviano.</p>
      </div>
      <div className="panel-block-content panel-block-data-cell">
        <form className="d-grid gap-2" onSubmit={onSubmit}>
          <input
            className="form-control"
            placeholder="Monto"
            value={paymentAmount}
            onChange={(event) => onChangeAmount(event.target.value)}
          />
          <input
            className="form-control"
            placeholder="Descripcion"
            value={paymentDescription}
            onChange={(event) => onChangeDescription(event.target.value)}
          />
          {paymentError ? <p className="app-inline-error mb-0">{paymentError}</p> : null}
          <button type="submit" className="btn btn-dark">Registrar pago</button>
        </form>
      </div>
    </article>
  );
}

export default PaymentFormPanel;
