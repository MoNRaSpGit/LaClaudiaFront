export const STORE_TIME_ZONE = 'America/Montevideo';

export const todayLabel = new Intl.DateTimeFormat('es-UY', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: STORE_TIME_ZONE
}).format(new Date());

export function money(value) {
  return `$${Number(value || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function percent(value) {
  const normalized = Number(value || 0);
  const sign = normalized > 0 ? '+' : '';
  return `${sign}${normalized.toFixed(2)}%`;
}

export function formatDateTime(value) {
  if (!value) {
    return { date: '--/--/----', time: '--:--:--' };
  }

  const dateObj = parseDateInput(value);
  return {
    date: new Intl.DateTimeFormat('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: STORE_TIME_ZONE
    }).format(dateObj),
    time: new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: STORE_TIME_ZONE
    }).format(dateObj)
  };
}

export function parseDateInput(value) {
  if (value instanceof Date) {
    return value;
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return new Date(NaN);
  }

  // Handle MySQL-style datetime without timezone as UTC.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(' ', 'T') + 'Z');
  }

  // Handle ISO-like datetime without timezone as UTC (with optional milliseconds).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(raw)) {
    return new Date(raw + 'Z');
  }

  return new Date(raw);
}

export function renderLiveEditorPrice(draft = {}) {
  const raw = draft.precio_venta_raw;
  if (raw === '') {
    return '$-';
  }
  const numeric = Number(draft.precio_venta || 0);
  return money(Number.isFinite(numeric) ? numeric : 0);
}
