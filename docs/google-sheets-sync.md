# Google Sheets contact sync — setup

`/api/cron/sync-user-sheet` mirrors the user contact export into a Google Sheet
every 15 minutes. Until the four environment variables below are set the job is
a no-op: it returns `{"ok":true,"skipped":"google-sheets-not-configured"}` and
never fails a deploy.

Setup is one-time, ~15 minutes, and all of it happens outside this repo.

## 1. Make the service account

A *service account* is a Google account belonging to the app rather than a
person. It is the thing the sheet gets shared with.

1. Go to <https://console.cloud.google.com/> and create a project (any name).
2. **APIs & Services → Library →** search "Google Sheets API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   Give it a name (e.g. `glowbal-sheet-sync`) and create it. No roles needed —
   roles grant access to Google Cloud, which is not what this uses.
4. Open the new account → **Keys → Add key → Create new key → JSON**. A file
   downloads. It contains a private key: treat it like a password, and do not
   commit it.

## 2. Share the sheet with it

Open the JSON and copy `client_email` (it looks like
`glowbal-sheet-sync@your-project.iam.gserviceaccount.com`).

In your Google Sheet: **Share** → paste that address → give it **Editor** →
send. Skip this and every sync fails with a 403, because holding the key grants
no access to any document on its own.

Name the tab `Users`, or set `GOOGLE_SHEETS_TAB` to whatever you call it.

## 3. Set the environment variables

In Vercel (**Settings → Environment Variables**) and in `.env.local` for local
runs:

| Variable | Where it comes from |
|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | `client_email` in the JSON |
| `GOOGLE_SHEETS_PRIVATE_KEY` | `private_key` in the JSON, **including** the `-----BEGIN PRIVATE KEY-----` lines |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | the sheet URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit` |
| `GOOGLE_SHEETS_TAB` | optional, defaults to `Users` |

The private key is multi-line. Pasting it into a dashboard usually turns the
newlines into literal `\n`, which `crypto` rejects with the unhelpful error
"no start line" — `readSheetsCredentials` normalises that case, so either form
works.

## 4. Check it

Redeploy, then run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-domain>/api/cron/sync-user-sheet
```

A good run returns `{"ok":true,"users":413,"profiles":233,"rowsWritten":413}`.
After that Vercel Cron fires it every 15 minutes (`vercel.json`).

## How it behaves

- **Rewrites the whole tab every run**, header included. It does not append.
  That is what makes the first run backfill every existing user, and what stops
  the sheet drifting when a student later *edits* their details — which is
  exactly what `/auth/complete-profile` makes hundreds of them do.
- **Edits you make in the sheet are overwritten.** Treat it as a read-only
  mirror; do your own working notes in a separate tab, which is untouched.
- **Rows are newest sign-up first.**
- Blank cells mean no value, rather than the string `null` the SQL export emits.
- Phone and date of birth are read from `student_profiles` first and auth
  metadata second. That fallback is load-bearing: 75 users have a phone this
  way versus 16 from the profile column alone.

## PII

The sheet holds every student's name, email, phone number and date of birth.
Share it with named people only — never "anyone with the link" — and remember
that `scripts/export-user-contacts.sql` carries the same warning for the same
data.

The column list and coalesce order in `src/lib/user-contact-rows.ts` mirror that
SQL script. Change one, change the other.
