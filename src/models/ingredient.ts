import { Schema, type Model } from "mongoose";
import { dbConnections } from "../config/database";

export type IngredientUnit = "g" | "ml" | "each";

export interface IngredientDocument {
  name: string;
  baseUnit: IngredientUnit;
  quantityOnHand: number;
  isActive: boolean;
}

const ingredientSchema = new Schema<IngredientDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    baseUnit: { type: String, enum: ["g", "ml", "each"], required: true },
    quantityOnHand: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

ingredientSchema.index({ name: 1 }, { unique: true });

const existingIngredientModel = dbConnections.ingredients.models.Ingredient as Model<IngredientDocument> | undefined;

export const Ingredient =
  existingIngredientModel ??
  dbConnections.ingredients.model<IngredientDocument>("Ingredient", ingredientSchema);