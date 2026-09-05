import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'sql/supabase-plus-promo-redemption.sql');
const promoV2MigrationPath = resolve(process.cwd(), 'sql/supabase-plus-promo-v2.sql');
const routePath = resolve(process.cwd(), 'src/app/api/plus/redeem/route.ts');

describe('Plus promo redemption contracts', () => {
  it('ships an authenticated server route and an append-only database migration', () => {
    expect(existsSync(routePath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(promoV2MigrationPath)).toBe(true);
  });

  it('makes one redemption per campaign and user atomic with the Plus grant', () => {
    const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    expect(sql).toMatch(/unique\s*\(user_id,\s*campaign\)/i);
    expect(sql).toContain('redeem_plus_promo');
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/grant execute[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/update public\.student_profiles[\s\S]*plus_status\s*=\s*true/i);
    expect(sql).toMatch(/insert into public\.plus_subscriptions/i);
  });

  it('rotates to a fresh zero-revenue campaign without deleting payment history', () => {
    const sql = existsSync(promoV2MigrationPath) ? readFileSync(promoV2MigrationPath, 'utf8') : '';

    expect(sql).toContain('gogogogoglowbal-v2');
    expect(sql).toMatch(/unique\s*\(user_id,\s*campaign\)/i);
    expect(sql).toContain("'Promo · 100% off'");
    expect(sql).not.toMatch(/delete\s+from\s+public\.payment_transactions/i);
    expect(sql).not.toMatch(/truncate/i);
  });
});
