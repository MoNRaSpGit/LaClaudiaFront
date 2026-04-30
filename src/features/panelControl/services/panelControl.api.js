import { apiUrl, buildHeaders, readJson } from '../../../shared/services/httpClient';

export async function registerPanelPayment(payload, options) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const response = await fetch(`${apiUrl}/api/scanner/payments`, {
    method: 'POST',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });
  const data = await readJson(response);
  const elapsedMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
  return {
    ...data,
    _meta: {
      elapsedMs: Number(elapsedMs.toFixed(1))
    }
  };
}

export async function updatePanelInitialCash(payload, options) {
  const response = await fetch(`${apiUrl}/api/scanner/dashboard/initial-cash`, {
    method: 'PUT',
    headers: buildHeaders({ token: options?.token, json: true }),
    body: JSON.stringify(payload)
  });

  return readJson(response);
}

export function subscribePanelDashboard(params) {
  const search = new URLSearchParams();
  if (params?.params?.initialCash != null) {
    search.set('initialCash', String(params.params.initialCash));
  }
  if (params?.params?.profitRate != null) {
    search.set('profitRate', String(params.params.profitRate));
  }
  if (params?.params?.date) {
    search.set('date', String(params.params.date));
  }

  const query = search.toString();
  const url = `${apiUrl}/api/scanner/dashboard/stream${query ? `?${query}` : ''}`;
  const controller = new AbortController();
  const decoder = new TextDecoder();
  let isClosed = false;

  function parseAndDispatch(rawEvent) {
    const lines = rawEvent.split(/\r?\n/);
    let eventName = 'message';
    const dataLines = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) {
        continue;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }

    if (!dataLines.length) {
      return;
    }

    let payload = null;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch (_error) {
      return;
    }

    if (eventName === 'dashboard') {
      params?.onDashboard?.(payload);
      return;
    }

    if (eventName === 'live_scanner') {
      params?.onLiveScanner?.(payload);
      return;
    }

    if (eventName === 'error') {
      const message = payload?.message || 'Error en stream de dashboard';
      params?.onError?.(new Error(message));
    }
  }

  async function consumeStream() {
    try {
      const response = await fetch(url, {
        headers: buildHeaders({ token: params?.token }),
        signal: controller.signal
      });

      if (!response.ok) {
        const authError = new Error(`No se pudo abrir stream dashboard (HTTP ${response.status})`);
        authError.status = response.status;
        throw authError;
      }

      if (!response.body) {
        throw new Error('Stream dashboard no disponible');
      }

      const reader = response.body.getReader();
      let buffer = '';

      while (!isClosed) {
        const { value, done } = await reader.read();
        if (done) {
          if (!isClosed) {
            throw new Error('Stream dashboard cerrado');
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.search(/\r?\n\r?\n/);
        while (separatorIndex !== -1) {
          const rawEvent = buffer.slice(0, separatorIndex);
          const separatorMatch = buffer.match(/\r?\n\r?\n/);
          const separatorLength = separatorMatch ? separatorMatch[0].length : 2;
          buffer = buffer.slice(separatorIndex + separatorLength);
          parseAndDispatch(rawEvent);
          separatorIndex = buffer.search(/\r?\n\r?\n/);
        }
      }
    } catch (error) {
      if (isClosed || error?.name === 'AbortError') {
        return;
      }
      params?.onError?.(error);
    }
  }

  consumeStream();

  return () => {
    isClosed = true;
    controller.abort();
  };
}
