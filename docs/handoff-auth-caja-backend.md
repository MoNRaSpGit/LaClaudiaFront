# Handoff - Auth + Caja hacia Backend

## Estado actual

- Login y boot funcionan con backend real.
- Scanner y Panel funcionan con persistencia/resumen backend.
- Flujo operativo pensado para caja:
  - foco automatico en input `Escanear aqui`.
  - acciones sin depender de mouse.

## Contrato activo

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/scanner/sales`
- `POST /api/scanner/payments`
- `GET /api/scanner/dashboard`

## Proximo foco recomendado

1. Alta rapida de producto para `barcode no encontrado`.
2. Endpoints/reportes de cierre diario de caja.
3. Endurecer permisos por rol en nuevos endpoints.
