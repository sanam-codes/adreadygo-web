# AdReadyGo web

React / Vite / TypeScript. English, invite-only marketing workspace.

## Run locally
- Node 22.12+ or compatible newer runtime.
- `npm ci`
- `npm run dev`
- Open http://localhost:5173 with the backend on port 8080.
- `npm run build` verifies TypeScript and produces `dist/`.

Vite proxies /api to the backend. Sessions use HttpOnly cookies; writes fetch and send server-issued CSRF tokens. No access tokens or AI credentials are stored in browser storage. Only the preferred business ID is remembered locally; backend membership checks remain authoritative.

Screens: invitation/sign-in, onboarding, overview, assistant, brands/assets, offers, editable campaign/carousel, approvals, sandbox publishing, leads, outcomes/imports, reporting and team/settings.

The editor renders its preview and PNG export with the same canvas renderer. Uploaded PNG/JPEG backgrounds and original logo assets are supported. AI drafts and Meta results are explicitly development/simulated data. No live models or advertising accounts are connected by default. Settings includes the guarded live Meta authorization flow; it requires backend credentials and account-specific verification.

Unit tests are intentionally deferred per the owner's request. Keep TypeScript/build and connected manual smoke verification before delivery. Deployment and model selection are later decisions.


### Meta report navigation and chart

The daily chart now has a numbered Y-axis, grid lines, and exact values above each bar (spend retains two decimal places). Long ranges scroll horizontally, keeping value labels legible. Count axes use whole-number ticks.

Campaign/ad-set/ad rows show non-zero secondary outcomes as compact tags; these do not change primary Results or Cost / result. Campaign and ad-set checkboxes provide multi-selection, select-all-visible, explicit View ad sets/View ads actions, selection counts and Clear selection. Campaign selection filters downstream ad sets/ads; ad-set selection filters downstream ads, gallery, daily breakdowns and exports. Reset filters clears selections and retains the minimum period spend default of 1. Existing account/date isolation remains in place.

Verified October 5, 2026 in Brave against the saved real OZO report: one selected campaign shows six ad sets; one selected ad set shows its single ad; two selected campaigns show twelve ad sets. Confirmed extra action tags and count/spend chart labels. TypeScript/Vite production build passed. No Meta ads were modified.
