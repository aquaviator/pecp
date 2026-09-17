// PECP Stable k6 Runtime - HTTP Helper
import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Executes a standardized HTTP step with timing, metric tagging, and checks.
 * Does NOT invent defaults: expectedStatus and thinkTimeSeconds are explicit.
 */
export function executeStep(stepConfig) {
  const {
    method = 'GET',
    url,
    body,
    headers = {},
    tags = {},
    expectedStatus,
    thinkTimeSeconds = 0
  } = stepConfig;

  const params = {
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    tags
  };

  let res;
  const verb = method.toUpperCase();
  if (verb === 'GET') {
    res = http.get(url, params);
  } else if (verb === 'POST') {
    res = http.post(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'PUT') {
    res = http.put(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'DELETE') {
    res = http.del(url, params);
  } else if (verb === 'PATCH') {
    res = http.patch(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else {
    res = http.get(url, params);
  }

  // Check expected status ONLY if explicitly defined
  if (expectedStatus !== undefined && expectedStatus !== null) {
    check(res, {
      [`${tags.name || 'Step'} status is ${expectedStatus}`]: (r) => r.status === expectedStatus
    });
  }

  // Sleep ONLY if explicitly provided and greater than zero
  if (typeof thinkTimeSeconds === 'number' && thinkTimeSeconds > 0) {
    sleep(thinkTimeSeconds);
  }

  return res;
}

