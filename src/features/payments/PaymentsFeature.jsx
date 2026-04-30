import { useCallback, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import PaymentsFormCard from './components/PaymentsFormCard';
import { usePaymentsController } from './model/usePaymentsController';

function PaymentsFeature({ currentUser, onUnauthorized }) {
  const unauthorizedHandledRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) {
      return;
    }
    unauthorizedHandledRef.current = true;
    toast.warn('Sesion vencida. Inicia sesion nuevamente.', {
      toastId: 'payments-session-expired',
      autoClose: 1700
    });
    window.setTimeout(() => {
      onUnauthorized?.();
    }, 900);
  }, [onUnauthorized]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  const controller = usePaymentsController({
    currentUser,
    onUnauthorized: handleUnauthorized
  });

  async function handlePaymentSubmit(event) {
    const result = controller.handleRegisterPayment(event, {
      onSuccess: ({ elapsedMs, serverElapsedMs, serverDbElapsedMs, serverAppElapsedMs }) => {
        const networkApproxMs = elapsedMs > 0 && serverElapsedMs > 0
          ? Number((elapsedMs - serverElapsedMs).toFixed(1))
          : null;
        const serverLabel = serverElapsedMs ?? '-';
        const dbLabel = serverDbElapsedMs ?? '-';
        const appLabel = serverAppElapsedMs ?? '-';
        const netLabel = networkApproxMs ?? '-';

        if (elapsedMs > 0) {
          if (elapsedMs <= 500) {
            console.info(`[OPERARIO_PAYMENT][OK] total=${elapsedMs} ms server=${serverLabel} ms db=${dbLabel} ms app=${appLabel} ms net~=${netLabel} ms`);
          } else {
            console.warn(`[OPERARIO_PAYMENT][LENTO] total=${elapsedMs} ms server=${serverLabel} ms db=${dbLabel} ms app=${appLabel} ms net~=${netLabel} ms (> 500 ms)`);
          }
        }
      },
      onError: () => {
        toast.error('Hubo un error al registrar el pago. Revisa conexion y reintenta.', {
          toastId: `operario-payment-fail-${Date.now()}`,
          autoClose: 2600
        });
      }
    });

    if (result?.ok) {
      toast.success('Pago registrado correctamente', {
        toastId: `operario-payment-ok-${Date.now()}`,
        autoClose: 1800
      });
    }
  }

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-xl-6">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Operario</p>
                <h1 className="panel-hero-title mb-1">Pagos</h1>
                <p className="panel-hero-subtitle mb-0">Registra egresos manuales y el panel de control los vera reflejados en movimientos.</p>
              </div>
              <div className="panel-status-stack">
                <div className="panel-status-open">Activa</div>
              </div>
            </section>

            <PaymentsFormCard
              paymentAmount={controller.paymentAmount}
              paymentDescription={controller.paymentDescription}
              paymentError={controller.paymentError}
              isRegisteringPayment={controller.isRegisteringPayment}
              onChangeAmount={controller.setPaymentAmount}
              onChangeDescription={controller.setPaymentDescription}
              onSubmit={handlePaymentSubmit}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default PaymentsFeature;
