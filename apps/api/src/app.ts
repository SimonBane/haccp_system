import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import { routes } from "./routes/index.js";

export const app = new Hono();

app.use("*", corsMiddleware);
app.route("/", routes);

app.get("/", (c) => c.json({ message: "HACCP API" }));
