# STATUS

Resumption aid. Start every session: read this, run `pnpm verify`, trust reality over this file.
`pnpm verify` = typecheck → lint → check:boundaries → test → build → check:manifest.

## Done

- [x] 1. Repo scaffold (Vite 8 + crxjs 3 + React 19 + TS 6.0 strict + styled-components + Zustand +
      Vitest + ESLint flat + Prettier + Husky/lint-staged; boundaries + manifest check scripts;
      component/hook/store generator). Blank popup builds as an unpacked extension (`dist/`).

- [x] 2. `shared/*`: utils (relative-time, promise-pool, base64, compare/search/unique,
      assertNever), hooks (useMediaQuery, useDebouncedValue), typed themes (light/dark/dimmed/
      high-contrast-dark + "system") via `AppThemeProvider`, UI primitives (Avatar, Banner, Button,
      Collapsible, EmptyState, IconButton, Pill, SegmentedControl, Select, Spinner, Stack, Switch,
      Tabs/TabPanel, TextField). Test helpers: `@test/render` (renderWithTheme), `@test/match-media`.

- [x] 3. `core/chrome/*` adapters: storage (typed keys, `unknown` values), messaging (union +
      runtime guard, sender check, no-receiver → false), alarms, notifications, action-badge
      (+ tryOpenPopup), offscreen (singleton manager, race-tolerant), permissions (+ toOriginPattern),
      tabs (https-only), runtime (id/version/url/lifecycle). In-memory fake: `@test/chrome-fake`.
      Manifest now declares storage/alarms/notifications/offscreen + optional `https://*/*`.

- [x] 4. `core/github`: client (`githubFetch` — Bearer, 30s timeout, ETag/304, primary/secondary
      rate limits, typed error hierarchy, same-origin guard for Link URLs), `fetchAllPages` (Link,
      cap 20), `githubGraphql` (partial errors, RATE_LIMITED), `PullRequestDetails` fragment
      (`nodes(ids)` batches of 25 + `search`), transforms (draft, checks, mergeability, labels,
      reviews, threads, stale/untouched/needsReview/needsMyReview, `derivePullRequestFlags`),
      API (`fetchViewer`, `fetchViewerTeams`, `listOpenPullRequests`, `fetchPullRequestsByNodeIds`,
      `searchPullRequests`, `fetchRequiredApprovals[Many]` pool=6), hosts (`parseEnterpriseHost`,
      `endpointsFor`, `tokenCreationUrl`). Fixtures in `core/github/__fixtures__`, `@test/fetch-fake`.

- [x] 5. `core/storage` (6 validated namespaced records + session keys, migrations with
      `meta.schemaVersion`, `createPersistedStore` Zustand binding) and `core/security`
      (fingerprint, PBKDF2-600k wrap, AES-GCM data key with per-slot AAD, token seal/open, WebAuthn
      PRF biometric, password policy, `createTokenVault` service incl. encrypted token draft).
      Fakes: `@test/webauthn-fake` (PRF = HMAC). Security tests run in the node environment.

- [x] 6. `features/onboarding` (`resolveOnboardingStage` + WelcomeScreen) and `features/security`
      (PasswordSetupScreen w/ live checklist, generate + copy-password; BiometricOfferScreen;
      UnlockScreen w/ biometric + confirmed reset). `popup/app`: `createPopupServices()` composition
      root (repositories, vault, vault-state store, persisted stores) + stage router. `configure`
      and `ready` stages render placeholders until phases 7/8. Fake: `@test/token-vault-fake`.

- [x] 7. `features/settings`: General form (`useConfigurationForm`: GHES host, token kind + help
      link + inline scopes, token, repos + saved search, interval, stale days, test connection w/
      scope warnings, debounced draft + encrypted token draft restore, `saveConfiguration` with
      permission-first ordering, host-change wipe + old-origin release, poll-now), Notifications,
      Appearance, About, `SettingsScreen`, `panelReducer`. `features/security`:
      SecuritySettingsPanel (change password → re-offer biometric, enroll/remove, lock, reset).
      Popup: `configure` stage = General form; `ready` = `ReadyShell` (dashboard placeholder +
      panels). `core/github`: `describeGithubError` (safe UI copy).

