/**
 * Custom API Error wrapping RFC 7807 details returned by FastAPI.
 */
export class ApiError extends Error {
  type?: string;
  title?: string;
  status: number;
  detail: string;
  instance?: string;

  constructor(status: number, detail: string, title?: string, type?: string, instance?: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.title = title || "API Error";
    this.type = type;
    this.instance = instance;
    this.name = "ApiError";
  }
}

/**
 * Fetch wrapper client that enforces credentials (for HttpOnly cookies),
 * prepends the base path, and parses errors in the RFC 7807 format.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `/api/v1${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: "include", // Essential for HttpOnly access/refresh token cookies
  };

  const response = await fetch(url, config);

  // For 204 No Content or empty bodies
  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  const contentType = response.headers.get("content-type");
  
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // Attempt to parse RFC 7807 Error details
    if (data && typeof data === "object") {
      // Check if wrapped in "detail" object or list (like Pydantic ValidationError)
      const detailMsg = typeof data.detail === "string" 
        ? data.detail 
        : typeof data.detail === "object"
          ? JSON.stringify(data.detail)
          : "An unexpected error occurred.";
          
      throw new ApiError(
        response.status,
        detailMsg,
        data.title,
        data.type,
        data.instance
      );
    }
    throw new ApiError(response.status, String(data) || response.statusText);
  }

  return data as T;
}
