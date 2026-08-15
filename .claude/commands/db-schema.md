---
description: Enumerate the live Supabase schema (never guess table or column names)
allowed-tools: Bash(node --env-file=.env.local -e:*), Bash(node -e:*)
---

Enumerate the **live** database. Three past sessions burned the owner's time by
trusting a `.sql` file or guessing table names — one reported the course
catalogue did not exist when it did. Never conclude a table is absent from a
guessed name.

`jq` is **not installed on this machine**, so the pipeline printed in
`docs/README.md` will fail. Use node:

List every exposed table:

```bash
node --env-file=.env.local -e "const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;fetch(u+'/rest/v1/',{headers:{apikey:k}}).then(r=>r.json()).then(d=>console.log(Object.keys(d.definitions).sort().join('\n')))"
```

Columns and types of one table (replace `TABLE`):

```bash
node --env-file=.env.local -e "const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY,t='TABLE';fetch(u+'/rest/v1/',{headers:{apikey:k}}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d.definitions[t]?.properties??('NOT FOUND: '+t),null,2)))"
```

Row count of one table (replace `TABLE`):

```bash
node --env-file=.env.local -e "const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY,t='TABLE';fetch(u+'/rest/v1/'+t+'?select=*',{method:'HEAD',headers:{apikey:k,Authorization:'Bearer '+k,Prefer:'count=exact'}}).then(r=>console.log(t,r.headers.get('content-range')))"
```

Then answer the user's question from the output. If they named a specific table
or feature, run the column query for it too. Report what you measured, not what
a `.sql` file claims — and if the schema contradicts a doc, say so.

$ARGUMENTS
