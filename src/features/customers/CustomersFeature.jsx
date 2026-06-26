import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { createCustomer, createCustomerPayment, getCustomerDetail, listCustomers } from './services/customers.api';

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

function parsePositiveAmount(value) {
  const normalized = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

function CustomersFeature({ currentUser, onUnauthorized }) {
  const token = String(currentUser?.sessionToken || '').trim();
  const onUnauthorizedRef = useRef(onUnauthorized);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
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

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const loadCustomers = useCallback(async ({ keepSelection = true } = {}) => {
    const nextCustomers = await listCustomers({ token });
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
          setSelectedCustomerDetail(detail);
        }
      } catch (error) {
        if (Number(error?.status || 0) === 401) {
          onUnauthorizedRef.current?.();
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
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCustomer(formValues, { token });
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
      toast.error(error?.message || 'No se pudo crear el cliente.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegisterPayment(event) {
    event.preventDefault();
    if (!selectedCustomerId || isRegisteringPayment) {
      return;
    }

    const parsedAmount = parsePositiveAmount(paymentFormValues.amount);
    const debtTotal = parseMoneyValue(selectedCustomerDetail?.customer?.debtTotal);

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
    } catch (error) {
      if (Number(error?.status || 0) === 401) {
        onUnauthorizedRef.current?.();
        return;
      }
      toast.error(error?.message || 'No se pudo registrar el pago.');
    } finally {
      setDetailLoading(false);
      setIsRegisteringPayment(false);
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
  const visibleSales = accountSales.slice(0, visibleSalesCount);
  const visiblePayments = accountPayments.slice(0, visiblePaymentsCount);
  const canExpandSales = accountSales.length > 3;
  const canExpandPayments = accountPayments.length > 3;

  return (
    <div className="container py-4">
      <div className="row g-4">
        <div className="col-lg-4">
          <section className="customers-card h-100">
            <p className="customers-kicker mb-2">Clientes</p>
            <h2 className="h4 mb-3">Alta rapida</h2>
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
                />
              </div>
              <button type="submit" className="btn btn-dark" disabled={isSaving || !token}>
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
            ) : customers.length === 0 ? (
              <p className="text-muted mb-0">Todavia no hay clientes cargados.</p>
            ) : (
              <div className="customers-list">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className={`customers-list-item ${selectedCustomerId === customer.id ? 'customers-list-item-active' : ''}`}
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <span className="customers-list-name">{customer.name}</span>
                    <span className="customers-list-meta">
                      Deuda {formatMoney(customer.debtTotal)}
                    </span>
                  </button>
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
                      onChange={(event) => setPaymentFormValues((current) => ({ ...current, notes: event.target.value }))}
                      maxLength={255}
                    />
                    {paymentError ? <p className="app-inline-error mb-0">{paymentError}</p> : null}
                    <button type="submit" className="btn btn-dark" disabled={isRegisteringPayment || Boolean(paymentError)}>
                      {isRegisteringPayment ? 'Registrando...' : 'Registrar pago'}
                    </button>
                  </div>
                </form>

                <div className="mb-3">
                  <div className="customers-history-head mb-2">
                    <p className="customers-detail-label mb-0">Historial de ventas</p>
                    <div className="customers-history-actions">
                      <span className="customers-history-count">{accountSales.length}</span>
                      {canExpandSales ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            if (visibleSalesCount >= accountSales.length) {
                              setVisibleSalesCount(3);
                              return;
                            }
                            if (visibleSalesCount <= 3) {
                              setVisibleSalesCount(Math.min(6, accountSales.length));
                              return;
                            }
                            setVisibleSalesCount(accountSales.length);
                          }}
                        >
                          {resolveExpandLabel(visibleSalesCount, accountSales.length, 3)}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {accountSales.length ? (
                    <div className="customers-sales-list">
                      {visibleSales.map((sale) => (
                        <div key={sale.id} className="customers-sale-row">
                          <div>
                            <strong>{formatMoney(sale.totalAmount)}</strong>
                            <div className="customers-sale-meta">{sale.itemsCount} items</div>
                          </div>
                          <span className="customers-sale-meta">{formatDateTime(sale.createdAt)}</span>
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
                          <div>
                            <strong>{formatMoney(payment.amount)}</strong>
                            <div className="customers-sale-meta">
                              {payment.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}
                              {payment.notes ? ` - ${payment.notes}` : ''}
                            </div>
                          </div>
                          <span className="customers-sale-meta">{formatDateTime(payment.createdAt)}</span>
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
  );
}

export default CustomersFeature;
