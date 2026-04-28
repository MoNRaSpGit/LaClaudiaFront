# Bitacora Frontend

## Estado actual (2026-04-26)

Frontend conectado a backend real para auth + ventas + pagos + dashboard, con foco en UX operativa de caja.

## Mini Changelog Tecnico (2026-04-27)

- Scanner UX y resiliencia (2026-04-28):
  - click en celda de producto suma `+1` unidad (flujo rapido de caja).
  - `admin` entra directo a `Panel de control`.
  - persistencia de sesion (`auth_session`) y estado scanner (`scanner_state`) para soportar `F5` sin perder contexto.
  - `logout` ahora limpia todo el estado local:
    - sesion.
    - credenciales recordadas.
    - carrito/estado scanner persistido.
    - cola de ventas pendientes.
    - reset inmediato del estado scanner en memoria (sin necesitar `F5`).
  - carteleria de scanner refinada:
    - error de validacion visible solo en modal `Producto manual`.
    - confirmacion de cobro con toast inmediato (`Compra confirmada`) al click en `Confirmar`.
    - si luego falla sincronizacion backend, se muestra toast de error de reintento en segundo plano.
  - integracion `react-toastify` con estilo visual discreto (verde suave, barra de progreso activa).
  - optimizaciones de ruido/rendimiento:
    - anti-spam de toast de error de sincronizacion (cooldown 30s).
    - se evita persistir `localStorage` en cada tecla de `scanBarcode`.
    - limpieza de acciones/props no usadas (`clearScanError`, props vacias redundantes).
  - calidad:
    - suite E2E inicial con Playwright:
      - flujo feliz operario (manual + cobrar + carrito vacio).
      - flujo resiliente (cobro optimista + falla de sync en background).
    - tests de contrato API en frontend para `auth` y `scanner`.
    - smoke post-deploy agregado (`npm run test:smoke:web`) para validar:
      - frontend home.
      - backend health.
      - login opcional via variables de entorno.

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
- Deploy y produccion:
  - frontend publicado apuntando a backend Render (`https://laclaudiabackend.onrender.com`).
  - marca UI actualizada a `Super Nova`.
- Scanner:
  - fix de loop/render en modal de edicion.
  - fix de persistencia de edicion (nombre/precio/imagen) contra backend.
- Auth UX:
  - boton rapido `Entrar como Admin` (`admin/1234`) agregado en login.

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
  4. editar producto en scanner ahora guarda cambios en carrito y persiste catalogo en backend (`PUT /api/scanner/products/:id`).
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

## En que quedamos

- hacer text manuales   y ver q errores salen

## Regla operativa permanente (documentacion)

- Modo de trabajo acordado:
  - carpetas por feature y capas separadas (`components`, `model`, `services`), orientado a escalabilidad sin sobre-ingenieria.
  - boundaries claros por modulo para evitar acople global.
- Regla de cierre por cada entrega:
  1. implementar.
  2. correr test relevante.
  3. push/deploy.
  4. validar todo OK.
  5. documentar en el mismo ciclo.
- La profundidad de la documentacion queda a criterio de la IA segun impacto del cambio:
  - actualizar `bitacora`.
  - actualizar `architecture` si cambia estructura o criterio.
  - mantener `README` publico breve y `README.local` para notas internas.

## Archivos clave de frontend

- `src/features/scanner/*`
- `src/features/panelControl/*`
- `src/shared/services/httpClient.js`
- `src/styles.css`
