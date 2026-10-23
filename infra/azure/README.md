# Azure deployment plan

Use Azure Container Apps (separate web, API and worker containers), Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis or equivalent, Azure Key Vault, and private storage.

- Build images from the repository with `infra/Dockerfile.web`, `infra/Dockerfile.api`, and `infra/Dockerfile.worker`.
- Configure Azure Container Registry and Container Apps managed identities.
- Keep secrets in Key Vault; mount the issuer key only into the isolated worker.
- Set `CHAIN_MODE=offline` until Anchor is tested and deployed to Devnet.
- Configure HTTPS, private database networking, autoscaling, logs, backups and alerting.
- Validate DNS, CORS, identity provider redirect URIs, and official BTU trust manifest before real issuance.

These files are **deployment scaffolding**, not proof of a deployed or secure Azure environment.
