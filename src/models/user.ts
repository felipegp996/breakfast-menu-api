import { Schema } from "mongoose";
import { dbConnections } from "../config/database";

export type UserRole = "admin" | "user";

export interface UserDocument {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

export const User =
  dbConnections.users.models.User ??
  dbConnections.users.model("User", userSchema);