# Bitacora Frontend

## Referencia operativa: version estable

- Si el usuario dice `volvemos a estable`, la referencia base actual es:
  - `frontend origin/main`
  - commit: `7478a2e`
  - mensaje: `scanner: enriquece reportes remotos etapa 1`
- Esta referencia representa la ultima version subida y tomada como estable antes de cambios locales no publicados.
- Regla de trabajo:
  - cualquier experimento/local grande se compara primero contra esta base.
  - antes de subir cambios sensibles, conviene validar diferencia contra esta referencia.

## Estado actual (2026-04-26)

Frontend conectado a backend real para auth + ventas + pagos + dashboard, con foco en UX operativa de caja.

## Mini Changelog Tecnico (2026-04-27)

- Stock simple para pedido operario -> admin (2026-05-02):
  - nuevo tab `Stock` disponible para:
    - `operario`
    - `admin`
  - flujo final simplificado segun validacion con cliente:
    - `operario` entra a `Stock`.
    - escribe producto.
    - recibe sugerencias desde catalogo real por nombre (`GET /api/scanner/products?q=...`).
    - selecciona productos para armar una lista.
    - ajusta cantidad por item con `+ / -`.
    - `Confirmar` envia la lista.
  - vista admin del mismo `Stock`:
    - muestra pedidos recibidos.
    - cada pedido incluye:
      - productos + cantidad.
      - quien lo pidio.
      - fecha/hora.
    - boton `Listo` para remover el pedido ya atendido.
  - implementacion actual:
    - `src/features/stock/StockFeature.jsx`.
    - usa `localStorage` como puente demo entre operario/admin, sin backend especifico de stock.
  - limpieza incluida:
    - removida la version previa de stock mas compleja (proveedores/reparto/pedidos por tarjeta).
    - removido CSS legacy de ese flujo para dejar solo el stock simple vigente.
  - validacion tecnica:
    - `npm run lint` OK.
    - `npm run test -- --run` OK.
    - `npm run build` OK.

- Pagina admin `Productos` con buscador por nombre (2026-05-02):
  - nueva tab `Productos` visible solo para `admin`.
  - muestra resultados simples con:
    - `producto`
    - `precio`
  - nuevo feature `src/features/products/*`.
  - edicion desde modal por fila para actualizar:
    - `nombre`
    - `precio`
  - backend acompaña con busqueda parcial por nombre en `GET /api/scanner/products?q=...`.
  - validacion tecnica:
    - `npm run lint` OK.
    - `npm run test -- --run` OK.
    - `npm run build` OK.
    - `npm run test:smoke:web` OK.

- Enriquecimiento etapa 1 de reportes remotos scanner (2026-05-01):
  - primera capa de logs mas finos agregada al monitoreo remoto del scanner.
  - objetivo:
    - deducir mejor el origen del error sin depender solo de `message`.
    - distinguir rapido entre error HTTP, auth, red, timeout o payload.
  - nuevos campos visibles/transportados en incidentes:
    - `errorFamily`
    - `endpoint`
    - `method`
    - `status`
    - `statusText`
    - `flow`
    - `trigger`
  - cobertura inicial aplicada:
    - sync de ventas via cola:
      - `endpoint=/api/scanner/sales`
      - `method=POST`
      - `flow=scanner_sale_sync`
      - `trigger=queue_retry`
    - alta rapida de producto:
      - `endpoint=/api/scanner/products`
      - `method=POST`
      - `flow=scanner_quick_add`
      - `trigger=quick_add_confirm`
  - clasificacion base de familia de error:
    - `payload_too_large`
    - `auth`
    - `http`
    - `timeout`
    - `network`
    - `unknown`
  - mejora visual en panel de diagnostico:
    - cada card ahora puede mostrar:
      - familia de error.
      - metodo + endpoint.
      - flujo + trigger.
      - `HTTP status` con `statusText` si existe.
  - impacto esperado:
    - leer mas rapido si el fallo vino de:
      - reintento de cola.
      - endpoint puntual.
      - rechazo `4xx/5xx`.
      - problema de auth.
      - problema de payload.
  - validacion tecnica:
    - `npm run lint` OK.
    - `npm run test -- --run` OK.
    - `npm run build` OK.
    - `npm run test:smoke:web` OK.

