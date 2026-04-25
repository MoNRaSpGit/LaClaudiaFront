# LaClaudia Frontend

Frontend base con React + Vite + Redux Toolkit + Bootstrap.

## Scripts

- `npm run dev`: desarrollo local.
- `npm run build`: build de produccion.
- `npm run preview`: preview local de build.
- `npm run deploy`: publica `dist` en GitHub Pages.

## Variables de entorno

- `VITE_API_URL=http://localhost:4000`
- `VITE_BASE_PATH=/`

Para GitHub Pages:

- `VITE_BASE_PATH=/<nombre-repo>/`
- `VITE_API_URL=https://<tu-backend-render>.onrender.com`

## Deploy sugerido

1. Configurar variables de entorno para produccion.
2. Ejecutar `npm run build`.
3. Ejecutar `npm run deploy`.
