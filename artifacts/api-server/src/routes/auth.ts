import { Router, type IRouter, type RequestHandler } from "express";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const router: IRouter = Router();
const sessionCookie = "saarthi_session";
const sessionDays = 7;

declare global {
  namespace Express {
    interface Request { userId?: number; user?: { id: number; name: string; email: string }; }
  }
}

const publicUser = (user: typeof usersTable.$inferSelect) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt });
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function createSession(userId: number, res: Parameters<RequestHandler>[1]) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, tokenHash: hashToken(token), expiresAt });
  res.cookie(sessionCookie, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[sessionCookie];
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  const [session] = await db.select().from(sessionsTable).where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date()))).limit(1);
  if (!session) return res.status(401).json({ error: "Your session has expired. Please log in again." });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) return res.status(401).json({ error: "Please log in to continue." });
  req.userId = user.id;
  req.user = publicUser(user);
  return next();
};

router.post("/auth/signup", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!name || !email || !password || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash: await hashPassword(password) }).returning();
  await createSession(user.id, res);
  return res.status(201).json({ user: publicUser(user) });
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: "Email or password is incorrect." });
  await createSession(user.id, res);
  return res.json({ user: publicUser(user) });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[sessionCookie];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return res.status(204).send();
});

router.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;