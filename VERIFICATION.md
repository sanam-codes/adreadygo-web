# Local verification — 29 September 2026

Passed against the local application:
- Java 21 / Spring Boot 4.1.1 executable JAR compilation.
- React/TypeScript production build.
- Login through Vite's /api proxy with session cookies and CSRF.
- Brand and offer persistence; assistant development draft creation.
- Campaign revision saving, submission and approval.
- Durable simulated publishing; pause/resume; sample metric loading.
- Approved budget revision and confirmed applied budget.
- Business-scope rejection and marketer denial for owner-only operations.
- Invitation acceptance and team removal.
- Image validation, authenticated upload and retrieval.
- CSV preview, commit and duplicate skipping.
- Approval invalidation after edit and stale-revision rejection.
- Leads, completed outcomes and contribution reporting.
- Password recovery through the private local outbox and old-session revocation.
- Browser sign-in, dashboard and editor inspection; duplicate-to-draft and edited creative save with persisted rendered PNG.

No unit test suite was created, as requested. These are connected smoke checks, not a guarantee that no defects exist.

Not externally verified: live Meta OAuth/ad delivery/insights against a real account, paid AI generation, PostgreSQL runtime on this machine, deployment, or external email. Meta code is guarded and defaults to simulation. AI provider selection is explicitly deferred. PostgreSQL configuration and migrations are present; the verified local database is H2 in PostgreSQL mode.

Current boundaries: live geographic targeting supports explicit country/cities but needs real-account validation; local files and mail outbox are used instead of S3/SMTP; business collection screens use bounded lists for the pilot. Production hardening, real-provider validation, model integration must be completed before public launch.


## Guided poster workspace — 3 October 2026

The shared poster workspace replaces the dual-column chat/generator with five steps: campaign description, five horizontally scrollable creative directions, an illustrated style gallery, exact wording and visual-direction review, then prompt preview and poster generation. Samples are illustrative style references, not generated previews of the current campaign. The read-only prompt opens in a keyboard-accessible modal with pretty-printed JSON. Business context stays available to AI without occupying a separate chat panel.

Idea contracts include hook, main message, supporting details and CTA. The refinement endpoint updates the selected brief without replacing its five concepts; explicit new MRP/price facts update printable wording and clear approval. Choosing an idea or changing the wording requires fresh approval/preparation. Generated versions have full-size previews, advisory checks, download, visual revision and an explicit save-to-campaign action with success feedback. The previous image is optional for revisions.

The default guided generation setting is 1K with Gemini 3.1 Flash Image. Backend providers and credentials remain server-side. Prompt version poster-v7-guided-digital-ad removes inconsistent brand-signature rules, discourages physical-poster framing, avoids repeated literal pricing in art direction and separates visual atmosphere from factual claims. Existing stored prompts require fresh preparation.

Fresh isolated H2 runs cover restaurant, gym and play-arena businesses, each with zero prior campaign history. Real 1K Flash generation, five-concept contracts, approval, saved prompt, native 1024x1024 retrieval, selection and campaign application were exercised. Gym refinement verifies that new MRP wording is saved without replacing the selected concept. Backend packaging and frontend production builds pass; unit tests remain skipped. No original business records were reset. Visual review caught duplicate pricing/CTA in some gym variants; model review remains advisory and cannot guarantee perfect text or performance.
