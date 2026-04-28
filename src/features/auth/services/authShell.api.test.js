import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginReal, logoutReal } from './authShell.api';

describe('authShell.api contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('loginReal hace POST /api/auth/login con body JSON username/password', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 1, username: 'operario', role: 'operario' },
        session: { token: 'token-1' }
      })
    });

    await loginReal({ username: 'operario', password: '1234' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'operario', password: '1234' })
      })
    );
  });

  it('logoutReal hace POST /api/auth/logout con Authorization', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true })
    });

    await logoutReal({ token: 'token-logout' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer token-logout' }
      })
    );
  });
});

