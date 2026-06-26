import {
  createScannerCustomerAccountPayment,
  createScannerCustomer,
  fetchScannerCustomerDetail,
  fetchScannerCustomers
} from '../../scanner/services/scanner.api';

export async function listCustomers({ token } = {}) {
  const payload = await fetchScannerCustomers({ token });
  return Array.isArray(payload?.customers) ? payload.customers : [];
}

export async function getCustomerDetail(customerId, { token } = {}) {
  return fetchScannerCustomerDetail(customerId, { token });
}

export async function createCustomer(payload, { token } = {}) {
  return createScannerCustomer(payload, { token });
}

export async function createCustomerPayment(customerId, payload, { token } = {}) {
  return createScannerCustomerAccountPayment(customerId, payload, { token });
}
