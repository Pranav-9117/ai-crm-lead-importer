import { ApiResponse, ApiError } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiClientError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Standardized API Client wrapping `fetch()` targeting the backend (`http://localhost:3001/api`).
 * Automatically unwraps `ApiResponse<T>` envelopes or throws a typed `ApiClientError`.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    // If response is not valid JSON
    if (!response.ok) {
      throw new ApiClientError(
        'HTTP_ERROR',
        `HTTP Error: ${response.status} ${response.statusText}`,
        response.status
      );
    }
  }

  if (!response.ok || (payload && !payload.success)) {
    const errorData: ApiError = payload?.error || {
      code: 'API_ERROR',
      message: `Request failed with status ${response.status}`,
    };
    throw new ApiClientError(
      errorData.code,
      errorData.message,
      response.status,
      errorData.details
    );
  }

  if (payload && payload.data !== undefined) {
    return payload.data;
  }

  return undefined as T;
}
