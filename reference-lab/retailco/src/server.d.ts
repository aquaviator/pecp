import type { Server } from 'node:http';

export interface RetailCoLabOptions {
  port?: number;
  host?: string;
  authToken?: string;
  silent?: boolean;
}

export interface RetailCoLabMetrics {
  requestCountsByRoute: Record<string, number>;
  statusCounts: Record<string, number>;
  businessAttainmentEvents: {
    order_created: number;
  };
}

export interface RetailCoLabInstance {
  server: Server;
  start: () => Promise<{ port: number; host: string }>;
  stop: () => Promise<void>;
  getPort: () => number;
  getMetrics: () => RetailCoLabMetrics;
  resetMetrics: () => void;
}

export declare const SYNTHETIC_PRODUCTS: Array<{
  sku: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}>;

export declare const SYNTHETIC_PAST_ORDERS: Array<{
  orderId: string;
  status: string;
  total: number;
  itemsCount: number;
  createdAt: string;
}>;

export declare function createRetailCoLabServer(options?: RetailCoLabOptions): RetailCoLabInstance;
