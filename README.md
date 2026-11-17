# EchoRoom AI

EchoRoom AI is a Zimbabwe-focused music event discovery and promotion web
application. It brings event listings, artist and promoter profiles, and fan
engagement tools together in one place, so people can discover what's happening
and promoters can share event information more clearly.

## What you can do

- Browse and search music events and artist profiles.
- Create accounts and follow artists or promoters.
- Save events and receive notifications.
- Create and manage promoter events and profiles.
- Use AI-assisted tools to extract details from event flyers, draft event
  descriptions, and identify possible duplicate events.
- Review reported content using moderation tools.

## How it works

- **Frontend:** React, Vite, and Tailwind CSS
- **Backend:** Node.js and Express REST API
- **Database:** PostgreSQL (configured for Supabase)
- **AI features:** Google Gemini API

The frontend is a responsive web app and includes a Progressive Web App (PWA)
manifest and service worker. It can be opened in a desktop or mobile browser.
It is not a native Android or iOS application.

## Requirements

- Node.js 22.x and npm
- A Supabase PostgreSQL database and its CA certificate
- A Google Gemini API key to use the AI features

Check your installed versions:

```bash
node --version
npm --version
```

## Run locally

These instructions work on Windows, Linux, and macOS. Run commands from the
repository root unless a command first changes directory.

### 1. Get the project and create environment files

Clone the repository, then change into its directory:

```bash
git clone <repository-url>
cd echoroom-ai
```

On **Windows PowerShell**:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

On **Linux or macOS**:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Configure the backend

Edit `backend/.env` and set:

| Variable | What to set |
|---|---|
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |
| `DATABASE_CA_CERT_PATH` | `certs/supabase-ca.crt` for local development |
| `JWT_SECRET` | A private random string of at least 32 characters |
| `GEMINI_API_KEY` | Your key from [Google AI Studio](https://aistudio.google.com/) |
| `CLIENT_URL` | `http://localhost:5173` for local browser access |

The example file also sets the development port and Gemini model. Keep the
Gemini key and database credentials in the backend environment file only; do
not put secrets in `frontend/.env` or commit either `.env` file.

The frontend example uses `VITE_API_BASE_URL=http://localhost:5000/api`, which
matches the local backend. Change it only if your API runs at a different URL.

### 3. Install dependencies and migrate the database

Open a terminal in the repository root and run:

```bash
cd backend
npm ci
npm run db:migrate
```

The migration command creates or updates the database tables. It needs a valid
database URL and CA certificate in `backend/.env`.

### 4. Start the backend and frontend

In the first terminal, from `backend/`, start the API:

```bash
npm run dev
```

In a second terminal, from the repository root, start the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal (normally
`http://localhost:5173`). The backend API runs at `http://localhost:5000`; check
that it is responding at `http://localhost:5000/api/health`.

To run the backend tests, use a terminal in `backend/`:

```bash
npm test
```

To build the frontend for deployment, use a terminal in `frontend/`:

```bash
npm run build
```

## Use on an iPhone or iPad

EchoRoom AI runs in Safari as a responsive website; there is no native iOS app
to install.

For regular use, open the deployed HTTPS website in Safari. To add the web app
to the Home Screen, use Safari's **Share** button and choose **Add to Home
Screen**. Home Screen installation and offline app-shell support require the
deployed site to use HTTPS.

To test from an iPhone or iPad while developing:

1. Connect the computer and iPhone/iPad to the same trusted Wi-Fi network.
2. Find the computer's local IP address and use it in place of
   `<computer-ip>` below.
3. Set `CLIENT_URL` in `backend/.env` to
   `http://<computer-ip>:5173`.
4. Set `VITE_API_BASE_URL` in `frontend/.env` to
   `http://<computer-ip>:5000/api`.
5. Start the backend normally. Start Vite with this command from `frontend/`:

   ```bash
   npm run dev -- --host 0.0.0.0
   ```

6. If your computer's firewall asks, allow the development servers on the
   trusted local network. In iPhone/iPad Safari, open
   `http://<computer-ip>:5173`.

Restart the frontend after changing its `.env` file. Local-network HTTP access
is for development; use HTTPS for a deployed site and Home Screen installation.

## API overview

All API routes are under `/api`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Check whether the API is responding |
| `POST` | `/api/ai/extract-flyer` | Extract event details from an uploaded flyer |
| `POST` | `/api/ai/generate-description` | Draft promotional event text |
| `POST` | `/api/ai/detect-duplicates` | Find possible duplicate events |

AI routes require authentication. Flyer extraction and description generation
are for promoter accounts. Flyer uploads accept JPEG, PNG, WEBP, or GIF images
up to 5 MB; extracted fields that are not present in the image are returned as
missing rather than invented.

## Configuration reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Application environment |
| `PORT` | No | `5000` | Backend HTTP port |
| `CLIENT_URL` | No | `http://localhost:5173` | Allowed frontend origin for CORS |
| `DATABASE_URL` | Yes for database features | — | PostgreSQL connection string |
| `DATABASE_CA_CERT_PATH` | Yes locally | — | Path to the PostgreSQL CA certificate |
| `DATABASE_CA_CERT` | Alternative | — | CA certificate PEM content, for serverless deployments |
| `JWT_SECRET` | Yes | — | JWT signing secret; must be at least 32 characters |
| `JWT_EXPIRES_IN` | No | `15m` | Token expiration |
| `GEMINI_API_KEY` | For AI features | — | Google Gemini API key; keep it on the backend |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model ID |
| `MAX_FILE_SIZE` | No | `5242880` | Maximum upload size in bytes (5 MB) |
| `VITE_API_BASE_URL` | No | `http://localhost:5000/api` | Frontend API base URL |

## Deployment

The frontend includes Netlify configuration in `frontend/netlify.toml`. The
backend includes a Vercel serverless entry point and configuration in
`backend/api/` and `backend/vercel.json`. Configure the environment variables
for each hosting provider; for a serverless backend, provide the certificate
through `DATABASE_CA_CERT` rather than a local certificate path. Set
`CLIENT_URL` to the deployed frontend's origin.

## Security notes

- Never commit `.env` files, database credentials, JWT secrets, or API keys.
- Keep `GEMINI_API_KEY` on the backend; frontend environment variables prefixed
  with `VITE_` are included in the browser build and must not contain secrets.
- Use HTTPS for deployed environments.
