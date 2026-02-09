# PAA (Phishing Awareness Admin)

Phishing awareness command center with a Node.js API, React admin UI, and Microsoft Graph integration. Build campaigns, send HTML templates, and track click analytics with a PDF export.

## Features
- Campaign + template management
- Microsoft Graph sender and recipient discovery
- Tokenized tracking links with click logging
- Click analytics (per campaign + overall KPI)
- PDF export for overall and per-campaign reports
- Prisma + PostgreSQL
- Dockerized dev stack

## Architecture
- Backend: Node.js + TypeScript + Express
- DB: Prisma + PostgreSQL
- UI: React + Vite
- Graph: MSAL client credentials (optional mock mode)

## Quick start (Docker)
1. Copy env config: `cp .env.example .env`
2. Set required variables in `.env` (see below)
3. Start stack: `docker compose up -d --build`
4. Run migrations: `docker compose exec app npm run prisma:deploy`
5. Seed data: `docker compose exec app npm run seed`

UI: `http://localhost:5173`
API: `http://localhost:3001`

## Dev workflow (local)
Backend:
1. `npm install`
2. `npm run prisma:migrate`
3. `npm run dev`

UI:
1. `cd ui`
2. `npm install`
3. `npm run dev`

The UI reads `VITE_API_BASE_URL` from `ui/.env`.

## Environment variables
Backend (`.env`):
- `DATABASE_URL`: PostgreSQL connection string
- `GRAPH_MOCK_MODE`: `true` to use mock adapter
- `TOKEN_TTL_DAYS`: token validity in days
- `PUBLIC_BASE_URL`: base URL used for tracking links
- `LANDING_REDIRECT_URL`: redirect target after tracking
- `GRAPH_SENDER_ADDRESS`: sender mailbox for Graph
- `TENANT_NAME`: optional fallback label stored with click events
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`: Graph credentials

UI (`ui/.env`):
- `VITE_API_BASE_URL`: API base URL (for example `http://localhost:3001`)

Do not commit `.env` or `ui/.env` to GitHub.

## API endpoints
- `POST /api/templates`
- `GET /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`
- `GET /api/senders`
- `GET /api/recipients`
- `GET /api/departments`
- `POST /api/campaigns`
- `GET /api/campaigns`
- `GET /api/campaigns/summary`
- `DELETE /api/campaigns/:id`
- `POST /api/campaigns/:id/start`
- `GET /api/campaigns/:id/clicks`
- `GET /t/:token`
- `GET /health`

## PDF export
Open the Tracking section (Click overview) and use:
- Export overall PDF
- Export campaign PDF

## Microsoft Graph setup
1. Register an Azure AD app
2. Add application permissions: `Mail.Send`, `User.Read.All`, `Organization.Read.All`
3. Grant admin consent
4. Set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `GRAPH_SENDER_ADDRESS`
5. Set `GRAPH_MOCK_MODE=false`

## Security note
This project is for authorized phishing awareness programs only. Use only on systems and users you are permitted to test.
