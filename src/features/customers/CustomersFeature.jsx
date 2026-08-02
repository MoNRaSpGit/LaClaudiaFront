import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { createCustomer, createCustomerPayment, getCustomerDetail, listCustomers, removeCustomer } from './services/customers.api';
import { printSaleTicket } from '../scanner/services/scanner.print';
import { printSaleTicketByQz } from '../scanner/services/scanner.qzPrint';
import CustomerDeleteModal from './CustomerDeleteModal';
import CustomerPaymentConfirmModal from './CustomerPaymentConfirmModal';
import {
  aggregateSaleItems,
  buildCustomerHistoryTicketPayload,
  formatDateTime,
  formatMoney,
  formatSaleItems,
  isRouteUnavailableError,
  parseMoneyValue
} from './customers.utils';
import '../../styles/customers.css';

function resolveExpandLabel(visibleCount, totalCount, step) {
  if (visibleCount >= totalCount) {
    return 'Ver menos';
  }
  if (visibleCount <= step) {
    return `Ver ${step}+`;
  }
  return 'Ver todo';
}

async function printTicketWithFallback(ticketPayload, toastIds) {
  try {
    await printSaleTicketByQz(ticketPayload);
    toast.success('Ticket enviado a impresora.', {
      toastId: toastIds.success,
      autoClose: 1800
    });
    return;
  } catch (error) {
    try {
      await printSaleTicket(ticketPayload);
      toast.warn('QZ fallo, se abrio impresion del navegador como respaldo.', {
        toastId: toastIds.fallback,
        autoClose: 2600
      });
      return;
    } catch {
      toast.error(`No se pudo imprimir el ticket: ${error?.message || 'Error de QZ.'}`, {
        toastId: toastIds.failure,
        autoClose: 3200
      });
    }
  }
}

