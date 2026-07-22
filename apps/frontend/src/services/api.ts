const API_BASE = ''; // proxied by Vite

interface RequestOptions extends RequestInit {
  bodyData?: any;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: string[];
  };
}

class APIClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('indra_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers = {
      ...this.getHeaders(),
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (options.bodyData) {
      config.body = JSON.stringify(options.bodyData);
    }

    try {
      const response = await fetch(url, config);
      const payload: APIResponse<T> = await response.json().catch(() => ({
        success: false,
        error: { message: 'Invalid server response structure.', code: 'SERVER_JSON_ERROR' },
      }));

      if (!response.ok || !payload.success) {
        const errorMsg = payload.error?.message 
          || (response.status === 401 
              ? 'Session expired or user not authenticated. Please log in with a valid account.'
              : `HTTP Exception ${response.status}: ${response.statusText}`);
        const error = new Error(errorMsg) as any;
        error.code = payload.error?.code || 'HTTP_ERROR';
        error.status = response.status;
        error.details = payload.error?.details;
        throw error;
      }

      return payload.data as T;
    } catch (err: any) {
      console.error(`[API Error] Request to ${path} failed:`, err);
      throw err;
    }
  }

  public get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T = any>(path: string, bodyData: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', bodyData });
  }

  public put<T = any>(path: string, bodyData: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', bodyData });
  }

  public delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new APIClient();
export default api;
