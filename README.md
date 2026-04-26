# LaClaudia Frontend

Frontend del flujo scanner (React + Vite + Redux Toolkit + Bootstrap).

## Scripts

- `npm run dev`
- `npm run build`
- `npm run build:gh`
- `npm run preview`
- `npm run deploy`

## Variables de entorno

- `VITE_API_URL=http://localhost:4000`
- `VITE_BASE_PATH=/`

## Deploy GitHub Pages

El workflow `deploy-gh-pages.yml` publica en cada push a `main`.

Variable recomendada en GitHub Actions:

- `VITE_API_URL_PROD=https://<tu-backend-render>.onrender.com`

## Documentacion tecnica

- Arquitectura: `docs/architecture.md`
- Bitacora: `docs/bitacora.md`
- Diario: `docs/daily/` (si se usa)
