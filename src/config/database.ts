import mongoose from "mongoose";
import { env } from "./env";

export const dbConnections = {
  ingredients: mongoose.createConnection(),
  recipes: mongoose.createConnection(),
  users: mongoose.createConnection(),
};

let connectionPromise: Promise<void> | undefined;

export function connectToDatabase(): Promise<void> {
  if (!connectionPromise) {
    connectionPromise = Promise.all([
      connect(dbConnections.ingredients, env.MONGODB_INGREDIENTS_URI),
      connect(dbConnections.recipes, env.MONGODB_RECIPES_URI),
      connect(dbConnections.users, env.MONGODB_USERS_URI),
    ]).then(() => undefined).catch((error: unknown) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  return connectionPromise;
}

function connect(connection: mongoose.Connection, uri: string) {
  if (connection.readyState === 1) return Promise.resolve();
  if (connection.readyState === 2) return connection.asPromise().then(() => undefined);
  return connection.openUri(uri).then(() => undefined);
}