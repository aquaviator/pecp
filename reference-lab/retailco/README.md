# RetailCo Reference Performance Lab

Deterministic Reference Performance Lab service for PECP M3 execution testing.

## Overview

A lightweight, zero-external-dependency Node.js HTTP service implementing the exact surface required by the canonical RetailCo M3 execution journeys.

- **Zero runtime dependencies**: Pure `node:http` implementation.
- **Deterministic responses**: Stable synthetic product catalogs, search results, basket structures, and order histories.
- **Ephemeral runtime credentials**: Never stores or commits secrets; enforces `Bearer <token>` via `RETAILCO_CHECKOUT_AUTH_TOKEN`.
- **Governed attainment signal**: Each successful checkout (`POST /api/v1/orders/checkout`) emits exactly 1 `order_created` business attainment event.

## Endpoints

| Route | Method | Expected Status | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | GET | 200 | No | Liveness and service metadata |
| `/ready` | GET | 200 | No | Readiness and synthetic data profile validation |
| `/api/v1/products/featured` | GET | 200 | No | Browse featured products |
| `/api/v1/products/search` | GET | 200 | No | Catalog query search |
| `/api/v1/basket/items` | POST | 200 | No | Add SKU item to basket |
| `/api/v1/orders/checkout` | POST | 201 | Yes (Bearer) | Submit order checkout (`order_created` = 1) |
| `/api/v1/customers/me/orders` | GET | 200 | No | Customer past order history |
| `/api/v1/metrics` | GET | 200 | No | Internal request & business event counters |

## Environment Variables

- `PORT`: Port to listen on (default: `8080`).
- `RETAILCO_CHECKOUT_AUTH_TOKEN`: Ephemeral runtime secret for `/api/v1/orders/checkout`. If absent, checkout safely rejects with `401 Unauthorized`.

## Local Execution

```bash
export PORT=8080
export RETAILCO_CHECKOUT_AUTH_TOKEN="test-ephemeral-token"
node src/server.js
```

## Docker Execution

```bash
docker build -t retailco-reference-lab .
docker run -p 8080:8080 -e RETAILCO_CHECKOUT_AUTH_TOKEN="test-ephemeral-token" retailco-reference-lab
```
