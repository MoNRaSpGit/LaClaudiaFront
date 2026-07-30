import { apiUrl, buildHeaders, fetchJson } from '../../../shared/services/httpClient';

export async function fetchScannerShiftState({ token, date } = {}) {
  const search = new URLSearchParams();
  if (date) {
    search.set('date', String(date));
  }

  const query = search.toString();
  return fetchJson(`${apiUrl}/api/scanner/shifts/current${query ? `?${query}` : ''}`, {
    headers: buildHeaders({ token })
  });
}

export async function openScannerShift(shiftType, { token, date, openingCash } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/shifts/open`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify({
      shiftType,
      date,
      openingCash
    })
  });
}

export async function closeScannerShift(shiftId, { token } = {}) {
  const normalizedId = Number(shiftId);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('shiftId invalido');
  }

  return fetchJson(`${apiUrl}/api/scanner/shifts/${normalizedId}/close`, {
    method: 'POST',
    headers: buildHeaders({ token })
  });
}

export async function resetScannerShifts({ token, date } = {}) {
  return fetchJson(`${apiUrl}/api/scanner/shifts/reset`, {
    method: 'POST',
    headers: buildHeaders({ token, json: true }),
    body: JSON.stringify({
      date
    })
  });
}
