function MetricCard({ title, value, hint, onDoubleClick }) {
  const isSalesToday = String(title || '').trim().toLowerCase() === 'ventas del dia';
  const isInteractive = typeof onDoubleClick === 'function';

  return (
    <article
      className={`panel-metric-card-v2 ${isSalesToday ? 'panel-metric-card-highlight-sales' : ''}`}
      onDoubleClick={onDoubleClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDoubleClick();
        }
      } : undefined}
    >
      <p className="panel-metric-title">{title}</p>
      <p className="panel-metric-value">{value}</p>
      <p className="panel-metric-hint">{hint}</p>
    </article>
  );
}

export default MetricCard;
