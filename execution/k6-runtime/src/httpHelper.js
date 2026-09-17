// PECP Stable k6 Runtime - HTTP Helper
import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Executes a standardized HTTP step with timing, metric tagging, and checks.
 */
export function executeStep(stepConfig) {
  const {
    method,
    url,
    body,
    headers = {},
    tags = {},
    expectedStatus = 200,
    thinkTime = 1
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
  } else {
    res = http.get(url, params);
  }

  check(res, {
    [`${tags.name || 'Step'} status is ${expectedStatus}`]: (r) => r.status === expectedStatus
  });

  if (thinkTime > 0) {
    sleep(thinkTime);
  }

  return res;
}
