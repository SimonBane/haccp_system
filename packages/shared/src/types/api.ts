export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
  database: "connected";
};

export type ApiError = {
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
};
