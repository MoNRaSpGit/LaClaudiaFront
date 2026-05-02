import { useEffect, useRef, useState } from 'react';
import { toUserErrorMessage } from '../../../shared/lib/userErrorMessages';
import { fetchProductsCatalog, updateProductsCatalogItem } from '../services/products.api';

const MIN_QUERY_LENGTH = 2;

function normalizeDraftFromItem(item) {
  return {
    nombre: String(item?.nombre || ''),
    precio_venta: String(item?.precio_venta ?? '')
  };
}

export function useProductsController({ currentUser, onUnauthorized }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [editDraft, setEditDraft] = useState({ nombre: '', precio_venta: '' });
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalizedQuery = String(searchTerm || '').trim();

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setItems([]);
      setError('');
      setIsLoading(false);
      setSelectedProductId(null);
      setEditDraft({ nombre: '', precio_venta: '' });
      setEditError('');
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);

      try {
        const result = await fetchProductsCatalog({
          query: normalizedQuery,
          limit: 20
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        const nextItems = Array.isArray(result?.items) ? result.items : [];
        setItems(nextItems);
        setError('');

        setSelectedProductId((currentSelectedId) => {
          const stillExists = nextItems.some((item) => Number(item.id) === Number(currentSelectedId));
          if (!stillExists) {
            setEditDraft({ nombre: '', precio_venta: '' });
            setEditError('');
            return null;
          }

          const selectedItem = nextItems.find((item) => Number(item.id) === Number(currentSelectedId));
          if (selectedItem) {
            setEditDraft(normalizeDraftFromItem(selectedItem));
          }
          return currentSelectedId;
        });
      } catch (fetchError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setItems([]);
        setError(toUserErrorMessage(fetchError, { context: 'scanner_lookup' }));
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  function selectProduct(product) {
    setSelectedProductId(Number(product?.id) || null);
    setEditDraft(normalizeDraftFromItem(product));
    setEditError('');
  }

  function closeProductEditor() {
    setSelectedProductId(null);
    setEditDraft({ nombre: '', precio_venta: '' });
    setEditError('');
  }

  function updateDraftField(field, value) {
    setEditDraft((current) => ({
      ...current,
      [field]: value
    }));
    setEditError('');
  }

  async function saveSelectedProduct() {
    const normalizedId = Number(selectedProductId);
    const normalizedName = String(editDraft.nombre || '').trim();
    const normalizedPrice = Number(editDraft.precio_venta);

    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      const message = 'Selecciona un producto para editar.';
      setEditError(message);
      throw new Error(message);
    }
    if (!normalizedName) {
      const message = 'El nombre es obligatorio.';
      setEditError(message);
      throw new Error(message);
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      const message = 'El precio debe ser mayor a 0.';
      setEditError(message);
      throw new Error(message);
    }

    setIsSaving(true);
    setEditError('');

    try {
      const result = await updateProductsCatalogItem(
        normalizedId,
        {
          nombre: normalizedName,
          precio_venta: Number(normalizedPrice.toFixed(2))
        },
        { token: currentUser?.sessionToken || '' }
      );

      const updatedItem = result?.item || null;
      if (updatedItem) {
        setItems((currentItems) => currentItems.map((item) => (
          Number(item.id) === normalizedId ? { ...item, ...updatedItem } : item
        )));
        setEditDraft(normalizeDraftFromItem(updatedItem));
      }

      return {
        ok: true,
        item: updatedItem
      };
    } catch (saveError) {
      if (Number(saveError?.status) === 401) {
        onUnauthorized?.();
      }
      const message = toUserErrorMessage(saveError, { context: 'scanner_lookup' });
      setEditError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedProduct = items.find((item) => Number(item.id) === Number(selectedProductId)) || null;

  return {
    searchTerm,
    setSearchTerm,
    items,
    isLoading,
    error,
    hasSearched: String(searchTerm || '').trim().length >= MIN_QUERY_LENGTH,
    selectedProduct,
    selectedProductId,
    selectProduct,
    closeProductEditor,
    editDraft,
    updateDraftField,
    saveSelectedProduct,
    editError,
    isSaving
  };
}