function CustomersFeature({ currentUser, onUnauthorized }) {
  const token = String(currentUser?.sessionToken || '').trim();
  const userRole = String(currentUser?.role || 'operario').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const onUnauthorizedRef = useRef(onUnauthorized);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [isPrintingStatement, setIsPrintingStatement] = useState(false);
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState(null);
  const [visibleSalesCount, setVisibleSalesCount] = useState(3);
  const [visiblePaymentsCount, setVisiblePaymentsCount] = useState(3);
  const [isCustomerRoutesUnavailable, setIsCustomerRoutesUnavailable] = useState(false);
  const [formValues, setFormValues] = useState({
    name: '',
    phone: ''
  });

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const loadCustomers = useCallback(async ({ keepSelection = true } = {}) => {
    const nextCustomers = await listCustomers({ token });
    setIsCustomerRoutesUnavailable(false);
    setCustomers(nextCustomers);
    setSelectedCustomerId((current) => {
      if (keepSelection && current && nextCustomers.some((customer) => customer.id === current)) {
        return current;
      }
      return nextCustomers[0]?.id ?? null;
    });
    return nextCustomers;
  }, [token]);

  const loadCustomerDetail = useCallback(async (customerId) => {
    if (!customerId || !token) {
      setSelectedCustomerDetail(null);
      return null;
    }

    const detail = await getCustomerDetail(customerId, { token });
    setIsCustomerRoutesUnavailable(false);
    setSelectedCustomerDetail(detail);
    return detail;
  }, [token]);

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialCustomers() {
      setIsLoading(true);
      try {
        const nextCustomers = await listCustomers({ token });
        if (isCancelled) {
          return;
        }
        setCustomers(nextCustomers);
        setSelectedCustomerId((current) => current ?? nextCustomers[0]?.id ?? null);
        setIsCustomerRoutesUnavailable(false);
      } catch (error) {
        if (Number(error?.status || 0) === 401) {
          onUnauthorizedRef.current?.();
          return;
        }
        if (isRouteUnavailableError(error)) {
          setIsCustomerRoutesUnavailable(true);
          setCustomers([]);
          setSelectedCustomerId(null);
          setSelectedCustomerDetail(null);
          return;
        }
        if (!isCancelled) {
          toast.error('No se pudieron cargar los clientes.');
          setCustomers([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (!token) {
      setCustomers([]);
      setSelectedCustomerId(null);
      setSelectedCustomerDetail(null);
      setIsLoading(false);
      return undefined;
    }

    loadInitialCustomers();
    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let isCancelled = false;

    async function loadDetail() {
      if (!selectedCustomerId || !token) {
        setSelectedCustomerDetail(null);
        return;
      }

      setDetailLoading(true);
      try {
        const detail = await getCustomerDetail(selectedCustomerId, { token });
        if (!isCancelled) {
          setIsCustomerRoutesUnavailable(false);
          setSelectedCustomerDetail(detail);
        }
      } catch (error) {
        if (Number(error?.status || 0) === 401) {
          onUnauthorizedRef.current?.();
          return;
        }
        if (isRouteUnavailableError(error)) {
          setIsCustomerRoutesUnavailable(true);
          setSelectedCustomerDetail(null);
          return;
        }
        if (!isCancelled) {
          toast.error('No se pudo cargar el detalle del cliente.');
          setSelectedCustomerDetail(null);
        }
      } finally {
        if (!isCancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      isCancelled = true;
    };
  }, [selectedCustomerId, token]);

  useEffect(() => {
    setVisibleSalesCount(3);
    setVisiblePaymentsCount(3);
    setIsPaymentConfirmOpen(false);
  }, [selectedCustomerId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving || isCustomerRoutesUnavailable) {
      if (isCustomerRoutesUnavailable) {
        toast.warn('Clientes no esta disponible en este backend todavia.');
      }
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCustomer(formValues, { token });
      const createdCustomer = result?.customer;
      setIsCustomerRoutesUnavailable(false);
      await loadCustomers({ keepSelection: false });
      setSelectedCustomerId(createdCustomer?.id || null);
      setFormValues({
        name: '',
        phone: ''
      });
      toast.success('Cliente creado.');
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        onUnauthorizedRef.current?.();
        return;
      }
      if (isRouteUnavailableError(error)) {
        setIsCustomerRoutesUnavailable(true);
        toast.error('Este backend todavia no tiene habilitada la ruta de clientes.');
        return;
      }
      toast.error(error?.message || 'No se pudo crear el cliente.');
    } finally {
      setIsSaving(false);
    }
  }

  const accountSales = Array.isArray(selectedCustomerDetail?.accountSales) ? selectedCustomerDetail.accountSales : [];
  const accountPayments = Array.isArray(selectedCustomerDetail?.accountPayments) ? selectedCustomerDetail.accountPayments : [];
  // El backend ya marca por venta si esta saldada o pendiente (misma
  // reconciliacion FIFO que usa el pago y el ticket) - antes esto se
  // adivinaba en el frontend con una heuristica que podia no coincidir.
  const outstandingAccountSales = accountSales.filter((sale) => !sale.isSettled);
  const visibleSales = outstandingAccountSales.slice(0, visibleSalesCount);
  const visiblePayments = accountPayments.slice(0, visiblePaymentsCount);
  const canExpandSales = outstandingAccountSales.length > 3;
  const canExpandPayments = accountPayments.length > 3;

  async function handleRegisterPayment(paymentMethod) {
    if (!selectedCustomerId || isRegisteringPayment || isCustomerRoutesUnavailable) {
      if (isCustomerRoutesUnavailable) {
        toast.warn('Los pagos de cuenta no estan disponibles en este backend todavia.');
      }
      return;
    }

    setIsRegisteringPayment(true);
    try {
      // Se paga siempre el total de la deuda (no hay pagos parciales). Se
      // relee fresco justo antes de cobrar para minimizar la ventana de una
      // pantalla desactualizada; igual el backend valida contra la deuda real.
      const freshDetail = await loadCustomerDetail(selectedCustomerId);
      const freshDebtTotal = parseMoneyValue(freshDetail?.customer?.debtTotal);

      if (freshDebtTotal <= 0) {
        toast.info('Este cliente no tiene deuda pendiente.', { toastId: 'customer-payment-no-debt' });
        setIsPaymentConfirmOpen(false);
        return;
      }

      const paymentResult = await createCustomerPayment(selectedCustomerId, {
        amount: freshDebtTotal,
        paymentMethod
      }, { token });

      setIsCustomerRoutesUnavailable(false);
      await loadCustomers();
      setDetailLoading(true);
      await loadCustomerDetail(selectedCustomerId);
      setIsPaymentConfirmOpen(false);
      toast.success('Pago de cuenta registrado.');

      const payment = paymentResult?.payment;
      if (Array.isArray(payment?.coveredItems) && payment.coveredItems.length) {
        const paymentTicketPayload = buildCustomerHistoryTicketPayload({
          customer: freshDetail?.customer,
          coveredItems: payment.coveredItems,
          currentUser,
          ticketKind: 'payment'
        });

        if (paymentTicketPayload.hasSales) {
          await printTicketWithFallback(paymentTicketPayload.ticket, {
            success: 'customer-payment-print-ok',
            fallback: 'customer-payment-print-fallback',
            failure: 'customer-payment-print-fail'
          });
        }
      }
    } catch (error) {
      if (Number(error?.status || 0) === 409) {
        // El backend valida contra la deuda real al momento del pago: si esta
        // pantalla estaba desactualizada (ej. se cargo otra venta a cuenta en
        // el medio), refrescamos el detalle para que el operador vea el monto correcto.
        toast.error(error?.message || 'El pago supera la deuda actual del cliente.');
        loadCustomerDetail(selectedCustomerId).catch(() => {});
        return;
      }
      if (Number(error?.status || 0) === 401) {
        onUnauthorizedRef.current?.();
        return;
      }
      if (isRouteUnavailableError(error)) {
        setIsCustomerRoutesUnavailable(true);
        toast.error('Este backend todavia no tiene habilitados los pagos de cuenta.');
        return;
      }
      toast.error(error?.message || 'No se pudo registrar el pago.');
    } finally {
      setDetailLoading(false);
      setIsRegisteringPayment(false);
    }
  }

  async function handlePrintStatement() {
    if (!selectedCustomerId || isPrintingStatement) {
      return;
    }

    // Accion de solo lectura: imprime lo que el cliente tiene pendiente ahora
    // mismo, sin registrar ningun pago ni tocar la deuda. Se puede repetir
    // las veces que haga falta para comparar contra lo que dice el sistema.
    setIsPrintingStatement(true);
    try {
      const freshDetail = await loadCustomerDetail(selectedCustomerId);
      const freshOutstandingSales = (Array.isArray(freshDetail?.accountSales) ? freshDetail.accountSales : [])
        .filter((sale) => !sale.isSettled);

      if (!freshOutstandingSales.length) {
        toast.info('Este cliente no tiene deuda pendiente para imprimir.', {
          toastId: 'customer-statement-empty'
        });
        return;
      }

      const statementTicketPayload = buildCustomerHistoryTicketPayload({
        customer: freshDetail?.customer,
        coveredItems: aggregateSaleItems(freshOutstandingSales),
        currentUser,
        ticketKind: 'statement'
      });

      if (statementTicketPayload.hasSales) {
        await printTicketWithFallback(statementTicketPayload.ticket, {
          success: 'customer-statement-print-ok',
          fallback: 'customer-statement-print-fallback',
          failure: 'customer-statement-print-fail'
        });
      }
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        onUnauthorizedRef.current?.();
        return;
      }
      toast.error(error?.message || 'No se pudo imprimir el comprobante.');
    } finally {
      setIsPrintingStatement(false);
    }
  }

  async function handleDeleteCustomer(customer) {
    const customerId = Number(customer?.id || 0);
    if (!isAdmin || !customerId || deletingCustomerId === customerId) {
      return;
    }

    const customerName = String(customer?.name || 'este cliente').trim();
    const debtTotal = parseMoneyValue(customer?.debtTotal);
    if (debtTotal > 0) {
      toast.error(`No se puede eliminar a ${customerName} porque tiene saldo pendiente (${formatMoney(debtTotal)}).`, {
        containerId: 'customers-toast',
        toastId: `customer-delete-blocked-${customerId}`,
        autoClose: 3200
      });
      return;
    }

    setDeleteConfirmCustomer(customer);
  }

  async function confirmDeleteCustomer() {
    const customer = deleteConfirmCustomer;
    const customerId = Number(customer?.id || 0);
    if (!customerId) {
      setDeleteConfirmCustomer(null);
      return;
    }

    setDeletingCustomerId(customerId);
    try {
      await removeCustomer(customerId, { token });
      setIsCustomerRoutesUnavailable(false);
      await loadCustomers({ keepSelection: true });
      if (selectedCustomerId === customerId) {
        setSelectedCustomerDetail(null);
      }
      setDeleteConfirmCustomer(null);
      toast.success('Cliente eliminado.');
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        onUnauthorizedRef.current?.();
        return;
      }
      if (isRouteUnavailableError(error)) {
        setIsCustomerRoutesUnavailable(true);
        toast.error('Este backend todavia no tiene habilitada la eliminacion de clientes.');
        return;
      }
      toast.error(error?.message || 'No se pudo eliminar el cliente.');
    } finally {
      setDeletingCustomerId(null);
    }
  }

  return (
    <>
      <ToastContainer
        containerId="customers-toast"
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        theme="light"
        style={{ zIndex: 2000, top: '4.5rem' }}
      />
      <CustomerDeleteModal
        customer={deleteConfirmCustomer}
        deletingCustomerId={deletingCustomerId}
        onCancel={() => setDeleteConfirmCustomer(null)}
        onConfirm={confirmDeleteCustomer}
      />
      {isPaymentConfirmOpen ? (
        <CustomerPaymentConfirmModal
          customer={selectedCustomerDetail?.customer}
          debtTotal={selectedCustomerDetail?.customer?.debtTotal}
          isSubmitting={isRegisteringPayment}
          onCancel={() => setIsPaymentConfirmOpen(false)}
          onConfirm={handleRegisterPayment}
        />
      ) : null}
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-lg-4">
            <section className="customers-card h-100">
              <p className="customers-kicker mb-2">Clientes</p>
              <h2 className="h4 mb-3">Alta rapida</h2>
              {isCustomerRoutesUnavailable ? (
                <div className="alert alert-warning py-2" role="alert">
                  Este backend todavia no expone la ruta de clientes. La pantalla queda en modo informativo hasta que se despliegue.
                </div>
              ) : null}
              <form className="d-grid gap-3" onSubmit={handleSubmit}>
                <div>
                  <label className="form-label" htmlFor="customer-name">Nombre</label>
                  <input
                    id="customer-name"
                    className="form-control"
                    value={formValues.name}
                    onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Juan Perez"
                    maxLength={120}
                    disabled={isCustomerRoutesUnavailable}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="customer-phone">Telefono</label>
                  <input
                    id="customer-phone"
                    className="form-control"
                    value={formValues.phone}
                    onChange={(event) => setFormValues((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="099 000 000"
                    maxLength={40}
                    disabled={isCustomerRoutesUnavailable}
                  />
                </div>
                <button type="submit" className="btn btn-dark" disabled={isSaving || !token || isCustomerRoutesUnavailable}>
                  {isSaving ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </form>
            </section>
          </div>

          <div className="col-lg-4">
            <section className="customers-card h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <p className="customers-kicker mb-1">Listado</p>
                  <h2 className="h4 mb-0">Cuenta corriente</h2>
                </div>
                <span className="customers-count-badge">{customers.length}</span>
              </div>

              {isLoading ? (
                <p className="text-muted mb-0">Cargando clientes...</p>
              ) : isCustomerRoutesUnavailable ? (
                <p className="text-muted mb-0">Clientes no disponible en este backend todavia.</p>
              ) : customers.length === 0 ? (
                <p className="text-muted mb-0">Todavia no hay clientes cargados.</p>
              ) : (
                <div className="customers-list">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`customers-list-item-shell ${selectedCustomerId === customer.id ? 'customers-list-item-shell-active' : ''}`}
                    >
                      <button
                        type="button"
                        className={`customers-list-item ${selectedCustomerId === customer.id ? 'customers-list-item-active' : ''}`}
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <span className="customers-list-name">{customer.name}</span>
                        <span className="customers-list-meta">Deuda {formatMoney(customer.debtTotal)}</span>
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger customers-delete-btn"
                          onClick={() => handleDeleteCustomer(customer)}
                          disabled={deletingCustomerId === customer.id}
                        >
                          {deletingCustomerId === customer.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="col-lg-4">
            <section className="customers-card h-100">
              <p className="customers-kicker mb-1">Detalle</p>
              <h2 className="h4 mb-3">Estado del cliente</h2>

              {detailLoading ? (
                <p className="text-muted mb-0">Cargando detalle...</p>
              ) : isCustomerRoutesUnavailable ? (
                <p className="text-muted mb-0">El detalle de clientes estara disponible cuando el backend publique estas rutas.</p>
              ) : !selectedCustomerDetail?.customer ? (
                <p className="text-muted mb-0">Selecciona un cliente para ver su deuda.</p>
              ) : (
                <>
                  <div className="customers-detail-hero customers-detail-hero-compact mb-3">
                    <div className="customers-balance-copy">
                      <span className="customers-detail-label mb-1">Saldo actual</span>
                      <strong className="customers-detail-name">{selectedCustomerDetail.customer.name}</strong>
                    </div>
                    <span className="customers-detail-debt">{formatMoney(selectedCustomerDetail.customer.debtTotal)}</span>
                  </div>

                  <div className="d-grid gap-2 mb-3">
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={handlePrintStatement}
                      disabled={isPrintingStatement || isCustomerRoutesUnavailable}
                    >
                      {isPrintingStatement ? 'Imprimiendo...' : 'Imprimir'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => setIsPaymentConfirmOpen(true)}
                      disabled={
                        isCustomerRoutesUnavailable
                        || parseMoneyValue(selectedCustomerDetail?.customer?.debtTotal) <= 0
                      }
                    >
                      Pagar
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="customers-history-head mb-2">
                      <p className="customers-detail-label mb-0">Historial de ventas</p>
                      <div className="customers-history-actions">
                        <span className="customers-history-count">{outstandingAccountSales.length}</span>
                        {canExpandSales ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              if (visibleSalesCount >= outstandingAccountSales.length) {
                                setVisibleSalesCount(3);
                                return;
                              }
                              if (visibleSalesCount <= 3) {
                                setVisibleSalesCount(Math.min(6, outstandingAccountSales.length));
                                return;
                              }
                              setVisibleSalesCount(outstandingAccountSales.length);
                            }}
                          >
                            {resolveExpandLabel(visibleSalesCount, outstandingAccountSales.length, 3)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {outstandingAccountSales.length ? (
                      <div className="customers-sales-list">
                        {visibleSales.map((sale) => (
                          <div key={sale.id} className="customers-sale-row">
                            <div className="customers-sale-main">
                              <div className="customers-sale-head">
                                <strong className="customers-sale-amount">{formatMoney(sale.totalAmount)}</strong>
                                <div className="customers-sale-meta">{sale.itemsCount} items</div>
                              </div>
                              {Array.isArray(sale.items) && sale.items.length ? (
                                <div className="customers-sale-items">
                                  {formatSaleItems(sale.items).map((label) => (
                                    <div key={`${sale.id}-${label}`} className="customers-sale-item-line">
                                      {label}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <div className="customers-sale-side">
                              <span className="customers-sale-meta customers-sale-date">{formatDateTime(sale.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">Sin ventas en cuenta todavia.</p>
                    )}
                  </div>

                  <div>
                    <div className="customers-history-head mb-2">
                      <p className="customers-detail-label mb-0">Historial de pagos</p>
                      <div className="customers-history-actions">
                        <span className="customers-history-count">{accountPayments.length}</span>
                        {canExpandPayments ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              if (visiblePaymentsCount >= accountPayments.length) {
                                setVisiblePaymentsCount(3);
                                return;
                              }
                              if (visiblePaymentsCount <= 3) {
                                setVisiblePaymentsCount(Math.min(6, accountPayments.length));
                                return;
                              }
                              setVisiblePaymentsCount(accountPayments.length);
                            }}
                          >
                            {resolveExpandLabel(visiblePaymentsCount, accountPayments.length, 3)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {accountPayments.length ? (
                      <div className="customers-sales-list">
                        {visiblePayments.map((payment) => (
                          <div key={payment.id} className="customers-sale-row customers-sale-row-payment">
                            <div className="customers-sale-main">
                              <div className="customers-sale-head">
                                <strong className="customers-sale-amount">{formatMoney(payment.amount)}</strong>
                              </div>
                              <div className="customers-sale-meta">
                                {payment.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}
                                {payment.notes ? ` - ${payment.notes}` : ''}
                              </div>
                            </div>
                            <span className="customers-sale-meta customers-sale-date">{formatDateTime(payment.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">Sin pagos registrados todavia.</p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export default CustomersFeature;
