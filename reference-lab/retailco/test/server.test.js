import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRetailCoLabServer } from '../src/server.js';

test('RetailCo Reference Lab Service Tests', async (t) => {
  const EPHEMERAL_TOKEN = `ephemeral-lab-token-${crypto.randomUUID()}`;
  const lab = createRetailCoLabServer({
    port: 0, // ephemeral port
    authToken: EPHEMERAL_TOKEN,
    silent: true
  });

  const { port } = await lab.start();
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(async () => {
    await lab.stop();
  });

  await t.test('GET /health returns 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
    assert.equal(body.service, 'retailco-reference-lab');
  });

  await t.test('GET /ready returns 200 with synthetic profiles', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ready');
    assert.equal(body.profiles.customerAccounts, 100000);
    assert.equal(body.profiles.activeSkus, 50000);
    assert.equal(body.authConfigured, true);
  });

  await t.test('GET /api/v1/products/featured returns 200 with products', async () => {
    const res = await fetch(`${baseUrl}/api/v1/products/featured`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(Array.isArray(body.products), true);
    assert.equal(body.products.length >= 3, true);
    assert.equal(body.products[0].sku, 'SKU-ELECTRONICS-9921');
  });

  await t.test('GET /api/v1/products/search returns 200 matching query', async () => {
    const res = await fetch(`${baseUrl}/api/v1/products/search?q=electronics`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.query, 'electronics');
    assert.equal(body.products.length >= 2, true);
    assert.equal(body.products.every((p) => p.category === 'electronics'), true);
  });

  await t.test('POST /api/v1/basket/items validates payload and returns 200', async () => {
    // Valid payload
    const resValid = await fetch(`${baseUrl}/api/v1/basket/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'SKU-ELECTRONICS-9921', quantity: 1 })
    });
    assert.equal(resValid.status, 200);
    const bodyValid = await resValid.json();
    assert.equal(bodyValid.basketId, 'basket-active-ref');
    assert.equal(bodyValid.item.sku, 'SKU-ELECTRONICS-9921');

    // Invalid payload: missing quantity
    const resInvalid = await fetch(`${baseUrl}/api/v1/basket/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: 'SKU-ELECTRONICS-9921' })
    });
    assert.equal(resInvalid.status, 400);
  });

  await t.test('POST /api/v1/orders/checkout rejects unauthorized requests safely', async () => {
    // Missing Authorization header
    const resMissing = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basketId: 'basket-active-ref',
        paymentMethod: 'SYNTHETIC_CARD_TEST',
        shippingAddressId: 'addr-ref-primary'
      })
    });
    assert.equal(resMissing.status, 401);
    const bodyMissing = await resMissing.json();
    assert.equal(bodyMissing.error, 'UNAUTHORIZED');
    assert.equal(JSON.stringify(bodyMissing).includes(EPHEMERAL_TOKEN), false);

    // Invalid Authorization header
    const resWrong = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-wrong-token'
      },
      body: JSON.stringify({
        basketId: 'basket-active-ref',
        paymentMethod: 'SYNTHETIC_CARD_TEST',
        shippingAddressId: 'addr-ref-primary'
      })
    });
    assert.equal(resWrong.status, 401);
    const bodyWrong = await resWrong.json();
    assert.equal(bodyWrong.error, 'UNAUTHORIZED');
    assert.equal(JSON.stringify(bodyWrong).includes(EPHEMERAL_TOKEN), false);
    assert.equal(JSON.stringify(bodyWrong).includes('invalid-wrong-token'), false);
  });

  await t.test('POST /api/v1/orders/checkout accepts valid auth and records order_created event', async () => {
    const prevCount = lab.getMetrics().businessAttainmentEvents.order_created;

    const res = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EPHEMERAL_TOKEN}`
      },
      body: JSON.stringify({
        basketId: 'basket-active-ref',
        paymentMethod: 'SYNTHETIC_CARD_TEST',
        shippingAddressId: 'addr-ref-primary'
      })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.status, 'CREATED');
    assert.equal(body.businessEvent.eventKey, 'order_created');
    assert.equal(body.businessEvent.contribution, 1);

    const newCount = lab.getMetrics().businessAttainmentEvents.order_created;
    assert.equal(newCount, prevCount + 1);
  });

  await t.test('GET /api/v1/customers/me/orders returns 200 with past orders', async () => {
    const res = await fetch(`${baseUrl}/api/v1/customers/me/orders`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.customerId, 'cust-synthetic-me');
    assert.equal(Array.isArray(body.orders), true);
    assert.equal(body.orders.length >= 2, true);
  });

  await t.test('GET /api/v1/metrics exposes internal counters', async () => {
    const res = await fetch(`${baseUrl}/api/v1/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.service, 'retailco-reference-lab');
    assert.equal(body.businessAttainmentEvents.order_created >= 1, true);
  });
});