- Diagnostico remoto mas legible en panel staff (2026-05-01):
  - el monitoreo remoto del scanner ahora vive en una vista propia `Diagnostico` dentro de `Panel de control`.
  - esta vista solo se muestra en frontend si el usuario cumple:
    - `role = admin`
    - `username = staff`
  - objetivo:
    - evitar que la clienta vea tooling interno de soporte.
    - mantener el acceso rapido para diagnostico sin tocar RBAC backend en esta etapa.
  - refactor aplicado en `panelControl`:
    - nueva UI dedicada `DiagnosticEventsPanel`.
    - nuevo helper `panelControl.diagnostics.js` para:
      - visibilidad.
      - normalizacion.
      - labels de tiempo.
      - filtros.
      - severidad.
    - `usePanelControlController` ahora unifica:
      - carga inicial.
      - refresh manual.
      - polling de eventos.
  - mejoras de lectura para soporte:
    - resumen superior de eventos / errores / warnings / `sale_sync_error`.
    - filtros:
      - `Todos`
      - `Errores`
      - `Warnings`
      - `Sync venta`
    - cards mas claras por incidente mostrando:
      - severidad.
      - timestamp.
      - antiguedad relativa.
      - `eventType`.
      - `HTTP status` cuando existe.
      - pendientes cuando existe.
      - usuario / terminal / origen.
    - el evento mas reciente queda visualmente destacado.
  - mobile:
    - acceso a `Diag.` desde navbar inferior solo para soporte.
    - subnav minima para volver al panel o refrescar eventos.
  - validacion tecnica:
    - `npm run lint` OK.
    - `npm run test -- --run` OK.
    - `npm run build` OK.
    - `npm run test:smoke:web` OK.

- Hardening de sesion operativa en caja (2026-05-01):
  - agregado keepalive autenticado de sesion en frontend (`/api/auth/session`) para mantener renovacion activa durante operacion.
  - intervalo de keepalive: `3 min` con reintentos por fallo transitorio de red.
  - logout automatico solo ante `401` persistente (no por un unico bache).
  - agregado cierre de sesion `best-effort` al cerrar/ocultar la app:
    - intenta `logout` con `keepalive` en `beforeunload/pagehide`.
    - guarda una marca local de cierre para limpiar sesion al reabrir si corresponde.
    - evita tratar un `reload` simple como cierre real.
  - objetivo de este cierre:
    - mejorar higiene operativa en PWA/navegador.
    - no depende como garantia absoluta de que el navegador siempre entregue el request final.
  - scanner ahora detecta `401` en cola de ventas y muestra mensaje de sesion vencida, evitando que se interprete como simple error de sync.
  - objetivo: reducir casos donde el cobro visual sale OK pero la venta no entra a movimientos por token vencido en entorno real.
  - soporte/diagnostico:
    - agregado panel oculto de diagnostico en scanner, activable con `Ctrl+Shift+D`.
    - muestra:
      - token activo/ausente.
      - cola pendiente.
      - quick-add pendientes/error.
      - ultimo error de sincronizacion.
    - objetivo: acelerar soporte en locales donde el error aparece solo en entorno real.
  - smoke tecnico ampliado:
    - `scripts/smoke-web.mjs` ahora soporta validacion autenticada opcional de:
      - operario (`auth/login` + `auth/session`)
      - admin (`auth/login` + `auth/session` + `dashboard`)
    - se habilita con:
      - `SMOKE_LOGIN_USER` / `SMOKE_LOGIN_PASS`
      - `SMOKE_ADMIN_USER` / `SMOKE_ADMIN_PASS`

- Ganancia diaria editable desde panel (2026-04-30):
  - porcentaje por defecto actualizado a `30%` para calculo de `Ganancia diaria`.
  - la tarjeta `Ganancia diaria` ahora permite edicion por doble click.
  - al hacer doble click se abre modal para ingresar porcentaje (`0` a `100`).
  - el valor guardado se aplica al stream del dashboard para recalcular metricas al instante.

