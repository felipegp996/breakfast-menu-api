import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/user";

const router = Router();
const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

router.post("/login", async (request, response, next) => {
  try {
    const credentials = loginSchema.safeParse(request.body);
    if (!credentials.success) {
      response.status(400).json({ error: "Enter a valid email and password." });
      return;
    }

    const user = await User.findOne({ email: credentials.data.email, isActive: true }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(credentials.data.password, user.passwordHash))) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: "12h",
    });

    response.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

export default router;