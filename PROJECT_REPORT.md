# Saarthi — AI-Based Personal Financial Advisor Agent

## Abstract

Saarthi is a browser-based intelligent agent for personal financial management. It stores financial transactions and user goals, analyzes spending behavior, compares actual spending with category budgets, detects unusual activity, estimates savings, and generates personalized decision-support recommendations. The system demonstrates an agent loop rather than presenting a static expense tracker.

## Problem definition

People often record expenses without understanding how their spending affects budgets and savings goals. A useful assistant must continuously observe new transactions, compare them with historical behavior, evaluate goals, and explain the next useful action.

## Objectives

- Centralize income, savings, expenses, budgets, and goals.
- Categorize expense descriptions with confidence.
- Detect budget variance and unusual transactions.
- Estimate future savings from historical monthly spending.
- Generate recommendations from stored data rather than fixed demo text.
- Show the complete Sense–Analyze–Reason–Decide–Act–Learn cycle.
- Provide an understandable interface suitable for a college presentation.

## PEAS model

| Element | Saarthi |
|---|---|
| Performance measure | Useful recommendations, goal progress, budget adherence, low false alerts, response time |
| Environment | User profile, income, transactions, budgets, goals, historical behavior |
| Actuators | Recommendations, alerts, goal status, category suggestions, dashboard updates |
| Sensors | Transaction descriptions, amount, date, profile values, budgets, feedback |

## Intelligent-agent classification

Saarthi is primarily a **learning agent** with **goal-based** and **utility-based** decision making.

- **Learning agent:** historical transactions and user feedback remain stored and change later analysis.
- **Goal-based agent:** the agent evaluates whether estimated savings can meet a user's goal.
- **Utility-based decision making:** candidate actions receive an internal priority score from budget deviation, savings gap, and anomaly severity.

The utility score is an internal decision-support value, not a financial truth.

## Architecture

The frontend is a React + Vite dashboard. The backend is an Express API in the shared API service. PostgreSQL stores profiles, transactions, budgets, goals, alerts, recommendations, feedback, and agent logs. The API contract is defined in OpenAPI and generated client hooks are used by the frontend.

The decision cycle is:

```text
Transaction input
      ↓
Sense / Perceive
      ↓
Category and anomaly analysis
      ↓
Budget and goal evaluation
      ↓
Utility-ranked decision
      ↓
Recommendation or alert
      ↓
Agent log and feedback update
```

## AI and analysis techniques

### Expense classification

Saarthi uses an explainable text classifier with a small training vocabulary. Description tokens are compared with category terms and a confidence score is calculated. The UI shows the confidence so the user can manually choose a category when needed. The classifier is intentionally explainable for a semester demonstration.

### Anomaly detection

For a category with history, the agent compares a new amount with the historical average and standard deviation. A transaction is unusual when it is materially above the learned category pattern. With very little history, a conservative high-value threshold is used.

### Savings prediction

The agent calculates monthly outflow for available historical months and estimates savings as income minus the average historical outflow. The result is labeled as an estimate and is compared with the monthly amount required by each goal.

### Decision engine

The engine prioritizes an over-budget category first, then a savings gap, and otherwise confirms that the current pace is healthy. The result is persisted as a recommendation with an internal utility score and a human-readable reason.

## Database design

- `finance_profiles` — one personal financial profile
- `finance_transactions` — amount, description, category, date, confidence, anomaly flag
- `finance_budgets` — one budget per category
- `finance_goals` — target, current amount, and time horizon
- `finance_alerts` — severity, message, category, read state
- `finance_recommendations` — action, reason, utility score, feedback
- `finance_feedback` — helpful or not helpful response
- `finance_agent_logs` — visible stages of the agent loop

## Demonstration scenarios

1. Load the sample dataset and show six months of increasing spending.
2. Add `Swiggy ₹450` and show Food classification.
3. Add `Uber ₹300` and show Transport classification.
4. Compare Entertainment spending with a ₹3,500 budget and show the over-budget decision.
5. Add a large entertainment transaction and show unusual-spending detection.
6. Ask the advisor which category has the highest spending and show that the answer uses stored data.
7. Submit feedback and show the Learn activity event.

## Limitations

- This is a personal budgeting prototype, not a regulated financial-advice product.
- The classifier is small and explainable rather than trained on a large banking dataset.
- Savings values are estimates based on recorded transactions and the profile income.
- There is no bank synchronization; users enter demonstration data manually.

## Future scope

- Train a larger classifier with anonymized labeled transactions.
- Add recurring expense recognition.
- Add per-user accounts and access control through a managed identity provider.
- Add optional import from a user-provided CSV.
- Evaluate recommendations against user feedback over a larger history.

## Conclusion

Saarthi demonstrates a working learning, goal-based, utility-driven intelligent agent for personal finance. Its recommendations, alerts, and chat responses are computed from persisted user data, and its visible activity timeline makes the reasoning cycle easy to explain during a term-work presentation.