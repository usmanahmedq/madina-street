# Madina Street ERP

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4aab63f6-b336-4788-b0a0-3ba9b142d542

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Supply `DATABASE_URL` and a securely generated `JWT_SECRET` (at least 32 characters) through the environment or the ignored `.env` file. Use the existing provisioned database; do not seed or reset it.
3. Run the app:
   `npm run dev`

## Render Web Service

Build with `npm install && npm run build` and start with `npm start` from the project root. The start command explicitly selects production mode, serves the built frontend and React Router deep links from `dist`, and serves API routes from the same origin. Vite's development server is not started.

| Variable | Production configuration |
| --- | --- |
| `DATABASE_URL` | Required. Supply the Neon connection string with the newly rotated database password. Missing configuration stops production startup. |
| `JWT_SECRET` | Required. Supply a newly rotated random secret of at least 32 characters. Missing/short configuration stops startup. |
| `PORT` | Automatically supplied by Render; do not set it manually. Local default is 3000. Server binds to `0.0.0.0`. |
| `NODE_ENV` | `npm start` sets this to `production`. |
| `DATABASE_TRANSPORT` | Optional; Neon hosts automatically select `neon-websocket` over TLS port 443. |

`GEMINI_API_KEY` and `APP_URL` are not used by the current application and are not required. Leave the internal test flag `MADINA_TEST_MODE` unset in production.

Keep secrets out of Git and frontend build variables. Rotate both exposed credentials before deployment and configure replacements directly in Render; no code changes or database migrations are needed for rotation. JWT rotation invalidates existing sessions.
