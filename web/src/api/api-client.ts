export interface SSEHandlers {
  onToken: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onComplete: (response?: any) => void;
  onError: (error: Error) => void;
}

export class ApiClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(baseUrl: string, authToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authToken = authToken;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    return this.handleResponse(res);
  }

  async post<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(res);
  }

  async put<T>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(res);
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE', headers: this.headers() });
    return this.handleResponse(res);
  }

  async sse(path: string, body: any, handlers: SSEHandlers): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      handlers.onError(new Error(`HTTP ${response.status}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      handlers.onError(new Error('No response body'));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                handlers.onError(new Error(data.error));
                return;
              }
              if (data.done) {
                handlers.onComplete({ content: data.fullText, reasoning: data.reasoning });
                return;
              }
              if (data.token) handlers.onToken(data.token);
              if (data.reasoning) handlers.onReasoningToken?.(data.reasoning);
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (error) {
      handlers.onError(error as Error);
    }
  }

  private async handleResponse(res: Response): Promise<any> {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json.success === false && json.error) throw new Error(json.error.message);
    return json.data !== undefined ? json.data : json;
  }
}
