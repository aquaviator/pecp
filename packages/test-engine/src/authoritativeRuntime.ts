// ============================================================================
// PECP Authoritative Stable k6 Runtime Source Binding
// Single source of truth: Packaged directly from execution/k6-runtime/src/runtime.js
// Eliminates duplicate hand-maintained strings (Constitution §10, Work Package M3.0.2).
// ============================================================================
import authoritativeRuntimeSource from '../../../execution/k6-runtime/src/runtime.js?raw';

export const PECP_STABLE_K6_RUNTIME_VERSION = '1.0.0';
export const PECP_STABLE_K6_RUNTIME_SOURCE_ID = 'pecp-stable-k6-runtime-v1.0.0';
export const PECP_AUTHORITATIVE_RUNTIME_PATH = 'execution/k6-runtime/src/runtime.js';

export const PECP_STABLE_K6_RUNTIME_SOURCE = authoritativeRuntimeSource;
