// ============================================================================
// PECP Generated k6 Journey Modules
// Source Test Definition: test-def-proj-retailco-bf2026-v1.0 (v1.0)
// Bound Contract: contract-proj-retailco-bf26-v1.0-approved
// Generated At: 2026-09-19T15:58:29.033Z
// Consumes: PECP Stable k6 Runtime (executeStep, resolveCredential)
// ============================================================================
import { executeStep } from './runtime.js';
import { resolveCredential } from './runtime.js';

export const JOURNEY_WEIGHTS = {
  "browse": 0.55,
  "search": 0.2,
  "basket": 0.15,
  "checkout": 0.08,
  "account": 0.02
};

/**
 * Browse Catalog Journey (Weight: 55%)
 */
export function runBrowseJourney(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
  // Step: View Featured Products
  executeStep({
    method: 'GET',
    url: `${baseUrl}/api/v1/products/featured`,
    expectedStatus: 200,
    thinkTimeSeconds: 2,
    headers,
    tags: { journey: 'browse', step: 'step-browse-featured', name: 'View Featured Products' }
  });
}

/**
 * Search Catalog Journey (Weight: 20%)
 */
export function runSearchJourney(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
  // Step: Query Product Catalog
  executeStep({
    method: 'GET',
    url: `${baseUrl}/api/v1/products/search?q=electronics`,
    expectedStatus: 200,
    thinkTimeSeconds: 3,
    headers,
    tags: { journey: 'search', step: 'step-search-query', name: 'Query Product Catalog' }
  });
}

/**
 * Basket Operations Journey (Weight: 15%)
 */
export function runBasketJourney(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
  // Step: Add SKU to Basket
  executeStep({
    method: 'POST',
    url: `${baseUrl}/api/v1/basket/items`,
    body: {"sku":"SKU-ELECTRONICS-9921","quantity":1},
    expectedStatus: 200,
    thinkTimeSeconds: 2,
    headers,
    tags: { journey: 'basket', step: 'step-basket-add', name: 'Add SKU to Basket' }
  });
}

/**
 * Order Checkout Journey (Weight: 8%)
 */
export function runCheckoutJourney(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
  // Step: Submit Order Checkout
  // Credential Reference: __ENV['RETAILCO_CHECKOUT_AUTH_TOKEN']
  const authToken = resolveCredential('RETAILCO_CHECKOUT_AUTH_TOKEN', 'Checkout API Authorization');
  headers['Authorization'] = `Bearer ${authToken}`;
  executeStep({
    method: 'POST',
    url: `${baseUrl}/api/v1/orders/checkout`,
    body: {"basketId":"basket-active-ref","paymentMethod":"SYNTHETIC_CARD_TEST","shippingAddressId":"addr-ref-primary"},
    expectedStatus: 201,
    businessEvent: {"eventKey":"order_created","metric":"orders","unit":"orders","contribution":1,"expectedStatus":201,"description":"1 order attained per successful checkout submission"},
    thinkTimeSeconds: 4,
    headers,
    tags: { journey: 'checkout', step: 'step-checkout-submit', name: 'Submit Order Checkout' }
  });
}

/**
 * Account Overview Journey (Weight: 2%)
 */
export function runAccountJourney(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
  // Step: View Customer Order History
  executeStep({
    method: 'GET',
    url: `${baseUrl}/api/v1/customers/me/orders`,
    expectedStatus: 200,
    thinkTimeSeconds: 2,
    headers,
    tags: { journey: 'account', step: 'step-account-orders', name: 'View Customer Order History' }
  });
}

export const JOURNEY_RUNNER_MAP = {
  browse: runBrowseJourney,
  search: runSearchJourney,
  basket: runBasketJourney,
  checkout: runCheckoutJourney,
  account: runAccountJourney
};
