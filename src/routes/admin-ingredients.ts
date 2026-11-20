import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/authenticate";
import { Ingredient } from "../models/ingredient";
import { Recipe } from "../models/recipe";

const router = Router();
const ingredientInput = z.object({
  name: z.string().trim().min(1).max(100),
  baseUnit: z.enum(["g", "ml", "each"]),
  quantityOnHand: z.number().finite().min(0).optional(),
  isActive: z.boolean().optional(),
});

router.use(authenticate, requireAdmin);

router.get("/", async (request, response, next) => {
  try {
    const filter = request.query.includeInactive === "true" ? {} : { isActive: true };
    const ingredients = await Ingredient.find(filter).sort({ name: 1 }).lean();
    response.json(ingredients.map((ingredient) => ({
      ...ingredient,
      quantityOnHand: ingredient.quantityOnHand ?? 0,
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  try {
    const parsed = ingredientInput.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid ingredient details." });
      return;
    }

    const ingredient = await Ingredient.create(parsed.data);
    response.status(201).json(ingredient);
  } catch (error) {
    if (isDuplicateKey(error)) {
      response.status(409).json({ error: "An ingredient with that name already exists." });
      return;
    }
    next(error);
  }
});

router.put("/:id", async (request, response, next) => {
  try {
    if (!Ingredient.db.base.Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid ingredient id." });
      return;
    }

    const parsed = ingredientInput.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid ingredient details." });
      return;
    }

    const current = await Ingredient.findById(request.params.id);
    if (!current) {
      response.status(404).json({ error: "Ingredient not found." });
      return;
    }

    if (current.baseUnit !== parsed.data.baseUnit) {
      const usedByRecipe = await Recipe.exists({ "ingredients.ingredientId": current._id });
      if (usedByRecipe) {
        response.status(409).json({ error: "The base unit cannot change after this ingredient is used." });
        return;
      }
    }

    current.set(parsed.data);
    await current.save();
    response.json(current);
  } catch (error) {
    if (isDuplicateKey(error)) {
      response.status(409).json({ error: "An ingredient with that name already exists." });
      return;
    }
    next(error);
  }
});

router.delete("/:id", async (request, response, next) => {
  try {
    if (!Ingredient.db.base.Types.ObjectId.isValid(request.params.id)) {
      response.status(400).json({ error: "Invalid ingredient id." });
      return;
    }

    const ingredient = await Ingredient.findByIdAndUpdate(
      request.params.id,
      { isActive: false },
      { new: true, runValidators: true },
    );
    if (!ingredient) {
      response.status(404).json({ error: "Ingredient not found." });
      return;
    }

    response.json(ingredient);
  } catch (error) {
    next(error);
  }
});

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export default router;