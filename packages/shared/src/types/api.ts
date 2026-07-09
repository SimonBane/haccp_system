export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
};

export type ApiError = {
  error: string;
  message: string;
};
