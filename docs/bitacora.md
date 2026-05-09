# Bitacora Frontend

## Objetivo

- Este archivo registra cambios funcionales y tecnicos del frontend.
- Aca vive el historial de entregas.
- No deberia mezclar reglas de arquitectura profundas del proyecto salvo notas operativas puntuales.

## Referencia operativa: version estable

- Si el usuario dice `volvemos a estable`, la referencia base actual es:
  - `frontend origin/main`
  - commit: `7478a2e`
  - mensaje: `scanner: enriquece reportes remotos etapa 1`
- Esta referencia representa la ultima version subida y tomada como estable antes de cambios locales no publicados.

## Estado actual

- Frontend conectado a backend real para:
  - auth.
  - ventas.
  - pagos.
  - panel.
  - stock.
  - productos.
  - meses.
- Foco actual:
  - UX operativa de caja.
  - stock entre operario y admin.
  - soporte interno.
  - mantenimiento incremental sin romper flujo diario.

## Changelog reciente

### 2026-05-08

- `Stock > Reparto` ahora permite editar pedidos ya guardados.
- Flujo nuevo disponible para `operario`:
  - agregar productos.
  - renombrar productos.
  - ajustar cantidades.
  - eliminar filas.
- La UI final en cada tarjeta de `Reparto` muestra:
  - `Confirmar llegada`
  - `Editar`
- Se reutiliza el mismo modal de `Editar pedido` del armado inicial.
- Validacion:
  - `npm run lint` OK.
  - `npm run test -- --run` OK.
  - `npm run build` OK.

### 2026-05-07

- Rediseño UX de `Stock > Pedido` con editor desacoplado.
- Nuevo layout principal:
  - columna izquierda para carga rapida.
  - columna derecha para resumen compacto.
- El resumen deja de exponer edicion inline por fila.
- Nuevo flujo de correccion:
  - boton unico `Editar pedido`.
  - modal dedicado para proveedor e items.
  - agregar filas nuevas.
  - renombrar productos.
  - ajustar cantidades.
  - eliminar filas.
- Objetivo:
  - separar `cargar` de `corregir`.
  - bajar ruido visual.
  - mantener la pantalla principal limpia.
- Validacion:
  - `npm run lint` OK.
  - `npm run test -- --run` OK.
  - `npm run build` OK.
  - `npm run test:smoke:web` OK.

### 2026-05-05

- `Stock` deja de depender de `localStorage` como puente demo.
- Ahora usa backend real para:
  - guardar pedidos.
  - listar pendientes.
  - confirmar llegada.
- Se agrega subtab `+Vendidos`.
- `admin` ve pedidos reales creados desde otra sesion o PC.
- Validacion:
  - `npm run build` OK.
  - `npm run test:smoke:web` OK.

### 2026-05-02

- Limpieza de navegacion admin:
  - removido tab experimental `Otros`.
  - `admin` ya no ve `Scanner` en navbar/menu.
- Nueva pagina `Productos` para admin:
  - buscador por nombre.
  - tabla simple.
  - modal de edicion por fila.
- Primera etapa del flujo `Stock` para operario/admin.
- Validacion:
  - `npm run lint` OK.
  - `npm run test -- --run` OK.
  - `npm run build` OK.

### 2026-05-01

- Diagnostico remoto mas legible para soporte:
  - vista `Diagnostico` dentro de `Panel de control`.
  - filtros.
  - resumen.
  - cards enriquecidas por incidente.
- Enriquecimiento de reportes remotos del scanner:
  - `errorFamily`
  - `endpoint`
  - `method`
  - `status`
  - `statusText`
  - `flow`
  - `trigger`
- Hardening de sesion operativa:
  - keepalive autenticado.
  - logout defensivo.
  - diagnostico oculto en scanner con `Ctrl+Shift+D`.
- Validacion:
  - `npm run lint` OK.
  - `npm run test -- --run` OK.
  - `npm run build` OK.
  - `npm run test:smoke:web` OK.

### 2026-04-30

- `Pagos` disponible para `operario`.
- `Ganancia diaria` editable desde panel.
- Alta rapida por barcode no encontrado.
- Scanner manual por categorias.
- Login operativo con credenciales rapidas.
- Ajustes para reducir falsos errores de sincronizacion.

### 2026-04-29

- Fix critico login/logout con timeouts.
- Hardening de sesion SSE.
- Impresion de tickets por QZ Tray con fallback navegador.
- Limpieza final de laboratorios de pago.
- Ajustes mobile de navbar y panel.

### 2026-04-28 a 2026-04-26

- Consolidacion inicial de auth real, scanner, panel y boundaries por feature.
- Separacion `components / model / services`.
- Fast path optimista para cobro.
- Stream SSE autenticado para dashboard.
- Limpieza de estado legacy y acoples viejos.

## Cambios vigentes por area

### Stock

- `Pedido`:
  - carga manual por proveedor.
  - ingreso rapido de productos.
  - resumen compacto paralelo.
  - modal de edicion dedicado.
- `Reparto`:
  - lista pedidos pendientes del operario.
  - permite editar antes de confirmar llegada.
  - permite cerrar pedido.
- `+Vendidos`:
  - ranking simple del dia para reposicion.

### Productos

- Visible solo para `admin`.
- Busqueda por nombre.
- Edicion de:
  - `nombre`
  - `precio`

### Panel de control

- SSE para metricas y movimientos.
- Vista de diagnostico reservada para soporte.
- Ganancia diaria editable.

### Scanner

- Foco continuo para operacion sin mouse.
- Cobro optimista.
- Cola local para reintentos.
- Impresion automatica por QZ Tray con fallback.

## Reglas operativas del frontend

- Cambio validado => documentacion en el mismo ciclo.
- Si cambia estructura, criterio o wiring:
  - actualizar `docs/architecture.md`.
- Si cambia funcionalidad visible, UX o flujo operativo:
  - actualizar `docs/bitacora.md`.
- Antes de cerrar cambios sensibles conviene validar:
  - `npm run lint`
  - `npm run test -- --run`
  - `npm run build`
  - `npm run test:smoke:web` si impacta flujo real

## Ruta rapida para nuevo agente

1. `README.md`
2. `docs/architecture.md`
3. `docs/bitacora.md`
4. `docs/saas-rebuild-frontend.md`
5. `src/features/auth/*`
6. `src/features/scanner/*`
7. `src/features/panelControl/*`
8. `src/features/stock/*`

## Nota de archivo

- Si una entrada vieja deja de aportar contexto operativo, conviene resumirla en vez de seguir acumulando ruido.
- La bitacora debe priorizar:
  - lo vigente.
  - lo reciente.
  - lo que ayuda a entender el estado actual del frontend.
