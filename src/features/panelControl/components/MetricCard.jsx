function MetricCard({ title, value, hint }) {
  return (
    <article className="panel-metric-card-v2">
      <p className="panel-metric-title">{title}</p>
      <p className="panel-metric-value">{value}</p>
      <p className="panel-metric-hint">{hint}</p>
    </article>
  );
}

export default MetricCard;

