// Shared API Client
// Defined according to M5.1 Work Package §18
// Handles base URL, credentialed requests, CSRF injection, and error formatting

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export class ApiClient {
  readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PECP_API_BASE_URL) ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  getCsrfToken(): string | null {
    return getCookie('pecp_csrf');
  }

  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const method = (options.method || 'GET').toUpperCase();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    if (isMutation) {
      if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
      }
      const csrf = this.getCsrfToken();
      if (csrf && !headers['X-PECP-CSRF'] && !headers['x-pecp-csrf']) {
        headers['X-PECP-CSRF'] = csrf;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: options.credentials || 'include'
      });
    } catch (networkError: any) {
      throw new Error(`Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
    }

    if (!response.ok) {
      let errorMsg = `PECP API error: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use default message
      }
      const err = new Error(errorMsg);
      (err as any).status = response.status;
      throw err;
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const data = await response.json();
    return data as T;
  }

  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  async patch<T>(path: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  async delete<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const defaultApiClient = new ApiClient();
