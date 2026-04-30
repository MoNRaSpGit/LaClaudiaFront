export const STORE_TIME_ZONE = 'America/Montevideo';

function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function getUtcDateForStoreDateTime(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, STORE_TIME_ZONE);
  const shifted = new Date(utcGuess.getTime() - offsetMs);
  const shiftedOffsetMs = getTimeZoneOffsetMs(shifted, STORE_TIME_ZONE);

  if (shiftedOffsetMs === offsetMs) {
    return shifted;
  }

  return new Date(utcGuess.getTime() - shiftedOffsetMs);
}

function toDateLabelFromParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getStoreDateLabel(date = new Date()) {
  const parts = getDatePartsInTimeZone(date, STORE_TIME_ZONE);
  return toDateLabelFromParts(parts.year, parts.month, parts.day);
}

export function getTodayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-UY', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: STORE_TIME_ZONE
  }).format(date);
}

export function getMsUntilNextStoreMidnight(now = new Date()) {
  const currentStoreParts = getDatePartsInTimeZone(now, STORE_TIME_ZONE);
  const tomorrowUtc = new Date(Date.UTC(currentStoreParts.year, currentStoreParts.month - 1, currentStoreParts.day + 1, 0, 0, 0));
  const nextStoreMidnight = getUtcDateForStoreDateTime(
    tomorrowUtc.getUTCFullYear(),
    tomorrowUtc.getUTCMonth() + 1,
    tomorrowUtc.getUTCDate(),
    0,
    0,
    0
  );

  return Math.max(1000, nextStoreMidnight.getTime() - now.getTime() + 1000);
}

export function money(value) {
  return `$${Number(value || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function moneyNoDecimals(value) {
  return `$${Number(value || 0).toLocaleString('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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
