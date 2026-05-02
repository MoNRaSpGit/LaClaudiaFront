# Arquitectura Frontend

## Patron

- Feature folders por dominio.
- Estado global con Redux Toolkit.
- Capas de frontend separadas por feature:
  - `components`: UI.
  - `model`: casos de uso/controladores.
  - `services`: acceso API.
- Utilidades transversales en `src/shared/*`.

## Modo de trabajo del proyecto

- Organizacion por capas y por dominio (estilo MVC adaptado a frontend/backend moderno):
  - cada feature contiene su UI (`components`), logica de casos de uso (`model`) y acceso a datos (`services`).
- Carpetas separadas por contexto funcional:
  - `auth`, `scanner`, `panelControl`.
  - `payments`.
  - `products`.
- Boundary por modulo:
  - cada feature consume su propia capa `services`.
  - `shared` solo contiene utilidades/comunes, no reglas de negocio acopladas.
- Escalabilidad operativa:
  - evitar mega-componentes y mezclar capas en un solo archivo.
  - todo cambio nuevo entra en su feature correspondiente.
  - mantener contratos estables entre frontend y backend.
- Objetivo de mantenibilidad:
  - codigo legible para onboarding rapido.
  - cambios incrementales sin sobre-ingenieria.

## Estructura actual

- `src/features/auth`: boot + login conectado a backend.
- `src/features/scanner`: flujo scanner completo.
- `src/features/panelControl`: caja, movimientos, ranking y pagos (desde backend).
- `src/features/payments`: pagina operativa de pagos para rol `operario`.
- `src/features/products`: consulta admin de catalogo por nombre.
- `src/shared/lib`: utilidades reutilizables.
- `src/shared/services`: cliente HTTP base + servicios transversales.
- `src/app/store.js`: composicion de slices (scanner).

### Scanner feature

- `ScannerFeature.jsx`: compose UI principal.
- `model/useScannerController.js`: controlador de casos de uso.
- `services/scanner.api.js`: acceso HTTP al backend.
- `services/scanner.qzPrint.js`: impresion termica RAW (`ESC/POS`) via QZ Tray.
- `services/scanner.print.js`: fallback de impresion por navegador (`window.print`).
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
- `model/panelControl.diagnostics.js`: normalizacion/filtros/visibilidad de incidentes remotos.
- `services/panelControl.api.js`: acceso API propio del feature.
- `components/*`: bloques UI desacoplados (metricas, movimientos, ranking, pagos, modal, diagnostico).

### Products feature

- `ProductsFeature.jsx`: pagina admin de consulta de catalogo.
- `model/useProductsController.js`: estado de busqueda y resultados.
- `services/products.api.js`: acceso a listado/busqueda de productos.
- `components/*`: UI desacoplada del buscador y la tabla.
- edicion actual:
  - boton `Editar` por fila.
  - modal para editar `nombre` y `precio`.

#### Diagnostico remoto en panel

- `Panel de control` soporta 2 vistas en frontend:
  - `Operacion`
  - `Diagnostico`
- `Diagnostico` esta pensado como tooling interno de soporte:
  - visibilidad frontend acotada a `admin + staff`.
  - no reemplaza permisos backend; solo evita exponer esta vista a la clienta en esta etapa.
- `DiagnosticEventsPanel.jsx` concentra la UI de incidentes:
  - resumen.
  - filtros.
  - cards por evento.
- `panelControl.diagnostics.js` concentra criterio de presentacion:
  - normalizacion de eventos.
  - severidad.
  - etiquetas de tiempo.
  - filtros por familia visible.

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
- En listado de ticket, click sobre celda de producto suma `+1` unidad (atajo rapido de operacion).
- Al confirmar cobro, se dispara impresion automatica de ticket:
  - primer canal: QZ Tray + ESC/POS.
  - fallback: ventana de impresion navegador si falla QZ.

## Persistencia local operativa

- Auth:
  - sesion activa persistida en local para tolerar `F5` sin cerrar login.
  - restauracion de sesion al boot del `AuthGate`.
- Scanner:
  - carrito y estado de edicion en vivo persistidos en local para tolerar `F5`.
  - cola de ventas pendientes persistida para reintentos en background.
- Cierre de sesion:
  - se limpia toda la persistencia local de auth/scanner/queue.
  - se resetea el estado scanner en memoria inmediatamente (sin recarga manual).

