import http from 'node:http';
import { parse as parseUrl } from 'node:url';

/**
 * Deterministic catalog items matching RetailCo synthetic data profiles.
 */
export const SYNTHETIC_PRODUCTS = [
  {
    sku: 'SKU-ELECTRONICS-9921',
    name: 'Noise Cancelling Wireless Headphones',
    price: 199.99,
    category: 'electronics',
    inStock: true
  },
  {
    sku: 'SKU-ELECTRONICS-8812',
    name: 'Fast Wireless Charging Pad',
    price: 39.99,
    category: 'electronics',
    inStock: true
  },
  {
    sku: 'SKU-APPAREL-1044',
    name: 'Merino Wool Crew Sweater',
    price: 89.0,
    category: 'apparel',
    inStock: true
  }
];

export const SYNTHETIC_PAST_ORDERS = [
  {
    orderId: 'order-hist-1001',
    status: 'DELIVERED',
    total: 149.5,
    itemsCount: 2,
    createdAt: '2026-08-01T12:00:00Z'
  },
  {
    orderId: 'order-hist-1002',
    status: 'DELIVERED',
    total: 89.0,
    itemsCount: 1,
    createdAt: '2026-08-15T09:30:00Z'
  }
];

/**
 * Reads and parses JSON body from an incoming HTTP request.
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Safety limit: 1MB
      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

/**
 * Sends a JSON response with the given status code and headers.
 */
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Service-Name': 'retailco-reference-lab',
    'X-Service-Version': '1.0.0'
  });
  res.end(body);
}

/**
 * Creates and configures the RetailCo Reference Lab HTTP server.
 *
 * @param {object} options
 * @param {number} [options.port]
 * @param {string} [options.host]
 * @param {string|null} [options.authToken]
 * @param {boolean} [options.silent]
 */
