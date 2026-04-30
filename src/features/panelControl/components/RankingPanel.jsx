function RankingPanel({
  hasRankingItems,
  visibleRankingItems,
  rankingDateLabel,
  canExpandRanking,
  rankingExpandLabel,
  onExpandRanking
}) {
  function resolveRankingImage(item = {}) {
    const candidates = [
      item.thumbnail_url,
      item.thumbnailUrl,
      item.image_url,
      item.imageUrl,
      item.imagen,
      item.image,
      item.foto,
      item.foto_url
    ];

    const raw = candidates.find((value) => String(value || '').trim() !== '');
    if (!raw) {
      return '';
    }

    const value = String(raw).trim();
    if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value;
    }

    // If backend sends plain base64, normalize it into a data URL.
    return `data:image/jpeg;base64,${value}`;
  }

  function renderThumbnail(item) {
    const imageUrl = resolveRankingImage(item);
    if (imageUrl) {
      return <img src={imageUrl} alt={item?.name || 'Producto'} className="panel-ranking-thumb" loading="lazy" />;
    }

    return <span className="panel-ranking-thumb panel-ranking-thumb-placeholder">IMG</span>;
  }

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
        <p className="panel-help mb-0">Ranking del dia {rankingDateLabel} por cantidad vendida.</p>
      </div>
      <div className="panel-block-content panel-block-data-cell">
        {hasRankingItems ? (
          <ol className="panel-ranking-cells mb-0">
            {visibleRankingItems.map((item, index) => (
              <li key={`${item.key}-${index}`}>
                <div className="panel-ranking-left">
                  <span className="panel-ranking-position">#{index + 1}</span>
                  {renderThumbnail(item)}
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

