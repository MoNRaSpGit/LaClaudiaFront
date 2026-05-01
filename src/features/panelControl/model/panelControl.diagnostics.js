import { STORE_TIME_ZONE } from './panelControl.formatters';

const relativeTimeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function formatRelativeMinutes(totalMinutes) {
  if (totalMinutes < 1) {
    return 'Hace instantes';
  }
  if (totalMinutes < 60) {
    return relativeTimeFormatter.format(-totalMinutes, 'minute');
  }

  const totalHours = Math.round(totalMinutes / 60);
  if (totalHours < 24) {
    return relativeTimeFormatter.format(-totalHours, 'hour');
  }

  const totalDays = Math.round(totalHours / 24);
  return relativeTimeFormatter.format(-totalDays, 'day');
}

export function canViewPanelDiagnostics(currentUser) {
  const role = String(currentUser?.role || '').trim().toLowerCase();
  const username = String(currentUser?.username || '').trim().toLowerCase();
  return role === 'admin' && username === 'staff';
}

export function normalizeDiagnosticEvent(event, index = 0) {
  const status = Number(event?.context?.status || 0);
  const statusText = String(event?.context?.statusText || '').trim();
  const pending = Number(event?.context?.pending || 0);
  const productName = String(event?.context?.productName || '').trim();
  const trigger = String(event?.context?.trigger || '').trim();
  const endpoint = String(event?.context?.endpoint || '').trim();
  const method = String(event?.context?.method || '').trim().toUpperCase();
  const flow = String(event?.context?.flow || '').trim();
  const errorFamily = String(event?.context?.errorFamily || '').trim();
  const sourceLabel = String(event?.sourceLabel || '').trim() || 'scanner';
  const username = String(event?.user?.username || '').trim() || 'sin usuario';
  const terminalId = String(event?.terminalId || '').trim() || 'sin terminal';
  const severity = String(event?.severity || 'info').trim().toLowerCase();
  const createdAtRaw = String(event?.createdAt || '').trim();
  const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;
  const createdAtLabel = Number.isFinite(createdAtMs)
    ? new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: STORE_TIME_ZONE
    }).format(new Date(createdAtMs))
    : '-';

  const ageMinutes = Number.isFinite(createdAtMs)
    ? Math.max(0, Math.round((Date.now() - createdAtMs) / 60000))
    : null;

  const contextParts = [];
  if (pending > 0) {
    contextParts.push(`Pendientes ${pending}`);
  }
  if (productName) {
    contextParts.push(productName);
  }
  if (trigger) {
    contextParts.push(trigger);
  }
  if (flow) {
    contextParts.push(flow);
  }

  return {
    ...event,
    id: event?.id || `${event?.eventType || 'diagnostic'}-${createdAtRaw || index}`,
    severity,
    status,
    statusText,
    pending,
    productName,
    trigger,
    endpoint,
    method,
    flow,
    errorFamily,
    sourceLabel,
    username,
    terminalId,
    createdAtMs,
    createdAtLabel,
    ageLabel: ageMinutes == null ? '-' : formatRelativeMinutes(ageMinutes),
    contextLine: contextParts.join(' | '),
    httpLabel: status > 0 ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}` : '',
    isRecent: ageMinutes != null && ageMinutes <= 10,
    eventTypeLabel: String(event?.eventType || '').trim() || 'diagnostic_event'
  };
}

export function matchesDiagnosticFilter(event, filter) {
  const normalizedFilter = String(filter || 'all').trim().toLowerCase();
  if (normalizedFilter === 'all') {
    return true;
  }
  if (normalizedFilter === 'errors') {
    return event.severity === 'error';
  }
  if (normalizedFilter === 'warnings') {
    return event.severity === 'warning';
  }
  if (normalizedFilter === 'sale_sync') {
    return event.eventTypeLabel === 'scanner.sale_sync_error';
  }
  return true;
}

export function getDiagnosticSeverityBadgeClass(severity) {
  if (severity === 'error') {
    return 'text-bg-danger';
  }
  if (severity === 'warning') {
    return 'text-bg-warning';
  }
  return 'text-bg-secondary';
}
