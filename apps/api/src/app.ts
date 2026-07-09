import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { routes } from "./routes/index.js";
import type { AppEnv } from "./types.js";

export const app = new Hono<AppEnv>();

app.use("*", requestIdMiddleware);
app.use("*", corsMiddleware);
app.route("/", routes);

app.get("/", (c) => c.json({ message: "HACCP API" }));

app.notFound(notFoundHandler);
app.onError(errorHandler);

export default app;
