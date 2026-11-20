import { Schema, Types, type Model } from "mongoose";
import { dbConnections } from "../config/database";

export interface RecipeIngredient {
  ingredientId: Types.ObjectId;
  quantity: number;
}

export interface RecipeDocument {
  name: string;
  description: string;
  imageUrl: string;
  ingredients: RecipeIngredient[];
  isActive: boolean;
}

const recipeIngredientSchema = new Schema<RecipeIngredient>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    quantity: { type: Number, required: true, min: Number.EPSILON },
  },
  { _id: false },
);

const recipeSchema = new Schema<RecipeDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    imageUrl: { type: String, required: true, trim: true },
    ingredients: {
      type: [recipeIngredientSchema],
      required: true,
      validate: {
        validator: (items: RecipeIngredient[]) =>
          items.length > 0 && new Set(items.map((item) => item.ingredientId.toString())).size === items.length,
        message: "A recipe needs unique ingredient requirements.",
      },
    },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

recipeSchema.index({ isActive: 1, name: 1 });

const existingRecipeModel = dbConnections.recipes.models.Recipe as Model<RecipeDocument> | undefined;

export const Recipe =
  existingRecipeModel ??
  dbConnections.recipes.model<RecipeDocument>("Recipe", recipeSchema);