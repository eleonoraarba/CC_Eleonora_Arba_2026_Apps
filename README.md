# Cloud Computing Lab

Demo project for:

- React frontend authentication with AWS Cognito
- Azure Functions backend JWT verification
- Authorization with Cognito groups (`admin`, `user`) and `custom:device_id`

## Architecture

![](images/0-p3-overview.png "Authorization Flows")

## Table of Contents

- [Quick Start](#quick-start)
- [Mandatory setup](#mandatory-setup)
- [Reference links](#reference-links)
- [Architecture](#architecture)
- [Backend API](#backend-api)
- [Environment variables](#environment-variables)
- [API examples](#api-examples)
- [How Auth Works](#how-auth-works)
- [Local Docker Notes](#local-docker-notes)
- [Production safety notes](#production-safety-notes)
- [Release checklist](#release-checklist)
- [Project governance](#project-governance)
- [Appendix A: Cognito Setup Checklist](#appendix-a-cognito-setup-checklist)
- [Appendix B: Docker Hub Publish Setup (Mandatory)](#appendix-b-docker-hub-publish-setup-mandatory)
- [Appendix C: Azure App Service Deploy (Containers)](#appendix-c-azure-app-service-deploy-containers)
- [License](#license)

## Quick Start

Use this repository as the **second half** of the deployment tutorial.

Follow this order:

1. Deploy Azure infrastructure from `TUCN_CC_Apps_Infra`.
2. Read the OpenTofu outputs from that repo.
3. Add the required secrets and variables in this GitHub repository.
4. Validate the app locally with Docker Compose.
5. Push to `main` and let GitHub Actions publish the images and update Azure.

Before using this repo for Azure deployment, make sure these values already exist in `TUCN_CC_Apps_Infra`:

- `frontend_url`
- `backend_url`
- `resource_group_name`
- `app_service_name`
- `function_app_name`
- `github_oidc_client_id`
- `github_oidc_tenant_id`
- `github_oidc_subscription_id`

GitHub settings required in `TUCN_CC_Apps`:

- Secrets:
    - `DOCKERHUB_USERNAME`
    - `DOCKERHUB_TOKEN`
- Variables:
    - `AZURE_CLIENT_ID`
    - `AZURE_TENANT_ID`
    - `AZURE_SUBSCRIPTION_ID`
    - `AZURE_RESOURCE_GROUP`
    - `AZURE_APP_SERVICE_NAME`
    - `AZURE_FUNCTION_APP_NAME`
    - `REACT_APP_API_BASE`
    - `REACT_APP_COGNITO_AUTHORITY`
    - `REACT_APP_COGNITO_CLIENT_ID`
    - `REACT_APP_COGNITO_DOMAIN`
    - `REACT_APP_OIDC_REDIRECT_URI`
    - `REACT_APP_OIDC_SCOPE`
    - `REACT_APP_LOGOUT_URI`

Recommended mapping from infra outputs:

- `AZURE_CLIENT_ID` = `github_oidc_client_id`
- `AZURE_TENANT_ID` = `github_oidc_tenant_id`
- `AZURE_SUBSCRIPTION_ID` = `github_oidc_subscription_id`
- `AZURE_RESOURCE_GROUP` = `resource_group_name`
- `AZURE_APP_SERVICE_NAME` = `app_service_name`
- `AZURE_FUNCTION_APP_NAME` = `function_app_name`
- `REACT_APP_API_BASE` = `backend_url`
- `REACT_APP_OIDC_REDIRECT_URI` = `frontend_url`
- `REACT_APP_LOGOUT_URI` = `frontend_url`

Once those are configured:

1. Run the app locally.
2. Commit and push to `main`.
3. Verify GitHub Actions built and pushed both images.
4. Verify Azure App Service and Azure Function App were updated.

## Reference links

- AWS Cognito: https://docs.aws.amazon.com/cognito/
- Create a user pool: https://docs.aws.amazon.com/cognito/latest/developerguide/tutorial-create-user-pool.html
- Cognito app client and Hosted UI: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html
- Docker Hub: https://hub.docker.com/
- Docker Hub PATs: https://docs.docker.com/security/for-developers/access-tokens/
- GitHub Actions secrets: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions
- Docker Compose: https://docs.docker.com/compose/
- Azure Functions (overview): https://learn.microsoft.com/azure/azure-functions/functions-overview
- Azure Functions Node.js developer guide: https://learn.microsoft.com/azure/azure-functions/functions-reference-node
- Azure Functions Docker containers: https://learn.microsoft.com/azure/azure-functions/functions-deploy-container
- Azure App Service custom containers: https://learn.microsoft.com/azure/app-service/tutorial-custom-container

## Mandatory setup

Follow these steps in order. All are required.

1. Set up Cognito first:
    - Complete the checklist in `Appendix A: Cognito Setup Checklist`.
2. Set up Docker Hub publishing:
    - Complete `Appendix B: Docker Hub Publish Setup`.
    - This is required before publishing images from GitHub Actions.
3. Create backend env file:

```bash
cp backend/.env.example backend/.env
```

4. Edit `backend/.env` with your Cognito values:

- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `CORS_ORIGIN` (default: `http://localhost:3000`)

5. Create frontend env file:

```bash
cp frontend/.env.example frontend/.env
```

6. Edit `frontend/.env` so values match your environment:

- `REACT_APP_API_BASE` (for local Docker: `http://localhost:3001`)
- `REACT_APP_COGNITO_AUTHORITY`
- `REACT_APP_COGNITO_CLIENT_ID`
- `REACT_APP_COGNITO_DOMAIN`
- `REACT_APP_OIDC_REDIRECT_URI` (for local: `http://localhost:3000`)
- `REACT_APP_LOGOUT_URI` (for local: `http://localhost:3000`)

7. Run frontend + backend locally with Docker Compose:

```bash
docker compose --env-file frontend/.env up --build -d
```

8. Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

9. Smoke test backend:

```bash
curl http://localhost:3001/
curl -i http://localhost:3001/api/profile
```

Expected result for `/api/profile` without token: `401 Unauthorized`.

10. Publish images after everything is working:

- Commit and push to `main`.
- GitHub Actions workflow `.github/workflows/docker-publish.yml` will publish:
    - `<DOCKERHUB_USERNAME>/tucn-cc-backend-api:sha-<commit>`
    - `<DOCKERHUB_USERNAME>/tucn-cc-frontend:sha-<commit>`

## Backend API

- `GET /` -> basic API message
- `GET /api/profile` -> returns resolved claims (`role`, `device_id`)
- `GET /api/data` -> role-based filtered data

Protected endpoints require:

```http
Authorization: Bearer <ID_TOKEN>
```

Backend code details: [`backend/README.md`](backend/README.md)

## Environment variables

### Backend (`backend/.env`)

| Variable               | Required    | Example                 | Purpose                            |
| ---------------------- | ----------- | ----------------------- | ---------------------------------- |
| `COGNITO_REGION`       | Yes         | `eu-central-1`          | Cognito region for issuer/JWKS URL |
| `COGNITO_USER_POOL_ID` | Yes         | `eu-central-1_example`  | User pool used to validate tokens  |
| `COGNITO_CLIENT_ID`    | Recommended | `your-app-client-id`    | Audience/client validation         |
| `CORS_ORIGIN`          | Yes         | `http://localhost:3000` | Allowed frontend origin            |

### Frontend (`frontend/.env`)

| Variable                      | Required    | Example                                                     | Purpose                   |
| ----------------------------- | ----------- | ----------------------------------------------------------- | ------------------------- |
| `REACT_APP_API_BASE`          | Yes         | `http://localhost:3001`                                     | Backend API base URL      |
| `REACT_APP_COGNITO_AUTHORITY` | Yes         | `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>` | OIDC authority            |
| `REACT_APP_COGNITO_CLIENT_ID` | Yes         | `your-app-client-id`                                        | OIDC client id            |
| `REACT_APP_COGNITO_DOMAIN`    | Yes         | `https://your-domain.auth.<region>.amazoncognito.com`       | Hosted UI domain          |
| `REACT_APP_OIDC_REDIRECT_URI` | Yes         | `http://localhost:3000`                                     | OIDC callback URL         |
| `REACT_APP_OIDC_SCOPE`        | Recommended | `openid email profile`                                      | Requested scopes          |
| `REACT_APP_LOGOUT_URI`        | Yes         | `http://localhost:3000`                                     | Hosted UI logout redirect |

## API examples

`GET /api/profile` as `admin`:

```json
{
  "role": "admin",
  "device_id": null
}
```

`GET /api/data` as `admin`:

```json
{
  "role": "admin",
  "data": [
    { "device_id": "E-001", "value": 10 },
    { "device_id": "E-002", "value": 20 }
  ]
}
```

`GET /api/data` as `user` with `custom:device_id=E-001`:

```json
{
  "role": "user",
  "device_id": "E-001",
  "data": [{ "device_id": "E-001", "value": 10 }]
}
```

## How Auth Works

1. Frontend logs in with Cognito Hosted UI.
2. Frontend gets an ID token.
3. Frontend calls backend with bearer token.
4. Backend validates JWT against Cognito JWKs:

```text
https://cognito-idp.<region>.amazonaws.com/<user-pool-id>/.well-known/jwks.json
```

5. Backend applies authorization:

- `admin` -> can see all devices
- `user` -> can only see their `custom:device_id`

## Local Docker Notes

- Backend runs on Azure Functions container port `80`, mapped to host `3001`.
- Frontend runs on Nginx container port `80`, mapped to host `3000`.
- On Apple Silicon, backend image is forced to `linux/amd64` via `docker-compose.yml`.
- Frontend `REACT_APP_*` values are injected at image build time via `build.args`; run Compose with `--env-file frontend/.env` (or set env vars in your shell/CI).

## Production safety notes

- Keep `sha-<commit>` image tags for immutable deployments and easy rollback.
- Never commit `.env` files; only commit `.env.example`.
- Do not put secrets in frontend `REACT_APP_*` values (frontend bundle is public).
- Set `CORS_ORIGIN` to your real frontend URL in production.
- Ensure `AzureWebJobsStorage` is configured in Azure environments.

## Release checklist

1. Confirm Cognito config and callback/logout URLs are correct.
2. Confirm `backend/.env` and `frontend/.env` are correct locally.
3. Run `docker compose --env-file frontend/.env up --build -d` and validate frontend + backend flows.
4. Verify no `.env` files are tracked by git.
5. Commit and push to `main`.
6. Verify workflow `Publish Docker Images` succeeded.
7. Verify Docker Hub tags:
    - `<DOCKERHUB_USERNAME>/tucn-cc-backend-api:sha-<commit>`
    - `<DOCKERHUB_USERNAME>/tucn-cc-frontend:sha-<commit>`
8. Verify Azure App Service and Function App were updated to the new SHA tags.

## Project governance

- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Support policy: [SUPPORT.md](SUPPORT.md)

## Appendix A: Cognito Setup Checklist

Minimum setup for this project:

1. Create a User Pool + SPA App Client.
2. Add custom attribute `device_id` (string, mutable).
3. Create groups:
    - `admin`
    - `user`
4. App client OAuth settings:
    - Grant type: Authorization code
    - Scopes: `openid email profile`
    - Callback URLs: `http://localhost:3000`, `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`
    - Logout URLs: `http://localhost:3000`, `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`
5. Create test users and assign groups.
6. For `user` accounts, set `custom:device_id` (for example `E-001`).

## Appendix B: Docker Hub Publish Setup (Mandatory)

Setup steps:

1. Create a Docker Hub account:
    - https://hub.docker.com/
2. Create a Docker Hub access token (PAT):
    - Docker Hub → Account Settings → Personal access tokens → Generate new token
    - Save the token value securely (you will not be able to view it again).
3. Add repository **secrets** in GitHub (Settings → Secrets and variables → Actions → Secrets):

   | Secret               | Value                    |
      | -------------------- | ------------------------ |
   | `DOCKERHUB_USERNAME` | your Docker Hub username |
   | `DOCKERHUB_TOKEN`    | your Docker Hub PAT      |

4. Add repository **variables** for frontend build config (Settings → Secrets and variables → Actions → Variables).
   Use your real Azure URLs for production — **not localhost**:

   | Variable                      | Production value                                            |
      | ----------------------------- | ----------------------------------------------------------- |
   | `REACT_APP_API_BASE`          | `https://func-tucn-cc-dev-<suffix>.azurewebsites.net`       |
   | `REACT_APP_COGNITO_AUTHORITY` | `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>` |
   | `REACT_APP_COGNITO_CLIENT_ID` | your Cognito app client ID                                  |
   | `REACT_APP_COGNITO_DOMAIN`    | `https://<domain>.auth.<region>.amazoncognito.com`          |
   | `REACT_APP_OIDC_REDIRECT_URI` | `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`        |
   | `REACT_APP_LOGOUT_URI`        | `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`        |
   | `REACT_APP_OIDC_SCOPE`        | `openid email profile`                                      |

5. Trigger publish:
    - Push to `main`, or run `.github/workflows/docker-publish.yml` via `workflow_dispatch`.

Published images:

- `<DOCKERHUB_USERNAME>/tucn-cc-backend-api:sha-<commit>`
- `<DOCKERHUB_USERNAME>/tucn-cc-frontend:sha-<commit>`

## Appendix C: Azure CI/CD Deploy Setup

The `deploy` job in the workflow automatically updates the running container images in Azure after every push to `main`.

Recommended setup:

1. Deploy infrastructure locally from `TUCN_CC_Apps_Infra`.
2. Optionally enable `create_github_oidc = true` there if you want GitHub Actions in `TUCN_CC_Apps` to update Azure automatically.
3. Copy the resulting Azure values and resource names into the GitHub settings for this repo.

### Required GitHub configuration for `TUCN_CC_Apps`

Add these in `TUCN_CC_Apps`:

- **Secrets**:
    - `DOCKERHUB_USERNAME`
    - `DOCKERHUB_TOKEN`

- **Variables**:
    - `REACT_APP_API_BASE`
    - `REACT_APP_COGNITO_AUTHORITY`
    - `REACT_APP_COGNITO_CLIENT_ID`
    - `REACT_APP_COGNITO_DOMAIN`
    - `REACT_APP_OIDC_REDIRECT_URI`
    - `REACT_APP_LOGOUT_URI`
    - `REACT_APP_OIDC_SCOPE`
    - `AZURE_CLIENT_ID`
    - `AZURE_TENANT_ID`
    - `AZURE_SUBSCRIPTION_ID`
    - `AZURE_RESOURCE_GROUP`
    - `AZURE_APP_SERVICE_NAME`
    - `AZURE_FUNCTION_APP_NAME`

**Step 2** — Add these **variables** (not secrets) to this repo (Settings → Secrets and variables → Actions → Variables):

| Variable                  | Value                                     |
| ------------------------- | ----------------------------------------- |
| `AZURE_CLIENT_ID`         | `tofu output github_oidc_client_id`       |
| `AZURE_TENANT_ID`         | `tofu output github_oidc_tenant_id`       |
| `AZURE_SUBSCRIPTION_ID`   | `tofu output github_oidc_subscription_id` |
| `AZURE_RESOURCE_GROUP`    | `rg-tucn-cc-dev-<suffix>`                 |
| `AZURE_APP_SERVICE_NAME`  | `app-tucn-cc-dev-<suffix>`                |
| `AZURE_FUNCTION_APP_NAME` | `func-tucn-cc-dev-<suffix>`               |

**Step 3** — Push to `main`. The workflow will:

1. Run lint/tests on both services
2. Validate that all required GitHub secrets and variables are present
3. Build and push both Docker images to Docker Hub with tag `sha-<commit>`
4. Update the running containers in Azure App Service and Function App
5. Restart both services to pull the new images
6. Run a basic smoke check against both public Azure URLs

Also update your Cognito App Client to add the Azure callback and logout URLs:

- Callback URL: `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`
- Logout URL: `https://app-tucn-cc-dev-<suffix>.azurewebsites.net`

### Troubleshooting

- `AADSTS700213` in `azure/login` means the federated credential subject does not match the actual GitHub owner/repo. Re-check the OIDC settings in `TUCN_CC_Apps_Infra` and re-apply there.
- If the workflow fails immediately with a missing-setting error, add the missing GitHub secret or variable named in the job log.
- If Docker push fails, verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are present as repository secrets in `TUCN_CC_Apps`.
- If the frontend deploys but cannot call the backend, verify `REACT_APP_API_BASE` points to `https://func-tucn-cc-dev-<suffix>.azurewebsites.net`.
- If Cognito login redirects fail, verify the callback and logout URLs exactly match the Azure frontend URL with the chosen suffix.

## License - 2

This project is licensed under the MIT License. See [LICENSE](LICENSE).