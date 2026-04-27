function PanelModal({ title, body, onClose }) {
  return (
    <div className="panel-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-modal-card">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 mb-0">{title}</h3>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>X</button>
        </div>
        <div className="panel-modal-body mb-3">{body}</div>
        <button type="button" className="btn btn-dark w-100" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

export default PanelModal;

