# PERL Rebuild

This repo contains the mock-first PERL rebuild described in `AGENTS.md`.

## Apps

- `perl-api`: Express + TypeScript API scaffold with mock repositories wired by default
- `perl-rfid-frontend`: React + Vite frontend for the school-branded mock shell

## Local development

1. Copy `perl-api/.env.example` to `perl-api/.env`
2. Copy `perl-rfid-frontend/.env.example` to `perl-rfid-frontend/.env`
3. Install dependencies in each app with `npm install`
4. Start the API with `npm run dev` inside `perl-api`
5. Start the frontend with `npm run dev` inside `perl-rfid-frontend`

For the mock-first flow, leave `DATA_LAYER=mock`.

There is an optional root Docker Compose stack for the current app-only setup:

```bash
docker compose up --build
```

It runs only `perl-api` and `perl-rfid-frontend` on mock data. Database infrastructure is still deferred until Phase 6.

## Current phase

The current implementation covers Phase 0 and Phase 1:

- mock-by-default backend composition root
- school branding via `SchoolProfile` mock data
- `GET /api/school/current` tenant resolution through a query-param demo selector
- frontend `ThemeProvider` that resolves school identity before rendering the shell
- API/frontend Docker stack on mock data only

Auth, attendance, school admin, devices, and database persistence remain in later phases.
