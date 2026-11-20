import { Schema, Types, type Model } from "mongoose";
import { dbConnections } from "../config/database";

export type BreakfastRequestStatus = "active" | "cancelled" | "completed";

export interface RequestIngredientSnapshot {
  ingredientId: Types.ObjectId;
  name: string;
  quantity: number;
  unit: string;
}

export interface BreakfastRequestDocument {
  userId: Types.ObjectId;
  serviceDate: string;
  recipeId: Types.ObjectId;
  status: BreakfastRequestStatus;
  recipeSnapshot: {
    name: string;
    description: string;
    imageUrl: string;
    ingredients: RequestIngredientSnapshot[];
  };
}

const requestIngredientSnapshotSchema = new Schema<RequestIngredientSnapshot>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: Number.EPSILON },
    unit: { type: String, required: true },
  },
  { _id: false },
);

const breakfastRequestSchema = new Schema<BreakfastRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    serviceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    status: { type: String, enum: ["active", "cancelled", "completed"], default: "active", required: true },
    recipeSnapshot: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      imageUrl: { type: String, required: true },
      ingredients: { type: [requestIngredientSnapshotSchema], required: true },
    },
  },
  { timestamps: true },
);

breakfastRequestSchema.index({ userId: 1, serviceDate: 1 }, { unique: true });
breakfastRequestSchema.index({ serviceDate: 1, status: 1, createdAt: -1 });

const existingBreakfastRequestModel =
  dbConnections.ingredients.models.BreakfastRequest as Model<BreakfastRequestDocument> | undefined;

export const BreakfastRequest =
  existingBreakfastRequestModel ??
  dbConnections.ingredients.model<BreakfastRequestDocument>("BreakfastRequest", breakfastRequestSchema);