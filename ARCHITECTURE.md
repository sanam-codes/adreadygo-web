# AdReadyGo implementation baseline

Java 21, Spring Boot 4.1.1, Maven executable JAR; React/Vite/TypeScript.
Two independent repositories, fresh implementation. Invite-only English pilot.

## Architecture
- Modular monolith, package by business capability.
- Backend owns business isolation, permissions, approvals, provider calls and reporting.
- PostgreSQL target; explicit H2 file-backed local profile for machines without Docker.
- Database-backed jobs; no in-memory queue as source of truth.
- Server-side cookie authentication, CSRF protection, BCrypt passwords.
- Owner and Marketer/Designer mapped to permissions, never trusted from browser.
- Immutable revision approval; publishing reads approved revision and records provider state.
- Development AI and Meta adapters are visibly simulated and cannot incur spend.
- Runtime provider selection is backend configuration only.

## Execution
1. Auth, tenancy, migrations and local startup.
2. Brands, offers, creatives, assistant and asset editor.
3. Campaign approvals, durable publishing and integration adapters.
4. Leads, outcomes, imports and reporting.
5. Build and connected local smoke verification; unit tests deferred at user request.

## Permission matrix
Owner: business/team/integrations manage; creative/campaign edit; review/approve/publish/control;
lead manage; reports read.
Marketer: creative/campaign edit and submit; brand/offer edit; lead manage; reports read.
Backend checks active membership for each business request.

## Acceptance
Owner bootstrap, login, business setup, invitation, brand/offer setup, generated draft,
editable export, submission, approval, simulated publishing, lead/outcome entry and reporting.
External access is required to validate live Meta; no real ad activation during development.

See README.md, VERIFICATION.md and backend docs/PROVIDERS.md for implemented behavior and activation boundaries.
