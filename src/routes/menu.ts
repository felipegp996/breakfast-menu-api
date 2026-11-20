import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { BreakfastRequest } from "../models/breakfast-request";
import { env } from "../config/env";
import { refreshDailyStock } from "../services/daily-stock";

const router = Router();

router.get("/today", authenticate, async (request, response, next) => {
  try {
    const serviceDate = getServiceDate(env.APP_TIMEZONE);
    const [dailyStock, currentRequest] = await Promise.all([
      refreshDailyStock(serviceDate),
      BreakfastRequest.findOne({
        userId: request.auth!.userId,
        serviceDate,
        status: "active",
      }).lean(),
    ]);

    const ownReservation = new Map<string, number>();
    for (const item of currentRequest?.recipeSnapshot.ingredients ?? []) {
      ownReservation.set(item.ingredientId.toString(), item.quantity);
    }

    const availableRecipes = dailyStock.flatMap((entry) => {
      const requirements = entry.recipeSnapshot.ingredients;
      const canMakeForUser = requirements.every(({ ingredientId, quantity, availableQuantity }) =>
        availableQuantity + (ownReservation.get(ingredientId.toString()) ?? 0) >= quantity,
      );
      if (!canMakeForUser) return [];

      return [{
        id: entry.recipeId.toString(),
        name: entry.recipeSnapshot.name,
        description: entry.recipeSnapshot.description,
        imageUrl: entry.recipeSnapshot.imageUrl,
        ingredients: requirements.map(({ ingredientId, name, quantity, unit }) => ({
          ingredientId: ingredientId.toString(),
          name,
          unit,
          quantity,
        })),
      }];
    });

    response.json({
      serviceDate,
      recipes: availableRecipes,
      currentRequest: currentRequest ? {
        recipeId: currentRequest.recipeId.toString(),
        status: currentRequest.status,
        recipeSnapshot: currentRequest.recipeSnapshot,
      } : null,
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

export default router;