export function createRetailCoLabServer(options = {}) {
  const port = options.port !== undefined ? options.port : (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080);
  const host = options.host || '0.0.0.0';
  const getAuthToken = () => {
    if (options.authToken !== undefined) {
      return options.authToken;
    }
    return process.env.RETAILCO_CHECKOUT_AUTH_TOKEN || null;
  };
  const silent = Boolean(options.silent);

  const metrics = {
    startTime: Date.now(),
    requestCountsByRoute: {},
    statusCounts: {},
    businessAttainmentEvents: {
      order_created: 0
    }
  };

  const recordMetric = (routeKey, status) => {
    metrics.requestCountsByRoute[routeKey] = (metrics.requestCountsByRoute[routeKey] || 0) + 1;
    metrics.statusCounts[status] = (metrics.statusCounts[status] || 0) + 1;
  };

  const server = http.createServer(async (req, res) => {
    const { pathname, query } = parseUrl(req.url || '/', true);
    const method = req.method || 'GET';

    try {
      // 1. Health Probe
      if (method === 'GET' && pathname === '/health') {
        recordMetric('/health', 200);
        return sendJson(res, 200, {
          status: 'healthy',
          service: 'retailco-reference-lab',
          version: '1.0.0',
          uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
          timestamp: new Date().toISOString()
        });
      }

      // 2. Readiness Probe
      if (method === 'GET' && pathname === '/ready') {
        recordMetric('/ready', 200);
        const currentToken = getAuthToken();
        return sendJson(res, 200, {
          status: 'ready',
          service: 'retailco-reference-lab',
          version: '1.0.0',
          profiles: {
            customerAccounts: 100000,
            activeSkus: 50000,
            syntheticPaymentTokens: 'v1'
          },
          authConfigured: Boolean(currentToken),
          timestamp: new Date().toISOString()
        });
      }

      // 3. Featured Products Browse
      if (method === 'GET' && pathname === '/api/v1/products/featured') {
        recordMetric('/api/v1/products/featured', 200);
        return sendJson(res, 200, {
          products: SYNTHETIC_PRODUCTS,
          total: SYNTHETIC_PRODUCTS.length
        });
      }

      // 4. Product Catalog Search
      if (method === 'GET' && pathname === '/api/v1/products/search') {
        recordMetric('/api/v1/products/search', 200);
        const q = typeof query.q === 'string' ? query.q.toLowerCase() : '';
        const matches = q
          ? SYNTHETIC_PRODUCTS.filter(
              (p) =>
                p.category.toLowerCase().includes(q) ||
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            )
          : SYNTHETIC_PRODUCTS;
        return sendJson(res, 200, {
          query: q,
          products: matches,
          total: matches.length
        });
      }

      // 5. Basket Add Item
      if (method === 'POST' && pathname === '/api/v1/basket/items') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          recordMetric('/api/v1/basket/items', 400);
          return sendJson(res, 400, {
            error: 'BAD_REQUEST',
            message: 'Malformed JSON payload'
          });
        }

        if (!body || typeof body.sku !== 'string' || typeof body.quantity !== 'number' || body.quantity <= 0) {
          recordMetric('/api/v1/basket/items', 400);
          return sendJson(res, 400, {
            error: 'BAD_REQUEST',
            message: 'Missing or invalid required fields: sku (string), quantity (positive number)'
          });
        }

        recordMetric('/api/v1/basket/items', 200);
        return sendJson(res, 200, {
          basketId: 'basket-active-ref',
          status: 'ACTIVE',
          item: {
            sku: body.sku,
            quantity: body.quantity
          },
          itemCount: body.quantity,
          total: 199.99
        });
      }

      // 6. Submit Order Checkout
      if (method === 'POST' && pathname === '/api/v1/orders/checkout') {
        const currentToken = getAuthToken();

        // Safe failure when expected credential configuration is absent
        if (!currentToken) {
          recordMetric('/api/v1/orders/checkout', 401);
          return sendJson(res, 401, {
            error: 'UNAUTHORIZED',
            message: 'Authorization token not configured in lab environment'
          });
        }

        const authHeader = req.headers['authorization'];
        if (!authHeader || authHeader !== `Bearer ${currentToken}`) {
          recordMetric('/api/v1/orders/checkout', 401);
          return sendJson(res, 401, {
            error: 'UNAUTHORIZED',
            message: 'Missing or invalid Bearer authorization token'
          });
        }

        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          recordMetric('/api/v1/orders/checkout', 400);
          return sendJson(res, 400, {
            error: 'BAD_REQUEST',
            message: 'Malformed JSON payload'
          });
        }

        if (!body || !body.basketId || !body.paymentMethod || !body.shippingAddressId) {
          recordMetric('/api/v1/orders/checkout', 400);
          return sendJson(res, 400, {
            error: 'BAD_REQUEST',
            message: 'Missing required checkout fields: basketId, paymentMethod, shippingAddressId'
          });
        }

        // Exactly one business event: order_created (contribution = 1)
        metrics.businessAttainmentEvents.order_created += 1;
        const currentOrderNum = metrics.businessAttainmentEvents.order_created;

        recordMetric('/api/v1/orders/checkout', 201);
        return sendJson(res, 201, {
          orderId: `order-syn-${Date.now()}-${currentOrderNum}`,
          status: 'CREATED',
          basketId: body.basketId,
          businessEvent: {
            eventKey: 'order_created',
            metric: 'orders',
            unit: 'orders',
            contribution: 1
          },
          createdAt: new Date().toISOString()
        });
      }

      // 7. Customer Order History
      if (method === 'GET' && pathname === '/api/v1/customers/me/orders') {
        recordMetric('/api/v1/customers/me/orders', 200);
        return sendJson(res, 200, {
          customerId: 'cust-synthetic-me',
          orders: SYNTHETIC_PAST_ORDERS,
          total: SYNTHETIC_PAST_ORDERS.length
        });
      }

      // 8. Internal Metrics (for testing / preflight observation)
      if (method === 'GET' && (pathname === '/metrics' || pathname === '/api/v1/metrics')) {
        recordMetric(pathname, 200);
        return sendJson(res, 200, {
          service: 'retailco-reference-lab',
          version: '1.0.0',
          uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
          requestCounts: metrics.requestCountsByRoute,
          statusCounts: metrics.statusCounts,
          businessAttainmentEvents: metrics.businessAttainmentEvents
        });
      }

      // 9. Unknown route
      recordMetric('NOT_FOUND', 404);
      return sendJson(res, 404, {
        error: 'NOT_FOUND',
        message: `Endpoint ${method} ${pathname} not found in Reference Lab manifest`
      });
    } catch (err) {
      recordMetric('INTERNAL_SERVER_ERROR', 500);
      return sendJson(res, 500, {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error occurred in Reference Lab'
      });
    }
  });

  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          const addr = server.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          if (!silent) {
            console.log(`[retailco-reference-lab] Listening on http://${host}:${actualPort}`);
          }
          resolve({ port: actualPort, host });
        });
        server.on('error', reject);
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
    getPort: () => {
      const addr = server.address();
      return typeof addr === 'object' && addr ? addr.port : port;
    },
    getMetrics: () => ({ ...metrics }),
    resetMetrics: () => {
      metrics.requestCountsByRoute = {};
      metrics.statusCounts = {};
      metrics.businessAttainmentEvents.order_created = 0;
    }
  };
}

// Standalone CLI execution
const isMain = process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server.ts'));
if (isMain) {
  const lab = createRetailCoLabServer();
  lab.start().catch((err) => {
    console.error('[retailco-reference-lab] Failed to start:', err);
    process.exit(1);
  });
}
