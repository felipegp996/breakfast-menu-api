import { Router } from "express";
import { Types, type HydratedDocument } from "mongoose";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate";
import { dbConnections } from "../config/database";
import { env } from "../config/env";
import { BreakfastRequest, type BreakfastRequestDocument, type RequestIngredientSnapshot } from "../models/breakfast-request";
import { Ingredient } from "../models/ingredient";
import { Notification } from "../models/notification";
import { Recipe } from "../models/recipe";
import { User } from "../models/user";
import { refreshDailyStock } from "../services/daily-stock";

const router = Router();
const createRequestSchema = z.object({ recipeId: z.string().regex(/^[a-f\d]{24}$/i) });

class StockUnavailableError extends Error {}

router.post("/", authenticate, async (request, response, next) => {
  const parsed = createRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Choose a valid recipe." });
    return;
  }

  try {
    const recipe = await Recipe.findOne({ _id: parsed.data.recipeId, isActive: true }).lean();
    if (!recipe) {
      response.status(404).json({ error: "This recipe is no longer available." });
      return;
    }

    const recipeIngredientIds = recipe.ingredients.map(({ ingredientId }) => ingredientId);
    const activeIngredients = await Ingredient.find({
      _id: { $in: recipeIngredientIds },
      isActive: true,
    }).select("name baseUnit quantityOnHand").lean();
    const activeIngredientById = new Map(activeIngredients.map((ingredient) => [ingredient._id.toString(), ingredient]));

    if (activeIngredientById.size !== recipe.ingredients.length) {
      response.status(409).json({ error: "One or more ingredients in this recipe are no longer active." });
      return;
    }

    const recipeSnapshot = {
      name: recipe.name,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients.map(({ ingredientId, quantity }) => {
        const ingredient = activeIngredientById.get(ingredientId.toString())!;
        return {
          ingredientId,
          name: ingredient.name,
          quantity,
          unit: ingredient.baseUnit,
        } satisfies RequestIngredientSnapshot;
      }),
    };
    const serviceDate = getServiceDate(env.APP_TIMEZONE);
    const session = await dbConnections.ingredients.startSession();
    const updatedRequest: { current: HydratedDocument<BreakfastRequestDocument> | null } = { current: null };

    try {
      await session.withTransaction(async () => {
        const existingRequest = await BreakfastRequest.findOne({
          userId: request.auth!.userId,
          serviceDate,
        }).session(session);

        const deltas = new Map<string, { ingredientId: Types.ObjectId; quantity: number }>();
        if (existingRequest?.status === "active") {
          for (const item of existingRequest.recipeSnapshot.ingredients) {
            const id = item.ingredientId.toString();
            const current = deltas.get(id);
            deltas.set(id, { ingredientId: item.ingredientId, quantity: (current?.quantity ?? 0) + item.quantity });
          }
        }
        for (const item of recipeSnapshot.ingredients) {
          const id = item.ingredientId.toString();
          const current = deltas.get(id);
          deltas.set(id, { ingredientId: item.ingredientId, quantity: (current?.quantity ?? 0) - item.quantity });
        }

        await applyInventoryDeltas(deltas, session);
        updatedRequest.current = await BreakfastRequest.findOneAndUpdate(
          { userId: request.auth!.userId, serviceDate },
          {
            $set: {
              recipeId: recipe._id,
              status: "active",
              recipeSnapshot,
            },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (updatedRequest.current) {
      try {
        const orderUser = await User.findById(request.auth!.userId)
          .select("name email")
          .lean<{ _id: Types.ObjectId; name: string; email: string }>();
        if (orderUser) {
          await Notification.create({
            userId: orderUser._id,
            userName: orderUser.name,
            userEmail: orderUser.email,
            order: {
              requestId: updatedRequest.current._id,
              serviceDate: updatedRequest.current.serviceDate,
              recipe: {
                name: updatedRequest.current.recipeSnapshot.name,
                description: updatedRequest.current.recipeSnapshot.description,
                imageUrl: updatedRequest.current.recipeSnapshot.imageUrl,
                ingredients: updatedRequest.current.recipeSnapshot.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
              },
            },
            orderedAt: new Date(),
          });
        } else {
          console.error(`Could not create an order notification: user ${request.auth!.userId} was not found.`);
        }
      } catch (notificationError) {
        console.error("The order was saved, but its notification could not be created.", notificationError);
      }
    }

    await refreshDailyStockSafely(serviceDate);

    response.status(200).json(updatedRequest.current);
  } catch (error) {
    if (error instanceof StockUnavailableError) {
      response.status(409).json({ error: "There are not enough ingredients left for that recipe." });
      return;
    }
    if (isDuplicateKey(error)) {
      response.status(409).json({ error: "A breakfast request for today is already being saved. Refresh and try again." });
      return;
    }
    next(error);
  }
});

router.delete("/today", authenticate, async (request, response, next) => {
  const serviceDate = getServiceDate(env.APP_TIMEZONE);
  const session = await dbConnections.ingredients.startSession();
  let cancelledRequest = null;

  try {
    await session.withTransaction(async () => {
      const existingRequest = await BreakfastRequest.findOne({
        userId: request.auth!.userId,
        serviceDate,
        status: "active",
      }).session(session);

      if (!existingRequest) return;

      const deltas = new Map<string, { ingredientId: Types.ObjectId; quantity: number }>();
      for (const item of existingRequest.recipeSnapshot.ingredients) {
        const id = item.ingredientId.toString();
        const current = deltas.get(id);
        deltas.set(id, { ingredientId: item.ingredientId, quantity: (current?.quantity ?? 0) + item.quantity });
      }
      await applyInventoryDeltas(deltas, session);
      existingRequest.status = "cancelled";
      await existingRequest.save({ session });
      cancelledRequest = existingRequest;
    });
  } catch (error) {
    if (error instanceof StockUnavailableError) {
      response.status(409).json({ error: "The reservation could not be released. Contact the administrator." });
      return;
    }
    next(error);
    return;
  } finally {
    await session.endSession();
  }

  if (!cancelledRequest) {
    response.status(404).json({ error: "There is no active breakfast request for today." });
    return;
  }
  await refreshDailyStockSafely(serviceDate);
  response.json(cancelledRequest);
});

async function applyInventoryDeltas(
  deltas: Map<string, { ingredientId: Types.ObjectId; quantity: number }>,
  session: import("mongoose").ClientSession,
) {
  for (const { ingredientId, quantity } of deltas.values()) {
    if (quantity === 0) continue;

    const filter = quantity < 0
      ? { _id: ingredientId, isActive: true, quantityOnHand: { $gte: -quantity } }
      : { _id: ingredientId };
    const result = await Ingredient.updateOne(
      filter,
      { $inc: { quantityOnHand: quantity } },
      { session },
    );

    if (result.matchedCount !== 1) throw new StockUnavailableError();
  }
}

async function refreshDailyStockSafely(serviceDate: string) {
  try {
    await refreshDailyStock(serviceDate);
  } catch (error) {
    console.error(`Could not refresh daily stock for ${serviceDate}.`, error);
  }
}

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

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export default router;