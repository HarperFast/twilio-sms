import { suite, test, before, after } from 'node:test';
import { strictEqual, ok, deepStrictEqual } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '..');

// harper's `exports` only exposes ".", so 'harper/dist/bin/harper.js' is not resolvable.
// Resolve the CLI from the (exported) main entry and pass it explicitly.
const require = createRequire(import.meta.url);
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

/**
 * Helper: perform an authenticated HTTP request against the running Harper instance.
 */
function authFetch(
  ctx: ContextWithHarper,
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  const { headers = {}, ...rest } = init;
  const creds = Buffer.from(`${ctx.harper.admin.username}:${ctx.harper.admin.password}`).toString('base64');
  return fetch(`${ctx.harper.httpURL}${path}`, {
    ...rest,
    headers: { Authorization: `Basic ${creds}`, ...headers },
  });
}

/**
 * Build a URL-encoded body that mimics a Twilio inbound SMS webhook payload.
 * NOTE: Actual Twilio credentials are not available in CI.  These tests validate
 * the Harper integration layer only (routing, data storage, response shape) — not
 * actual Twilio connectivity.
 */
function twilioPayload(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

void suite('twilio-sms component', (ctx: ContextWithHarper) => {
  before(async () => {
    await setupHarperWithFixture(ctx, FIXTURE_PATH, { harperBinPath });
  });

  after(async () => {
    await teardownHarper(ctx);
  });

  // ── Smoke ──────────────────────────────────────────────────────────────────

  void test('Harper starts successfully and root is reachable', async () => {
    const res = await authFetch(ctx, '/');
    ok([200, 400, 404].includes(res.status), `Unexpected status ${res.status}`);
  });

  // ── /PhoneNumbers REST table ───────────────────────────────────────────────

  void test('GET /PhoneNumbers returns an array', async () => {
    const res = await authFetch(ctx, '/PhoneNumbers/');
    strictEqual(res.status, 200);
    const body = await res.json();
    ok(Array.isArray(body), `expected array, got ${JSON.stringify(body)}`);
  });

  void test('PUT /PhoneNumbers/:id creates a record', async () => {
    const res = await authFetch(ctx, '/PhoneNumbers/+15551234567', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+15551234567', status: 'in' }),
    });
    ok([200, 201, 204].includes(res.status), `expected 2xx, got HTTP ${res.status}`);
  });

  void test('GET /PhoneNumbers/:id returns the stored record', async () => {
    // Ensure the record exists first
    await authFetch(ctx, '/PhoneNumbers/+15559876543', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+15559876543', status: 'out' }),
    });

    const res = await authFetch(ctx, '/PhoneNumbers/+15559876543');
    strictEqual(res.status, 200);
    const body = await res.json() as { phoneNumber: string; status: string };
    strictEqual(body.phoneNumber, '+15559876543');
    strictEqual(body.status, 'out');
  });

  // ── /optInStatus endpoint ──────────────────────────────────────────────────

  void test('POST /optInStatus with no body returns 200 or 204', async () => {
    // Sending an empty payload — optInStatus handler returns null when
    // OptOutType is absent, Harper serialises that as an empty/null response.
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ Body: 'Hello', From: '+15550000000' }),
    });
    ok([200, 204].includes(res.status), `expected 200/204 for non-keyword SMS, got HTTP ${res.status}`);
  });

  void test('POST /optInStatus with STOP keyword updates PhoneNumbers table', async () => {
    const from = '+15551110001';
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'STOP', From: from }),
    });
    ok([200, 201, 204].includes(res.status), `expected 2xx for opt-out, got HTTP ${res.status}`);

    // Verify the record was written to the PhoneNumbers table
    const record = await authFetch(ctx, `/PhoneNumbers/${encodeURIComponent(from)}`);
    strictEqual(record.status, 200, 'PhoneNumbers record should exist after opt-out');
    const body = await record.json() as { status: string };
    strictEqual(body.status, 'out', `expected status "out" after STOP keyword, got "${body.status}"`);
  });

  void test('POST /optInStatus with START keyword sets status to "in"', async () => {
    const from = '+15551110002';
    // First opt-out, then opt back in
    await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'STOP', From: from }),
    });
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'START', From: from }),
    });
    ok([200, 201, 204].includes(res.status), `expected 2xx for opt-in, got HTTP ${res.status}`);

    const record = await authFetch(ctx, `/PhoneNumbers/${encodeURIComponent(from)}`);
    strictEqual(record.status, 200, 'PhoneNumbers record should exist after opt-in');
    const body = await record.json() as { status: string };
    strictEqual(body.status, 'in', `expected status "in" after START keyword, got "${body.status}"`);
  });

  void test('POST /optInStatus with CANCEL keyword opts out', async () => {
    const from = '+15551110003';
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'CANCEL', From: from }),
    });
    ok([200, 201, 204].includes(res.status), `expected 2xx for CANCEL, got HTTP ${res.status}`);

    const record = await authFetch(ctx, `/PhoneNumbers/${encodeURIComponent(from)}`);
    strictEqual(record.status, 200, 'PhoneNumbers record should exist after CANCEL');
    const body = await record.json() as { status: string };
    strictEqual(body.status, 'out', `expected status "out" after CANCEL keyword, got "${body.status}"`);
  });

  void test('POST /optInStatus with UNSTOP keyword opts in', async () => {
    const from = '+15551110004';
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'UNSTOP', From: from }),
    });
    ok([200, 201, 204].includes(res.status), `expected 2xx for UNSTOP, got HTTP ${res.status}`);

    const record = await authFetch(ctx, `/PhoneNumbers/${encodeURIComponent(from)}`);
    strictEqual(record.status, 200, 'PhoneNumbers record should exist after UNSTOP');
    const body = await record.json() as { status: string };
    strictEqual(body.status, 'in', `expected status "in" after UNSTOP keyword, got "${body.status}"`);
  });

  void test('POST /optInStatus with unknown OptOutType is a no-op', async () => {
    // An unrecognised keyword — the handler returns undefined, no DB write.
    const res = await authFetch(ctx, '/optInStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: twilioPayload({ OptOutType: 'UNKNOWN_KEYWORD', From: '+15559999999' }),
    });
    ok([200, 204].includes(res.status), `expected 200/204 for unknown keyword, got HTTP ${res.status}`);
  });
});
