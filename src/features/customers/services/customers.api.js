import {
  createScannerCustomerAccountPayment,
  createScannerCustomer,
  deleteScannerCustomer,
  fetchScannerCustomerDetail,
  fetchScannerCustomers
} from '../../scanner/services/scanner.api';

function normalizeCustomerSummary(customer = {}) {
  const id = Number(customer?.id || customer?.customerId || 0);
  return {
    ...customer,
    id: Number.isInteger(id) && id > 0 ? id : customer?.id,
    name: String(customer?.name || customer?.nombre || customer?.fullName || '').trim(),
    phone: String(customer?.phone || customer?.telefono || '').trim(),
    debtTotal: Number(customer?.debtTotal ?? customer?.deudaTotal ?? 0) || 0
  };
}

function normalizeCustomerDetail(payload = {}) {
  const customer = payload?.customer
    ? normalizeCustomerSummary(payload.customer)
    : null;

  return {
    ...payload,
    customer
  };
}

function buildCreateCustomerPayload(payload = {}) {
  const normalizedName = String(payload?.name || payload?.nombre || '').trim();
  const normalizedPhone = String(payload?.phone || payload?.telefono || '').trim();

  if (!normalizedName) {
    const error = new Error('Ingresa un nombre para guardar el cliente.');
    error.code = 'INVALID_CUSTOMER_NAME';
    throw error;
  }

  return {
    name: normalizedName,
    phone: normalizedPhone || null
  };
}

export async function listCustomers({ token } = {}) {
  const payload = await fetchScannerCustomers({ token });
  return Array.isArray(payload?.customers)
    ? payload.customers.map((customer) => normalizeCustomerSummary(customer))
    : [];
}

export async function getCustomerDetail(customerId, { token } = {}) {
  const payload = await fetchScannerCustomerDetail(customerId, { token });
  return normalizeCustomerDetail(payload);
}

export async function createCustomer(payload, { token } = {}) {
  const normalizedPayload = buildCreateCustomerPayload(payload);

  try {
    const result = await createScannerCustomer(normalizedPayload, { token });
    return normalizeCustomerDetail(result);
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status !== 400 && status !== 422) {
      throw error;
    }

    const fallbackPayload = {
      nombre: normalizedPayload.name,
      telefono: normalizedPayload.phone
    };
    const result = await createScannerCustomer(fallbackPayload, { token });
    return normalizeCustomerDetail(result);
  }
}

export async function createCustomerPayment(customerId, payload, { token } = {}) {
  return createScannerCustomerAccountPayment(customerId, payload, { token });
}

export async function removeCustomer(customerId, { token } = {}) {
  return deleteScannerCustomer(customerId, { token });
}
