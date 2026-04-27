# Bitacora Frontend

## Estado actual (2026-04-26)

Frontend conectado a backend real para auth + ventas + pagos + dashboard, con foco en UX operativa de caja.

## Mini Changelog Tecnico (2026-04-27)

- Boundary API por feature aplicado:
  - `auth` deja de depender de `shared/services/backend.api.js`.
  - `panelControl` deja de depender de `shared/services/backend.api.js`.
- Nuevo `src/shared/services/httpClient.js` como base comun liviana:
  - `apiUrl`.
  - `buildHeaders`.
  - `readJson`.
- Limpieza:
  - eliminado `src/shared/services/backend.api.js` (acople global legacy).
  - eliminado `SIMULATE_EDITING_BANNER` y `src/shared/config/featureFlags.js` (simulacion legacy).

## Mini Changelog Tecnico (2026-04-26)

- Se elimino estado local legado de panel:
  - removido `panelControlSlice` del store.
  - removidos reducer + tests del slice legado.
- Se removio `simulateLogin()` de `authShell.api.js`.
- Se estabilizaron warnings/ruido de UI:
  - selector memoizado en scanner (`selectScannerTotals`).
  - keys robustas en ranking.
- Se reforzo UX operativa:
  - modal de confirmacion al cobrar.
  - enter funcional en producto manual.
  - textos de pagos ajustados a `Descripcion` segun contexto.
- Panel en tiempo real:
  - removido polling por `setInterval`.
  - agregado stream SSE autenticado para dashboard.
- Refactor de `panelControl`:
  - separado en `components`, `model`, `services`.
  - `PanelControlFeature` queda como contenedor de composicion.
- Fast path scanner/cobro:
  - `Cobrar` optimista (UI no bloquea por red).
  - cola liviana de ventas en background con retry (`scanner.salesQueue`).
  - cache de lookup por barcode repetido para evitar roundtrip innecesario.

## Ruta Para Nuevo Agente (leer en este orden)

1. `README.md` (estado funcional y scripts).
2. `docs/architecture.md` (estructura por feature y flujo real).
3. `docs/bitacora.md` (estado actual + pendientes).
4. `src/features/auth/*`, `src/features/scanner/*`, `src/features/panelControl/*`.

## Contexto rapido para agente (2026-04-26)

- El flujo funcional ya quedo validado en UI y conectado:
  - scanner por barcode.
  - producto manual.
  - cobro.
  - panel con movimientos, ranking y pagos.
- Se limpiaron piezas no usadas para dejar base mas mantenible:
  - estado `app` viejo removido.
  - componentes de scanner no usados removidos.
  - utilidades compartidas en `src/shared/*`.
- Se corrigieron 5 puntos clave antes de conectar backend:
  1. ranking sin tope fijo de 5 para que el acordeon 5/10/todos funcione.
  2. metricas de caja filtradas por dia actual.
  3. keys estables en ranking (evita choques por nombre repetido).
  4. editar producto en scanner ahora guarda cambios reales en carrito.
  5. guard clause para no consultar backend con barcode vacio.
- Tests y build del frontend pasan despues de estos ajustes.
- Conclusion: frontend listo para continuidad de hardening y permisos.
- UX aplicada:
  - pantalla de carga inicial (boot) para disimular arranque de servicio free.
  - login moderno conectado a backend.
  - entrada al workspace actual (Scanner + Panel) luego de login real.
  - estructura por feature en `src/features/auth/{components,model,services}`.
  - navbar oscura clasica con menu de usuario/hamburguesa.
  - opcion recordar usuario y clave en dispositivo local.
  - foco operativo continuo en input de scanner (flujo sin clicks).

## Lo que ya quedo funcionando

- Navegacion por tabs: `Scanner` y `Panel Control`.
- Flujo de escaneo:
  - Agregar producto por barcode.
  - Agregar producto manual por valor.
  - Quitar unidades por producto.
  - Confirmar venta con `Cobrar`.
- Sincronizacion en vivo con Panel:
  - `Caja en vivo` clona el carrito del scanner.
  - `Total actual` visible solo cuando hay productos.
  - Hora del banner tomada del ultimo escaneo/ingreso.
- Panel de caja:
  - Metricas de caja inicial, ventas, ganancia, monto actual y pagos.
  - Movimientos de venta y pago.
  - Detalle de movimientos en formato acordeon.
  - Ranking por cantidad vendida.
  - Registro de pago funcional.
  - Actualizacion en tiempo real por SSE (sin polling).
- Banner de trabajo en vivo:
  - `Producto manual` / `Editando producto`.
  - Preview de nombre y precio en tiempo real.

## Ajustes UX ya aplicados

- Paleta visual mas sobria, con contrastes claros por seccion.
- Diferenciacion de estados sin colores chillones.
- Detalle de ventas con items en celdas.
- Colores de montos unificados:
  - positivos en verde oscuro.
  - pagos/egresos en rojo oscuro.

## Decisiones tomadas

- Mantener UX de caja orientada a teclado aunque la persistencia sea backend real.
- Tratar producto manual como linea de ticket (no catalogo fijo):
  - `isManual: true`
  - `productId: null`

## Pendientes inmediatos (siguiente etapa)

1. Flujo `barcode no encontrado`:
   - abrir modal de valor.
   - crear alta real con barcode + precio + nombre default.
2. Documentar cierre diario de caja y preparar endpoints de reporting.

## Archivos clave de frontend

- `src/features/scanner/*`
- `src/features/panelControl/*`
- `src/shared/services/httpClient.js`
- `src/styles.css`
