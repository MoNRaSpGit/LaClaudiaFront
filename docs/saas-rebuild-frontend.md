# Dossier Frontend Para Reconstruccion SaaS

## Objetivo

Este documento captura el frontend actual de Super Nova como referencia de reconstruccion.

No esta pensado como historial de cambios, sino como mapa funcional para rehacer este modulo dentro de un SaaS nuevo sin tocar la app productiva del cliente.

## Alcance funcional actual

El frontend cubre 2 modulos operativos principales:

1. `Scanner`
   - ingreso por barcode
   - agregado manual de producto
   - edicion en vivo de item
   - confirmacion de cobro
   - impresion automatica de ticket
   - cola de sincronizacion en segundo plano

2. `Panel de control`
   - metricas del dia
   - caja en vivo
   - movimientos
   - ranking
   - registro de pagos
   - ajuste de caja inicial

## Features y archivos clave

### Auth

- `src/features/auth/AuthGate.jsx`
- `src/features/auth/model/useAuthGateController.js`
- `src/features/auth/services/authShell.api.js`
- `src/features/auth/components/LoginCard.jsx`
- `src/features/auth/components/AppBootScreen.jsx`

Responsabilidad:
- boot inicial
- login/logout real
- persistencia local de sesion
- quick logins operativos

Credenciales operativas actuales:
- `admin / admin123`
- `nova / nova123`

### Scanner

- `src/features/scanner/ScannerFeature.jsx`
- `src/features/scanner/model/useScannerController.js`
- `src/features/scanner/scannerSlice.js`
- `src/features/scanner/services/scanner.api.js`
- `src/features/scanner/services/scanner.salesQueue.js`
- `src/features/scanner/services/scanner.qzPrint.js`
- `src/features/scanner/services/scanner.print.js`
- `src/features/scanner/components/*`

Responsabilidad:
- flujo de venta orientado a teclado
- acumulacion de carrito
- cobro optimista
- persistencia local de contexto
- impresion
- publicacion de `caja en vivo`

### Panel de control

- `src/features/panelControl/PanelControlFeature.jsx`
- `src/features/panelControl/model/usePanelControlController.js`
- `src/features/panelControl/model/panelControl.formatters.js`
- `src/features/panelControl/services/panelControl.api.js`
- `src/features/panelControl/components/*`

Responsabilidad:
- dashboard operativo
- pagos
- ranking
- movimientos
- caja inicial editable
- tiempo real por SSE

### Shared

- `src/shared/services/httpClient.js`
- `src/shared/services/platform.api.js`
- `src/shared/lib/userErrorMessages.js`

Responsabilidad:
- primitives HTTP
- heartbeat/prewarm backend
- traduccion de errores operativos

## Flujo UX principal

### 1. Entrada

1. Boot screen
2. Login real
3. Redireccion al workspace
4. `admin` entra a Panel
5. `operario` entra a Scanner

### 2. Venta

1. foco en input scanner
2. barcode encontrado => agrega item
3. barcode no encontrado => abre alta rapida/manual segun flujo actual
4. `Cobrar`
5. `Confirmar`
6. toast de exito inmediato
7. sincronizacion backend en segundo plano
8. impresion automatica

### 3. Pago

1. login como `admin`
2. abrir `Panel de control`
3. ir a `Registrar pago`
4. cargar `Monto` y `Descripcion`
5. confirmar
6. toast de exito
7. panel se actualiza

## Persistencia local actual

- `laclau_auth_remember_v1`
- `laclau_auth_session_v1`
- `scanner_state_v1`
- `scanner_sales_queue_v1`

Uso:
- recordar credenciales
- tolerar `F5`
- sostener cola offline/reintentos

## Integraciones frontend importantes

### Backend

- login/logout
- sales
- payments
- dashboard
- dashboard stream
- live-state
- products lookup
- product update
- dashboard initial cash

### Impresion

1. primario: `qz-tray` + RAW `ESC/POS`
2. fallback: `window.print`

### Tiempo real

- SSE para dashboard
- push live-state desde operario

## Estilos y look actual

Archivos base:
- `src/styles.css`
- `src/styles/auth.css`
- `src/styles/navbar.css`
- `src/styles/scanner.css`
- `src/styles/panel.css`

Ideas visuales a preservar en la reconstruccion:
- UI operativa, sobria y rapida
- scanner dominante con foco en teclado
- panel modular por bloques
- navbar oscura compacta
- feedback por toast discreto
- mobile usable sin rediseño total aparte

## Dependencias frontend relevantes

- `react`
- `react-redux`
- `@reduxjs/toolkit`
- `react-toastify`
- `qz-tray`
- `jsbarcode`
- `qrcode`
- `bootstrap`

## Pruebas utiles ya validadas

- unit tests con `vitest`
- smoke web de frontend/backend
- e2e inicial con `playwright`
- smoke real manual/API/UI validado:
  - login `nova`
  - compra
  - login `admin`
  - pago
  - limpieza posterior de movimientos smoke

## Que conviene reconstruir primero en el SaaS

Orden recomendado:

1. `AuthGate` y login real
2. estructura visual general
3. scanner
4. cola de venta y cobro
5. panel de control
6. impresion
7. tiempo real

## Lo que hoy esta hardcodeado y despues conviene generalizar

- marca `Super Nova`
- nombre de impresora preferida `ImpRamon`
- roles base `admin` / `operario`
- copy operativa especifica de caja
- ciertos textos de dashboard

## Riesgos de copiar sin rediseñar

- arrastrar branding fijo
- arrastrar storage local sin abstraerlo
- acoplar auth de este proyecto a un SaaS futuro
- copiar reglas de negocio sin separar tenant/sucursal/comercio

## Recomendacion de migracion

No copiar “todo junto” al SaaS.

Conviene usar este dossier para reconstruir por modulos:

1. shell general SaaS
2. auth
3. caja/scanner
4. panel
5. impresion
6. endurecimiento multi-tenant
