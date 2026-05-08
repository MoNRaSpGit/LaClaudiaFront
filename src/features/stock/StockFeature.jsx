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

function buildEditableDraftItems(items) {
  return items.map((item, index) => ({
    id: `${item.name}-${index}-${Date.now()}`,
    name: String(item.name || ''),
    quantity: Math.max(1, Number(item.quantity || 1))
  }));
}

function normalizeEditedDraftItems(items) {
  const merged = new Map();

  items.forEach((item) => {
    const normalizedName = normalizeItemName(item?.name);
    const normalizedQuantity = Math.max(1, Number(item?.quantity || 1));

    if (!normalizedName) {
      return;
    }

    const key = normalizedName.toLowerCase();
    const current = merged.get(key);
    if (current) {
      current.quantity += normalizedQuantity;
      return;
    }

    merged.set(key, {
      name: normalizedName,
      quantity: normalizedQuantity
    });
  });

  return Array.from(merged.values());
}

function DraftEditorModal({
  providerValue,
  items,
  onProviderChange,
  onItemChange,
  onItemQuantityChange,
  onItemRemove,
  onAddItem,
  onClose,
  onSave
}) {
  return (
    <div className="stock-editor-overlay" role="dialog" aria-modal="true" aria-label="Editar pedido">
      <div className="stock-editor-card">
        <div className="stock-editor-head">
          <div>
            <h3 className="h5 mb-1">Editar pedido</h3>
            <p className="mb-0 text-muted">Corrige proveedor, nombres o cantidades sin tocar la pantalla principal.</p>
          </div>
          <button type="button" className="stock-remove-icon-btn stock-editor-close-btn" onClick={onClose} aria-label="Cerrar editor">
            x
          </button>
        </div>

        <div className="stock-editor-section">
          <label className="form-label" htmlFor="stock-editor-provider">Proveedor</label>
          <input
            id="stock-editor-provider"
            type="text"
            className="form-control"
            value={providerValue}
            onChange={(event) => onProviderChange(event.target.value)}
            placeholder="Nombre del proveedor"
          />
        </div>

        <div className="stock-editor-section">
          <div className="stock-editor-list-head">
            <strong>Productos</strong>
            <button type="button" className="btn btn-outline-dark btn-sm" onClick={onAddItem}>
              Agregar fila
            </button>
          </div>
          <div className="stock-editor-list">
            {items.length ? (
              items.map((item) => (
                <div key={item.id} className="stock-editor-item">
                  <input
                    type="text"
                    className="form-control"
                    value={item.name}
                    onChange={(event) => onItemChange(item.id, event.target.value)}
                    placeholder="Nombre del producto"
                  />
                  <div className="stock-request-qty-controls">
                    <button
                      type="button"
                      className="btn btn-outline-secondary stock-qty-btn"
                      onClick={() => onItemQuantityChange(item.id, -1)}
                    >
                      -
                    </button>
                    <strong className="stock-request-qty-value">{item.quantity}</strong>
                    <button
                      type="button"
                      className="btn btn-outline-secondary stock-qty-btn"
                      onClick={() => onItemQuantityChange(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="stock-remove-icon-btn"
                    onClick={() => onItemRemove(item.id)}
                    aria-label={`Eliminar ${item.name || 'producto'}`}
                  >
                    x
                  </button>
                </div>
              ))
            ) : (
              <div className="stock-empty-state">
                <strong>Sin productos en edicion.</strong>
                <p className="mb-0">Agrega una fila o vuelve al formulario para seguir armando el pedido.</p>
              </div>
            )}
          </div>
        </div>

        <div className="stock-editor-footer">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-dark" onClick={onSave}>
            Guardar cambios
          </button>
        </div>
      </div>
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProviderName, setEditProviderName] = useState('');
  const [editItemsDraft, setEditItemsDraft] = useState([]);
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

  const summaryItemsPreview = useMemo(() => draftItems.slice(0, 4), [draftItems]);
  const remainingPreviewCount = Math.max(0, draftItems.length - summaryItemsPreview.length);
  const hasDraftSummary = Boolean(confirmedProviderName || draftItems.length);

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

  function handleOpenEditModal() {
    setEditProviderName(confirmedProviderName);
    setEditItemsDraft(buildEditableDraftItems(draftItems));
    setIsEditModalOpen(true);
  }

  function handleCloseEditModal() {
    setIsEditModalOpen(false);
    setEditProviderName('');
    setEditItemsDraft([]);
  }

  function handleEditItemChange(itemId, nextName) {
    setEditItemsDraft((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, name: nextName }
        : item
    )));
  }

  function handleEditItemQuantityChange(itemId, delta) {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }

    setEditItemsDraft((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }
        : item
    )));
  }

  function handleRemoveEditedItem(itemId) {
    setEditItemsDraft((current) => current.filter((item) => item.id !== itemId));
  }

  function handleAddEditedItem() {
    setEditItemsDraft((current) => [
      ...current,
      {
        id: `draft-edit-${Date.now()}-${current.length}`,
        name: '',
        quantity: 1
      }
    ]);
  }

  function handleSaveEditModal() {
    const normalizedProvider = normalizeProviderName(editProviderName);
    const normalizedItems = normalizeEditedDraftItems(editItemsDraft);

    if (!normalizedProvider) {
      toast.error('Escribi el proveedor del pedido.', {
        toastId: 'stock-edit-provider-required',
        autoClose: 1800
      });
      return;
    }

    if (!normalizedItems.length) {
      toast.error('El pedido tiene que tener al menos un producto.', {
        toastId: 'stock-edit-items-required',
        autoClose: 1800
      });
      return;
    }

    setConfirmedProviderName(normalizedProvider);
    setDraftItems(normalizedItems);
    handleCloseEditModal();
  }

  function handleClearDraft() {
    setDraftItems([]);
    setConfirmedProviderName('');
    setProviderName('');
    setProductName('');
    handleCloseEditModal();
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
      handleCloseEditModal();
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
                  <div className="stock-compose-grid">
                    <div className="stock-compose-card stock-compose-entry">
                      <div className="stock-compose-head">
                        <div>
                          <h2 className="h5 mb-1">Armar pedido</h2>
                          <p className="mb-0 text-muted">Carga proveedor y productos con foco en rapidez.</p>
                        </div>
                        <span className="stock-badge-pill">Carga</span>
                      </div>

                      <form onSubmit={handleSubmit} className="stock-compose-form">
                        <div className="stock-compose-block">
                          <label className="form-label" htmlFor="stock-provider-input">Proveedor</label>
                          <div className="stock-compose-inline">
                            <input
                              id="stock-provider-input"
                              type="text"
                              className="form-control"
                              value={providerName}
                              onChange={(event) => setProviderName(event.target.value)}
                              onKeyDown={handleProviderInputKeyDown}
                              placeholder="Ej: Coca Cola"
                            />
                            <button type="button" className="btn btn-outline-dark stock-inline-btn" onClick={handleConfirmProvider}>
                              Confirmar
                            </button>
                          </div>
                          {confirmedProviderName ? (
                            <div className="stock-confirm-chip">
                              <span className="stock-confirm-chip-label">Proveedor activo</span>
                              <strong>{confirmedProviderName}</strong>
                            </div>
                          ) : (
                            <p className="stock-step-hint mb-0">Primero confirma el proveedor para habilitar la carga de productos.</p>
                          )}
                        </div>

                        <div className="stock-compose-block">
                          <label className="form-label" htmlFor="stock-product-input">Producto faltante</label>
                          <div className="stock-compose-inline">
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
                            <button type="button" className="btn btn-outline-dark stock-inline-btn" onClick={handleAddDraftItem}>
                              Agregar
                            </button>
                          </div>
                          <p className="stock-step-hint mb-0">Enter agrega el producto y deja el foco listo para seguir cargando.</p>
                        </div>

                        <div className="stock-save-row">
                          <button type="submit" className="btn btn-dark stock-save-btn" disabled={isSubmittingRequest}>
                            {isSubmittingRequest ? 'Guardando...' : 'Guardar pedido'}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="stock-compose-card stock-compose-summary">
                      <div className="stock-compose-head">
                        <div>
                          <h2 className="h5 mb-1">Resumen del pedido</h2>
                          <p className="mb-0 text-muted">Vista limpia. La edicion vive en un modal para no ensuciar esta pantalla.</p>
                        </div>
                        {hasDraftSummary ? <span className="stock-badge-pill">{formatItemsLabel(draftItems.length)}</span> : null}
                      </div>

                      {hasDraftSummary ? (
                        <>
                          <div className="stock-summary-hero">
                            <div className="stock-summary-kpi">
                              <span>Proveedor</span>
                              <strong>{confirmedProviderName || 'Sin confirmar'}</strong>
                            </div>
                            <div className="stock-summary-kpi">
                              <span>Items cargados</span>
                              <strong>{draftItems.length}</strong>
                            </div>
                          </div>

                          <div className="stock-summary-preview">
                            {summaryItemsPreview.map((item) => (
                              <div key={item.name} className="stock-summary-preview-row">
                                <span>{item.name}</span>
                                <strong>x{item.quantity}</strong>
                              </div>
                            ))}
                            {remainingPreviewCount ? (
                              <div className="stock-summary-preview-more">
                                +{remainingPreviewCount} producto{remainingPreviewCount === 1 ? '' : 's'} mas
                              </div>
                            ) : null}
                          </div>

                          <div className="stock-summary-actions">
                            <button type="button" className="btn btn-outline-dark stock-summary-edit-btn" onClick={handleOpenEditModal}>
                              Editar pedido
                            </button>
                            <button type="button" className="stock-text-action-btn" onClick={handleClearDraft}>
                              Vaciar todo
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="stock-empty-state stock-summary-empty">
                          <strong>El resumen aparece aca.</strong>
                          <p className="mb-0">Cuando confirmes proveedor y agregues productos, vas a ver una vista compacta del pedido y un boton unico para editarlo.</p>
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

      {isEditModalOpen ? (
        <DraftEditorModal
          providerValue={editProviderName}
          items={editItemsDraft}
          onProviderChange={setEditProviderName}
          onItemChange={handleEditItemChange}
          onItemQuantityChange={handleEditItemQuantityChange}
          onItemRemove={handleRemoveEditedItem}
          onAddItem={handleAddEditedItem}
          onClose={handleCloseEditModal}
          onSave={handleSaveEditModal}
        />
      ) : null}
    </>
  );
}

export default StockFeature;
