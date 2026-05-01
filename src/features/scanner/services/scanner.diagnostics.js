import { createScannerDiagnosticEvent } from './scanner.api';

const TERMINAL_ID_KEY = 'scanner_terminal_id_v1';
const DIAGNOSTIC_QUEUE_KEY = 'scanner_diagnostic_queue_v1';
const DIAGNOSTIC_COOLDOWN_MS = 60000;
const recentDiagnosticEvents = new Map();
let queueLoaded = false;
let diagnosticQueue = [];

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function loadQueueOnce() {
  if (queueLoaded) {
    return;
  }

  queueLoaded = true;
  if (!isBrowser()) {
    return;
  }

  try {
    const raw = window.localStorage.getItem(DIAGNOSTIC_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    diagnosticQueue = Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    diagnosticQueue = [];
  }
}

function persistQueue() {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(DIAGNOSTIC_QUEUE_KEY, JSON.stringify(diagnosticQueue));
  } catch (_error) {
    // Keep reporting flow non-blocking even if localStorage fails.
  }
}

function createTerminalId() {
  const randomChunk = Math.random().toString(36).slice(2, 8);
  return `terminal-${Date.now().toString(36)}-${randomChunk}`;
}

export function getScannerTerminalId() {
  if (!isBrowser()) {
    return 'terminal-server';
  }

  const existing = String(window.localStorage.getItem(TERMINAL_ID_KEY) || '').trim();
  if (existing) {
    return existing;
  }

  const created = createTerminalId();
  window.localStorage.setItem(TERMINAL_ID_KEY, created);
  return created;
}

function getSourceLabel(currentUser) {
  const role = String(currentUser?.role || '').trim().toLowerCase() || 'user';
  const username = String(currentUser?.username || currentUser?.name || '').trim() || 'anon';
  const host = typeof window !== 'undefined' ? String(window.location.host || '').trim() : 'host-local';
  return `${role}:${username}@${host}`;
}

function shouldSkipByCooldown(payload) {
  const eventType = String(payload?.eventType || '').trim() || 'scanner.unknown';
  const message = String(payload?.message || '').trim() || 'sin-mensaje';
  const key = `${eventType}::${message}`;
  const now = Date.now();
  const lastAt = Number(recentDiagnosticEvents.get(key) || 0);
  if (now - lastAt < DIAGNOSTIC_COOLDOWN_MS) {
    return true;
  }
  recentDiagnosticEvents.set(key, now);
  return false;
}

function enqueueDiagnostic(payload) {
  loadQueueOnce();
  diagnosticQueue.push({
    payload,
    queuedAt: new Date().toISOString()
  });
  persistQueue();
}

export async function flushScannerDiagnosticQueue({ token } = {}) {
  loadQueueOnce();
  if (!token || !diagnosticQueue.length) {
    return { pending: diagnosticQueue.length };
  }

  while (diagnosticQueue.length) {
    const current = diagnosticQueue[0];
    try {
      await createScannerDiagnosticEvent(current.payload, { token });
      diagnosticQueue.shift();
      persistQueue();
    } catch (error) {
      return {
        pending: diagnosticQueue.length,
        error
      };
    }
  }

  return { pending: 0 };
}

export async function reportScannerDiagnosticEvent(payload, { token, currentUser, skipCooldown = false } = {}) {
  const normalizedPayload = {
    eventType: String(payload?.eventType || '').trim() || 'scanner.unknown',
    severity: String(payload?.severity || '').trim().toLowerCase() || 'error',
    message: String(payload?.message || '').trim() || 'Evento diagnostico sin mensaje',
    sourceApp: 'frontend',
    sourceLabel: String(payload?.sourceLabel || '').trim() || getSourceLabel(currentUser),
    terminalId: String(payload?.terminalId || '').trim() || getScannerTerminalId(),
    context: payload?.context && typeof payload.context === 'object' ? payload.context : null
  };

  if (!skipCooldown && shouldSkipByCooldown(normalizedPayload)) {
    return { ok: true, skipped: true };
  }

  try {
    const result = await createScannerDiagnosticEvent(normalizedPayload, {
      token: token || ''
    });
    flushScannerDiagnosticQueue({ token }).catch(() => {});
    return result;
  } catch (error) {
    enqueueDiagnostic(normalizedPayload);
    return {
      ok: false,
      queued: true,
      error
    };
  }
}
