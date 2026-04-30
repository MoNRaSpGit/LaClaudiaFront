function MetricCard({ title, value, hint }) {
  const isSalesToday = String(title || '').trim().toLowerCase() === 'ventas del dia';
  return (
    <article className={`panel-metric-card-v2 ${isSalesToday ? 'panel-metric-card-highlight-sales' : ''}`}>
      <p className="panel-metric-title">{title}</p>
      <p className="panel-metric-value">{value}</p>
      <p className="panel-metric-hint">{hint}</p>
    </article>
  );
}

export default MetricCard;


