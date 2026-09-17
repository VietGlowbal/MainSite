# Data platform incident runbook

The first response preserves evidence and prevents false product truth. Never
delete audit/history to make an incident appear resolved.

| Incident | Immediate action | Safe degraded behavior |
|---|---|---|
| Mongo outage/timeout | Stop acceptance of new raw-backed assertions; alert on `RAW_PERSIST_FAILED`. | Retry acquisition/persistence; no extraction is PRODUCT_SAFE without durable lineage. |
| Supabase Storage outage/object missing | Stop large-binary acceptance and inspect object references/checksums. | Retry storage; keep the source unresolved or retryable. |
| Postgres outage or staging failure | Stop affected claims/promotions; preserve local job identity. | Retry idempotently; do not write canonical truth directly. |
| LLM provider outage/rate limit | Disable the affected provider adapter. | Use deterministic structured parsing or retryable extraction failure. |
| Search-provider outage | Stop search expansion. | Continue with admitted first-party sources or mark recovery exhausted. |
| Domain block/robots denial | Keep the explicit policy failure. | Do not convert access failure into absence or `NOT_PUBLISHED`. |
| Identity collision or ambiguous match | Quarantine the reconciliation candidate. | Require curator review; prefer unresolved over false merge. |
| Promotion failure/race | Freeze promotion for the fingerprint and inspect audit/transaction state. | Retry the same fingerprint after confirming no partial projection. |
| Bad canonical projection | Disable v3 application and retain evidence/audit. | Issue a forward correction after review; preserve prior history. |
| Credential/secret exposure | Revoke and rotate the affected credential immediately. | Redact logs and investigate access; never include the value in an incident ticket. |

## Incident checklist

1. Record UTC time, environment, run/job/fingerprint, adapter, and policy
   versions—never credentials or raw secrets.
2. Classify the event as infrastructure, semantic quality, identity, or
   promotion.
3. Stop only the affected adapter/promotion scope unless the safety invariant
   is global.
4. Confirm no canonical/product-safe state was written from failed, stale,
   inferred, conflicting, or lineage-free evidence.
5. Preserve raw snapshots, assertions, job attempts, and audit records.
6. Reproduce with a fixture or isolated non-production copy, apply the minimal
   fix, and rerun the relevant failure-injection and idempotency tests.
7. Resume with the same stable fingerprint where safe; otherwise create a new
   forward correction with an explicit relationship to the prior attempt.
