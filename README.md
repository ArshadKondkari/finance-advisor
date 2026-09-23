# Saarthi — AI Personal Finance Advisor

Saarthi is a full-stack academic prototype that helps a user understand spending, budgets, savings goals, and unusual transactions. It is a budgeting and financial-habits decision-support tool. It does not provide investment advice, guaranteed returns, banking services, or bank-account synchronization.

## Start here — easiest local setup

This is a **Node.js/TypeScript project**, not a Python project.

> Do **not** run `pip install -r requirements.txt`. Python packages are not used by this application. Use `corepack pnpm install` instead.

### Windows + VS Code

1. Install **Node.js LTS** from <https://nodejs.org/>.
2. Install **PostgreSQL** from <https://www.postgresql.org/download/>.
3. Open PostgreSQL/pgAdmin and create a database named:

   ```text
   saarthi_finance
   ```

4. Open VS Code and open the folder where you want the project.
5. Open **Terminal → New Terminal** and run these commands:

   ```powershell
   git clone https://github.com/ArshadKondkari/finance-advisor.git
   cd finance-advisor
   corepack pnpm --version
   corepack pnpm install
   ```

   This setup uses Node.js Corepack, so it does **not** require the `npm`
   command. If `corepack` is also not recognized, install or reinstall the
   official Node.js LTS package and restart VS Code.

6. Set your PostgreSQL connection. Replace `YOUR_PASSWORD` with your PostgreSQL password:

   ```powershell
   $env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/saarthi_finance"
   ```

7. Create the application tables:

   ```powershell
   corepack pnpm --filter @workspace/db run push
   ```

8. Start the backend in **Terminal 1**:

   ```powershell
   $env:PORT="5000"
   corepack pnpm --filter @workspace/api-server run dev
   ```

9. Open a second VS Code terminal and start the frontend:

   ```powershell
   $env:PORT="5173"
   $env:BASE_PATH="/"
   corepack pnpm --filter @workspace/finance-advisor run dev
   ```

10. Open this address in your browser:

    <http://localhost:5173>

### One-click Windows setup

After PostgreSQL is installed and the `saarthi_finance` database exists, you can double-click:

```text
setup-windows.bat
```

It installs the JavaScript libraries, creates the tables, starts the API and frontend, and opens the browser. It asks you for the `DATABASE_URL`.

### If a command is not recognized

If `pnpm` is not recognized, use the Node.js-bundled Corepack command:

```powershell
corepack pnpm --version
```

Then use `corepack pnpm` instead of `pnpm` for the commands below. If
`corepack` is not recognized, install or reinstall Node.js LTS from
<https://nodejs.org/> and restart VS Code.

## Quick start

### Prerequisites

Install the following before starting:

- Node.js 20.19+ or Node.js 22+
- pnpm 9+
- PostgreSQL 14+
- Git (optional, only needed when cloning the repository)

Download links:

- Node.js: <https://nodejs.org/>
- PostgreSQL: <https://www.postgresql.org/download/>
- pnpm: <https://pnpm.io/installation>

### 1. Get the project

Clone the repository:

```bash
git clone https://github.com/ArshadKondkari/finance-advisor.git
cd finance-advisor
```

Or download the repository ZIP and open the extracted `finance-advisor` folder in VS Code.

### 2. Create a PostgreSQL database

Create a local database named `saarthi_finance` using pgAdmin or `psql`:

```sql
CREATE DATABASE saarthi_finance;
```

Create the connection string using your PostgreSQL username and password:

```text
postgresql://postgres:YOUR_PASSWORD@localhost:5432/saarthi_finance
```

Do not commit a real database password to GitHub.

### 3. Install JavaScript dependencies

From the repository root:

```bash
corepack pnpm install
```

If pnpm is already installed and available:

```bash
pnpm install
```

### 4. Set the database connection

The backend and database commands read `DATABASE_URL` from the terminal environment.

macOS/Linux:

