/* global __APP_BUILD_VERSION__ */

const FALLBACK_APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev-local';
const CURRENT_APP_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined'
  ? String(__APP_BUILD_VERSION__ || '').trim() || FALLBACK_APP_VERSION
  : FALLBACK_APP_VERSION;

const AVAILABLE_VERSION_KEY = 'laclau_available_version_v1';
const AVAILABLE_FORCE_LOGOUT_KEY = 'laclau_available_force_logout_v1';
const DISMISSED_VERSION_KEY = 'laclau_dismissed_version_v1';
const DEBUG_AVAILABLE_VERSION_KEY = 'laclau_debug_available_version_v1';
const DEBUG_APPLIED_VERSION_KEY = 'laclau_debug_applied_version_v1';
const DEBUG_FORCE_LOGOUT_KEY = 'laclau_debug_force_logout_v1';
const SKIP_UNLOAD_LOGOUT_ONCE_KEY = 'laclau_skip_unload_logout_once_v1';
const UPDATE_EVENT_NAME = 'laclau-app-update-changed';
const UPDATE_URL = new URL(`${import.meta.env.BASE_URL}app-version.json`, window.location.origin).toString();

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitUpdateChange() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
}

function readStorage(key) {
  if (!isBrowser()) {
    return '';
  }
  return String(window.localStorage.getItem(key) || '').trim();
}

function writeStorage(key, value) {
  if (!isBrowser()) {
    return;
  }
  if (!value) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

function clearAvailableUpdate() {
  writeStorage(AVAILABLE_VERSION_KEY, '');
  writeStorage(AVAILABLE_FORCE_LOGOUT_KEY, '');
}

function markPlannedReload() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(SKIP_UNLOAD_LOGOUT_ONCE_KEY, 'true');
}

function getEffectiveCurrentVersion() {
  const debugAppliedVersion = canUseUpdateLab() ? readStorage(DEBUG_APPLIED_VERSION_KEY) : '';
  return debugAppliedVersion || CURRENT_APP_VERSION;
}

function parseRemoteVersion(payload) {
  if (!payload || typeof payload !== 'object') {
    return { version: '', forceLogout: false };
  }

  return {
    version: String(payload.version || '').trim(),
    forceLogout: payload.forceLogout === true
  };
}

function persistAvailableUpdate(nextVersion, { forceLogout = false } = {}) {
  const normalized = String(nextVersion || '').trim();
  const currentVersion = getEffectiveCurrentVersion();

  if (!normalized || normalized === currentVersion) {
    clearAvailableUpdate();
    if (readStorage(DISMISSED_VERSION_KEY) === normalized) {
      writeStorage(DISMISSED_VERSION_KEY, '');
    }
    emitUpdateChange();
    return false;
  }

  writeStorage(AVAILABLE_VERSION_KEY, normalized);
  writeStorage(AVAILABLE_FORCE_LOGOUT_KEY, forceLogout ? 'true' : '');
  emitUpdateChange();
  return true;
}

export function canUseUpdateLab() {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_UPDATE_LAB === 'true';
}

export function getCurrentAppVersion() {
  return getEffectiveCurrentVersion();
}

export function getAvailableUpdateVersion() {
  return readStorage(AVAILABLE_VERSION_KEY);
}

export function getDismissedUpdateVersion() {
  return readStorage(DISMISSED_VERSION_KEY);
}

export function getSimulatedAvailableVersion() {
  return readStorage(DEBUG_AVAILABLE_VERSION_KEY);
}

export function getAvailableForceLogout() {
  return readStorage(AVAILABLE_FORCE_LOGOUT_KEY) === 'true';
}

export function getSimulatedForceLogout() {
  return readStorage(DEBUG_FORCE_LOGOUT_KEY) === 'true';
}

