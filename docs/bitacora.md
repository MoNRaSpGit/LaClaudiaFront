# Bitacora Frontend

## Estado actual (2026-04-26)

Estamos trabajando en una version funcional del flujo Scanner + Panel Control, priorizando UX y validacion de comportamiento antes de pasar toda la logica pesada al backend/BDD.

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

- Mantener una fase liviana en frontend para validar flujo de negocio y UX.
- Tratar producto manual como linea de ticket (no catalogo fijo):
  - `isManual: true`
  - `productId: null`

## Pendientes inmediatos (siguiente etapa)

1. Flujo `barcode no encontrado`:
   - abrir modal de valor.
   - crear alta real con barcode + precio + nombre default.
2. Persistir ventas/pagos en backend + BDD2.
3. Quitar flag de simulacion visual cuando no sea necesario:
   - `SIMULATE_EDITING_BANNER`.
4. Documentar cierre diario de caja y preparar endpoints de reporting.

## Archivos clave de frontend

- `src/features/scanner/*`
- `src/features/panelControl/*`
- `src/styles.css`
