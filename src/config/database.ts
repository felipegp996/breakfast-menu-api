import mongoose from "mongoose";
import { env } from "./env";

export const dbConnections = {
  ingredients: mongoose.createConnection(),
  recipes: mongoose.createConnection(),
  users: mongoose.createConnection(),
};

export async function connectToDatabase() {
  await Promise.all([
    dbConnections.ingredients.openUri(env.MONGODB_INGREDIENTS_URI),
    dbConnections.recipes.openUri(env.MONGODB_RECIPES_URI),
    dbConnections.users.openUri(env.MONGODB_USERS_URI),
  ]);
}