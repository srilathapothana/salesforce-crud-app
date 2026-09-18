# Salesforce CRUD Console

A full-stack web application that performs Create, Read, Update, and Delete
operations on Salesforce standard objects — **Account, Contact, Lead,
Opportunity, and Case** — through a custom web UI, without using the native
Salesforce interface. Authentication is handled entirely through the
Salesforce OAuth 2.0 Authorization Code flow (with PKCE) via a Salesforce
External Client App.

## Tech Stack

| Layer      | Technology                                   |
|------------|-----------------------------------------------|
| Frontend   | React 18 (Vite)                               |
| Backend    | Node.js, Express                              |
| Auth       | OAuth 2.0 Authorization Code Flow + PKCE      |
| Data Layer | Salesforce REST API (SOQL queries, sObjects)  |

## Features

- Salesforce login via OAuth 2.0 — no credentials are ever handled by the app itself
- Central dropdown to switch between five standard objects
- Dynamic field rendering per object (5–7 fields, configurable up to 10)
- Infinite-scroll pagination — loads 20 records at a time
- Create, View, Edit, and Delete actions on every record
- Automatic access-token refresh, including support for orgs with Refresh
  Token Rotation enabled
- Single deployable service: Express serves the built React app in production

## Architecture

```
┌──────────────┐        OAuth 2.0 + PKCE        ┌──────────────────┐
│   Browser    │ ─────────────────────────────► │   Salesforce     │
│  (React SPA) │ ◄───────────────────────────── │  External Client │
└──────┬───────┘        access/refresh token     │       App        │
       │                                          └──────────────────┘
       │ REST calls (/api/*)                                ▲
       ▼                                                     │
┌──────────────┐        REST API / SOQL over               │
│  Express API │ ──────────────────────────────────────────┘
│   (Node.js)  │
└──────────────┘
```

The Express server owns the Salesforce session (access token, refresh token)
and never exposes it to the browser. The frontend only ever talks to the
Express API over same-origin `/api/*` and `/auth/*` routes.

## Project Structure

```
salesforce-crud-app/
├── client/                 React frontend (Vite)
│   └── src/
│       ├── App.jsx         Dropdown, record table, infinite scroll
│       ├── api.js          Fetch wrapper for the backend API
│       └── components/
│           └── RecordModal.jsx   Create / View / Edit modal
├── server/                 Express backend
│   ├── index.js            OAuth routes + CRUD proxy routes
│   ├── objectConfig.js     Object/field configuration
│   └── .env.example
└── README.md
```

## Prerequisites

- Node.js 18 or later
- A Salesforce Developer Edition org (free — see setup below)
- Git

## Setup

### 1. Create a Salesforce Developer Org

Sign up for a free Developer Edition org at
[developer.salesforce.com/signup](https://developer.salesforce.com/signup).

### 2. Create an External Client App

In Salesforce Setup, go to **External Client Apps → New External Client App**
and configure it as follows.

**Basic Information**
- App Name: `SF CRUD Console` (or any name)
- Distribution State: `Local`

**API (Enable OAuth Settings)**
- Enable OAuth: checked
- Callback URL(s):
  - `http://localhost:5000/auth/callback` (local development)
  - `https://<your-deployed-domain>/auth/callback` (added after deployment)
- OAuth Scopes:
  - `Manage user data via APIs (api)`
  - `Perform requests at any time (refresh_token, offline_access)`
- Flow Enablement: `Enable Authorization Code and Credentials Flow`
- Security: PKCE and Refresh Token Rotation are enforced by default on new
  orgs and cannot be disabled — this application implements both.

Save the app, then under its **Settings → OAuth Settings → Manage Consumer
Details**, retrieve the **Consumer Key** and **Consumer Secret**. Confirm
**App Authorization** is set to "All users can self-authorize."

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Populate `server/.env`:

```env
SF_CLIENT_ID=<Consumer Key>
SF_CLIENT_SECRET=<Consumer Secret>
SF_REDIRECT_URI=http://localhost:5000/auth/callback
SF_LOGIN_URL=https://login.salesforce.com
SESSION_SECRET=<a long random string>
CLIENT_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

### 4. Install and run

Backend:
```bash
cd server
npm install
npm run dev
```

Frontend (separate terminal):
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` and click **Log in to Salesforce**.

## API Reference

| Method | Endpoint                        | Description                              |
|--------|----------------------------------|-------------------------------------------|
| GET    | `/auth/login`                   | Redirects to Salesforce OAuth authorize   |
| GET    | `/auth/callback`                | Exchanges the auth code for tokens        |
| POST   | `/auth/logout`                  | Clears the server-side session            |
| GET    | `/api/auth/status`              | Returns current login state               |
| GET    | `/api/objects`                  | Lists supported objects and their fields  |
| GET    | `/api/records/:object`          | Paginated record list (`offset`, `limit`) |
| GET    | `/api/records/:object/:id`      | Fetch a single record                     |
| POST   | `/api/records/:object`          | Create a record                           |
| PATCH  | `/api/records/:object/:id`      | Update a record                           |
| DELETE | `/api/records/:object/:id`      | Delete a record                           |

Object and field configuration lives entirely in `server/objectConfig.js`;
the frontend renders whatever fields the backend reports, so adding a field
or a new object requires no frontend changes.

## Deployment

The application is designed to run as a single service — Express serves the
built React app alongside the API — so it deploys to any host that runs a
persistent Node process (Koyeb, Render, Railway, Fly.io, etc.).

Example using **Koyeb**:

1. Push the repository to GitHub.
2. Create a new Web Service, connect the GitHub repo, and select the
   **Buildpack** builder.
3. Build command:
   ```
   cd client && npm install && npm run build && cd ../server && npm install
   ```
4. Run command:
   ```
   node server/index.js
   ```
5. Set the environment variables listed above, with `NODE_ENV=production`
   and `SF_REDIRECT_URI` pointing at the deployed URL.
6. After the first deploy, add the deployed callback URL to the Salesforce
   External Client App's Callback URL list.

## Security Notes

- Access and refresh tokens are stored server-side in the session only; they
  are never sent to or stored in the browser.
- The OAuth flow uses PKCE (`S256`), satisfying Salesforce's default
  requirement for External Client Apps.
- Refresh Token Rotation is supported: each refresh persists the newly
  issued refresh token, since the previous one is invalidated immediately.
- Session storage is in-memory for this build; a production deployment
  serving multiple users should use a persistent store such as Redis.

## License

This project was built as part of a coding assignment and is provided as-is
for evaluation purposes.