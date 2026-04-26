# Arquitectura Frontend

## Patron

- Feature folders por dominio.
- Estado global con Redux Toolkit.

## Estructura actual

- `src/features/app`: estado de salud de API.
- `src/features/scanner`: flujo scanner completo.

### Scanner feature

- `ScannerFeature.jsx`: compose UI principal.
- `model/useScannerController.js`: controlador de casos de uso.
- `services/scanner.api.js`: acceso HTTP al backend.
- `scannerSlice.js`: estado de scanner y ticket.
- `components/*`: UI desacoplada.

## Flujo principal

1. Carga inicial de 5 productos (`/api/scanner/products`).
2. Ingreso/escaneo de barcode.
3. Lookup por barcode (`/api/scanner/products/lookup`).
4. Si existe, se agrega al ticket con acumulacion de cantidad.
