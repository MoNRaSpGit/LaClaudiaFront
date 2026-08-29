# Deuda tecnica - frontend

## Objetivo

- Lista viva de problemas reales detectados pero **todavia no arreglados**.
- Cada item queda ahi hasta que se arregla; en ese momento se saca de aca y,
  si corresponde, se documenta el cambio en `docs/bitacora.md`.
- No arrancar ninguno de estos en horario operativo sin avisar: varios tocan
  el flujo de cobro del scanner, que es critico para que los operarios
  puedan seguir trabajando sin cortes.
- Origen: auditoria general pedida el 2026-08-01 despues de los fixes de
  turnos colgados y ticket de cuenta corriente.

## Como priorizar

- Alto: puede dejar a un operario bloqueado en medio de un cobro, o imprimir
  un ticket con datos que no coinciden con lo que quedo grabado.
- Medio: mala experiencia (reintentos ciegos, mensajes confusos) sin bloqueo
  ni perdida de datos.
- Bajo: mencionado en la auditoria pero sin caso de falla real encontrado.

---

## [ALTO] 6 pantallas mas con el mismo bug de "boton pegado" que turnos (fetch sin timeout)

- El fix de timeout (`fetchWithTimeout`/`fetchJson` en
  `src/shared/services/httpClient.js`) solo se aplico a
  `src/features/scanner/services/scanner.api.js` y `scanner.shifts.api.js`.
- Estos `*.api.js` siguen con `fetch()` crudo + `readJson()`, sin
  `AbortController`, y si el backend se cuelga dejan sus pantallas
  trabadas en "Guardando..."/"Confirmando..." para siempre:
  - `src/features/cash/services/cash.api.js` (caja inicial de hoy / pre-carga de manana)
  - `src/features/months/services/months.api.js` (resumen mensual)
  - `src/features/panelControl/services/panelControl.api.js` (pago manual, caja inicial, diagnosticos)
  - `src/features/payments/services/payments.api.js` (pago del operario)
  - `src/features/products/services/products.api.js` (catalogo, edicion de precio)
  - `src/features/stock/services/stock.api.js` (pedidos de stock: crear, editar, resolver)
- Botones concretos que quedan pegados si esto pasa: "Confirmar llegada" y
  "Guardando..." en `StockFeature.jsx`, "Guardar caja inicial de hoy" /
  "Guardar pre-carga de manana" en `CashFeature.jsx`, "Registrar pago" en
  Panel de Control y en la pagina de Pagos del operario, edicion de precio en
  `ProductsFeature.jsx`.
- Fix: migrar cada uno a `fetchJson` de `shared/services/httpClient.js`,
  igual que ya se hizo con scanner.

## [ALTO] Impresion QZ Tray sin timeout, bloqueando el boton de cobro/cierre de turno

- Archivo: `src/features/scanner/services/scanner.qzPrint.js` -
  `ensureQzConnected` (`await qz.websocket.connect()`) y
  `printSaleTicketByQz`/`openCashDrawerByQz` no tienen ningun timeout propio.
- Estas funciones se esperan (`await`) dentro de flujos que controlan un
  estado de carga visible al operario:
  - `ScannerFeature.jsx` (`executeCharge`): si QZ Tray no responde, el modal
    de "Confirmar cobro" queda en "Confirmando..." aunque la venta YA se
    encolo y se va a sincronizar en background - el operario no sabe si
    cobro o no.
  - `handleCloseShift` en `ScannerFeature.jsx`: si el cajon/QZ se cuelga,
    "Cerrar turno"/"Abrir turno" quedan bloqueados aunque el turno ya se
    cerro en el backend.
  - `CustomersFeature.jsx` (`printTicketWithFallback`, usado en pagar e
    imprimir comprobante de cuenta corriente): mismo patron.
- Fix sugerido: agregar timeout propio a la conexion/impresion QZ, y separar
  el "esperar a que imprima" del estado que bloquea el boton principal (que
  la impresion sea best-effort con su propio feedback, no bloqueante).

## [ALTO] El ticket de venta se imprime con el precio del carrito local, no el que confirma el backend

- Archivo: `src/features/scanner/model/useScannerController.js` (`chargeCart`,
  fast path: `dispatch(clearCart())` + `enqueueScannerSale(...)` sin esperar
  respuesta del backend) y `ScannerFeature.jsx` (impresion inmediata con el
  `ticket.total` calculado 100% del lado del cliente).
- Riesgo concreto: el admin cambia el precio de un producto desde
  `ProductsFeature` justo mientras el operario tiene ese producto en el
  carrito. El operario cobra: se imprime un ticket con el precio viejo y se
  abre el cajon, pero lo que finalmente queda grabado en el backend puede no
  coincidir. No hay mecanismo para re-imprimir con el total real una vez que
  se confirma la venta.
- Mismo patron de fondo que el bug de cuenta corriente ya arreglado (heuristica/
  dato local vs verdad del backend), pero aca la impresion ocurre ANTES de la
  confirmacion de red en vez de despues.

## [ALTO] Panel de Control no maneja sesion vencida (401) en 2 acciones

- Archivo: `src/features/panelControl/model/usePanelControlController.js`:
  - `saveInitialCash` (linea ~566-582): no tiene catch propio, el wrapper en
    `PanelControlFeature.jsx` solo muestra un toast generico, nunca llama a
    `onUnauthorized`.
  - `handleRegisterPayment` (linea ~643-647): el catch solo hace
    `setPaymentError(...)`, tampoco llama a `onUnauthorized`.
- Comparar con `usePaymentsController.js` o `CashFeature.jsx`, que si
  detectan 401 y redirigen a login.
- Riesgo concreto: al admin se le vence el token mientras esta en el panel;
  intenta guardar caja inicial o registrar un pago manual y ve un error
  generico sin indicacion de volver a loguearse, mientras el resto de la
  pantalla (dashboard, SSE) sigue mostrando datos que van a dejar de
  actualizarse en silencio.

## [MEDIO] Cola de ventas: errores no reconocidos (5xx, timeout) reintentan cada 2s sin backoff

- Archivo: `src/features/scanner/services/scanner.salesQueue.js`
  (`scheduleRetry`, `RETRY_DELAY_MS = 2000`).
- El caso `SHIFT_CLOSED` ya espacia el retry a 10s; cualquier otro error no
  reconocido (500 sostenido del backend, o el `TIMEOUT` que ahora puede
  lanzar `fetchWithTimeout`) sigue reintentando cada 2s para siempre, sin
  backoff exponencial ni limite de intentos.
- No bloquea la UI (el operario ve el contador de pendientes y un toast tras
  el segundo intento fallido), pero si el backend esta caido de verdad, cada
  caja golpea `/api/scanner/sales` cada 2s indefinidamente.

## [BAJO] `scanner.diagnostics.js` no distingue tipos de error en su cola

- No reconoce `SHIFT_CLOSED` ni 401 para pausar el reintento; simplemente
  para el loop en el primer error y no reintenta hasta el proximo trigger
  manual. Bajo riesgo real porque es un reporte "best effort" que no bloquea
  cobro ni impresion - mencionado porque se pidio revisar especificamente
  este archivo en la auditoria.