- Reduccion de falsos errores en compra (2026-04-30):
  - ajuste en scanner para evitar toast de error ante un unico fallo transitorio de sincronizacion.
  - el aviso de error ahora se muestra recien con fallos repetidos (2 o mas) de la cola.
  - si el navegador esta offline, se evita mostrar ese toast para no generar ruido operativo.
  - al quedar la cola en `0` pendientes, se reinicia el contador de errores.

- Scanner manual por categorias (2026-04-30):
  - se reemplazo el boton unico `Producto manual` por accesos rapidos por categoria:
    - `Fruta/Verduras`
    - `Fiambre`
    - `Fideo`
    - `Producto x kg`
    - `Otros`
  - misma logica operativa de siempre:
    - click en categoria.
    - modal para ingresar valor.
    - alta en carrito inmediata.
  - cambio funcional clave:
    - la linea ya no entra con nombre generico `Producto Manual`.
    - ahora entra con el nombre de la categoria seleccionada.
  - live editor en panel:
    - mantiene sincronizacion en vivo mostrando el nombre de categoria elegida.
  - UX visual:
    - botones compactos para operacion rapida.
  - ajustes posteriores de UX:
    - el ultimo producto escaneado ahora destaca en gris suave en lugar de verde.
    - los productos nuevos entran arriba de la lista para priorizar el ultimo movimiento.
    - el bloque de carga manual queda fijo visible (sin trigger colapsable) para no agregar ruido extra de controles secundarios.

- Saludo temporal Dia del Trabajador (2026-05-01):
  - agregado banner minimalista arriba del scanner.
  - estilo final:
    - fondo rosa suave.
    - texto `Feliz Dia del Trabajador`.
    - detalle visual de engranajes animados (`Fluido`).
    - cierre manual con `X`.
  - comportamiento:
    - si el usuario lo cierra, se oculta solo en esa sesion.
    - si refresca durante el mismo dia, vuelve a mostrarse.
    - desaparece automaticamente cuando cambia la fecha operativa.
    - estilo sobrio/neutro (sin fondo negro pleno ni colores fuertes).
    - iconos por categoria para reconocimiento rapido.
  - decision final de interfaz:
    - se evaluaron variantes visuales y se fijo `Borde fuerte` como estilo definitivo de los botones.
    - se removio el selector temporal de estilos de prueba para dejar UI limpia en produccion.
  - ajuste de layout:
    - `Otros` queda como quinto acceso rapido, centrado en la fila inferior para no romper la grilla principal de `2` columnas.
  - feedback visual:
    - el ultimo producto ingresado queda resaltado en verde oscuro suave para lectura rapida en caja.

- Pagos para operario (2026-04-30):
  - nuevo tab `Pagos` visible para rol `operario` en navbar.
  - pagina simple con monto + descripcion para registrar egresos manuales.
  - usa el mismo endpoint de pagos del backend, por lo que impacta en movimientos del panel admin.
  - manejo de sesion vencida alineado con panel: toast + logout consistente ante `401`.

- Alta rapida por barcode no encontrado (2026-04-30):
  - el modal rapido de scanner ahora permite:
    - `precio` obligatorio.
    - `nombre` opcional.
  - si no se completa nombre, se usa fallback `Producto Manual`.
  - el cierre del modal y alta en carrito son optimistas:
    - la UI agrega el item al instante.
    - el backend crea el producto por detras.
  - blindaje agregado para evitar falso positivo peligroso:
    - mientras el alta real del producto sigue pendiente, `Cobrar` queda bloqueado.
    - si el backend falla, el item queda marcado con error visible en carrito.
    - si el backend responde OK, el item optimista se reconcilia con el producto real.
  - resultado: el siguiente escaneo del mismo barcode ya lo encuentra desde catalogo cuando el alta completa correctamente.

- Login operativo y credenciales rapidas (2026-04-30):
  - login real mantenido contra backend con usuarios simples para operacion diaria.
  - credenciales activas acordadas:
    - `admin` / `1994`
    - `nova` / `nova123`
  - accesos rapidos del login actualizados:
    - `Entrar como Admin` precarga solo `admin` y enfoca la clave.
    - `Entrar como Operario` usa `nova/nova123`.
  - el usuario `nova` se creo como `operario` real en backend para que el acceso rapido no dependa de mocks ni credenciales legacy.
  - se mantiene `operario/operario123` como usuario historico si siguiera existiendo en DB, pero ya no es la credencial operativa principal ni el acceso rapido recomendado.
  - smoke real validado luego del cambio:
    - login `nova` + venta real OK.
    - login `admin` + pago real OK.
    - smoke UI tipo usuario con clicks reales OK.
    - movimientos de prueba limpiados despues de validar para no ensuciar caja del dia.

