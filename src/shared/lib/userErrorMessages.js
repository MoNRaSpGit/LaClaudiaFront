function normalizeErrorText(error) {
  return String(error?.message || error || '').trim();
}

export function toUserErrorMessage(error, { context = 'general' } = {}) {
  const raw = normalizeErrorText(error);
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'Ocurrio un error inesperado. Reintenta y, si persiste, reinicia la app.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    if (context === 'login') {
      return 'No se pudo conectar al backend (puede estar apagado o caido). Verifica internet y vuelve a intentar en unos segundos.';
    }
    return 'No hay conexion con el backend (caido, apagado o red inestable). Reintenta y revisa la conexion.';
  }

  if (lower.includes('tardo demasiado') || lower.includes('timeout') || lower.includes('timed out')) {
    return 'Conexion lenta con el servidor. Reintenta en unos segundos.';
  }

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('sesion expirada')) {
    return 'Sesion vencida. Inicia sesion nuevamente.';
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'No tienes permisos para esta accion.';
  }

  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('504')) {
    return 'El servidor esta con problemas temporales. Reintenta en unos minutos.';
  }

  return raw;
}

