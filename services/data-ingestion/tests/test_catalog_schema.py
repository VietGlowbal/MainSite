from __future__ import annotations

import unittest
from pathlib import Path


MAIN_SITE_ROOT = Path(__file__).resolve().parents[3]
MIGRATION_PATH = MAIN_SITE_ROOT / "supabase-catalog-v2.sql"


class TestCatalogSchemaMigration(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION_PATH.read_text(encoding="utf-8")
        cls.normalized = " ".join(cls.sql.lower().split())

    def test_declares_normalized_catalogue_tables(self) -> None:
        for table in (
            "university_profiles",
            "academic_units",
            "course_academic_units",
            "course_offerings",
            "course_field_values",
            "course_admission_requirements",
            "catalog_promotions",
        ):
            self.assertIn(
                f"create table if not exists public.{table}",
                self.normalized,
            )

    def test_keeps_crawl_tables_as_sources(self) -> None:
        self.assertNotIn("drop table", self.normalized)
        self.assertIn("from public.crawl_programmes", self.normalized)
        self.assertIn("from public.crawl_field_assertions", self.normalized)

    def test_promotion_supports_read_only_preflight(self) -> None:
        self.assertIn(
            "create or replace function public.promote_crawl_run",
            self.normalized,
        )
        self.assertIn("p_dry_run boolean default true", self.normalized)
        self.assertIn("if p_dry_run then", self.normalized)
        self.assertIn(
            "grant execute on function public.promote_crawl_run(uuid, boolean) to service_role",
            self.normalized,
        )

    def test_product_safety_fields_are_explicit(self) -> None:
        self.assertIn("display_mode text not null", self.normalized)
        self.assertIn("use_for_eligibility boolean not null", self.normalized)
        self.assertIn("'source_excerpt'", self.normalized)
        self.assertIn("'not_published'", self.normalized)
        self.assertIn(
            "verification_status in ('rule_validated', 'human_verified')",
            self.normalized,
        )

    def test_product_views_use_invoker_security(self) -> None:
        self.assertGreaterEqual(
            self.normalized.count("with (security_invoker = true)"),
            2,
        )
        self.assertIn(
            "revoke all on function public.promote_crawl_run",
            self.normalized,
        )


if __name__ == "__main__":
    unittest.main()