- Scanner UX y resiliencia (2026-04-28):
  - PF de estabilidad scanner y mensajes operativos (2026-04-29):
    - mejorados mensajes de error para operacion real:
      - `Failed to fetch` en login ahora se traduce a backend caido/apagado o red inestable.
      - timeouts y errores de panel/scanner/pagos muestran recomendaciones mas claras.
      - nuevo helper comun: `src/shared/lib/userErrorMessages.js`.
    - corregido arrastre de confirmacion por `Enter` entre ciclos de cobro:
      - la causa estaba en señales de confirmacion que quedaban vivas al vaciar carrito/desmontar checkout.
      - ahora se resetean al confirmar compra y cuando el carrito queda vacio.
      - `ScannerCheckout` procesa cada señal de abrir/confirmar una sola vez por id.
      - se mantuvo flujo por teclado: `Enter` abre cobrar y siguiente `Enter` confirma, sin contaminar el siguiente producto.
    - limpieza tecnica:
      - removida variable muerta `hasRemoteLiveSource` en panel controller.
    - validacion tecnica:
      - `npm run build` OK.
      - `npm run test -- --run` OK.
      - `npm run test:smoke:web` OK.
  - Fix critico login/logout (2026-04-29):
    - corregido cuelgue intermitente al reloguear despues de logout.
    - causa principal: requests de `login/logout` sin timeout podian quedar colgadas cuando backend estaba frio/lento.
    - solucion aplicada:
      - `fetchWithTimeout` en auth shell.
      - timeout `login`: 12s.
      - timeout `logout`: 8s.
      - mensaje de error controlado al abortar por timeout para volver a estado de login sin bloquear UI.
    - estabilidad adicional en caja en vivo:
      - limpieza de `scanner_state_v1` al iniciar sesion.
      - al desmontar scanner de operario se publica estado vivo vacio (`items: []`) para evitar residuos en panel.
      - fallback de nombre en panel en vivo ajustado a `Operario` (ya no `Admin` cuando no hay fuente remota real).
    - validacion tecnica:
      - `npm run build` OK.
      - `npm run test -- --run` OK.
      - `npm run test:smoke:web` OK.
  - Limpieza final de laboratorio (2026-04-29):
    - se removio por completo el flujo experimental de pago app/cliente.
    - eliminado laboratorio en scanner:
      - generacion QR y simulaciones.
      - estado de cuenta simulado.
      - boton `Pagar` y confirmaciones de laboratorio.
    - eliminado laboratorio en panel admin:
      - popup `quiere pagar`.
      - sincronizacion local por storage/polling para decisiones de laboratorio.
    - eliminado archivo de canal temporal:
      - `src/shared/services/labPaymentChannel.js`.
    - resultado: queda solo flujo operativo productivo (scanner + cobro + ticket + panel), sin componentes de prueba activos.
  - Impresion de ticket por QZ Tray (2026-04-29):
    - tecnologia activa: `qz-tray` + RAW `ESC/POS` desde frontend.
    - flujo operativo actual: `Confirmar cobro` => imprimir ticket automatico.
    - fallback de resiliencia: si QZ falla, abre impresion de navegador (`window.print`) para no cortar caja.
    - selector de impresora:
      - preferencia cacheada por nombre (`ImpRamon` en entorno actual).
      - filtro de impresoras virtuales (`PDF/XPS/Fax/OneNote`) para evitar falsos positivos.
    - formato ticket termico:
      - header y footer centrados por comando ESC/POS.
      - cuerpo tabular en 3 columnas: `Produc.` / `Cant.` / `Subtotal`.
      - eliminado detalle duplicado `1x + precio unitario` por linea.
    - nota operativa de permisos QZ:
      - al no usar firma/certificado confiable, QZ puede pedir confirmacion de seguridad.
      - se priorizo no disparar prompts en `F5`; los permisos se solicitan al imprimir.
    - limpieza de laboratorio:
      - removidos flujos temporales de laboratorio (barcode cliente y pruebas de corte) para volver a flujo operativo estable.
  - Hardening de sesion en Panel SSE (2026-04-29):
    - manejo explicito de `401 Unauthorized` al abrir `GET /api/scanner/dashboard/stream`.
    - se evita bucle de reconexion cuando el token expiro/revocado.
    - se muestra toast `Sesion vencida. Inicia sesion nuevamente.` y luego logout automatico.
    - wiring de `onUnauthorized` desde `App` hacia `PanelControlFeature`/controller para cierre de sesion consistente.
  - Registro de pagos optimizado para baja latencia percibida:
    - submit optimista en frontend (toast OK inmediato + sync backend en segundo plano).
    - estado `Registrando...` para evitar doble submit.
    - toast de error tardio si falla el guardado real.
  - Medicion de tiempos agregada en pago:
    - log en consola: `[PAYMENT][OK|LENTO] total=... ms server=... ms`.
    - umbral operativo: `<= 500 ms` OK, `> 500 ms` marcar como lento.
  - Diagnostico de cuello de botella (muestras de produccion):
    - promedio 10 pagos: `total ~681.6 ms`, `server ~228.8 ms`, `neto red ~452.8 ms`.
    - conclusion: cuello principal fuera de app (red/infra), backend dentro de margen.
  - Navbar mobile ajustado:
    - marca + menu usuario en una sola linea.
    - tabs `Scanner/Panel` movidos al dropdown en mobile.
  - Panel mobile ajustado:
    - navegacion inferior por secciones con estado activo visual al presionar.
    - correccion de scroll con `scroll-margin-top` para evitar que el titulo quede tapado por navbar sticky.
  - limpieza de ruido CSS:
    - removidas clases legacy del selector mobile anterior (`panel-mobile-section-selector`, `panel-mobile-tab*`).
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
  - accesos rapidos de login activos para operacion y pruebas manuales.
  - credenciales historicas iniciales (`admin/1234`) quedaron reemplazadas por las credenciales actuales documentadas arriba.

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
4. `docs/saas-rebuild-frontend.md` (captura funcional para reconstruccion futura en SaaS).
5. `src/features/auth/*`, `src/features/scanner/*`, `src/features/panelControl/*`.

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