- [x] 8. `features/dashboard`: `buildDashboardView` (tabs incl. per-author, draft/stale tri-state,
      label, live search, sort, stats), `resolveDashboardStatus` (rate-limited > token-invalid >
      error > loading/truncated), `useDashboardData` (whole cache record + storage subscription →
      cache-first source switch), DashboardScreen (header w/ source switcher, refresh, About,
      Settings; banners; collapsible persisted stats; tabs; filter bar; list/empty states),
      PullRequestItem (avatar, pills, dates, approvals, unresolved threads, labels, opens via
      chrome.tabs). `useNow` in shared/hooks. Popup `ReadyShell` renders it for panel `none`.

- [x] 9. Background: `core/polling` (`runPollCycle`: gating, host reconcile, viewer/teams TTL,
      sequential per-source fetch — repo: ETag list + GraphQL hydration of changed/volatile/
      disappeared; search: full + `updated:>=` deltas; full refresh every 12 cycles; approvals
      cache; per-source isolation; rate-limit/401 stop; `createPoller` in-flight dedupe;
      `promptUnlockOnce`), `core/events` (diff, ledger, `notifyEvents` cap 4 + summary + one
      sound), `core/badge` (`resolveBadgeState`, `refreshBadge`). `src/background`
      (controller + index registering listeners synchronously; alarm ensured on wake-up),
      `src/offscreen` (audio), generated `public/sounds/*.wav` + `public/icons/*.png`
      (`pnpm assets`), manifest icons, offscreen rollup input.

- [x] 10. Full-app pass: built manifest audited (4 API permissions, 1 concrete host, optional
      `https://*/*` only for GHES requests), no hardcoded org/user/host outside tests (only RFC 2606
      `example.com` placeholders), coverage thresholds pass (~96.6% lines overall),
      `pnpm e2e:smoke` (Playwright Chromium, unpacked dist, mocked api.github.com) passes:
      onboarding w/ real PBKDF2-600k, no plaintext password/token in storage, lock → unlock
      across cleared session, test connection, save → background poll → dashboard → badge "1".
      README written.

## In progress

(none)

## Next up

- All §11 phases done. Candidate follow-ups (not started): human verification items below;
  optional search-mode reconcile of merged PRs sooner than 12 cycles; i18n.

## Architecture (agreed)

```
src/background|popup|offscreen   composition roots only (nothing imports them)
src/features/{onboarding,security,settings,dashboard}   never import each other
src/core/{chrome,github,storage,security,polling,events,badge}
src/shared/{ui,theme,hooks,utils}  imports nothing from src
src/test/                          chrome/fetch fakes, test-only
```

- Cross-feature composition happens in `popup/app`: onboarding exposes the stage machine
  (welcome → password → biometric → configure → dashboard); the router renders `security` /
  `settings` / `dashboard` screens. Settings receives its Security tab as a slot prop.
- PR domain type: see plan in Decisions log (raw normalized facts cached; flags derived via
  `derivePullRequestFlags(pr, { viewerLogin, viewerTeams, staleThresholdDays, now })`).
- Data sources: REST `/pulls?state=open&sort=updated` + ETag (repo mode change detection) →
  GraphQL `nodes(ids)` with `PullRequestDetails` fragment (batches ~25) for hydration; search mode
  uses GraphQL `search(type: ISSUE)` + `updated:>=` deltas. Required approvals via REST
  `rules/branches/{b}` → fallback `branches/{b}/protection`, 24h cache, 403/404 → null.
  Team requests via `GET /user/teams` (needs read:org, degrade to direct-only). `GET /user` =
  test connection + viewer login.

## Decisions log

