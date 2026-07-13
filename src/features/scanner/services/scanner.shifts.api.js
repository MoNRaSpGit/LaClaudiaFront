import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function fetchScannerShiftState({ token, date } = {}) {
  const search = new URLSearchParams();
  if (date) {
    search.set('date', String(date));
  }

  const query = search.toString();
  const response = await fetch(`${apiUrl}/api/scanner/shifts/current${query ? `?${query}` : ''}`, {
    headers: buildHeaders({ token })
  });
  return readJson(response);
}

export async function openScannerShift(shiftType, { token, date } = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/shifts/open`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify({
      shiftType,
      date
    })
  });
  return readJson(response);
}

export async function closeScannerShift(shiftId, { token } = {}) {
  const normalizedId = Number(shiftId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('shiftId invalido');
  }

  const response = await fetch(`${apiUrl}/api/scanner/shifts/${normalizedId}/close`, {
    method: 'POST',
    headers: buildHeaders({ token })
  });
  return readJson(response);
}

export async function resetScannerShifts({ token, date } = {}) {
  const response = await fetch(`${apiUrl}/api/scanner/shifts/reset`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify({
      date
    })
  });
  return readJson(response);
}
