import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  agentLogsTable,
  alertsTable,
  budgetsTable,
  feedbackTable,
  goalsTable,
  profilesTable,
  recommendationsTable,
  transactionsTable,
} from "@workspace/db";
import {
  AskAdvisorBody,
  CreateGoalBody,
  CreateTransactionBody,
  ListTransactionsQueryParams,
  MarkAlertReadParams,
  SubmitFeedbackBody,
  UpdateProfileBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
  UpsertBudgetBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const categories = ["Food", "Rent", "Transport", "Shopping", "Entertainment", "Bills", "Education", "Healthcare", "Other"];
const trainingTerms: Record<string, string[]> = {
  Food: ["swiggy", "zomato", "restaurant", "cafe", "coffee", "lunch", "dinner", "grocery", "food", "blinkit"],
  Rent: ["rent", "housing", "hostel", "landlord"],
  Transport: ["uber", "ola", "metro", "bus", "fuel", "petrol", "taxi", "transport"],
  Shopping: ["amazon", "flipkart", "myntra", "shopping", "clothes", "shoes"],
  Entertainment: ["netflix", "spotify", "movie", "cinema", "gaming", "concert", "entertainment"],
  Bills: ["electricity", "internet", "recharge", "mobile", "bill", "water", "utility"],
  Education: ["course", "book", "college", "tuition", "education"],
  Healthcare: ["doctor", "medicine", "pharmacy", "hospital", "health"],
  Other: [],
};

const round = (value: number) => Math.round(value * 100) / 100;
const formatDate = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
const monthOf = (value: string) => value.slice(0, 7);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function classifyDescription(description: string) {
  const tokens = description.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const scores = categories.map((category) => ({
    category,
    score: trainingTerms[category].reduce((score, term) => score + (tokens.includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const best = scores[0];
  const total = scores.reduce((sum, item) => sum + item.score, 0);
  const confidence = best.score === 0 ? 0.42 : Math.min(0.98, 0.58 + best.score / Math.max(1, total) * 0.4);
  return { category: best.score === 0 ? "Other" : best.category, confidence: round(confidence) };
}

async function ensureProfile() {
  const [existing] = await db.select().from(profilesTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(profilesTable).values({
    name: "Arshad",
    monthlyIncome: 50000,
    currentSavings: 40000,
    savingsTarget: 120000,
    goalDurationMonths: 12,
  }).returning();
  return created;
}

async function logAgent(stage: string, message: string) {
  await db.insert(agentLogsTable).values({ stage, message });
}

function calculateAnomaly(amount: number, history: number[]) {
  if (history.length < 2) return amount >= 7000;
  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance = history.reduce((sum, value) => sum + (value - average) ** 2, 0) / history.length;
  const deviation = Math.sqrt(variance);
  return amount > average + Math.max(deviation * 2, average * 0.8);
}

async function getCurrentTransactions() {
  const all = await db.select().from(transactionsTable).orderBy(desc(transactionsTable.date), desc(transactionsTable.id));
  const month = all.length ? monthOf(all[0].date) : currentMonth();
  return { all, month, current: all.filter((item) => monthOf(item.date) === month) };
}

async function buildGoals(expectedMonthly: number) {
  const goals = await db.select().from(goalsTable).orderBy(desc(goalsTable.id));
  return goals.map((goal) => {
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const requiredMonthly = round(remaining / Math.max(1, goal.deadlineMonths));
    const progress = round(Math.min(100, goal.currentAmount / Math.max(1, goal.targetAmount) * 100));
    return {
      id: goal.id,
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadlineMonths: goal.deadlineMonths,
      progress,
      requiredMonthly,
      expectedMonthly: round(expectedMonthly),
      status: expectedMonthly >= requiredMonthly ? "On track" : "Needs attention",
    };
  });
}

async function buildBudgets(current: typeof transactionsTable.$inferSelect[]) {
  const budgets = await db.select().from(budgetsTable).orderBy(budgetsTable.category);
  return budgets.map((budget) => {
    const spent = round(current.filter((item) => item.category === budget.category).reduce((sum, item) => sum + item.amount, 0));
    const percentage = round(spent / Math.max(1, budget.amount) * 100);
    return {
      id: budget.id,
      category: budget.category,
      amount: budget.amount,
      spent,
      percentage,
      status: percentage >= 100 ? "Over budget" : percentage >= 80 ? "Near limit" : "Within budget",
    };
  });
}

async function getDashboardData() {
  const profile = await ensureProfile();
  const { all, current } = await getCurrentTransactions();
  const totalExpenses = round(current.reduce((sum, item) => sum + item.amount, 0));
  const remainingBalance = round(profile.monthlyIncome - totalExpenses);
  const months = [...new Set(all.map((item) => monthOf(item.date)))];
  const monthlyTrend = months.slice(0, 6).reverse().map((month) => ({
    month,
    amount: round(all.filter((item) => monthOf(item.date) === month).reduce((sum, item) => sum + item.amount, 0)),
  }));
  const categorySpending = categories.map((category) => ({
    category,
    amount: round(current.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0)),
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const historicalSavings = monthlyTrend.map((item) => profile.monthlyIncome - item.amount);
  const projectedSavings = historicalSavings.length ? round(historicalSavings.reduce((sum, value) => sum + value, 0) / historicalSavings.length) : remainingBalance;
  const budgets = await buildBudgets(current);
  const goals = await buildGoals(projectedSavings);
  const [alerts, recommendations, activity] = await Promise.all([
    db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt), desc(alertsTable.id)).limit(6),
    db.select().from(recommendationsTable).orderBy(desc(recommendationsTable.createdAt), desc(recommendationsTable.id)).limit(4),
    db.select().from(agentLogsTable).orderBy(desc(agentLogsTable.createdAt), desc(agentLogsTable.id)).limit(8),
  ]);
  return {
    profile,
    summary: {
      income: profile.monthlyIncome,
      totalExpenses,
      remainingBalance,
      currentSavings: profile.currentSavings,
      projectedSavings,
      savingsProgress: round(profile.currentSavings / Math.max(1, profile.savingsTarget) * 100),
      highestCategory: categorySpending[0]?.category ?? "No data yet",
      averageDaily: round(totalExpenses / 30),
    },
    categorySpending,
    monthlyTrend,
    budgets,
    goals,
    alerts: alerts.map((alert) => ({ ...alert, createdAt: formatDate(alert.createdAt) })),
    recommendations: recommendations.map((item) => ({ ...item, utilityScore: item.utilityScore > 1 ? round(item.utilityScore / 100) : item.utilityScore, createdAt: formatDate(item.createdAt) })),
    activity: activity.map((item) => ({ ...item, createdAt: formatDate(item.createdAt) })),
    agentStatus: recommendations.length ? "Recommendation generated" : "Monitoring",
  };
}

async function createRecommendation() {
  const dashboard = await getDashboardData();
  const topBudget = dashboard.budgets.find((budget) => budget.status !== "Within budget");
  const goal = dashboard.goals[0];
  let title = "Keep the momentum";
  let message = `Your current spending leaves an estimated ₹${Math.max(0, dashboard.summary.remainingBalance).toLocaleString("en-IN")} this month.`;
  let action = "Maintain current spending";
  let utilityScore = 45;
  if (topBudget) {
    title = `${topBudget.category} needs attention`;
    message = `${topBudget.category} is at ${Math.round(topBudget.percentage)}% of its planned budget. Review the next few purchases in this category.`;
    action = "Reduce category spending";
    utilityScore = Math.min(98, 55 + topBudget.percentage / 2);
  } else if (goal && goal.status !== "On track") {
    title = "Close the savings gap";
    message = `Your goal needs about ₹${goal.requiredMonthly.toLocaleString("en-IN")} each month, while the estimate is ₹${goal.expectedMonthly.toLocaleString("en-IN")}.`;
    action = "Increase monthly savings";
    utilityScore = 78;
  }
  const [recommendation] = await db.insert(recommendationsTable).values({ title, message, action, utilityScore: round(utilityScore) }).returning();
  return recommendation;
}

async function runAgentLoop(context: string, transaction?: typeof transactionsTable.$inferSelect) {
  await logAgent("SENSE", transaction ? `New transaction received: ${transaction.description}` : context);
  await logAgent("PERCEIVE", "Transaction data processed and normalized.");
  await logAgent("ANALYZE", "Category totals, trends, and budget variance recalculated.");
  await logAgent("REASON", "Savings goal and anomaly signals evaluated against history.");
  await logAgent("DECIDE", "Utility-ranked financial action selected from current conditions.");
  await createRecommendation();
  await logAgent("ACT", "Recommendation and alerts refreshed from the latest analysis.");
  await logAgent("LEARN", "Historical pattern updated for the next decision.");
}

router.get("/profile", async (_req, res) => {
  res.json(await ensureProfile());
});

router.put("/profile", async (req, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter valid profile values." });
  const profile = await ensureProfile();
  const [updated] = await db.update(profilesTable).set(parsed.data).where(eq(profilesTable.id, profile.id)).returning();
  await logAgent("LEARN", "Profile preferences updated for future decisions.");
  return res.json(updated);
});

router.get("/transactions", async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid transaction filters." });
  const filters = [];
  if (parsed.data.category) filters.push(eq(transactionsTable.category, parsed.data.category));
  if (parsed.data.search) filters.push(ilike(transactionsTable.description, `%${parsed.data.search}%`));
  const rows = await db.select().from(transactionsTable).where(filters.length ? and(...filters) : undefined).orderBy(desc(transactionsTable.date), desc(transactionsTable.id));
  return res.json(rows);
});

router.post("/transactions", async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter an amount, description, and date." });
  const classification = parsed.data.category ? { category: parsed.data.category, confidence: 1 } : classifyDescription(parsed.data.description);
  const history = await db.select({ amount: transactionsTable.amount }).from(transactionsTable).where(eq(transactionsTable.category, classification.category));
  const isAnomaly = calculateAnomaly(parsed.data.amount, history.map((item) => item.amount));
  const [created] = await db.insert(transactionsTable).values({
    amount: parsed.data.amount,
    description: parsed.data.description,
    category: classification.category,
    date: parsed.data.date,
    confidence: classification.confidence,
    isAnomaly,
  }).returning();
  if (isAnomaly) {
    await db.insert(alertsTable).values({
      type: "Unusual spending",
      severity: "warning",
      category: classification.category,
      message: `${classification.category} spending is significantly higher than your normal pattern.`,
    });
  }
  await runAgentLoop("New transaction added.", created);
  return res.status(201).json(created);
});

router.patch("/transactions/:id", async (req, res) => {
  const params = UpdateTransactionParams.safeParse(req.params);
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!params.success || !parsed.success) return res.status(400).json({ error: "Invalid transaction." });
  const { category, ...transactionUpdates } = parsed.data;
  const updateData = category == null ? transactionUpdates : { ...transactionUpdates, category };
  const [updated] = await db.update(transactionsTable).set(updateData).where(eq(transactionsTable.id, params.data.id)).returning();
  if (!updated) return res.status(404).json({ error: "Transaction not found." });
  await runAgentLoop("Transaction updated.", updated);
  return res.json(updated);
});

router.delete("/transactions/:id", async (req, res) => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid transaction id." });
  await db.delete(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  await runAgentLoop("Transaction removed and analysis refreshed.");
  return res.status(204).send();
});

router.get("/budgets", async (_req, res) => {
  const { current } = await getCurrentTransactions();
  return res.json(await buildBudgets(current));
});

router.post("/budgets", async (req, res) => {
  const parsed = UpsertBudgetBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid category budget." });
  const existing = await db.select().from(budgetsTable).where(eq(budgetsTable.category, parsed.data.category));
  const [budget] = existing.length
    ? await db.update(budgetsTable).set({ amount: parsed.data.amount }).where(eq(budgetsTable.category, parsed.data.category)).returning()
    : await db.insert(budgetsTable).values(parsed.data).returning();
  await runAgentLoop("Budget updated.");
  const { current } = await getCurrentTransactions();
  const computed = (await buildBudgets(current)).find((item) => item.id === budget.id);
  return res.json(computed ?? budget);
});

router.get("/goals", async (_req, res) => {
  const dashboard = await getDashboardData();
  return res.json(dashboard.goals);
});

router.post("/goals", async (req, res) => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid goal." });
  const [goal] = await db.insert(goalsTable).values(parsed.data).returning();
  await runAgentLoop("New savings goal created.");
  const dashboard = await getDashboardData();
  return res.status(201).json(dashboard.goals.find((item) => item.id === goal.id));
});

router.get("/dashboard", async (_req, res) => {
  return res.json(await getDashboardData());
});

router.get("/alerts", async (_req, res) => {
  const alerts = await db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt), desc(alertsTable.id)).limit(30);
  return res.json(alerts.map((alert) => ({ ...alert, createdAt: formatDate(alert.createdAt) })));
});

router.post("/alerts/:id/read", async (req, res) => {
  const parsed = MarkAlertReadParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid alert id." });
  const [alert] = await db.update(alertsTable).set({ isRead: true }).where(eq(alertsTable.id, parsed.data.id)).returning();
  if (!alert) return res.status(404).json({ error: "Alert not found." });
  return res.json({ ...alert, createdAt: formatDate(alert.createdAt) });
});

router.get("/activity", async (_req, res) => {
  const activity = await db.select().from(agentLogsTable).orderBy(desc(agentLogsTable.createdAt), desc(agentLogsTable.id)).limit(30);
  return res.json(activity.map((item) => ({ ...item, createdAt: formatDate(item.createdAt) })));
});

router.post("/analyze", async (_req, res) => {
  await runAgentLoop("Full analysis requested from the dashboard.");
  return res.json(await getDashboardData());
});

router.post("/chat", async (req, res) => {
  const parsed = AskAdvisorBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ask a question about your finances." });
  const question = parsed.data.message.toLowerCase();
  const dashboard = await getDashboardData();
  if (question.includes("most") || question.includes("highest")) {
    return res.json({ answer: `Your highest spending category this period is ${dashboard.summary.highestCategory}, based on ₹${dashboard.categorySpending[0]?.amount.toLocaleString("en-IN") ?? "0"} in recorded expenses.`, source: "Stored transactions and dashboard analysis" });
  }
  if (question.includes("food")) {
    const food = dashboard.categorySpending.find((item) => item.category === "Food")?.amount ?? 0;
    return res.json({ answer: `You have spent ₹${food.toLocaleString("en-IN")} on food in the current analysis period.`, source: "Stored transactions" });
  }
  if (question.includes("goal") || question.includes("reach")) {
    const goal = dashboard.goals[0];
    if (goal) {
      return res.json({ answer: `Your goal is ${goal.status.toLowerCase()}. The estimate is ₹${goal.expectedMonthly.toLocaleString("en-IN")} per month versus ₹${goal.requiredMonthly.toLocaleString("en-IN")} required.`, source: "Goal evaluator and savings estimate" });
    }
    return res.json({ answer: "You do not have a savings goal yet. Add one from the Goals page to start tracking progress.", source: "Goal evaluator" });
  }
  if (question.includes("alert") || question.includes("why")) {
    return res.json({ answer: dashboard.alerts[0]?.message ?? "There are no active alerts. Your current recorded spending is being monitored.", source: "Alert engine" });
  }
  return res.json({ answer: `You have recorded ₹${dashboard.summary.totalExpenses.toLocaleString("en-IN")} in expenses this period and an estimated remaining balance of ₹${dashboard.summary.remainingBalance.toLocaleString("en-IN")}. Try asking about food, your goal, alerts, or your highest category.`, source: "Stored transactions and spending analysis" });
});

router.post("/feedback", async (req, res) => {
  const parsed = SubmitFeedbackBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid feedback." });
  const [feedback] = await db.insert(feedbackTable).values(parsed.data).returning();
  await db.update(recommendationsTable).set({ feedback: parsed.data.rating }).where(eq(recommendationsTable.id, parsed.data.recommendationId));
  await logAgent("LEARN", `User marked a recommendation ${parsed.data.rating.replace("_", " ")}.`);
  return res.status(201).json(feedback);
});

router.post("/demo/load", async (_req, res) => {
  await ensureProfile();
  const [existing] = await db.select({ id: transactionsTable.id }).from(transactionsTable).limit(1);
  if (!existing) {
    const demoTransactions = [
      ["2026-04-12", "Rent payment", "Rent", 15000],
      ["2026-04-14", "Swiggy order", "Food", 4200],
      ["2026-04-20", "Metro card", "Transport", 1800],
      ["2026-05-12", "Rent payment", "Rent", 15000],
      ["2026-05-16", "Groceries and dinner", "Food", 5200],
      ["2026-05-23", "Netflix and cinema", "Entertainment", 2500],
      ["2026-06-12", "Rent payment", "Rent", 15000],
      ["2026-06-18", "Food and groceries", "Food", 6100],
      ["2026-06-22", "Uber and metro", "Transport", 2800],
      ["2026-07-12", "Rent payment", "Rent", 15000],
      ["2026-07-18", "Food delivery", "Food", 7000],
      ["2026-07-25", "Amazon purchase", "Shopping", 4300],
      ["2026-08-12", "Rent payment", "Rent", 15000],
      ["2026-08-17", "Dining and groceries", "Food", 7600],
      ["2026-08-25", "Entertainment subscription", "Entertainment", 3500],
      ["2026-09-04", "Electricity bill", "Bills", 2200],
      ["2026-09-06", "Swiggy order", "Food", 450],
      ["2026-09-08", "Uber ride", "Transport", 300],
      ["2026-09-10", "Amazon purchase", "Shopping", 2500],
      ["2026-09-13", "Concert tickets", "Entertainment", 8000],
    ] as const;
    await db.insert(transactionsTable).values(demoTransactions.map(([date, description, category, amount]) => ({ date, description, category, amount, confidence: 0.94, isAnomaly: amount >= 7000 })));
    await db.insert(budgetsTable).values([
      { category: "Food", amount: 6000 },
      { category: "Transport", amount: 4000 },
      { category: "Entertainment", amount: 3500 },
      { category: "Shopping", amount: 4000 },
      { category: "Bills", amount: 3000 },
    ]).onConflictDoNothing();
    await db.insert(goalsTable).values({ title: "Build an emergency fund", targetAmount: 120000, currentAmount: 40000, deadlineMonths: 12 });
    await db.insert(alertsTable).values({ type: "Unusual spending", severity: "warning", category: "Entertainment", message: "Entertainment spending is significantly higher than your normal pattern." });
    await logAgent("SENSE", "Demo dataset loaded for the finance lab presentation.");
    await logAgent("ANALYZE", "Six months of spending history is ready for trend analysis.");
  }
  await runAgentLoop("Demo data analysis refreshed.");
  return res.json(await getDashboardData());
});

export default router;