- TypeScript pinned to ~6.0 (not 7.x): typescript-eslint 8.70 peer range is `<6.1.0`.
- eslint-plugin-react omitted: no ESLint 10 support; react-hooks plugin + TS strict cover needs.
- Lint layer rules via `no-restricted-imports` (alias-level; entrypoint protection is script-only because globs like `**/offscreen` false-positive on `core/chrome/offscreen`) + `no-restricted-globals` for
  `chrome`/`fetch`; `scripts/check-boundaries.ts` resolves every import (incl. relative) to a layer.
- Import order: type-only imports form their own last group (import-x/order).
- `optional_host_permissions` will be `["https://*/*"]`: GHES hosts are unknown at build time and
  Chrome can only runtime-request origins covered there; each request is for one concrete origin.
  Required `host_permissions` must be concrete (enforced by `scripts/manifest-rules.ts`).
- Manifest check maps each API permission to its `chrome.<api>` usage in src; permissions get
  added in the same commit as the adapter that uses them. `tabs` is not allowed
  (`chrome.tabs.create` doesn't need it).
- CI completion doesn't bump PR `updated_at` → ETag 304 can hide check changes; every cycle also
  re-hydrates "volatile" PRs (checks pending or mergeability unknown).
- Merged/closed detection: PRs leaving the open set are re-fetched via `nodes(ids)` for final state,
  then evicted. Search mode does a full reconcile every N cycles (deltas can't see removals).
- Vault: random AES-GCM-256 data key encrypts the PAT; data key wrapped by PBKDF2-SHA-256 (600k
  iterations) key over fingerprint+password, and optionally by WebAuthn PRF → HKDF key. Only the
  raw data key goes to `chrome.storage.session` (default trusted-contexts access). Background never
  derives keys.
- Fingerprint EXCLUDES timezone (travel would break unlock) in addition to userAgent/platformVersion.
  Unpacked-extension `runtime.id` depends on folder path → moving the folder requires "Reset vault";
  documented, no manifest `key` committed.
- Onboarding draft never stores the plaintext token: the token draft is encrypted with the session
  data key (password setup precedes token entry).
- Auto-open-on-lock "once per session" flag lives in `chrome.storage.session`.
- Generic components (Tabs, Select, SegmentedControl) are typed as
  `<TValue extends string>(props: Props<TValue>): ReactElement` — `FC<Props>` can't carry a generic.
- Vitest runs without globals → RTL `cleanup()` is registered explicitly in `src/test/setup.ts`.
- Message handlers never send responses; results flow back via chrome.storage (every context can
  observe it, and it survives the SW being torn down mid-request).
- Storage adapter returns `unknown` values; core/storage parses/validates each namespace on read.
- Added `core/chrome/runtime` adapter (not in the original table): core/security needs
  `chrome.runtime.id` for the fingerprint and core may not call chrome.* outside core/chrome.
- Offscreen HTML entry + sound catalog land in phase 9 (with the poller); permission declared now
  because the adapter already references chrome.offscreen.
- `GithubSession = { host, getToken }`: each API function calls `getToken()` once, so the plaintext
  PAT lives only for that call. fetch errors are replaced (not wrapped) so no runtime-echoed
  request detail can leak.
- Repo-mode ETag applies to the FIRST page only; a close on page ≥2 of a >100-PR repo won't bust
  it → poller must also do a periodic full refresh (same as search mode).
- Required approvals = max(ruleset `pull_request` rule, classic protection); both unreadable → null.
  Two REST calls per repo+branch → poller caches 24h.
- `latestOpinionatedReviews` gives verdicts; `reviews(last:1)` + totalCount and `comments(last:1)` +
  totalCount give "new review/comment" signals for notifications without extra requests.
- Comments after an approval don't override it in `latestReviewPerReviewer` (GitHub semantics);
  dismissals do.
- Storage: 6 local records (meta/settings/security/polling/cache/ui) each parsed field-by-field on
  read (corrupt field → default, not whole-record loss). Session uses separate keys (vaultKey,
  unlockedAt, lockedPromptShown, tokenDraft) so popup/background never clobber each other.
- Cross-context writes: single-writer ownership per record (popup: settings/security/ui;
  background: polling/cache) + per-context serialized `update()` queue.
- Zustand binding is `createPersistedStore(repository)` (vanilla store + storage subscription);
  React reads via `useStore(persisted.store, selector)`. Optimistic update rolls back on failure.
- Sound catalog lives in `core/audio` (ids shared by settings UI, background and offscreen).
- Vault AAD per slot (password-wrapped key / biometric-wrapped key / PAT / PAT draft) so a blob
  can't be moved between slots. Wrong password and wrong fingerprint both → `VaultUnlockError`.
- `changePassword` re-authenticates with the current password even when unlocked, re-wraps the
  same data key (token ciphertext unchanged), and drops biometric → UI must re-offer enrollment.
- WebAuthn: platform authenticator, UV required, no rp.id (defaults to the extension origin); no
  signature verification (no server) — secrecy of the PRF output is the security boundary.
- Security tests use `// @vitest-environment node`: jsdom's Uint8Array realm differs from Node's
  TextEncoder output, which breaks WebCrypto `instanceof` checks.
- Features receive services via props from `popup/app` (no cross-feature imports, no global
  context); `useOnboardingStage` lives in popup since it combines several features' facts.
- `meta.biometricOfferedAt` added (schema still v1 — nothing shipped yet); reset clears it so the
  offer returns after the new password.
- `saveConfiguration`: `permissions.request` is the first await (keeps user activation); the draft
  (sans token) is written fire-and-forget right before it, since the prompt can close the popup.
- Host change: popup clears `cache` + `polling` (exception to background single-writer — it's a
  wipe, and cache keys are host-scoped anyway); background must tolerate its records vanishing.
- Test connection uses the typed token directly (not the vault) so it works before saving.
- Dashboard "pull-to-refresh" is a header Refresh button (+ auto poll-now on popup open): a pull
  gesture isn't idiomatic in a 600×600 desktop popup.
- Dashboard only renders `state === 'open'` PRs; closed/merged ones may linger in cache for
  notification diffing but never show.
- storage adapter captures `chrome.storage.onChanged` at subscribe time (unsubscribe must not
  re-resolve the global; surfaced by tests unstubbing chrome before unmount).
- Poll cycle: sequential sources, per-source try/catch, per-source cache write; rate limit or
  401 stops the cycle; 3 consecutive all-failed cycles → error badge. Throttle 20s unless forced
  or a source lacks cache. Viewer TTL 6h, teams 24h, required approvals 24h per branch.
- Background self-heals host changes: `polling.hostKey` mismatch → reset polling + prune cache.
- Checks/conflict/review/comment notifications only for the viewer's own PRs; review-requested
  for any tracked PR; merged/closed for any tracked PR. First snapshot of a source never notifies.
  Ledger records all events (even disabled types) so enabling a type doesn't replay history.
- "Auto-open when a notification fires while locked": while locked no poll can read GitHub, so
  a due poll that finds the vault locked triggers the once-per-session prompt instead.
- Notification ids `pr|<event key>|<url>` make clicks stateless (URL recovered from the id,
  https-validated) — nothing to persist across SW restarts.
- Ledger is written BEFORE showing notifications (at-most-once delivery).
- Locked badge text is "•" (ASCII-safe across platforms) on gray; error "!" on red.
- e2e smoke uses `channel: 'chromium'` (full build): Playwright's headless shell and branded
  Chrome (137+) can't load unpacked extensions via flags.
- Notification sounds are generated by a script (no third-party audio assets).

## Known issues / blockers

- Needs human verification in branded Chrome with a real token (automation can't cover these):
  WebAuthn PRF biometric enroll/unlock on a real platform authenticator (only faked in tests);
  OS notification display + click-through; offscreen sound playback; `chrome.action.openPopup`
  auto-open when locked (fallback notification covered by tests); GHES permission prompt UX
  closing the popup mid-save (draft restore is unit-tested).
- `pnpm e2e:smoke` needs Playwright's Chromium (`npx playwright-core install chromium`).
