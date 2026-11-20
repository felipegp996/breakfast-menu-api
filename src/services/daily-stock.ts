import { DailyStock, type DailyStockDocument } from "../models/daily-stock";
import { Ingredient } from "../models/ingredient";
import { Recipe } from "../models/recipe";

export async function refreshDailyStock(serviceDate: string): Promise<DailyStockDocument[]> {
  const recipes = await Recipe.find({ isActive: true }).sort({ name: 1 }).lean();
  if (recipes.length === 0) return [];

  const ingredientIds = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map(({ ingredientId }) => ingredientId.toString())))];
  const ingredients = ingredientIds.length
    ? await Ingredient.find({ _id: { $in: ingredientIds }, isActive: true })
      .select("name baseUnit quantityOnHand")
      .lean()
    : [];
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient._id.toString(), ingredient]));

  const projections = recipes.map((recipe) => {
    const snapshotIngredients = recipe.ingredients.map(({ ingredientId, quantity }) => {
      const ingredient = ingredientById.get(ingredientId.toString());
      return {
        ingredientId,
        name: ingredient?.name ?? "Unavailable ingredient",
        quantity,
        availableQuantity: ingredient?.quantityOnHand ?? 0,
        unit: ingredient?.baseUnit ?? "each",
      };
    });

    return {
      serviceDate,
      recipeId: recipe._id,
      recipeSnapshot: {
        name: recipe.name,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: snapshotIngredients,
      },
      isAvailable: snapshotIngredients.every(({ quantity, availableQuantity }) => availableQuantity >= quantity),
    };
  });

  await DailyStock.bulkWrite(projections.map((projection) => ({
    updateOne: {
      filter: { serviceDate, recipeId: projection.recipeId },
      update: { $set: projection },
      upsert: true,
    },
  })));
  return DailyStock.find({
    serviceDate,
    recipeId: { $in: recipes.map(({ _id }) => _id) },
  }).sort({ "recipeSnapshot.name": 1 }).lean();
}