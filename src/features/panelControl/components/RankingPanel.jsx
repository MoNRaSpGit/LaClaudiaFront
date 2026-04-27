function RankingPanel({
  hasRankingItems,
  visibleRankingItems,
  rankingDateLabel,
  canExpandRanking,
  rankingExpandLabel,
  onExpandRanking
}) {
  return (
    <article className="panel-block-v2 panel-side-block panel-block-accent-violet">
      <div className="panel-block-header panel-block-title-cell">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h3 className="h6 mb-0">Ranking</h3>
          {canExpandRanking ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onExpandRanking}
            >
              {rankingExpandLabel}
            </button>
          ) : null}
        </div>
        <p className="panel-help mb-0">Ranking del día {rankingDateLabel} por cantidad vendida.</p>
      </div>
      <div className="panel-block-content panel-block-data-cell">
        {hasRankingItems ? (
          <ol className="panel-ranking-cells mb-0">
            {visibleRankingItems.map((item, index) => (
              <li key={`${item.key}-${index}`}>
                <div className="panel-ranking-left">
                  <span className="panel-ranking-position">#{index + 1}</span>
                  <span>{item.name}</span>
                </div>
                <strong className="panel-ranking-qty">{item.qty} u.</strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="panel-empty-state">
            <p className="panel-empty-title mb-1">Sin ranking disponible</p>
            <p className="panel-empty-text mb-0">El ranking aparece cuando se registran ventas con productos.</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default RankingPanel;
