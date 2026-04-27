import { configureStore } from '@reduxjs/toolkit';
import scannerReducer from '../features/scanner/scannerSlice';

export const store = configureStore({
  reducer: {
    scanner: scannerReducer
  }
});
