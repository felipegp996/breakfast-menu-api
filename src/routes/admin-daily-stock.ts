import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/authenticate";
import { env } from "../config/env";
import { refreshDailyStock } from "../services/daily-stock";

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

router.use(authenticate, requireAdmin);

router.get("/", async (request, response, next) => {
  try {
    const requestedDate = typeof request.query.date === "string" ? request.query.date : undefined;
    const serviceDate = requestedDate ?? getServiceDate(env.APP_TIMEZONE);
    if (!isValidServiceDate(serviceDate)) {
      response.status(400).json({ error: "Date must be a valid YYYY-MM-DD date." });
      return;
    }

    const entries = await refreshDailyStock(serviceDate);
    response.json({
      serviceDate,
      recipes: entries.map((entry) => ({
        id: entry.recipeId.toString(),
        name: entry.recipeSnapshot.name,
        description: entry.recipeSnapshot.description,
        imageUrl: entry.recipeSnapshot.imageUrl,
        isAvailable: entry.isAvailable,
        ingredients: entry.recipeSnapshot.ingredients.map((ingredient) => ({
          ingredientId: ingredient.ingredientId.toString(),
          name: ingredient.name,
          unit: ingredient.unit,
          requiredQuantity: ingredient.quantity,
          availableQuantity: ingredient.availableQuantity,
          isSufficient: ingredient.availableQuantity >= ingredient.quantity,
        })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

function getServiceDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidServiceDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export default router;