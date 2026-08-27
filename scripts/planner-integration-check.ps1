param([Parameter(Mandatory = $true)][string]$DatabaseUrl)
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) { throw 'psql is required. Install PostgreSQL/Supabase CLI and rerun against a disposable database; production is never touched.' }
$root = Split-Path -Parent $PSScriptRoot
$migrations = @('supabase-core3-plan-hierarchy.sql','supabase-canonical-planner-production.sql','supabase-planner-ops.sql','supabase-planner-production-hardening.sql','supabase-planner-production-hardening-multi-microstep-fix.sql')
& $psql.Source $DatabaseUrl --set ON_ERROR_STOP=1 --file (Join-Path $PSScriptRoot 'planner-integration-bootstrap.sql')
if ($LASTEXITCODE -ne 0) { throw 'Integration bootstrap failed.' }
foreach ($migration in $migrations) {
  & $psql.Source $DatabaseUrl --set ON_ERROR_STOP=1 --file (Join-Path $root $migration)
  if ($LASTEXITCODE -ne 0) { throw "Migration failed: $migration" }
}
& $psql.Source $DatabaseUrl --set ON_ERROR_STOP=1 --command "GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role; GRANT SELECT ON public.application_plans, public.application_plan_phases, public.application_plan_steps, public.application_plan_micro_steps, public.application_planner_ops, public.application_planner_generation_runs, public.application_planner_feedback TO anon, authenticated;"
if ($LASTEXITCODE -ne 0) { throw 'Integration test grants failed.' }
& $psql.Source $DatabaseUrl --set ON_ERROR_STOP=1 --file (Join-Path $PSScriptRoot 'planner-integration-check.sql')
if ($LASTEXITCODE -ne 0) { throw 'Planner integration assertions failed.' }
Write-Host 'Planner local PostgreSQL integration check passed.'
