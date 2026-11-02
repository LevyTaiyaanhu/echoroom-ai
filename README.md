# EchoRoom AI

A Zimbabwe-focused music event discovery and promotion platform.

## Problem

Music event information is scattered across social platforms, making
accurate and current details difficult to find.

## Planned solution

- Promoter profiles
- Searchable event listings
- Official event pages
- AI-assisted flyer extraction and descriptions
- Duplicate-event suggestions
- Admin verification and user reporting
- Likes, follows, and engagement statistics

## Planned stack

- Frontend: React and Tailwind CSS
- Backend: Node.js and Express
- Database: PostgreSQL hosted on Supabase
- AI: Google Gemini API

## Development status

# EchoRoom AI Backend

Express REST API for the EchoRoom AI capstone project.

## Requirements

- Node.js matching `.nvmrc`
- npm

## Setup

```bash
nvm install
nvm use
npm ci
cp .env.example .env
```

## Development

```bash
npm run dev
```

## Tests

```bash
npm test
```

## Start

```bash
npm start
```

## Current endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Check whether the API is responding |

## Configuration

- NODE_ENV: application environment
- PORT: HTTP server port
- CLIENT_URL: permitted frontend origin

## Current limitations

Database access, authentication, event management, and AI integration
are not implemented yet.