## Actualizaciones frontend en caliente

- El frontend publica `app-version.json` en cada build.
- La app cliente consulta ese manifiesto:
  - al iniciar sesion.
  - al volver a foco.
  - al volver a pestana visible.
  - cada 2 minutos.
- Si detecta una version distinta:
  - muestra modal simple de actualizacion.
  - permite posponer con banner compacto.
  - aplica recarga con feedback visual.
- Modo normal:
  - recarga y mantiene sesion.
- Modo critico:
  - recarga y exige reingreso.
  - se activa con `forceLogout: true` en el manifiesto generado por build.
- Regla operativa:
  - usar modo normal para cambios visuales, fixes de frontend y mejoras no sensibles.
  - usar modo critico para cambios de auth, permisos, sesion o compatibilidad fuerte backend/frontend.
- Deploy automatizado:
  - el workflow de GitHub Pages pasa `VITE_APP_FORCE_LOGOUT` desde variables del repo/entorno.
  - si la variable no esta definida, el comportamiento por defecto es update normal.
- Restriccion actual:
  - no queda expuesto ningun laboratorio/manual trigger en UI productiva.

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

## Checkout optimista y notificaciones

- `Cobrar` usa fast-path:
  - al confirmar, la UI cierra venta en el acto y encola sincronizacion.
  - toast de exito inmediato para no bloquear flujo por red.
- Si la sincronizacion falla:
  - se dispara aviso de error de reintento en segundo plano.
  - reintentos automaticos con cola local.
  - anti-spam visual con cooldown para no saturar al operario.

## Integracion backend actual

- `POST /api/auth/login` para autenticacion.
- `POST /api/auth/logout` para cierre de sesion.
- `POST /api/scanner/sales` para confirmar ventas.
- `POST /api/scanner/payments` para pagos.
- `PUT /api/scanner/products/:id` para persistir edicion de catalogo desde scanner.
- `GET /api/scanner/dashboard` para metricas, movimientos y ranking.
- `GET /api/scanner/dashboard/stream` para updates en tiempo real (SSE).

## Impresion de tickets (scanner)

- Estrategia primaria:
  - RAW `ESC/POS` usando `qz-tray`.
  - Impresora fisica seleccionada con cache local (entorno actual: `ImpRamon`).
  - Exclusión de impresoras virtuales para evitar `Print to PDF` accidental.
- Estrategia fallback:
  - render HTML 80mm e impresion por navegador.
- Formato operativo:
  - encabezado/pie centrado.
  - detalle en 3 columnas fijas: `Produc.` / `Cant.` / `Subtotal`.

## Fuente de verdad de tiempo

- El backend entrega timestamps normalizados en ISO UTC (`...Z`) para eventos y movimientos.
- El frontend no infiere zona del servidor: renderiza todo en `America/Montevideo` (`UTC-03:00`).
- Regla operativa: cualquier fecha/hora de UI debe pasar por `panelControl.formatters` para evitar desfasajes.

## Calidad y pruebas

- Tests unitarios con Vitest:
  - `scannerSlice` (carrito y totales).
  - utilidades compartidas (`shared/lib/number`).
- Smoke operativo recomendado antes de dar por bueno un cambio sensible:
  1. login rapido como `nova`.
  2. carga de producto y confirmacion de compra.
  3. login rapido como `admin`.
  4. registro de pago desde `Panel Control`.
  5. verificacion de dashboard y, si la prueba fue contra datos reales, limpieza de movimientos smoke.
- Nota para automatizacion:
  - en pruebas UI que recorren cobro, conviene neutralizar la apertura de impresion del navegador/QZ para validar el flujo sin depender del popup fisico de print.

## Regla de documentacion continua

- Regla fija del proyecto: cambio validado => documentacion en el mismo ciclo.
- Flujo de cierre recomendado:
  1. implementar cambio.
  2. ejecutar pruebas relevantes (unit/e2e/smoke segun alcance).
  3. push/deploy.
  4. validar estado final OK.
  5. documentar inmediatamente.
- Formato de documentacion (a criterio de la IA segun impacto):
  - `README` publico breve.
  - `README.local` operativo interno.
  - `docs/bitacora.md` como historial tecnico vivo.
  - `docs/architecture.md` si cambia estructura/criterio arquitectonico.
  - `docs/daily/*` para sesiones largas o handoff detallado.
