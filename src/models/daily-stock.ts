import { Schema, Types, type Model } from "mongoose";
import { dbConnections } from "../config/database";

export interface DailyStockIngredientSnapshot {
  ingredientId: Types.ObjectId;
  name: string;
  quantity: number;
  availableQuantity: number;
  unit: string;
}

export interface DailyStockDocument {
  serviceDate: string;
  recipeId: Types.ObjectId;
  recipeSnapshot: {
    name: string;
    description: string;
    imageUrl: string;
    ingredients: DailyStockIngredientSnapshot[];
  };
  isAvailable: boolean;
}

const dailyStockIngredientSchema = new Schema<DailyStockIngredientSnapshot>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: Number.EPSILON },
    availableQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
  },
  { _id: false },
);

const dailyStockSchema = new Schema<DailyStockDocument>(
  {
    serviceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    recipeSnapshot: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      imageUrl: { type: String, required: true },
      ingredients: { type: [dailyStockIngredientSchema], required: true },
    },
    isAvailable: { type: Boolean, required: true },
  },
  { timestamps: true },
);

dailyStockSchema.index({ serviceDate: 1, recipeId: 1 }, { unique: true });
dailyStockSchema.index({ serviceDate: 1, isAvailable: 1 });

const existingDailyStockModel = dbConnections.recipes.models.DailyStock as Model<DailyStockDocument> | undefined;

export const DailyStock =
  existingDailyStockModel ??
  dbConnections.recipes.model<DailyStockDocument>("DailyStock", dailyStockSchema, "daily-stock");