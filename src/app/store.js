import { configureStore } from '@reduxjs/toolkit';
import appReducer from '../features/app/appSlice';
import scannerReducer from '../features/scanner/scannerSlice';
import panelControlReducer from '../features/panelControl/panelControlSlice';

export const store = configureStore({
  reducer: {
    app: appReducer,
    scanner: scannerReducer,
    panelControl: panelControlReducer
  }
});
