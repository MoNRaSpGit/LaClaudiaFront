import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMonthlySummary, updateMonthlyWeekOverride } from '../services/months.api';

export function useMonthsController({ currentUser, onUnauthorized }) {
  const [months, setMonths] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMonths = useCallback(async () => {
    if (!currentUser?.sessionToken) {
      if (isMountedRef.current) {
        setMonths([]);
        setError('');
        setIsLoading(false);
      }
      return;
    }

    if (isMountedRef.current) {
      setIsLoading(true);
    }

    try {
      const result = await fetchMonthlySummary({ limitMonths: 24 }, {
        token: currentUser?.sessionToken || ''
      });

      if (isMountedRef.current) {
        setMonths(Array.isArray(result?.months) ? result.months : []);
        setError('');
      }
    } catch (loadError) {
      if (Number(loadError?.status) === 401) {
        onUnauthorized?.();
      }
      if (isMountedRef.current) {
        if (Number(loadError?.status) === 401) {
          setError('Sesion expirada. Inicia sesion nuevamente.');
        } else if (Number(loadError?.status) === 403) {
          setError('Tu usuario no puede ver el historial mensual.');
        } else {
          setError('No se pudo cargar el resumen por meses.');
        }
        setMonths([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentUser?.sessionToken, onUnauthorized]);

  useEffect(() => {
    loadMonths().catch(() => {});
  }, [loadMonths]);

  const featuredMonthKeys = useMemo(
    () => months.slice(0, 1).map((month) => String(month?.monthKey || '')),
    [months]
  );

  async function saveWeekOverride(payload) {
    if (isSaving) {
      return { ok: false, busy: true };
    }

    setIsSaving(true);
    try {
      const result = await updateMonthlyWeekOverride(payload, {
        token: currentUser?.sessionToken || ''
      });
      await loadMonths();
      return {
        ok: true,
        override: result?.override || null
      };
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }

  return {
    months,
    isLoading,
    isSaving,
    error,
    featuredMonthKeys,
    saveWeekOverride
  };
}
