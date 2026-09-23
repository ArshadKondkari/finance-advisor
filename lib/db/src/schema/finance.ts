import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  real,
  serial,
  text,
  timestamp,
  unique,
  pgTable,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("auth_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesTable = pgTable("finance_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  monthlyIncome: real("monthly_income").notNull().default(50000),
  currentSavings: real("current_savings").notNull().default(40000),
  savingsTarget: real("savings_target").notNull().default(120000),
  goalDurationMonths: integer("goal_duration_months").notNull().default(12),
});

export const transactionsTable = pgTable("finance_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  confidence: real("confidence").notNull().default(1),
  isAnomaly: boolean("is_anomaly").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetsTable = pgTable("finance_budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
}, (table) => ({ userCategoryUnique: unique().on(table.userId, table.category) }));

export const goalsTable = pgTable("finance_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadlineMonths: integer("deadline_months").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alertsTable = pgTable("finance_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("General"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recommendationsTable = pgTable("finance_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  action: text("action").notNull(),
  utilityScore: real("utility_score").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedbackTable = pgTable("finance_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  recommendationId: integer("recommendation_id").notNull(),
  rating: text("rating").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentLogsTable = pgTable("finance_agent_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true });
export const insertGoalSchema = createInsertSchema(goalsTable).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true, createdAt: true });
export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({ id: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true });
export const insertAgentLogSchema = createInsertSchema(agentLogsTable).omit({ id: true, createdAt: true });

export type Profile = typeof profilesTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
export type Budget = typeof budgetsTable.$inferSelect;
export type Goal = typeof goalsTable.$inferSelect;
export type Alert = typeof alertsTable.$inferSelect;
export type Recommendation = typeof recommendationsTable.$inferSelect;
export type Feedback = typeof feedbackTable.$inferSelect;
export type AgentLog = typeof agentLogsTable.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;