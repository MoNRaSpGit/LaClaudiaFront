import { useMemo, useState } from 'react';
import { moneyNoDecimals } from '../panelControl/model/panelControl.formatters';
import '../../styles/recount.css';

const DENOMINATIONS = [
  { key: 'coin_1', label: '$1', value: 1, kind: 'moneda' },
  { key: 'coin_2', label: '$2', value: 2, kind: 'moneda' },
  { key: 'coin_5', label: '$5', value: 5, kind: 'moneda' },
  { key: 'coin_10', label: '$10', value: 10, kind: 'moneda' },
  { key: 'bill_20', label: '$20', value: 20, kind: 'billete' },
  { key: 'bill_50', label: '$50', value: 50, kind: 'billete' },
  { key: 'bill_100', label: '$100', value: 100, kind: 'billete' },
  { key: 'bill_200', label: '$200', value: 200, kind: 'billete' },
  { key: 'bill_500', label: '$500', value: 500, kind: 'billete' },
  { key: 'bill_1000', label: '$1.000', value: 1000, kind: 'billete' },
  { key: 'bill_2000', label: '$2.000', value: 2000, kind: 'billete' }
];

function createEmptyCounts() {
  return DENOMINATIONS.reduce((acc, denom) => {
    acc[denom.key] = '';
    return acc;
  }, {});
}

function parseCount(rawValue) {
  const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function RecountFeature() {
  const [counts, setCounts] = useState(createEmptyCounts);

  const rows = useMemo(() => {
    return DENOMINATIONS.map((denom) => {
      const quantity = parseCount(counts[denom.key]);
      return { ...denom, quantity, subtotal: quantity * denom.value };
    });
  }, [counts]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.subtotal, 0), [rows]);
  const totalPieces = useMemo(() => rows.reduce((sum, row) => sum + row.quantity, 0), [rows]);

  function handleChange(key, rawValue) {
    if (rawValue !== '' && !/^\d*$/.test(rawValue)) {
      return;
    }
    setCounts((current) => ({ ...current, [key]: rawValue }));
  }

  function handleReset() {
    setCounts(createEmptyCounts());
  }

  const coinRows = rows.filter((row) => row.kind === 'moneda');
  const billRows = rows.filter((row) => row.kind === 'billete');

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-xl-7">
          <section className="panel-hero mb-4">
            <div>
              <p className="panel-hero-kicker mb-1">Arqueo</p>
              <h1 className="panel-hero-title mb-1">Recuento</h1>
              <p className="panel-hero-subtitle mb-0">
                Carga cuantas monedas y billetes de cada denominacion tenes y calculamos el total automaticamente.
              </p>
            </div>
            <div className="panel-status-stack">
              <div className="panel-status-open">{moneyNoDecimals(total)}</div>
            </div>
          </section>

          <article className="panel-block-v2 panel-block-accent-green mb-4">
            <div className="panel-block-header panel-block-title-cell">
              <h3 className="h6 mb-2">Monedas</h3>
              <p className="panel-help mb-0">Cantidad de monedas por denominacion.</p>
            </div>
            <div className="panel-block-content panel-block-data-cell">
              <div className="recount-grid">
                {coinRows.map((row) => (
                  <label key={row.key} className="recount-item">
                    <span className="recount-item-label">{row.label}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control recount-item-input"
                      placeholder="0"
                      value={counts[row.key]}
                      onChange={(event) => handleChange(row.key, event.target.value)}
                    />
                    <span className="recount-item-subtotal">{moneyNoDecimals(row.subtotal)}</span>
                  </label>
                ))}
              </div>
            </div>
          </article>

          <article className="panel-block-v2 panel-block-accent-blue mb-4">
            <div className="panel-block-header panel-block-title-cell">
              <h3 className="h6 mb-2">Billetes</h3>
              <p className="panel-help mb-0">Cantidad de billetes por denominacion.</p>
            </div>
            <div className="panel-block-content panel-block-data-cell">
              <div className="recount-grid">
                {billRows.map((row) => (
                  <label key={row.key} className="recount-item">
                    <span className="recount-item-label">{row.label}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-control recount-item-input"
                      placeholder="0"
                      value={counts[row.key]}
                      onChange={(event) => handleChange(row.key, event.target.value)}
                    />
                    <span className="recount-item-subtotal">{moneyNoDecimals(row.subtotal)}</span>
                  </label>
                ))}
              </div>
            </div>
          </article>

          <section className="panel-section mb-4">
            <div className="panel-cash-summary-grid">
              <article className="panel-metric-card-v2 panel-cash-summary-card">
                <p className="panel-metric-title">Total contado</p>
                <p className="panel-metric-value">{moneyNoDecimals(total)}</p>
                <p className="panel-metric-hint">{totalPieces} {totalPieces === 1 ? 'pieza cargada' : 'piezas cargadas'} en total.</p>
              </article>
            </div>
          </section>

          <button type="button" className="btn btn-outline-secondary w-100" onClick={handleReset}>
            Reiniciar recuento
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecountFeature;