```bash
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/saarthi_finance"
```

Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/saarthi_finance"
```

### 5. Create the tables

Run this once after creating the database:

```bash
corepack pnpm --filter @workspace/db run push
```

### 6. Start the API

Open VS Code Terminal 1:

macOS/Linux:

```bash
export PORT=5000
corepack pnpm --filter @workspace/api-server run dev
```

Windows PowerShell:

```powershell
$env:PORT="5000"
corepack pnpm --filter @workspace/api-server run dev
```

Keep this terminal open. Test the API at <http://localhost:5000/api/healthz>.

### 7. Start the web app

Open VS Code Terminal 2:

macOS/Linux:

```bash
export PORT=5173
export BASE_PATH=/
corepack pnpm --filter @workspace/finance-advisor run dev
```

Windows PowerShell:

```powershell
$env:PORT="5173"
$env:BASE_PATH="/"
corepack pnpm --filter @workspace/finance-advisor run dev
```

Open <http://localhost:5173> in your browser.

The Vite development proxy forwards `/api` requests from port `5173` to the API on port `5000`.

## One-click local setup

After PostgreSQL is installed and the `saarthi_finance` database exists:

- Windows: double-click `setup-windows.bat`
- macOS/Linux: run `./setup-macos-linux.sh`

The setup script installs dependencies, asks for your local `DATABASE_URL`, creates the tables, and starts both the API and frontend. It uses
`corepack pnpm` when a standalone `pnpm` command is not available, so `npm`
is not required.
On Windows, it can offer to install Node.js LTS with `winget` if Node.js is missing. PostgreSQL must still be installed and configured separately.

## Demo flow

1. Open the dashboard.
2. Select **Load sample workspace**.
3. Review the six-month spending trend and Entertainment over-budget signal.
4. Open Transactions and add `Swiggy order` with an amount of `450`; Food should be suggested.
5. Add a large Entertainment transaction; the agent should create an unusual-spending alert.
6. Open Advisor and ask: `Which category am I spending the most on?`
7. Run analysis and review the Agent Activity trail.
8. Give feedback on a recommendation and show the Learn step.

## Database table structure

The application uses PostgreSQL with Drizzle ORM. You do **not** need to
manually create each table: this command creates or updates them from the
project schema:

```bash
corepack pnpm --filter @workspace/db run push
```

The database must already exist, for example `saarthi_finance`. The command
creates these tables:

### `finance_profiles`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `name` | `text` | yes | — |
| `monthly_income` | `real` | yes | `50000` |
| `current_savings` | `real` | yes | `40000` |
| `savings_target` | `real` | yes | `120000` |
| `goal_duration_months` | `integer` | yes | `12` |

### `finance_transactions`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `amount` | `real` | yes | — |
| `description` | `text` | yes | — |
| `category` | `text` | yes | — |
| `date` | `date` | yes | — |
| `confidence` | `real` | yes | `1` |
| `is_anomaly` | `boolean` | yes | `false` |
| `created_at` | `timestamptz` | yes | current timestamp |

### `finance_budgets`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `category` | `text` | yes, unique | — |
| `amount` | `real` | yes | — |

### `finance_goals`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `title` | `text` | yes | — |
| `target_amount` | `real` | yes | — |
| `current_amount` | `real` | yes | `0` |
| `deadline_months` | `integer` | yes | — |
| `created_at` | `timestamptz` | yes | current timestamp |

### `finance_alerts`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `type` | `text` | yes | — |
| `severity` | `text` | yes | — |
| `message` | `text` | yes | — |
| `category` | `text` | yes | `General` |
| `is_read` | `boolean` | yes | `false` |
| `created_at` | `timestamptz` | yes | current timestamp |

### `finance_recommendations`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `title` | `text` | yes | — |
| `message` | `text` | yes | — |
| `action` | `text` | yes | — |
| `utility_score` | `real` | yes | — |
| `feedback` | `text` | no | `NULL` |
| `created_at` | `timestamptz` | yes | current timestamp |

### `finance_feedback`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `recommendation_id` | `integer` | yes | — |
| `rating` | `text` | yes | — |
| `created_at` | `timestamptz` | yes | current timestamp |

`recommendation_id` identifies the recommendation being rated. The current
schema keeps this relationship at the application level rather than declaring
a PostgreSQL foreign-key constraint.

### `finance_agent_logs`

| Column | PostgreSQL type | Required | Default |
| --- | --- | --- | --- |
| `id` | `serial` | yes, primary key | auto-increment |
| `stage` | `text` | yes | — |
| `message` | `text` | yes | — |
| `created_at` | `timestamptz` | yes | current timestamp |

To inspect the structure after setup, open `psql` and run:

```sql
\dt finance_*
\d finance_profiles
\d finance_transactions
\d finance_budgets
\d finance_goals
\d finance_alerts
\d finance_recommendations
\d finance_feedback
\d finance_agent_logs
```

## What makes it an intelligent agent?

Every transaction can trigger this loop:

1. **Sense** — receive a new transaction.
2. **Perceive** — normalize the description, date, amount, and category.
3. **Analyze** — calculate category totals, trends, budgets, and anomalies.
4. **Reason** — compare the current state with savings goals and previous behavior.
5. **Decide** — rank possible actions with an internal utility score.
6. **Act** — create a recommendation or alert.
7. **Learn** — store agent activity and user feedback.

The loop is visible in the dashboard's Agent Loop and Agent Activity sections.

## Project structure

```text
artifacts/finance-advisor/   React + Vite frontend
artifacts/api-server/        Express + TypeScript API
lib/db/                      PostgreSQL + Drizzle schema
lib/api-spec/                OpenAPI contract
lib/api-zod/                 Generated API validation types
lib/api-client-react/        Generated React API client
PROJECT_REPORT.md            Academic report, PEAS model, algorithms, and limitations
```

## Useful commands

```bash
pnpm run typecheck
pnpm --filter @workspace/finance-advisor run build
pnpm --filter @workspace/api-server run build
```

## Troubleshooting

### `DATABASE_URL must be set`

Set `DATABASE_URL` in the same terminal before running the database or API command.

### `PORT environment variable is required`

Set `PORT=5000` for the API or `PORT=5173` for the frontend.

### The dashboard loads but data requests fail

Check that:

1. PostgreSQL is running.
2. The API terminal is still running on port `5000`.
3. The frontend is running on port `5173`.
4. The database tables were created with `pnpm --filter @workspace/db run push`.

### Reset local demo data

The **Load sample workspace** action replaces the current demonstration records. Do not use it if you need to preserve your current local entries.

## Safety boundaries

Never enter bank passwords, card numbers, OTPs, or banking credentials. This project stores only the financial values needed for the academic demonstration.

## License

This project is provided for academic and demonstration purposes.