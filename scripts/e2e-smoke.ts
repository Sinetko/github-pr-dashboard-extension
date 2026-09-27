import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type BrowserContext, type Page, type Route, type Worker } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PASSWORD = 'Smoke-Test-Passw0rd!';
const TOKEN = 'github_pat_11SMOKETESTSMOKETESTSMOKE';
const headed = process.argv.includes('--headed');
const screenshotIndex = process.argv.indexOf('--screenshots');
const screenshotDirectory =
  screenshotIndex === -1 ? null : (process.argv[screenshotIndex + 1] ?? null);

const step = (label: string): void => {
  console.log(`• ${label}`);
};

const snapshot = async (page: Page, name: string): Promise<void> => {
  if (screenshotDirectory !== null) {
    await page.screenshot({ path: join(screenshotDirectory, `${name}.png`) });
  }
};

const now = new Date().toISOString();
const graphqlPullRequest = (
  number: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  __typename: 'PullRequest',
  id: `PR_smoke_${number}`,
  number,
  title: `Smoke test change ${number}`,
  url: `https://github.com/smoke-org/smoke-repo/pull/${number}`,
  isDraft: false,
  state: 'OPEN',
  createdAt: now,
  updatedAt: now,
  baseRefName: 'main',
  headRefOid: 'abc123',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'BLOCKED',
  author: { login: 'someone-else', avatarUrl: '' },
  repository: { name: 'smoke-repo', owner: { login: 'smoke-org' } },
  labels: { nodes: [{ name: 'smoke', color: '0e8a16', description: null }] },
  reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'smoke-user' } }] },
  latestOpinionatedReviews: { nodes: [] },
  reviews: { totalCount: 0, nodes: [] },
  comments: { totalCount: 0, nodes: [] },
  commits: { nodes: [{ commit: { committedDate: now, statusCheckRollup: { state: 'SUCCESS' } } }] },
  reviewThreads: { totalCount: 0, nodes: [] },
  ...extra,
});

const mockGithub = async (context: BrowserContext): Promise<{ requests: string[] }> => {
  const requests: string[] = [];
  const json = (route: Route, body: unknown, status = 200): Promise<void> =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
      headers: { etag: 'W/"smoke"' },
    });
  await context.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if (request.headers().authorization !== `Bearer ${TOKEN}`) {
      await json(route, { message: 'Bad credentials' }, 401);
      return;
    }
    if (url.pathname === '/user') {
      await json(route, { login: 'smoke-user', name: 'Smoke', avatar_url: '' });
    } else if (url.pathname === '/user/teams') {
      await json(route, []);
    } else if (url.pathname.endsWith('/pulls')) {
      await json(
        route,
        [1, 2].map((number) => ({
          number,
          node_id: `PR_smoke_${number}`,
          state: 'open',
          title: 'x',
          updated_at: now,
        })),
      );
    } else if (url.pathname === '/graphql') {
      const { variables } = request.postDataJSON() as { variables: { ids?: string[] } };
      const nodes = (variables.ids ?? []).map((id) =>
        graphqlPullRequest(
          Number(id.replace('PR_smoke_', '')),
          id === 'PR_smoke_2' ? { reviewRequests: { nodes: [] } } : {},
        ),
      );
      await json(route, { data: { nodes } });
    } else if (url.pathname.includes('/rules/branches/')) {
      await json(route, [
        { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
      ]);
    } else {
      await json(route, { message: 'Not Found' }, 404);
    }
  });
  return { requests };
};

const main = async (): Promise<void> => {
  const profile = mkdtempSync(join(tmpdir(), 'pr-dashboard-e2e-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: !headed,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    viewport: { width: 600, height: 600 },
  });
  try {
    const github = await mockGithub(context);
    step('waiting for the service worker');
    const worker: Worker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
    const page = await context.newPage();
    await page.goto(popupUrl);

    step('welcome → password setup (real PBKDF2-600k)');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await snapshot(page, '01-password');
    await page.getByRole('button', { name: 'Create vault' }).click();
    const skip = page.getByRole('button', { name: 'Not now' });
    const configure = page.getByRole('heading', { name: 'Connect GitHub' });
    await Promise.race([skip.waitFor({ timeout: 20_000 }), configure.waitFor({ timeout: 20_000 })]);
    if (await skip.isVisible()) {
      await skip.click();
    }
    await configure.waitFor();
    await snapshot(page, '02-configure');

    step('storage: vault in local, key only in session, no plaintext password');
    const stored = await worker.evaluate(async () => ({
      local: await chrome.storage.local.get(null),
      session: await chrome.storage.session.get(null),
    }));
    const localJson = JSON.stringify(stored.local);
    if (
      !('security' in stored.local) ||
      !localJson.includes('PBKDF2-SHA256') ||
      localJson.includes(PASSWORD)
    ) {
      throw new Error('vault record missing or password leaked into local storage');
    }
    if (
      typeof stored.session.vaultKey !== 'string' ||
      localJson.includes(stored.session.vaultKey)
    ) {
      throw new Error('session key missing or leaked into local storage');
    }

    step('lock (clear session like a browser restart) → unlock with password');
    await worker.evaluate(() => chrome.storage.session.clear());
    await page.reload();
    await page.getByLabel('Vault password').fill('Wrong-Password-123!');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await page.getByText(/Incorrect password/).waitFor();
    await page.getByLabel('Vault password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await configure.waitFor({ timeout: 20_000 });

    step('configure token + repository (GitHub mocked) → dashboard');
    await page.getByLabel('Token', { exact: true }).fill(TOKEN);
    await page.getByRole('button', { name: 'Test' }).click();
    await page.getByText('Connected as @smoke-user').waitFor();
    await page.getByLabel('Repository 1').fill('smoke-org/smoke-repo');
    await page.getByRole('button', { name: 'Save and open dashboard' }).click();
    await page.getByText('Smoke test change 1').waitFor({ timeout: 20_000 });
    await page.getByText('Needs my review').first().waitFor();
    await snapshot(page, '03-dashboard');

    const plaintextAnywhere = await worker.evaluate(async (token) => {
      const everything = JSON.stringify([
        await chrome.storage.local.get(null),
        await chrome.storage.session.get(null),
      ]);
      return everything.includes(token);
    }, TOKEN);
    if (plaintextAnywhere) {
      throw new Error('plaintext token found in extension storage');
    }

    step('badge reflects needs-my-review');
    const badge = await worker.evaluate(() => chrome.action.getBadgeText({}));
    if (badge !== '1') {
      throw new Error(`expected badge "1", got "${badge}"`);
    }
    const hosts = new Set(
      github.requests.map((request) => request.split(' ')[1]?.split('/')[1] ?? ''),
    );
    console.log(`  GitHub requests: ${github.requests.length} (${[...hosts].join(', ')})`);
    console.log('✓ smoke test passed');
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => {
  console.error('✗ smoke test failed:', error);
  process.exit(1);
});