export function getAppUpdateSnapshot() {
  const currentVersion = getCurrentAppVersion();
  const availableVersion = getAvailableUpdateVersion();
  const dismissedVersion = getDismissedUpdateVersion();
  const simulatedVersion = getSimulatedAvailableVersion();
  const requiresSessionReset = getAvailableForceLogout();
  const hasPendingUpdate = Boolean(availableVersion) && availableVersion !== currentVersion;

  return {
    currentVersion,
    availableVersion,
    dismissedVersion,
    hasPendingUpdate,
    isSimulated: Boolean(simulatedVersion) && simulatedVersion === availableVersion,
    requiresSessionReset
  };
}

export function dismissAvailableUpdate(version) {
  writeStorage(DISMISSED_VERSION_KEY, String(version || '').trim());
  emitUpdateChange();
}

export function clearDismissedUpdate() {
  writeStorage(DISMISSED_VERSION_KEY, '');
  emitUpdateChange();
}

export async function checkForAppUpdate({ signal } = {}) {
  const simulatedVersion = getSimulatedAvailableVersion();
  if (simulatedVersion) {
    persistAvailableUpdate(simulatedVersion, { forceLogout: getSimulatedForceLogout() });
    return getAppUpdateSnapshot();
  }

  try {
    const response = await fetch(UPDATE_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      },
      signal
    });

    if (!response.ok) {
      return getAppUpdateSnapshot();
    }

    const payload = await response.json();
    const remoteManifest = parseRemoteVersion(payload);
    persistAvailableUpdate(remoteManifest.version, { forceLogout: remoteManifest.forceLogout });
    return getAppUpdateSnapshot();
  } catch {
    return getAppUpdateSnapshot();
  }
}

export function reloadToApplyUpdate() {
  const availableVersion = getAvailableUpdateVersion();
  const simulatedVersion = getSimulatedAvailableVersion();

  if (canUseUpdateLab() && availableVersion && simulatedVersion && availableVersion === simulatedVersion) {
    writeStorage(DEBUG_APPLIED_VERSION_KEY, availableVersion);
    writeStorage(DEBUG_AVAILABLE_VERSION_KEY, '');
    writeStorage(DEBUG_FORCE_LOGOUT_KEY, '');
    clearAvailableUpdate();
  }

  clearDismissedUpdate();
  markPlannedReload();
  window.location.reload();
}

export function simulateAvailableUpdate({ forceLogout = false } = {}) {
  if (!canUseUpdateLab()) {
    return '';
  }

  const nextVersion = `${CURRENT_APP_VERSION}-remote-${Date.now()}`;
  writeStorage(DEBUG_AVAILABLE_VERSION_KEY, nextVersion);
  writeStorage(DEBUG_FORCE_LOGOUT_KEY, forceLogout ? 'true' : '');
  emitUpdateChange();
  return nextVersion;
}

export function clearSimulatedUpdate() {
  writeStorage(DEBUG_AVAILABLE_VERSION_KEY, '');
  writeStorage(DEBUG_APPLIED_VERSION_KEY, '');
  writeStorage(DEBUG_FORCE_LOGOUT_KEY, '');
  writeStorage(AVAILABLE_VERSION_KEY, '');
  writeStorage(AVAILABLE_FORCE_LOGOUT_KEY, '');
  writeStorage(DISMISSED_VERSION_KEY, '');
  emitUpdateChange();
}

export function subscribeToUpdateChanges(listener) {
  if (!isBrowser() || typeof listener !== 'function') {
    return () => {};
  }

  function handleStorage(event) {
    if (!event?.key) {
      listener();
      return;
    }
    if (
      event.key === AVAILABLE_VERSION_KEY
      || event.key === AVAILABLE_FORCE_LOGOUT_KEY
      || event.key === DISMISSED_VERSION_KEY
      || event.key === DEBUG_AVAILABLE_VERSION_KEY
      || event.key === DEBUG_APPLIED_VERSION_KEY
      || event.key === DEBUG_FORCE_LOGOUT_KEY
    ) {
      listener();
    }
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener(UPDATE_EVENT_NAME, listener);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(UPDATE_EVENT_NAME, listener);
  };
}
