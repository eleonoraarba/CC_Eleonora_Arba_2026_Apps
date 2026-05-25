# Contributing

Thanks for contributing to this lab project.

## Development workflow

1. Fork the repository and create a feature branch.
2. Copy env examples:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
3. Run locally:
   - `docker compose up --build`
4. Run checks before opening a PR:
   - Backend: `cd backend && npm ci && npm run check`
   - Frontend: `cd frontend && npm ci && CI=true npm test -- --watch=false --passWithNoTests && npm run build`

## Pull request checklist

- Keep changes focused and small.
- Update docs when behavior or setup changes.
- Never commit `.env` files, tokens, or keys.
- Ensure CI passes.
