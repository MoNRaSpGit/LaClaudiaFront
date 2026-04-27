# LaClaudia Frontend

Frontend del flujo scanner (React + Vite + Redux Toolkit + Bootstrap).

## Scripts

- `npm run dev`
- `npm run build`
- `npm run build:gh`
- `npm run build:gh:prod`
- `npm run preview`
- `npm run deploy`
- `npm run test`
- `npm run test:watch`

## Variables de entorno

- `VITE_API_URL=http://localhost:4000`
- `VITE_API_URL_PROD=https://<tu-backend-render>.onrender.com` (solo para build/deploy de producción)
- `VITE_BASE_PATH=/`
- `VITE_BOOT_MIN_DELAY_MS=3000` (si se implementa luego por env, hoy esta fijo en codigo para simular arranque)

## Deploy GitHub Pages

El workflow `deploy-gh-pages.yml` publica en cada push a `main`.

Variable recomendada en GitHub Actions:

- `VITE_API_URL_PROD=https://<tu-backend-render>.onrender.com`

Deploy manual seguro (evita publicar con `localhost`):

1. Definir `VITE_API_URL_PROD`
2. Ejecutar `npm run deploy`

## Documentacion tecnica

- Arquitectura: `docs/architecture.md`
- Bitacora: `docs/bitacora.md`
- Handoff integracion: `docs/handoff-auth-caja-backend.md`
- Diario: `docs/daily/` (si se usa)

## Para nuevo agente

Leer en orden:
1. `README.md`
2. `docs/architecture.md`
3. `docs/bitacora.md`
4. `src/features/auth/*`, `src/features/scanner/*`, `src/features/panelControl/*`

## Estado de login actual

- Hay una capa UX de autenticacion en `src/features/auth/*` conectada a backend real.
- Incluye:
  - pantalla de boot inicial (disimula arranque de servicio free).
  - login por `usuario + clave` via `POST /api/auth/login`.
  - cierre de sesion via `POST /api/auth/logout`.
  - opcion de recordar usuario/clave en dispositivo local (modo operativo actual).
