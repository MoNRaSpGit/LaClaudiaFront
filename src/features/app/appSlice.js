import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  apiStatus: 'idle',
  apiMessage: '',
  lastCheckAt: null,
  error: ''
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setApiChecking(state) {
      state.apiStatus = 'checking';
      state.error = '';
    },
    setApiSuccess(state, action) {
      state.apiStatus = 'online';
      state.apiMessage = action.payload;
      state.lastCheckAt = new Date().toISOString();
      state.error = '';
    },
    setApiError(state, action) {
      state.apiStatus = 'offline';
      state.error = action.payload;
      state.lastCheckAt = new Date().toISOString();
    }
  }
});

export const { setApiChecking, setApiSuccess, setApiError } = appSlice.actions;
export default appSlice.reducer;
