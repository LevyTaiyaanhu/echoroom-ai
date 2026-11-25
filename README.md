# EchoRoom AI

**Discover Zimbabwe's music scene in one place.**

EchoRoom AI is a music event discovery and promotion platform built for Zimbabwe. It brings music events, artists, promoters, and fans together in one place.

Instead of searching through different WhatsApp groups and social media pages for event flyers, users can discover upcoming events, explore artist profiles, follow their favourite artists, and stay updated on what's happening.

The platform also uses AI to help promoters extract event information from flyers, write event descriptions, and identify possible duplicate events.

## Features

### For fans
- Browse and search upcoming music events.
- Discover artists and view their profiles.
- Follow artists and promoters.
- Save events for later.
- Receive notifications about events.
- Like, view, and share events.

### For artists and promoters
- Create and manage profiles.
- Publish and manage music events.
- Promote events to a wider audience.
- Use AI tools to extract information from event flyers.
- Generate event descriptions.
- Identify possible duplicate event listings.

### For administrators
- Review reported content.
- Manage and moderate platform activity.

## Technologies Used

| Part | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL (Supabase) |
| AI integration | Google Gemini API |
| Frontend hosting | Vercel |
| Backend hosting | Render |

EchoRoom AI is a responsive web application and supports Progressive Web App (PWA) features. It can be accessed using a desktop or mobile browser. It is not a native Android or iOS application.

---

# Getting Started

You can run EchoRoom AI locally on Windows or Ubuntu Linux. For iPhone and iPad, you can access the deployed website through Safari.

## 1. Requirements

Before running the project locally, make sure you have the following installed:

- **Node.js 22.x** – runs the JavaScript backend and frontend development tools.
- **npm** – installs the project dependencies. It comes with Node.js.
- **Git** – downloads the project from GitHub.
- **A Supabase account** – provides the PostgreSQL database.
- **A Google Gemini API key** – required for AI-powered features.

You can check whether Node.js and npm are installed by running:

```bash
node --version
npm --version
```

You should have Node.js 22.x installed.

## 2. Download the Project

Open your terminal or command prompt and run:

```bash
git clone https://github.com/LevyTaiyaanhu/echoroom-ai.git
cd echoroom-ai
```

This downloads the project to your computer.

## 3. Configure Environment Variables

The project uses environment files to store database settings, API keys, and application configuration.

First, create the environment files.

### Windows PowerShell

Run these commands from the project folder:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Ubuntu Linux

Run:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Configure the backend

Open `backend/.env` and provide your own settings:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |
| `DATABASE_CA_CERT_PATH` | Path to the Supabase CA certificate |
| `JWT_SECRET` | A private random string of at least 32 characters |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `CLIENT_URL` | Frontend address, normally `http://localhost:5173` |

For local development, the certificate path is:

```env
DATABASE_CA_CERT_PATH=certs/supabase-ca.crt
```

Keep your database credentials, JWT secret, and Gemini API key private. Never upload your `.env` files to GitHub.

### Configure the frontend

Open `frontend/.env` and set:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

This tells the frontend where to find the local backend API.

**Important:** Only use the variable name expected by the frontend source code. The example above follows the project's documented configuration.

## 4. Install Dependencies

The frontend and backend have separate dependencies, so install them separately.

### Install backend dependencies

```bash
cd backend
npm ci
```

### Install frontend dependencies

Open another terminal in the project folder and run:

```bash
cd frontend
npm ci
```

Wait for both installations to finish.

## 5. Set Up the Database

Before starting the application for the first time, make sure your Supabase database is configured and your backend environment variables are correct.

From the backend folder, run:

```bash
npm run db:migrate
```

This creates or updates the database tables required by the application.

You normally need to run migrations when setting up the database or when the project introduces new migrations.

## 6. Run EchoRoom AI Locally

You need two terminals: one for the backend and another for the frontend.

### Start the backend

Open your first terminal:

```bash
cd echoroom-ai/backend
npm run dev
```

The backend should start at:

```text
http://localhost:5000
```

You can check whether it is running by opening:

```text
http://localhost:5000/api/health
```

### Start the frontend

Open a second terminal:

```bash
cd echoroom-ai/frontend
npm run dev
```

Vite normally starts the frontend at:

```text
http://localhost:5173
```

Open that address in your browser to use EchoRoom AI.

---

# Running EchoRoom AI on Different Devices

## Windows

**What you need to install:**

1. Node.js 22.x.
2. Git.
3. A code editor such as Visual Studio Code.

**Steps:**

1. Install Node.js and Git.
2. Open Visual Studio Code.
3. Open the terminal.
4. Clone the repository:

```powershell
git clone https://github.com/LevyTaiyaanhu/echoroom-ai.git
cd echoroom-ai
```

5. Create the backend and frontend `.env` files using the PowerShell commands above.
6. Configure your environment variables.
7. Install backend and frontend dependencies using `npm ci`.
8. Run the database migration from the backend folder:

```powershell
npm run db:migrate
```

9. Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

10. Start the frontend in another terminal:

```powershell
cd frontend
npm run dev
```

11. Open `http://localhost:5173` in your browser.

**Windows is now ready to run EchoRoom AI locally.**

## Ubuntu Linux

**What you need to install:**

1. Node.js 22.x.
2. npm.
3. Git.
4. A code editor such as Visual Studio Code.

If Git is not installed, open your terminal and run:

```bash
sudo apt update
sudo apt install git
```

Install Node.js 22.x using a trusted installation method, such as the official Node.js distribution or Node Version Manager (nvm).

Check your installations:

```bash
node --version
npm --version
git --version
```

**Steps:**

1. Open your Ubuntu terminal.
2. Clone the repository:

```bash
git clone https://github.com/LevyTaiyaanhu/echoroom-ai.git
cd echoroom-ai
```

3. Create your environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. Configure the environment variables.
5. Install backend dependencies:

```bash
cd backend
npm ci
```

6. Run the database migration:

```bash
npm run db:migrate
```

7. Start the backend:

```bash
npm run dev
```

8. Open another terminal and install frontend dependencies:

```bash
cd echoroom-ai/frontend
npm ci
```

9. Start the frontend:

```bash
npm run dev
```

10. Open `http://localhost:5173` in your browser.

**Ubuntu Linux is now ready to run EchoRoom AI locally.**

## iPhone and iPad (iOS)

EchoRoom AI does not require a separate iOS application. It runs as a responsive web application through Safari.

**What you need:**

- An iPhone or iPad.
- Safari browser.
- An internet connection.

**How to use EchoRoom AI:**

1. Open Safari on your iPhone or iPad.
2. Visit the deployed website:

   `https://echoroom-ai-y2fk.vercel.app/`

3. Browse events, discover artists, and use the available platform features.
4. If you want to add EchoRoom AI to your Home Screen:
   - Tap the Share button in Safari.
   - Select **Add to Home Screen**.
   - Confirm the installation.

EchoRoom AI will then have a Home Screen icon, making it easier to open like an app.

**Do I need to install Node.js or Visual Studio Code on my iPhone?**

No. Those tools are only needed when developing and running the project locally on a computer. For normal use, Safari and an internet connection are enough.

The website must be deployed using HTTPS for Home Screen installation and PWA features.

---

# Running Tests

To run the backend tests, open a terminal in the backend folder:

```bash
npm test
```

# Building the Frontend

To create a production build of the frontend:

```bash
cd frontend
npm run build
```

The production files will be generated in the `frontend/dist` directory.

# Live Deployment

EchoRoom AI is deployed using the following services:

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | Supabase |

**Live website:** https://echoroom-ai-y2fk.vercel.app/

**Backend API:** https://echoroom-ai.onrender.com/

**Backend health check:** https://echoroom-ai.onrender.com/api/health

# Important Security Notes

- Never commit `.env` files to GitHub.
- Keep database passwords and API keys private.
- Never expose the Gemini API key in frontend code.
- Variables beginning with `VITE_` are included in the frontend browser build. Never store private credentials in them.
- Use HTTPS for production deployments.

---

## About the Project

EchoRoom AI aims to make music event discovery and promotion easier in Zimbabwe by giving artists, promoters, venues, and fans a central place to connect.

**Built with the goal of bringing Zimbabwe's music community closer together.**