## Paquete local en validacion - monitoreo remoto scanner

- Se implemento un paquete local de monitoreo remoto para incidentes del scanner.
- Objetivo:
  - que errores reales del flujo de caja queden visibles despues en panel para soporte.
- Incluye:
  - cola local `scanner_diagnostic_queue_v1` para no perder eventos si backend esta caido.
  - flush al volver online.
  - flush periodico desde scanner.
  - flush previo desde panel antes de leer eventos.
  - visibilidad de eventos recientes en `Panel de control`.
- Estado actual de validacion manual:
  - evento manual: OK.
  - `sale_sync_error` real con backend caido y luego backend levantado: OK.
  - hora de eventos: corregida y validada.
- Restriccion operativa actual:
  - el monitoreo visible en panel queda reservado para `staff`.
  - el boton rapido `staff // staff` es solo local para soporte y no se debe subir.

## Ajuste defensivo scanner - payload liviano y sin carga de imagen por caja

- Se detecto en produccion `scanner.sale_sync_error` con `HTTP 413 request entity too large`.
- Causa mas probable confirmada por flujo:
  - venta enviando payload demasiado pesado desde scanner.
- Blindaje aplicado en frontend:
  - la cola `scanner_sales_queue_v1` sanea ventas nuevas y viejas antes de reintentar.
  - el payload de venta deja de incluir `thumbnail_url`.
  - desde el scanner el usuario ya no puede cargar nuevas imagenes al editar un producto.
  - las imagenes existentes/autorizadas se siguen mostrando en la lista.
- Objetivo operativo:
  - mantener caja rapida sin volver a disparar rechazos `413` por imagen/base64 en ventas.

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

## Alias operativo: Pasos Finales (`PF`)

- Si el usuario dice:
  - `pasos finales antes del push/deploy`
  - `pasos finales`
  - `PF`
