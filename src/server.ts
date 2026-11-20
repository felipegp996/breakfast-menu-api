import { app } from "./app";
import { connectToDatabase } from "./config/database";
import { env } from "./config/env";

async function start() {
  await connectToDatabase();
  app.listen(env.PORT, () => {
    console.info(`Breakfast Menu API listening on port ${env.PORT}`);
  });
}

start().catch((error: unknown) => {
  console.error("Could not start the API.", error);
  process.exitCode = 1;
});