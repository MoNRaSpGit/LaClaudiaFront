import { useCallback, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import ProductsSearchPanel from './components/ProductsSearchPanel';
import { useProductsController } from './model/useProductsController';

function ProductsFeature({ currentUser, onUnauthorized }) {
  const unauthorizedHandledRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (unauthorizedHandledRef.current) {
      return;
    }
    unauthorizedHandledRef.current = true;
    toast.warn('Sesion vencida. Inicia sesion nuevamente.', {
      toastId: 'products-session-expired',
      autoClose: 1700
    });
    window.setTimeout(() => {
      onUnauthorized?.();
    }, 900);
  }, [onUnauthorized]);

  useEffect(() => {
    unauthorizedHandledRef.current = false;
  }, [currentUser?.sessionToken]);

  const controller = useProductsController({
    currentUser,
    onUnauthorized: handleUnauthorized
  });

  async function handleSave(event) {
    event.preventDefault();
    try {
      await controller.saveSelectedProduct();
      controller.closeProductEditor();
      toast.success('Producto actualizado correctamente.', {
        toastId: `products-update-ok-${Date.now()}`,
        autoClose: 1800
      });
    } catch (_error) {
      return;
    }
  }

  return (
    <>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnFocusLoss={false} theme="light" />
      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-xl-10">
            <section className="panel-hero mb-4">
              <div>
                <p className="panel-hero-kicker mb-1">Admin</p>
                <h1 className="panel-hero-title mb-1">Productos</h1>
                <p className="panel-hero-subtitle mb-0">Consulta rapida del catalogo por nombre con foco en producto y precio.</p>
              </div>
              <div className="panel-status-pill">Catalogo</div>
            </section>

            <ProductsSearchPanel
              searchTerm={controller.searchTerm}
              onChangeSearchTerm={controller.setSearchTerm}
              items={controller.items}
              isLoading={controller.isLoading}
              error={controller.error}
              hasSearched={controller.hasSearched}
              selectedProductId={controller.selectedProductId}
              onSelectProduct={controller.selectProduct}
              onCloseEditor={controller.closeProductEditor}
              editDraft={controller.editDraft}
              onChangeDraftField={controller.updateDraftField}
              onSave={handleSave}
              editError={controller.editError}
              isSaving={controller.isSaving}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductsFeature;
