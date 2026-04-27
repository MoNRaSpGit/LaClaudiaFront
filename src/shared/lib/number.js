export function parsePositiveAmount(rawValue) {
  const normalized = String(rawValue || '').replace(',', '.').trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

