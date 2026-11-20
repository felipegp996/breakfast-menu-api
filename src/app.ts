import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { env } from "./config/env";
import authRouter from "./routes/auth";
import ingredientAdminRouter from "./routes/admin-ingredients";
import recipeAdminRouter from "./routes/admin-recipes";
import dailyStockAdminRouter from "./routes/admin-daily-stock";
import notificationAdminRouter from "./routes/admin-notifications";
import menuRouter from "./routes/menu";
import requestRouter from "./routes/requests";
import { connectToDatabase } from "./config/database";

export const app = express();

app.disable("x-powered-by");
app.use(cors({ origin: env.UI_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

app.use(async (_request, _response, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "breakfast-menu-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/admin/ingredients", ingredientAdminRouter);
app.use("/api/admin/recipes", recipeAdminRouter);
app.use("/api/admin/daily-stock", dailyStockAdminRouter);
app.use("/api/admin/notifications", notificationAdminRouter);
app.use("/api/menu", menuRouter);
app.use("/api/requests", requestRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "Route not found." });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "An unexpected error occurred." });
};

app.use(errorHandler);

export default app;