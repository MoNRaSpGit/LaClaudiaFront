# Arquitectura Frontend

## Patron

- Feature folders por dominio.
- Estado global con Redux Toolkit.
- Capas de frontend separadas por feature:
  - `components`: UI.
  - `model`: casos de uso/controladores.
  - `services`: acceso API.
- Utilidades transversales en `src/shared/*`.

## Estructura actual

- `src/features/auth`: boot + login conectado a backend.
- `src/features/scanner`: flujo scanner completo.
- `src/features/panelControl`: caja, movimientos, ranking y pagos (desde backend).
- `src/shared/lib`: utilidades reutilizables.
- `src/shared/services`: cliente HTTP base + servicios transversales.
- `src/app/store.js`: composicion de slices (scanner).

### Scanner feature

- `ScannerFeature.jsx`: compose UI principal.
- `model/useScannerController.js`: controlador de casos de uso.
- `services/scanner.api.js`: acceso HTTP al backend.
- `scannerSlice.js`: estado de scanner y ticket.
- `components/*`: UI desacoplada.

### Auth feature

- `AuthGate.jsx`: gate de entrada antes del workspace.
- `model/useAuthGateController.js`: estado de boot/login y recordar credenciales.
- `services/authShell.api.js`: boot + login/logout real del feature.
- `components/*`: pantallas de carga y login.

### Panel Control feature

- `PanelControlFeature.jsx`: contenedor/compose principal.
- `model/usePanelControlController.js`: estado y casos de uso de panel.
- `model/panelControl.formatters.js`: formateadores de dominio UI.
- `services/panelControl.api.js`: acceso API propio del feature.
- `components/*`: bloques UI desacoplados (metricas, movimientos, ranking, pagos, modal).

## Boundary API por feature

- `auth` consume su API local (`authShell.api.js`).
- `panelControl` consume su API local (`panelControl.api.js`).
- `scanner` consume su API local (`scanner.api.js`).
- `shared/services/httpClient.js` concentra solo primitives HTTP (`apiUrl`, headers y parseo JSON).

## Comportamiento operativo (UX de caja)

- El input `Escanear aqui` mantiene foco automatico para operar sin mouse:
  - al entrar al scanner.
  - al cerrar modal manual.
  - al guardar/cerrar edicion.
  - al quitar unidad.
  - al cobrar.

## Flujo principal

1. Arranque de app con boot screen para disimular spin-up del backend.
2. Login real (usuario + clave) contra backend.
3. Entrada a workspace (`Scanner`/`Panel Control`).
4. Ingreso/escaneo de barcode.
5. Lookup por barcode (`/api/scanner/products/lookup`).
6. Si existe, se agrega al ticket con acumulacion de cantidad.
7. `Cobrar` confirma la venta en backend.
8. Panel recibe metricas/movimientos/ranking en tiempo real por SSE.
9. Registro de pagos en backend.

## Integracion backend actual

- `POST /api/auth/login` para autenticacion.
- `POST /api/auth/logout` para cierre de sesion.
- `POST /api/scanner/sales` para confirmar ventas.
- `POST /api/scanner/payments` para pagos.
- `PUT /api/scanner/products/:id` para persistir edicion de catalogo desde scanner.
- `GET /api/scanner/dashboard` para metricas, movimientos y ranking.
- `GET /api/scanner/dashboard/stream` para updates en tiempo real (SSE).

## Fuente de verdad de tiempo

- El backend entrega timestamps normalizados en ISO UTC (`...Z`) para eventos y movimientos.
- El frontend no infiere zona del servidor: renderiza todo en `America/Montevideo` (`UTC-03:00`).
- Regla operativa: cualquier fecha/hora de UI debe pasar por `panelControl.formatters` para evitar desfasajes.

## Calidad y pruebas

- Tests unitarios con Vitest:
  - `scannerSlice` (carrito y totales).
  - utilidades compartidas (`shared/lib/number`).
