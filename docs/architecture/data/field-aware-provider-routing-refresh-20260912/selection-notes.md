# Provider-routed bounded refresh

Frozen population is copied from `field-aware-refresh-20260911`; no target URLs were changed. Configured provider IDs are existing public/non-heavy providers. IPEDS, Scorecard bulk, USDOE affordability, Discover Uni/HESA, and other heavy or out-of-scope resources remain in the catalogue but are excluded from this local-mode refresh so the validated durable-storage rail is not bypassed. Each selected external provider is admitted only through an explicit per-seed ExternalSourceRule.

{
  "mit-us": 10,
  "duke-us": 10,
  "stanford-us": 10,
  "cornell-us": 10,
  "ucla-us": 10,
  "eth-zurich-ch": 9,
  "sorbonne-fr": 9,
  "toronto-ca": 7,
  "unsw-au": 8,
  "ntu-sg": 8
}
