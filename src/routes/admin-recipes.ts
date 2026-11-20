import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/authenticate";
import { Ingredient } from "../models/ingredient";
import { Recipe } from "../models/recipe";

const router = Router();
const recipeInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  imageUrl: z.string().trim().url(),
  ingredients: z.array(z.object({
    ingredientId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.number().positive(),
  })).min(1).superRefine((ingredients, context) => {
    const ids = ingredients.map(({ ingredientId }) => ingredientId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Choose each ingredient only once." });
    }
  }),
  isActive: z.boolean().optional(),
});

router.use(authenticate, requireAdmin);

router.get("/", async (request, response, next) => {
  try {
    const filter = request.query.includeInactive === "true" ? {} : { isActive: true };
    const recipes = await Recipe.find(filter).sort({ name: 1 }).lean();
    response.json(recipes);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid recipe id." });
      return;
    }

    const recipe = await Recipe.findById(request.params.id).lean();
    if (!recipe) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(recipe);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  try {
    const parsed = recipeInput.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid recipe details." });
      return;
    }
    if (!(await hasActiveIngredients(parsed.data.ingredients))) {
      response.status(400).json({ error: "One or more selected ingredients are unavailable." });
      return;
    }

    const recipe = await Recipe.create(toRecipeDocument(parsed.data));
    response.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (request, response, next) => {
  try {
    if (!Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid recipe id." });
      return;
    }

    const parsed = recipeInput.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid recipe details." });
      return;
    }
    if (!(await hasActiveIngredients(parsed.data.ingredients))) {
      response.status(400).json({ error: "One or more selected ingredients are unavailable." });
      return;
    }

    const recipe = await Recipe.findByIdAndUpdate(
      request.params.id,
      toRecipeDocument(parsed.data),
      { new: true, runValidators: true },
    );
    if (!recipe) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(recipe);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (request, response, next) => {
  try {
    if (!Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid recipe id." });
      return;
    }

    const recipe = await Recipe.findByIdAndUpdate(
      request.params.id,
      { isActive: false },
      { new: true, runValidators: true },
    );
    if (!recipe) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(recipe);
  } catch (error) {
    next(error);
  }
});

async function hasActiveIngredients(ingredients: Array<{ ingredientId: string }>) {
  const ids = ingredients.map(({ ingredientId }) => new Types.ObjectId(ingredientId));
  const matches = await Ingredient.find({ _id: { $in: ids }, isActive: true }).select("_id").lean();
  return matches.length === ids.length;
}

function toRecipeDocument(recipe: z.infer<typeof recipeInput>) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(({ ingredientId, quantity }) => ({
      ingredientId: new Types.ObjectId(ingredientId),
      quantity,
    })),
  };
}

export default router;