import { AlertTriangle, RefreshCcw, ShieldAlert, Siren } from 'lucide-react';
import {
  getDiagnosticSeverityBadgeClass,
  matchesDiagnosticFilter
} from '../model/panelControl.diagnostics';

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'errors', label: 'Errores' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'sale_sync', label: 'Sync venta' }
];

function DiagnosticEventsPanel({
  events,
  error,
  isLoading,
  activeFilter,
  onFilterChange,
  onRefresh
}) {
  const visibleEvents = events.filter((event) => matchesDiagnosticFilter(event, activeFilter));
  const errorCount = events.filter((event) => event.severity === 'error').length;
  const warningCount = events.filter((event) => event.severity === 'warning').length;
  const saleSyncCount = events.filter((event) => event.eventTypeLabel === 'scanner.sale_sync_error').length;
  const latestEvent = events[0] || null;

  return (
    <section className="panel-section panel-diagnostics-page">
      <div className="panel-diagnostics-hero">
        <div>
          <p className="panel-hero-kicker mb-1">Soporte remoto</p>
          <h2 className="panel-hero-title mb-1">Diagnostico</h2>
          <p className="panel-hero-subtitle mb-0">
            Vista reservada para soporte. Aca quedan los incidentes recientes enviados desde scanner.
          </p>
        </div>
        <div className="panel-diagnostics-hero-actions">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
            onClick={() => {
              onRefresh().catch(() => {});
            }}
            disabled={isLoading}
          >
            <RefreshCcw size={14} />
            <span>{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      <div className="panel-diagnostics-summary-grid">
        <article className="panel-diagnostics-summary-card">
          <span className="panel-diagnostics-summary-label">Eventos</span>
          <strong className="panel-diagnostics-summary-value">{events.length}</strong>
          <small className="panel-diagnostics-summary-help">Ultimo: {latestEvent?.ageLabel || '-'}</small>
        </article>
        <article className="panel-diagnostics-summary-card">
          <span className="panel-diagnostics-summary-label">Errores</span>
          <strong className="panel-diagnostics-summary-value">{errorCount}</strong>
          <small className="panel-diagnostics-summary-help">Severidad alta</small>
        </article>
        <article className="panel-diagnostics-summary-card">
          <span className="panel-diagnostics-summary-label">Warnings</span>
          <strong className="panel-diagnostics-summary-value">{warningCount}</strong>
          <small className="panel-diagnostics-summary-help">Avisos relevantes</small>
        </article>
        <article className="panel-diagnostics-summary-card">
          <span className="panel-diagnostics-summary-label">Sync venta</span>
          <strong className="panel-diagnostics-summary-value">{saleSyncCount}</strong>
          <small className="panel-diagnostics-summary-help">Eventos `scanner.sale_sync_error`</small>
        </article>
      </div>

      <div className="panel-diagnostics-toolbar">
        <div className="panel-diagnostics-filters" role="tablist" aria-label="Filtros de diagnostico">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`panel-diagnostics-filter-btn ${activeFilter === filter.id ? 'panel-diagnostics-filter-btn-active' : ''}`}
              onClick={() => onFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {error ? <small className="text-danger">{error}</small> : null}
      </div>

      {!visibleEvents.length ? (
        <div className="panel-empty-state">
          <strong>Sin eventos para este filtro.</strong>
          <p className="mb-0">Cuando el scanner reporte una inconsistencia, va a quedar visible aca.</p>
        </div>
      ) : (
        <div className="d-grid gap-3">
          {visibleEvents.map((event, index) => (
            <article key={event.id} className={`panel-diagnostics-event-card ${index === 0 ? 'panel-diagnostics-event-card-latest' : ''}`}>
              <div className="panel-diagnostics-event-main">
                <div className="panel-diagnostics-event-copy">
                  <div className="panel-diagnostics-event-title-row">
                    <strong>{event.message}</strong>
                    {event.isRecent ? (
                      <span className="panel-diagnostics-fresh-badge">Nuevo</span>
                    ) : null}
                  </div>
                  <small className="text-muted">
                    {event.sourceLabel} | {event.username} | {event.terminalId}
                  </small>
                  {event.contextLine ? (
                    <small className="text-muted">{event.contextLine}</small>
                  ) : null}
                  {event.errorFamily || event.endpoint || event.method ? (
                    <small className="text-muted">
                      {[event.errorFamily, event.method, event.endpoint].filter(Boolean).join(' | ')}
                    </small>
                  ) : null}
                </div>

                <div className="panel-diagnostics-event-meta">
                  <span className={`badge ${getDiagnosticSeverityBadgeClass(event.severity)}`}>
                    {event.severity}
                  </span>
                  <div className="small text-muted mt-2">{event.createdAtLabel}</div>
                  <div className="small text-muted">{event.ageLabel}</div>
                  <div className="small text-muted">{event.eventTypeLabel}</div>
                </div>
              </div>

              <div className="panel-diagnostics-highlight-grid">
                {event.httpLabel ? (
                  <div className="panel-diagnostics-highlight-card panel-diagnostics-highlight-card-danger">
                    <span className="panel-diagnostics-highlight-icon"><ShieldAlert size={16} /></span>
                    <div>
                      <small className="panel-diagnostics-highlight-label">HTTP</small>
                      <strong>{event.httpLabel}</strong>
                    </div>
                  </div>
                ) : null}

                {event.pending > 0 ? (
                  <div className="panel-diagnostics-highlight-card panel-diagnostics-highlight-card-warning">
                    <span className="panel-diagnostics-highlight-icon"><Siren size={16} /></span>
                    <div>
                      <small className="panel-diagnostics-highlight-label">Pendientes</small>
                      <strong>{event.pending}</strong>
                    </div>
                  </div>
                ) : null}

                <div className="panel-diagnostics-highlight-card">
                  <span className="panel-diagnostics-highlight-icon"><AlertTriangle size={16} /></span>
                  <div>
                    <small className="panel-diagnostics-highlight-label">Tipo</small>
                    <strong>{event.eventTypeLabel}</strong>
                  </div>
                </div>

                {event.flow || event.trigger ? (
                  <div className="panel-diagnostics-highlight-card">
                    <span className="panel-diagnostics-highlight-icon"><RefreshCcw size={16} /></span>
                    <div>
                      <small className="panel-diagnostics-highlight-label">Flujo</small>
                      <strong>{[event.flow, event.trigger].filter(Boolean).join(' | ')}</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default DiagnosticEventsPanel;
