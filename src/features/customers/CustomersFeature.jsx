import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { createCustomer, createCustomerPayment, getCustomerDetail, listCustomers, removeCustomer } from './services/customers.api';
import { printSaleTicket } from '../scanner/services/scanner.print';
import { printSaleTicketByQz } from '../scanner/services/scanner.qzPrint';

function parseMoneyValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = Number(String(value || '').trim().replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatMoney(value) {
  return `$${parseMoneyValue(value).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(parsed);
}

function formatSaleItems(items = []) {
  return items
    .filter((item) => String(item?.name || '').trim())
    .map((item) => {
      const itemName = String(item.name || '').trim();
      const quantity = Number(item.quantity || 0);
      const lineTotal = formatMoney(item.lineTotal || 0);
      const unitPrice = Number(item.unitPrice || 0) > 0 ? ` x ${formatMoney(item.unitPrice)}` : '';
      return `${itemName}${quantity > 0 ? ` x${quantity}` : ''}${unitPrice} - ${lineTotal}`;
    });
}

function buildCustomerSaleTicketPayload(sale, currentUser) {
  const ticketItems = Array.isArray(sale?.items)
    ? sale.items
      .filter((item) => String(item?.name || '').trim())
      .map((item) => ({
        nombre: String(item.name || '').trim(),
        quantity: Number(item.quantity || 0) || 1,
        precio_venta: Number(item.unitPrice || 0)
      }))
    : [];

  return {
    storeName: 'Super Nova',
    externalId: String(sale?.externalId || '').trim() || `CTA-${sale?.id || '-'}`,
    chargedAtIso: sale?.createdAt || new Date().toISOString(),
    operatorName: currentUser?.name || currentUser?.username || 'Operario',
    items: ticketItems,
    total: Number(sale?.totalAmount || 0)
  };
}

function sortMovementsDesc(left, right) {
  const leftTime = new Date(left?.createdAt || 0).getTime();
  const rightTime = new Date(right?.createdAt || 0).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return Number(right?.id || 0) - Number(left?.id || 0);
}

function getActiveCustomerHistory({ accountSales = [], accountPayments = [], debtTotal = 0 }) {
  const normalizedDebt = parseMoneyValue(debtTotal);
  if (normalizedDebt <= 0) {
    return { sales: [], payments: [] };
  }

  const movements = [
    ...accountSales.map((sale) => ({ ...sale, movementType: 'sale', amount: Number(sale?.totalAmount || 0) })),
    ...accountPayments.map((payment) => ({ ...payment, movementType: 'payment', amount: Number(payment?.amount || 0) }))
  ].sort(sortMovementsDesc);

  let debtCursor = normalizedDebt;
  const activeSaleIds = new Set();
  const activePaymentIds = new Set();

  for (const movement of movements) {
    if (movement.movementType === 'payment') {
      activePaymentIds.add(Number(movement.id || 0));
      debtCursor += Number(movement.amount || 0);
      continue;
    }

    activeSaleIds.add(Number(movement.id || 0));
    debtCursor -= Number(movement.amount || 0);
    if (debtCursor <= 0) {
      break;
    }
  }

  return {
    sales: accountSales.filter((sale) => activeSaleIds.has(Number(sale.id || 0))),
    payments: accountPayments.filter((payment) => activePaymentIds.has(Number(payment.id || 0)))
  };
}

function buildCustomerHistoryTicketPayload({ customer, accountSales = [], currentUser }) {
  const sortedSales = accountSales
    .slice()
    .sort((left, right) => new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime());

  const ticketItems = sortedSales.flatMap((sale) => (
    Array.isArray(sale?.items)
      ? sale.items
        .filter((item) => String(item?.name || '').trim())
        .map((item) => ({
          nombre: String(item.name || '').trim(),
          quantity: Number(item.quantity || 0) || 1,
          precio_venta: Number(item.unitPrice || 0)
        }))
      : []
  ));

  return {
    hasSales: sortedSales.length > 0 && ticketItems.length > 0,
    salesCount: sortedSales.length,
    ticket: {
      storeName: 'Super Nova',
      externalId: `CTA-${customer?.id || '-'}`,
      chargedAtIso: sortedSales.at(-1)?.createdAt || new Date().toISOString(),
      operatorName: currentUser?.name || currentUser?.username || 'Operario',
      items: ticketItems,
      total: sortedSales.reduce((sum, sale) => sum + Number(sale?.totalAmount || 0), 0)
    }
  };
}

function parsePositiveAmount(value) {
  const normalized = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

function isRouteUnavailableError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').trim().toLowerCase();
  return status === 404 || message.includes('route not found') || message.includes('not found');
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
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState(null);
  const [printingSaleId, setPrintingSaleId] = useState(null);
  const [visibleSalesCount, setVisibleSalesCount] = useState(3);
  const [visiblePaymentsCount, setVisiblePaymentsCount] = useState(3);
  const [formValues, setFormValues] = useState({
    name: '',
    phone: ''
  });
  const [paymentFormValues, setPaymentFormValues] = useState({
    amount: '',
    paymentMethod: 'efectivo',
    notes: ''
  });
  const [paymentError, setPaymentError] = useState('');
  const [isCustomerRoutesUnavailable, setIsCustomerRoutesUnavailable] = useState(false);

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
    setPaymentError('');
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
      setIsCustomerRoutesUnavailable(false);
      const createdCustomer = result?.customer;
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

  async function handleRegisterPayment(event) {
    event.preventDefault();
    if (!selectedCustomerId || isRegisteringPayment || isCustomerRoutesUnavailable) {
      if (isCustomerRoutesUnavailable) {
        toast.warn('Los pagos de cuenta no estan disponibles en este backend todavia.');
      }
      return;
    }

    const parsedAmount = parsePositiveAmount(paymentFormValues.amount);
    const debtTotal = parseMoneyValue(selectedCustomerDetail?.customer?.debtTotal);
    const isClosingPayment = Math.abs((parsedAmount || 0) - debtTotal) < 0.0001;
    const closingTicketPayload = isClosingPayment
      ? buildCustomerHistoryTicketPayload({
        customer: selectedCustomerDetail?.customer,
        accountSales: activeAccountSales,
        currentUser
      })
      : null;

    if (!parsedAmount) {
      setPaymentError('Ingresa un monto valido.');
      toast.error('Ingresa un monto valido.');
      return;
    }

    if (parsedAmount > debtTotal) {
      const message = `El pago no puede superar la deuda actual (${formatMoney(debtTotal)}).`;
      setPaymentError(message);
      toast.error(message);
      return;
    }

    setPaymentError('');
    setIsRegisteringPayment(true);
    try {
      await createCustomerPayment(selectedCustomerId, {
        amount: parsedAmount,
        paymentMethod: paymentFormValues.paymentMethod,
        notes: paymentFormValues.notes
      }, { token });

      setIsCustomerRoutesUnavailable(false);
      await loadCustomers();
      setDetailLoading(true);
      await loadCustomerDetail(selectedCustomerId);
      setPaymentFormValues({
        amount: '',
        paymentMethod: 'efectivo',
        notes: ''
      });
      setPaymentError('');
      toast.success('Pago de cuenta registrado.');

      if (isClosingPayment && closingTicketPayload?.hasSales) {
        setPrintingSaleId('history');
        try {
          await printSaleTicketByQz(closingTicketPayload.ticket);
          toast.success('Ticket enviado a impresora.', {
            toastId: 'customer-payment-print-ok-history',
            autoClose: 1800
          });
        } catch (error) {
          try {
            await printSaleTicket(closingTicketPayload.ticket);
            toast.warn('QZ fallo, se abrio impresion del navegador como respaldo.', {
              toastId: 'customer-payment-print-fallback-history',
              autoClose: 2600
            });
          } catch {
            toast.error(`No se pudo imprimir el ticket: ${error?.message || 'Error de QZ.'}`, {
              toastId: 'customer-payment-print-fail-history',
              autoClose: 3200
            });
          }
        } finally {
          setPrintingSaleId(null);
        }
      }
    } catch (error) {
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

  async function handleDeleteCustomer(customer) {
    const customerId = Number(customer?.id || 0);
    if (!isAdmin || !customerId || deletingCustomerId === customerId) {
      return;
    }

      const customerName = String(customer?.name || 'este cliente').trim();
      const debtTotal = parseMoneyValue(customer?.debtTotal);
      if (debtTotal > 0) {
        const message = `No se puede eliminar a ${customerName} porque tiene saldo pendiente (${formatMoney(debtTotal)}).`;
        toast.error(message, {
          containerId: 'customers-toast',
          toastId: `customer-delete-blocked-${customerId}`,
          autoClose: 3200
        });
        return;
      }

      setDeleteConfirmCustomer(customer);
      return;

    const confirmed = window.confirm(`¿Eliminar a ${customerName}? Esta accion ocultara al cliente de la lista.`);
    if (!confirmed) {
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

  async function handlePrintHistoryTicket() {
    if (printingSaleId === 'history' || !selectedCustomerDetail?.customer) {
      return;
    }

    const result = buildCustomerHistoryTicketPayload({
      customer: selectedCustomerDetail.customer,
      accountSales: activeAccountSales,
      currentUser
    });

    if (!result.hasSales) {
      toast.info('No hay ventas pendientes para imprimir en el historial activo.');
      return;
    }

    const ticketPayload = result.ticket;
    setPrintingSaleId('history');

    try {
      await printSaleTicketByQz(ticketPayload);
      toast.success('Ticket enviado a impresora.', {
        toastId: `customer-sale-print-ok-history`,
        autoClose: 1800
      });
    } catch (error) {
      try {
        await printSaleTicket(ticketPayload);
        toast.warn('QZ fallo, se abrio impresion del navegador como respaldo.', {
          toastId: `customer-sale-print-fallback-history`,
          autoClose: 2600
        });
      } catch {
        toast.error(`No se pudo imprimir el ticket: ${error?.message || 'Error de QZ.'}`, {
          toastId: `customer-sale-print-fail-history`,
          autoClose: 3200
        });
      }
    } finally {
      setPrintingSaleId(null);
    }
  }

  function resolveExpandLabel(visibleCount, totalCount, step) {
    if (visibleCount >= totalCount) {
      return 'Ver menos';
    }
    if (visibleCount <= step) {
      return `Ver ${step}+`;
    }
    return 'Ver todo';
  }

  const accountSales = Array.isArray(selectedCustomerDetail?.accountSales) ? selectedCustomerDetail.accountSales : [];
  const accountPayments = Array.isArray(selectedCustomerDetail?.accountPayments) ? selectedCustomerDetail.accountPayments : [];
  const activeHistory = getActiveCustomerHistory({
    accountSales,
    accountPayments,
    debtTotal: selectedCustomerDetail?.customer?.debtTotal
  });
  const activeAccountSales = activeHistory.sales;
  const activeAccountPayments = activeHistory.payments;
  const printableHistoryTicket = buildCustomerHistoryTicketPayload({
    customer: selectedCustomerDetail?.customer,
    accountSales: activeAccountSales,
    currentUser
  });
  const visibleSales = activeAccountSales.slice(0, visibleSalesCount);
  const visiblePayments = activeAccountPayments.slice(0, visiblePaymentsCount);
  const canExpandSales = activeAccountSales.length > 3;
  const canExpandPayments = activeAccountPayments.length > 3;

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
      {deleteConfirmCustomer ? (
        <div className="customers-delete-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="customers-delete-title">
          <div className="customers-delete-modal-card">
            <p className="customers-kicker mb-2">Confirmacion</p>
            <h3 id="customers-delete-title" className="h5 mb-2">Eliminar cliente</h3>
            <p className="text-muted mb-3">
              Vas a ocultar a <strong>{deleteConfirmCustomer.name}</strong> de la lista de clientes.
            </p>
            <p className="text-muted mb-4">Su historial queda guardado, pero ya no aparecera como cliente activo.</p>
            <div className="customers-delete-modal-actions">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setDeleteConfirmCustomer(null)}
                disabled={Boolean(deletingCustomerId)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteCustomer}
                disabled={Boolean(deletingCustomerId)}
              >
                {deletingCustomerId === deleteConfirmCustomer.id ? 'Eliminando...' : 'Confirmar eliminacion'}
              </button>
            </div>
          </div>
        </div>
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
                      <span className="customers-list-meta">
                        Deuda {formatMoney(customer.debtTotal)}
                      </span>
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

                <form className="customers-payment-box mb-3" onSubmit={handleRegisterPayment}>
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <div>
                      <p className="customers-detail-label mb-1">Registrar pago</p>
                      <strong className="customers-payment-title">Descontar deuda</strong>
                    </div>
                  </div>
                  <div className="d-grid gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="form-control"
                      placeholder="Monto"
                      value={paymentFormValues.amount}
                      max={parseMoneyValue(selectedCustomerDetail?.customer?.debtTotal) || undefined}
                      onChange={(event) => {
                        const nextAmount = event.target.value;
                        setPaymentFormValues((current) => ({ ...current, amount: nextAmount }));

                        const parsedAmount = parsePositiveAmount(nextAmount);
                        const debtTotal = parseMoneyValue(selectedCustomerDetail?.customer?.debtTotal);
                        if (!nextAmount) {
                          setPaymentError('');
                          return;
                        }
                        if (!parsedAmount) {
                          setPaymentError('Ingresa un monto valido.');
                          return;
                        }
                        if (parsedAmount > debtTotal) {
                          setPaymentError(`El pago no puede superar la deuda actual (${formatMoney(debtTotal)}).`);
                          return;
                        }
                        setPaymentError('');
                      }}
                      required
                    />
                    <select
                      className="form-select"
                      value={paymentFormValues.paymentMethod}
                      disabled={isCustomerRoutesUnavailable}
                      onChange={(event) => setPaymentFormValues((current) => ({ ...current, paymentMethod: event.target.value }))}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Detalle opcional"
                      value={paymentFormValues.notes}
                      disabled={isCustomerRoutesUnavailable}
                      onChange={(event) => setPaymentFormValues((current) => ({ ...current, notes: event.target.value }))}
                      maxLength={255}
                    />
                    {paymentError ? <p className="app-inline-error mb-0">{paymentError}</p> : null}
                    <button type="submit" className="btn btn-dark" disabled={isRegisteringPayment || Boolean(paymentError) || isCustomerRoutesUnavailable}>
                      {isRegisteringPayment ? 'Registrando...' : 'Registrar pago'}
                    </button>
                  </div>
                </form>

                <div className="mb-3">
                    <div className="customers-history-head mb-2">
                      <p className="customers-detail-label mb-0">Historial de ventas</p>
                      <div className="customers-history-actions">
                        <span className="customers-history-count">{activeAccountSales.length}</span>
                        {canExpandSales ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              if (visibleSalesCount >= activeAccountSales.length) {
                                setVisibleSalesCount(3);
                                return;
                              }
                              if (visibleSalesCount <= 3) {
                                setVisibleSalesCount(Math.min(6, activeAccountSales.length));
                                return;
                              }
                              setVisibleSalesCount(activeAccountSales.length);
                            }}
                          >
                            {resolveExpandLabel(visibleSalesCount, activeAccountSales.length, 3)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  {activeAccountSales.length ? (
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
                        <span className="customers-history-count">{activeAccountPayments.length}</span>
                        {canExpandPayments ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              if (visiblePaymentsCount >= activeAccountPayments.length) {
                                setVisiblePaymentsCount(3);
                                return;
                              }
                              if (visiblePaymentsCount <= 3) {
                                setVisiblePaymentsCount(Math.min(6, activeAccountPayments.length));
                                return;
                              }
                              setVisiblePaymentsCount(activeAccountPayments.length);
                            }}
                          >
                            {resolveExpandLabel(visiblePaymentsCount, activeAccountPayments.length, 3)}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  {activeAccountPayments.length ? (
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
