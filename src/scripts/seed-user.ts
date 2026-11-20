import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database";
import { env } from "../config/env";
import { User } from "../models/user";

async function seedUser() {
  if (!env.USER_NAME || !env.USER_EMAIL || !env.USER_PASSWORD) {
    throw new Error("Set USER_NAME, USER_EMAIL, and USER_PASSWORD before seeding.");
  }

  await connectToDatabase();
  const email = env.USER_EMAIL.toLowerCase();
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error(`A user with ${email} already exists.`);
  }

  const passwordHash = await bcrypt.hash(env.USER_PASSWORD, 12);
  await User.create({
    name: env.USER_NAME,
    email,
    passwordHash,
    role: "user",
  });
  console.info(`User ${email} created.`);
}

seedUser()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });