import { useState } from 'react';
import { parsePositiveAmount } from '../../../shared/lib/number';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';
import { registerOperarioPayment } from '../services/payments.api';

export function usePaymentsController({ currentUser, onUnauthorized } = {}) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);

  function handleRegisterPayment(event, options = {}) {
    event.preventDefault();

    if (isRegisteringPayment) {
      return { ok: false, busy: true };
    }

    const parsedAmount = parsePositiveAmount(paymentAmount);
    const trimmedDescription = String(paymentDescription || '').trim();

    if (parsedAmount === null) {
      setPaymentError('Ingresa un monto valido mayor a 0.');
      return { ok: false };
    }

    if (!trimmedDescription) {
      setPaymentError('La descripcion es obligatoria.');
      return { ok: false };
    }

    setPaymentAmount('');
    setPaymentDescription('');
    setPaymentError('');
    setIsRegisteringPayment(true);

    registerOperarioPayment({
      externalId: `payment-${Date.now()}`,
      userId: currentUser?.id || null,
      amount: parsedAmount,
      description: trimmedDescription
    }, {
      token: currentUser?.sessionToken || ''
    })
      .then((result) => {
        const elapsedMs = Number(result?._meta?.elapsedMs || 0);
        const serverElapsedMs = Number(result?.meta?.elapsedMs || 0);
        const serverDbElapsedMs = Number(result?.meta?.dbElapsedMs || 0);
        const serverAppElapsedMs = Number(result?.meta?.appElapsedMs || 0);
        options?.onSuccess?.({
          elapsedMs,
          serverElapsedMs,
          serverDbElapsedMs,
          serverAppElapsedMs
        });
      })
      .catch((error) => {
        const message = toUserErrorMessage(error, { context: 'panel_payment' });
        if (String(message).toLowerCase().includes('sesion vencida')) {
          onUnauthorized?.();
        }
        setPaymentError(message);
        options?.onError?.(new Error(message));
      })
      .finally(() => {
        setIsRegisteringPayment(false);
      });

    return { ok: true };
  }

  return {
    paymentAmount,
    paymentDescription,
    paymentError,
    isRegisteringPayment,
    handleRegisterPayment,
    setPaymentAmount,
    setPaymentDescription
  };
}
