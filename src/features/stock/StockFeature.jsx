import { useEffect, useMemo, useRef, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { fetchProductsCatalog } from '../products/services/products.api';

const STOCK_REQUESTS_KEY = 'stock_simple_requests_v1';

function readRequests() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STOCK_REQUESTS_KEY);
    if (!rawValue) {
      return [];
    }
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (_error) {
    return [];
  }
}

function writeRequests(items) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STOCK_REQUESTS_KEY, JSON.stringify(items));
}

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

function StockFeature({ currentUser }) {
  const [productName, setProductName] = useState('');
  const [requests, setRequests] = useState(() => readRequests());
  const [draftItems, setDraftItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const requestIdRef = useRef(0);

  const userRole = String(currentUser?.role || 'operario').trim().toLowerCase();
  const isAdmin = userRole === 'admin';
  const requestedByLabel = String(currentUser?.name || currentUser?.username || 'Operario').trim() || 'Operario';

  useEffect(() => {
    function syncRequests() {
      setRequests(readRequests());
    }

    window.addEventListener('storage', syncRequests);
    return () => {
      window.removeEventListener('storage', syncRequests);
    };
  }, []);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((leftItem, rightItem) => {
      return new Date(rightItem.createdAt).getTime() - new Date(leftItem.createdAt).getTime();
    });
  }, [requests]);

  function handleResolveRequest(requestId) {
    const nextRequests = requests.filter((item) => item.id !== requestId);
    setRequests(nextRequests);
    writeRequests(nextRequests);
    toast.success('Pedido marcado como listo.', {
      toastId: `stock-request-done-${requestId}`,
      autoClose: 1500
    });
  }

  useEffect(() => {
    const normalizedQuery = String(productName || '').trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsSearching(true);

      try {
        const result = await fetchProductsCatalog({
          query: normalizedQuery,
          limit: 8
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setSearchResults(Array.isArray(result?.items) ? result.items : []);
        setSearchError('');
      } catch (_error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setSearchResults([]);
        setSearchError('No se pudo buscar productos.');
      } finally {
        if (requestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [productName]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draftItems.length) {
      return;
    }

    const nextRequests = [
      ...requests,
      {
        id: `stock-${Date.now()}`,
        items: draftItems,
        requestedBy: requestedByLabel,
        createdAt: new Date().toISOString()
      }
    ];

    setRequests(nextRequests);
    writeRequests(nextRequests);
    setDraftItems([]);
    toast.success('Pedido de stock enviado.', {
      toastId: `stock-request-ok-${Date.now()}`,
      autoClose: 1600
    });
  }

  function handleSelectSearchResult(item) {
    const normalizedProduct = String(item?.nombre || item?.name || '').trim();
    if (!normalizedProduct) {
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
    setSearchResults([]);
    setSearchError('');
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
                {sortedRequests.length ? (
                  <div>
                    {sortedRequests.map((item) => (
                      <div key={item.id} className="border rounded p-2 mb-2 bg-white">
                        <div><strong>Pedido</strong></div>
                        <div>
                          {Array.isArray(item.items) ? item.items.map((product, index) => (
                            <div key={`${item.id}-${index}`}>
                              {typeof product === 'string'
                                ? product
                                : `${product.name} x ${product.quantity}`}
                            </div>
                          )) : null}
                        </div>
                        <div>{item.requestedBy}</div>
                        <div>{formatCreatedAt(item.createdAt)}</div>
                        <div className="mt-2">
                          <button type="button" className="btn btn-sm btn-dark" onClick={() => handleResolveRequest(item.id)}>
                            Listo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mb-0">Todavía no hay pedidos de stock.</p>
                )}
              </div>
            ) : (
              <div>
                <h2 className="h5 mb-3">Pedir stock</h2>
                <form onSubmit={handleSubmit}>
                  <input
                    type="text"
                    className="form-control mb-2"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Escribí el producto"
                  />
                  {isSearching ? <div className="mb-2">Buscando...</div> : null}
                  {searchError ? <div className="mb-2">{searchError}</div> : null}
                  {searchResults.length ? (
                    <div className="border rounded mb-2 bg-white">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="btn w-100 text-start border-0 border-bottom rounded-0"
                          onClick={() => handleSelectSearchResult(item)}
                        >
                          {item.nombre || item.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button type="submit" className="btn btn-dark">Confirmar</button>
                </form>

                <div className="mt-3">
                  {draftItems.length ? (
                    <div className="stock-draft-panel">
                      <div className="stock-draft-panel-head">
                        <strong>Productos seleccionados</strong>
                        <span>{draftItems.length} item{draftItems.length === 1 ? '' : 's'}</span>
                      </div>
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
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default StockFeature;
