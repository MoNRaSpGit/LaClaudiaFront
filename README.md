# LaClaudia Frontend

Frontend base con React + Vite + Redux Toolkit + Bootstrap.

## Scripts

- `npm run dev`: desarrollo local.
- `npm run build`: build de produccion.
- `npm run build:gh`: build con base path para GitHub Pages (`/LaClaudiaFront/`).
- `npm run preview`: preview local de build.
- `npm run deploy`: publica `dist` manualmente en GitHub Pages (`gh-pages`).

## Variables de entorno

- `VITE_API_URL=http://localhost:4000`
- `VITE_BASE_PATH=/`

Para GitHub Pages:

- `VITE_BASE_PATH=/<nombre-repo>/`
- `VITE_API_URL=https://<tu-backend-render>.onrender.com`

## Deploy automatico con GitHub Actions

1. En GitHub, abrir el repo `LaClaudiaFront`.
2. Ir a `Settings -> Pages`.
3. En `Source`, seleccionar `GitHub Actions`.
4. Ir a `Settings -> Secrets and variables -> Actions -> Variables`.
5. Crear variable `VITE_API_URL_PROD` con tu URL de Render, por ejemplo:
   `https://tu-backend.onrender.com`
6. Hacer push a `main`.

Workflow configurado:

- `.github/workflows/deploy-gh-pages.yml`
- Build con `VITE_BASE_PATH=/LaClaudiaFront/`
- Publicacion automatica a GitHub Pages en cada push a `main`.
