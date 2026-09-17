export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeApiFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: json.error || json.message || `Request failed with status HTTP ${res.status}`,
            data: json,
          };
        }
        if (json.success === false) {
          return {
            ok: false,
            status: res.status,
            error: json.error || json.message || 'Operation failed',
            data: json,
          };
        }
        return { ok: true, status: res.status, data: json };
      } catch {
        return {
          ok: false,
          status: res.status,
          error: `Invalid JSON response from server (HTTP ${res.status}).`,
        };
      }
    } else {
      return {
        ok: false,
        status: res.status,
        error: `Server returned non-JSON response (${res.status} ${res.statusText || ''}).`.trim(),
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err.message || 'Network request failed or timed out.',
    };
  }
}
