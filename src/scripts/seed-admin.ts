import bcrypt from "bcryptjs";
import { connectToDatabase } from "../config/database";
import { env } from "../config/env";
import { User } from "../models/user";

async function seedAdmin() {
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before seeding.");
  }

  await connectToDatabase();
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error(`A user with ${email} already exists.`);
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await User.create({
    name: env.ADMIN_NAME,
    email,
    passwordHash,
    role: "admin",
  });
  console.info(`Administrator ${email} created.`);
}

seedAdmin().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  const mongoose = await import("mongoose");
  await mongoose.default.disconnect();
});