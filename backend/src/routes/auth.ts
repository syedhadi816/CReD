import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { auditLog, clientIp } from "../lib/auditLog";
import { AccessCodeAudience } from "../generated/prisma/client";

export const router = Router();

const LoginBody = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
  /** Must match the Welcome path: educator codes vs student codes. */
  role: z.enum(["educator", "student"]),
});

/** POST /api/auth/login — validate email + access code, create or find user, return token (userId for now). */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const body = LoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid email or access code" });
      return;
    }
    const { email, accessCode, role } = body.data;
    const expectedAudience =
      role === "educator" ? AccessCodeAudience.EDUCATOR : AccessCodeAudience.STUDENT;

    const code = await prisma.accessCode.findUnique({
      where: { code: accessCode.trim() },
    });
    if (!code) {
      res.status(401).json({ error: "Invalid access code" });
      return;
    }
    if (code.audience !== expectedAudience) {
      res.status(401).json({
        error:
          role === "educator"
            ? "This access code is for the student login. Use an educator code."
            : "This access code is for the educator login. Use a student code.",
      });
      return;
    }
    if (code.usedCount >= code.maxUses) {
      res.status(401).json({ error: "Access code has reached maximum uses" });
      return;
    }
    if (code.expiresAt && code.expiresAt < new Date()) {
      res.status(401).json({ error: "Access code has expired" });
      return;
    }
    if (code.email != null && code.email !== email) {
      res.status(401).json({ error: "This access code is not valid for this email" });
      return;
    }

    let user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { email: email.trim().toLowerCase() },
      });
    }

    await prisma.accessCode.update({
      where: { id: code.id },
      data: { usedCount: code.usedCount + 1 },
    });

    const ip = clientIp(req);
    await prisma.pilotLoginLog.create({
      data: {
        userId: user.id,
        email: user.email,
        accessCodeEntered: accessCode.trim(),
        clientIp: ip,
      },
    });
    auditLog("pilot_login", {
      userId: user.id,
      email: user.email,
      accessCodeEntered: accessCode.trim(),
      clientIp: ip,
    });

    res.json({
      token: user.id,
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});
