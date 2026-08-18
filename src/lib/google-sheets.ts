import { createSign } from 'node:crypto';

/**
 * A very small Google Sheets writer: service-account auth, no SDK.
 *
 * The official `googleapis` package is ~50MB installed and pulls a discovery
 * layer this needs none of — the whole job here is "sign a JWT, swap it for an
 * access token, PUT a rectangle of values". That is three fetches and one
 * `node:crypto` call, so it is written out rather than depended upon.
 *
 * Auth is the two-legged service-account flow: the app signs a JWT with the
 * account's private key, Google returns an access token good for an hour. The
 * spreadsheet must be SHARED with the service account's email (as Editor) —
 * owning the key grants nothing on its own, which is what makes the key safe to
 * rotate and the access easy to revoke.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

export type SheetsCredentials = {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
  tab: string;
};

/**
 * Read credentials from the environment, or null when the integration is not
 * configured. Null is a first-class answer: the sync job treats it as "skip",
 * so a deployment without these variables is simply a deployment without the
 * spreadsheet, not a crashing cron.
 */
export function readSheetsCredentials(): SheetsCredentials | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();

  if (!clientEmail || !rawKey || !spreadsheetId) return null;

  return {
    clientEmail,
    // Dashboards store the PEM as a single line with literal backslash-n.
    // `crypto` rejects that, and the resulting error ("no start line") names
    // nothing that would lead you here, so it is normalised at the boundary.
    privateKey: rawKey.includes('\n') ? rawKey.replace(/\n/g, '\n') : rawKey,
    spreadsheetId,
    tab: process.env.GOOGLE_SHEETS_TAB?.trim() || 'Users',
  };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken(creds: SheetsCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(creds.privateKey))}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google token exchange failed (${res.status}): ${body.error_description ?? 'no access_token'}`);
  }
  return body.access_token;
}

/** A1 notation needs single quotes around any tab name that is not one bare word. */
function quoteTab(tab: string): string {
  return /^[A-Za-z0-9_]+$/.test(tab) ? tab : `'${tab.replace(/'/g, "''")}'`;
}

/**
 * Overwrite the tab with `rows`, header included, and clear whatever used to
 * sit below them.
 *
 * Write-then-clear rather than clear-then-write on purpose: the obvious order
 * leaves the spreadsheet empty for as long as the round trip takes, and anyone
 * looking at it in that window sees every student vanish. This way the range is
 * only ever replaced in place, and the clear removes a tail that no longer
 * exists.
 */
export async function replaceSheetContents(
  creds: SheetsCredentials,
  rows: string[][],
): Promise<{ rowsWritten: number }> {
  if (rows.length === 0) return { rowsWritten: 0 };

  const token = await getAccessToken(creds);
  const auth = { Authorization: `Bearer ${token}` };
  const tab = quoteTab(creds.tab);
  const lastColumn = columnLetter(rows[0]!.length);

  const updateRes = await fetch(
    `${SHEETS_API}/${creds.spreadsheetId}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    },
  );
  if (!updateRes.ok) {
    throw new Error(`Sheets update failed (${updateRes.status}): ${await updateRes.text()}`);
  }

  // Anything below the rows just written is a leftover from a longer previous
  // run. Failing to clear it would leave deleted users on the sheet forever.
  const clearFrom = rows.length + 1;
  const clearRes = await fetch(
    `${SHEETS_API}/${creds.spreadsheetId}/values/${encodeURIComponent(`${tab}!A${clearFrom}:${lastColumn}`)}:clear`,
    { method: 'POST', headers: auth },
  );
  if (!clearRes.ok) {
    throw new Error(`Sheets clear failed (${clearRes.status}): ${await clearRes.text()}`);
  }

  return { rowsWritten: rows.length - 1 };
}

/** 1 -> A, 26 -> Z, 27 -> AA. Sheets ranges are letters, the row builder counts. */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
