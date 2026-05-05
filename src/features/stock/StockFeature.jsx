import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import {
  createStockRequest,
  fetchStockRequests,
  fetchTopSellingProducts,
  resolveStockRequest
} from './services/stock.api';

function formatCreatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatBusinessDateLabel(value) {
  const rawValue = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [year, month, day] = rawValue.split('-').map((part) => Number(part));
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  return rawValue || 'hoy';
}

function normalizeItemName(value) {
  return String(value || '').trim();
}

function normalizeProviderName(value) {
  return String(value || '').trim();
}

function buildRequestedByLabel(currentUser) {
  return String(currentUser?.name || currentUser?.username || 'Operario').trim() || 'Operario';
}

function formatItemsLabel(count) {
  return `${count} producto${count === 1 ? '' : 's'}`;
}

function renderStockRequestItem(product) {
  if (typeof product === 'string') {
    return (
      <div className="stock-simple-line">
        <span className="stock-simple-line-name">{product}</span>
        <span className="stock-simple-line-qty">Cant 1</span>
      </div>
    );
  }

  return (
    <div className="stock-simple-line">
      <span className="stock-simple-line-name">{product.name}</span>
      <span className="stock-simple-line-qty">Cant {product.quantity}</span>
    </div>
  );
}

function StockFeature({ currentUser, onUnauthorized }) {
  const [providerName, setProviderName] = useState('');
  const [confirmedProviderName, setConfirmedProviderName] = useState('');
  const [productName, setProductName] = useState('');
  const [requests, setRequests] = useState([]);
  const [draftItems, setDraftItems] = useState([]);
  const [activeTab, setActiveTab] = useState('pedido');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isResolvingRequestId, setIsResolvingRequestId] = useState('');
  const [topSellingItems, setTopSellingItems] = useState([]);
  const [topSellingDateLabel, setTopSellingDateLabel] = useState('');
  const [isLoadingTopSelling, setIsLoadingTopSelling] = useState(false);
  const [topSellingError, setTopSellingError] = useState('');
  const productInputRef = useRef(null);

  const userRole = String(currentUser?.role || 'operario').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const requestedByLabel = buildRequestedByLabel(currentUser);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((leftItem, rightItem) => {
      return new Date(rightItem.createdAt).getTime() - new Date(leftItem.createdAt).getTime();
    });
  }, [requests]);

  const repartoRequests = useMemo(() => {
    return isAdmin
      ? []
      : sortedRequests.filter((item) => String(item.requestedBy || '').trim().toLowerCase() === requestedByLabel.toLowerCase());
  }, [isAdmin, requestedByLabel, sortedRequests]);

  useEffect(() => {
    if (!currentUser?.sessionToken) {
      setRequests([]);
      setRequestsError('');
      setIsLoadingRequests(false);
      return undefined;
    }

    let isMounted = true;

    async function loadRequests() {
      setIsLoadingRequests(true);
      try {
        const result = await fetchStockRequests({
          token: currentUser?.sessionToken || ''
        });

        if (!isMounted) {
          return;
        }

        setRequests(Array.isArray(result?.requests) ? result.requests : []);
        setRequestsError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (Number(error?.status) === 401) {
          onUnauthorized?.();
          setRequestsError('Sesion expirada. Inicia sesion nuevamente.');
        } else {
          setRequestsError('No se pudieron cargar los pedidos de stock.');
        }
        setRequests([]);
      } finally {
        if (isMounted) {
          setIsLoadingRequests(false);
        }
      }
    }

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.sessionToken, onUnauthorized]);

  useEffect(() => {
    if (!currentUser?.sessionToken) {
      setTopSellingItems([]);
      setTopSellingDateLabel('');
      setTopSellingError('');
      setIsLoadingTopSelling(false);
      return undefined;
    }

    let isMounted = true;

    async function loadTopSelling() {
      setIsLoadingTopSelling(true);
      try {
        const result = await fetchTopSellingProducts({ rankingLimit: 8 }, {
          token: currentUser?.sessionToken || ''
        });

        if (!isMounted) {
          return;
        }

        const rankingItems = Array.isArray(result?.ranking) ? result.ranking : [];
        setTopSellingItems(rankingItems);
        setTopSellingDateLabel(String(result?.date || '').trim());
        setTopSellingError('');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (Number(error?.status) === 401) {
          onUnauthorized?.();
          setTopSellingError('Sesion expirada. Inicia sesion nuevamente.');
        } else if (Number(error?.status) === 403) {
          setTopSellingError('Tu usuario no puede ver el ranking de vendidos.');
        } else {
          setTopSellingError('No se pudo cargar la lista de mas vendidos.');
        }
        setTopSellingItems([]);
      } finally {
        if (isMounted) {
          setIsLoadingTopSelling(false);
        }
      }
    }

    loadTopSelling();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.sessionToken, onUnauthorized]);

  async function handleResolveRequest(requestId) {
    if (!requestId || !currentUser?.sessionToken || isResolvingRequestId) {
      return;
    }

    setIsResolvingRequestId(String(requestId));
    try {
      await resolveStockRequest(requestId, {
        token: currentUser?.sessionToken || ''
      });

      setRequests((current) => current.filter((item) => String(item.requestId || item.id) !== String(requestId)));
      toast.success('Pedido borrado de reparto.', {
        toastId: `stock-request-done-${requestId}`,
        autoClose: 1500
      });
    } catch (error) {
      if (Number(error?.status) === 401) {
        onUnauthorized?.();
      }
      toast.error(error?.message || 'No se pudo cerrar el pedido.', {
        toastId: `stock-request-done-error-${requestId}`,
        autoClose: 1800
      });
    } finally {
      setIsResolvingRequestId('');
    }
  }

  function handleAddDraftItem() {
    if (!confirmedProviderName) {
      toast.error('Confirma el proveedor antes de agregar productos.', {
        toastId: 'stock-provider-confirm-required',
        autoClose: 1800
      });
      return;
    }

    const normalizedProduct = normalizeItemName(productName);
    if (!normalizedProduct) {
      productInputRef.current?.focus();
      return;
    }

    setDraftItems((current) => {
      const existingItem = current.find((entry) => entry.name.toLowerCase() === normalizedProduct.toLowerCase());
      if (existingItem) {
        return current.map((entry) => (
          entry.name.toLowerCase() === normalizedProduct.toLowerCase()
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        ));
      }

      return [...current, { name: normalizedProduct, quantity: 1 }];
    });

    setProductName('');
    window.requestAnimationFrame(() => {
      productInputRef.current?.focus();
      productInputRef.current?.select();
    });
  }

  function handleConfirmProvider() {
    const normalizedProvider = normalizeProviderName(providerName);
    if (!normalizedProvider) {
      return;
    }

    setConfirmedProviderName(normalizedProvider);
    setProviderName('');
    window.requestAnimationFrame(() => {
      productInputRef.current?.focus();
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmittingRequest) {
      return;
    }

    if (!confirmedProviderName) {
      toast.error('Escribi el proveedor antes de guardar el pedido.', {
        toastId: 'stock-provider-required',
        autoClose: 1800
      });
      return;
    }

    if (!draftItems.length) {
      toast.error('Agrega al menos un producto al pedido.', {
        toastId: 'stock-items-required',
        autoClose: 1800
      });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const result = await createStockRequest({
        provider: confirmedProviderName,
        items: draftItems
      }, {
        token: currentUser?.sessionToken || ''
      });

      const createdRequest = result?.request;
      if (createdRequest) {
        setRequests((current) => [createdRequest, ...current]);
      }
      setDraftItems([]);
      setProviderName('');
      setConfirmedProviderName('');
      setProductName('');
      setActiveTab('reparto');
      toast.success('Pedido de stock guardado en Reparto.', {
        toastId: `stock-request-ok-${Date.now()}`,
        autoClose: 1600
      });
    } catch (error) {
      if (Number(error?.status) === 401) {
        onUnauthorized?.();
      }
      toast.error(error?.message || 'No se pudo guardar el pedido.', {
        toastId: 'stock-request-save-error',
        autoClose: 1800
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  function updateDraftItemQuantity(itemName, delta) {
    if (!itemName || !Number.isFinite(delta) || delta === 0) {
      return;
    }

    setDraftItems((current) => current
      .map((item) => (
        item.name === itemName
          ? { ...item, quantity: Math.max(0, Number(item.quantity || 0) + delta) }
          : item
      ))
      .filter((item) => item.quantity > 0));
  }

  function handleProductInputKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleAddDraftItem();
  }

  function handleProviderInputKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleConfirmProvider();
  }

  const topSellingDateCopy = formatBusinessDateLabel(topSellingDateLabel);

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-8">
            <h1 className="mb-3">Stock</h1>

            {isAdmin ? (
              <div>
                <h2 className="h5 mb-3">Pedidos recibidos</h2>
                {isLoadingRequests ? (
                  <div className="border rounded p-3 bg-white">
                    <strong>Cargando pedidos...</strong>
                    <p className="mb-0">Estamos trayendo los pedidos realizados por operarios.</p>
                  </div>
                ) : null}
                {!isLoadingRequests && requestsError ? (
                  <div className="border rounded p-3 bg-white">
                    <strong>No pudimos cargar stock.</strong>
                    <p className="mb-0">{requestsError}</p>
                  </div>
                ) : null}
                {!isLoadingRequests && !requestsError && sortedRequests.length ? (
                  <div>
                    {sortedRequests.map((item) => (
                      <div key={item.id} className="border rounded p-3 mb-2 bg-white">
                        <div className="mb-2"><strong>Proveedor:</strong> {item.provider || 'Sin proveedor'}</div>
                        <div className="mb-2">
                          <strong>Pidio:</strong> {item.requestedBy}
                        </div>
                        <div className="mb-2">
                          <strong>Fecha:</strong> {formatCreatedAt(item.createdAt)}
                        </div>
                        <div className="mb-2"><strong>Productos pedidos:</strong></div>
                        <div>
                          {Array.isArray(item.items) ? item.items.map((product, index) => (
                            <div key={`${item.id}-${index}`} className="border rounded px-3 py-2 mb-2 bg-light">
                              {renderStockRequestItem(product)}
                            </div>
                          )) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!isLoadingRequests && !requestsError && !sortedRequests.length ? (
                  <div className="border rounded p-3 bg-white">
                    <strong>Sin pedidos por ahora.</strong>
                    <p className="mb-0">Cuando un operario arme un pedido manual, aparece aca.</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="d-flex gap-2 mb-3 flex-wrap">
                  <button
                    type="button"
                    className={`btn ${activeTab === 'pedido' ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setActiveTab('pedido')}
                  >
                    Pedido
                  </button>
                  <button
                    type="button"
                    className={`btn ${activeTab === 'reparto' ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setActiveTab('reparto')}
                  >
                    Reparto
                    {repartoRequests.length ? <span className="stock-tab-count">{repartoRequests.length}</span> : null}
                  </button>
                  <button
                    type="button"
                    className={`btn ${activeTab === 'vendidos' ? 'btn-dark' : 'btn-outline-dark'}`}
                    onClick={() => setActiveTab('vendidos')}
                  >
                    +Vendidos
                  </button>
                </div>

                {activeTab === 'pedido' ? (
                  <div className="row g-3">
                    <div className="col-lg-7">
                      <div className="border rounded p-3 bg-white">
                        <h2 className="h5 mb-3">Armar pedido manual</h2>
                      <form onSubmit={handleSubmit}>
                          <label className="form-label" htmlFor="stock-provider-input">Proveedor</label>
                          <div className="d-flex gap-2 mb-2 flex-column flex-sm-row">
                              <input
                                id="stock-provider-input"
                                type="text"
                                className="form-control"
                                value={providerName}
                                onChange={(event) => setProviderName(event.target.value)}
                                onKeyDown={handleProviderInputKeyDown}
                                placeholder="Ej: Coca Cola"
                              />
                              <button type="button" className="btn btn-outline-dark" onClick={handleConfirmProvider}>
                                Agregar
                              </button>
                          </div>
                          {confirmedProviderName ? (
                            <div className="mb-3"><strong>Proveedor confirmado:</strong> {confirmedProviderName}</div>
                          ) : (
                            <div className="mb-3 text-muted">Confirma el proveedor antes de cargar productos.</div>
                          )}

                          <label className="form-label" htmlFor="stock-product-input">Producto faltante</label>
                          <div className="d-flex gap-2 mb-2 flex-column flex-sm-row">
                              <input
                                ref={productInputRef}
                                id="stock-product-input"
                                type="text"
                                className="form-control"
                                value={productName}
                                onChange={(event) => setProductName(event.target.value)}
                                onKeyDown={handleProductInputKeyDown}
                                placeholder="Escribi el nombre del producto"
                              />
                              <button type="button" className="btn btn-outline-dark" onClick={handleAddDraftItem}>
                                Agregar
                              </button>
                          </div>
                          <div className="mb-3 text-muted">Tip: apreta `Enter` y el foco vuelve solo para seguir cargando.</div>

                          <button type="submit" className="btn btn-dark" disabled={isSubmittingRequest}>
                            {isSubmittingRequest ? 'Guardando...' : 'Guardar pedido'}
                          </button>
                      </form>
                    </div>
                    </div>

                    <div className="col-lg-5">
                      {draftItems.length ? (
                        <div className="stock-draft-panel">
                          <div className="stock-draft-panel-head">
                            <strong>Resumen del pedido</strong>
                            <span>{formatItemsLabel(draftItems.length)}</span>
                          </div>
                          {confirmedProviderName ? (
                            <div className="stock-summary-provider">
                              <span>Proveedor</span>
                              <strong>{confirmedProviderName}</strong>
                            </div>
                          ) : null}
                          <div className="stock-draft-list">
                            {draftItems.map((item) => (
                              <div key={item.name} className="stock-draft-item">
                                <div className="stock-draft-copy">
                                  <strong>{item.name}</strong>
                                  <small>Cantidad a pedir</small>
                                </div>
                                <div className="stock-request-qty-controls">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary stock-qty-btn"
                                    onClick={() => updateDraftItemQuantity(item.name, -1)}
                                  >
                                    -
                                  </button>
                                  <strong className="stock-request-qty-value">{item.quantity}</strong>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary stock-qty-btn"
                                    onClick={() => updateDraftItemQuantity(item.name, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="border rounded p-3 bg-white text-muted">
                          <strong>Pedido vacio.</strong>
                          <p className="mb-0">Confirma proveedor y agrega productos para ver el resumen aca.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeTab === 'reparto' ? (
                  <div>
                    <h2 className="h5 mb-3">Reparto</h2>
                    {isLoadingRequests ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>Cargando reparto...</strong>
                        <p className="mb-0">Estamos trayendo tus pedidos guardados.</p>
                      </div>
                    ) : null}
                    {!isLoadingRequests && requestsError ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>No pudimos cargar reparto.</strong>
                        <p className="mb-0">{requestsError}</p>
                      </div>
                    ) : null}
                    {!isLoadingRequests && !requestsError && repartoRequests.length ? (
                      <div>
                        {repartoRequests.map((item) => (
                          <div key={item.id} className="border rounded p-3 mb-2 bg-white">
                            <div className="mb-2"><strong>Proveedor:</strong> {item.provider || 'Sin proveedor'}</div>
                            <div className="mb-2"><strong>Guardado:</strong> {formatCreatedAt(item.createdAt)}</div>
                            <div className="mb-2"><strong>Productos:</strong></div>
                            <div className="mb-3">
                              {Array.isArray(item.items) ? item.items.map((product, index) => (
                                <div key={`${item.id}-${index}`} className="border rounded px-3 py-2 mb-2 bg-light">
                                  {renderStockRequestItem(product)}
                                </div>
                              )) : null}
                            </div>
                            <button
                              type="button"
                              className="btn btn-dark"
                              onClick={() => handleResolveRequest(item.requestId)}
                              disabled={isResolvingRequestId === String(item.requestId)}
                            >
                              {isResolvingRequestId === String(item.requestId) ? 'Confirmando...' : 'Confirmar llegada'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!isLoadingRequests && !requestsError && !repartoRequests.length ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>No hay reparto pendiente.</strong>
                        <p className="mb-0">Cuando guardes un pedido nuevo, aparece aca automaticamente.</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <h2 className="h5 mb-2">+Vendidos</h2>
                    <p className="text-muted">Ranking del dia {topSellingDateCopy} para ayudarte a decidir que reponer primero.</p>

                    {isLoadingTopSelling ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>Cargando ranking...</strong>
                        <p className="mb-0">Estamos trayendo los productos mas vendidos del dia.</p>
                      </div>
                    ) : null}

                    {!isLoadingTopSelling && topSellingError ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>No pudimos mostrar +Vendidos.</strong>
                        <p className="mb-0">{topSellingError}</p>
                      </div>
                    ) : null}

                    {!isLoadingTopSelling && !topSellingError && topSellingItems.length ? (
                      <div className="stock-top-selling-list">
                        {topSellingItems.map((item, index) => (
                          <div key={`${item?.key || item?.name || 'ranking'}-${index}`} className="stock-top-selling-row">
                            <div className="stock-top-selling-head">
                              <div className="stock-top-selling-rank">#{index + 1}</div>
                              <div className="stock-top-selling-copy">
                                <strong>{item?.name || 'Producto'}</strong>
                                <span>{Number(item?.qty || 0)} vendidas hoy</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!isLoadingTopSelling && !topSellingError && !topSellingItems.length ? (
                      <div className="border rounded p-3 bg-white">
                        <strong>Sin ranking disponible.</strong>
                        <p className="mb-0">Aca van a aparecer los productos mas vendidos cuando entren ventas del dia.</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default StockFeature;