- Significa ejecutar esta secuencia:
  1. tests (unit + smoke/e2e criticos).
  2. optimizacion rapida de cambios recientes.
  3. revision de estructura/capas (MVC y boundaries por feature).
  4. limpieza de ruido (imports sin uso, estilos/codigo legacy).
  5. documentacion (bitacora + resumen tecnico).
- Regla adicional de cierre en `PF`:
  - ademas del checklist tecnico, la IA debe dar su opinion profesional final sobre el estado del cambio.
  - esa opinion debe incluir, si aplica, sugerencias concretas tipo:
    - `estaria bueno agregar ...`
    - `el siguiente paso logico seria ...`
    - `hay este riesgo residual y conviene ...`
  - objetivo: no cerrar solo con "paso todo", sino tambien aportar criterio tecnico y proximo valor posible.
- Regla de corte:
  - solo si 1-5 salen bien, recien pasar al punto 6:
  6. `push + deploy` y validacion final de publicacion.

## Archivos clave de frontend

- `src/features/scanner/*`
- `src/features/panelControl/*`
- `src/shared/services/httpClient.js`
- `src/styles.css`

## Ajustes UX panel - expandir/colapsar y responsive mobile

- Se ajusto el comportamiento de `Movimientos` y `Ranking` para que el mismo CTA permita:
  - expandir por tramos.
  - ver todo.
  - volver a estado compacto con `Ver menos`.
- En `Movimientos`, al volver a compacto tambien se resetea el detalle expandido para no dejar una fila abierta fuera de contexto.
- Se corrigio overflow horizontal en mobile dentro de:
  - `Caja en vivo`.
  - `Movimientos`.
- El ajuste responsive evita depender de zoom manual y mejora:
  - wrap de textos largos.
  - celdas flex que antes empujaban el ancho.
  - detalle de items y bloques laterales en pantallas chicas.
- Validacion:
  - `lint`: OK.
  - `test -- --run`: OK.
  - `build`: OK.
  - `test:smoke:web`: OK.

## Flujo de actualizacion frontend - deteccion real y recarga controlada

- Se reemplazo la simulacion puramente local por un flujo real de actualizacion basado en `app-version.json`.
- El build ahora publica un manifiesto con:
  - `version`.
  - `forceLogout`.
  - `generatedAt`.
- La app abierta chequea updates:
  - al iniciar sesion.
  - al volver a foco.
  - al volver a pestaña visible.
  - cada 2 minutos.
- Si detecta nueva version:
  - muestra modal simple `Hay una nueva actualizacion`.
  - permite `Mas tarde`.
  - deja banner compacto `Nueva version disponible`.
  - aplica recarga con feedback visual `Actualizando...`.
- Se agrego distincion entre:
  - update normal: recarga manteniendo sesion.
  - update critico: recarga pidiendo reingreso si `forceLogout` viene en `true`.
- Variables de control para deploy:
  - `VITE_APP_VERSION`.
  - `VITE_APP_FORCE_LOGOUT`.
- Workflow operativo:
  - deploy normal: no definir `VITE_APP_FORCE_LOGOUT` o dejarlo en `false`.
  - deploy critico: definir `VITE_APP_FORCE_LOGOUT=true` en variables del repo/entorno.
- Criterio de uso:
  - normal para UX, fixes de frontend y cambios no sensibles de sesion.
  - critico para auth, permisos, tokens o compatibilidad fuerte entre frontend y backend.
- Se retiro el laboratorio local de la UI para dejar solo el flujo productivo real.
- Validacion:
  - `lint`: OK.
  - `test -- --run`: OK.
  - `build`: OK.
  - `test:smoke:web`: OK.

## Prueba controlada de despliegue

- Se realizo una publicacion minima para validar en produccion el detector de nueva version con una pestana ya abierta.
- Objetivo:
  - confirmar aparicion del modal o banner de actualizacion sin depender de refresh manual.

## Ajuste de sesion en reload por update

- Se detecto un riesgo de logout involuntario durante `reload` de actualizacion.
- Causa probable:
  - el handler de cierre de ventana podia disparar `logout best effort` tambien en una recarga planificada.
- Blindaje agregado:
  - los reloads iniciados desde el flujo de actualizacion marcan una excepcion temporal.
  - auth evita invalidar la sesion backend en ese unload puntual.
