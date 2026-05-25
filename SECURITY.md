# Security Policy

## Supported versions

This is a teaching project. Security fixes are provided on the default branch (`main`).

## Reporting a vulnerability

Please do not open a public issue for potential vulnerabilities.

Report privately to repository maintainers with:

- Description of the issue
- Reproduction steps
- Impact
- Suggested mitigation (if available)

## Secrets policy

- Do not commit `.env` files.
- Do not commit private keys, PATs, or cloud credentials.
- Use GitHub Actions secrets for CI/CD credentials.
