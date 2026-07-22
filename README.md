# PERL Rebuild

This repo contains the mock-first PERL rebuild described in `AGENTS.md`.

## Apps

- `perl-api`: Express + TypeScript API scaffold with mock repositories wired by default
- `perl-rfid-frontend`: React + Vite frontend scaffold for the rebuild shell

## Local development

1. Copy `perl-api/.env.example` to `perl-api/.env`
2. Copy `perl-rfid-frontend/.env.example` to `perl-rfid-frontend/.env`
3. Install dependencies in each app with `npm install`
4. Start the API with `npm run dev` inside `perl-api`
5. Start the frontend with `npm run dev` inside `perl-rfid-frontend`

For the mock-first flow, leave `DATA_LAYER=mock`.

There is intentionally no root Docker Compose stack yet. Per `AGENTS.md`, local database infrastructure is deferred until Phase 6.

## Current phase

The implemented scaffold is limited to Phase 0:

- root app folders
- mock-by-default backend composition root
- health endpoint
- backend lint/test baseline
- frontend placeholder shell
- no database or Docker dependency in Phase 0

Database-backed persistence is deferred until the later real-persistence phase.
