from __future__ import annotations

import gzip
import hashlib
import json
import os
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .models import JsonRecord, utc_now_iso


@dataclass(frozen=True)
class RunPaths:
    root: Path
    raw_html: Path
    raw_json: Path
    raw_pdf: Path

    @classmethod
    def create(cls, root: Path) -> "RunPaths":
        paths = cls(
            root=root,
            raw_html=root / "raw" / "html",
            raw_json=root / "raw" / "json",
            raw_pdf=root / "raw" / "pdf",
        )
        for path in (paths.root, paths.raw_html, paths.raw_json, paths.raw_pdf):
            path.mkdir(parents=True, exist_ok=True)
        return paths

    def jsonl_path(self, name: str) -> Path:
        return self.root / f"{name}.jsonl"


class JsonlStore:
    def __init__(self, paths: RunPaths) -> None:
        self.paths = paths
        self._lock = threading.RLock()

    def append(self, stream: str, record: JsonRecord | dict[str, Any]) -> None:
        payload = record.to_dict() if isinstance(record, JsonRecord) else record
        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        with self._lock:
            with self.paths.jsonl_path(stream).open("a", encoding="utf-8") as handle:
                handle.write(line)
                handle.write("\n")

    def write_json(self, name: str, payload: dict[str, Any]) -> Path:
        destination = self.paths.root / name
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        with self._lock:
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            os.replace(temporary, destination)
        return destination

    def replace_jsonl(
        self,
        stream: str,
        records: list[dict[str, Any]],
    ) -> Path:
        destination = self.paths.jsonl_path(stream)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        content = "".join(
            json.dumps(record, ensure_ascii=False, separators=(",", ":"))
            + "\n"
            for record in records
        )
        with self._lock:
            temporary.write_text(content, encoding="utf-8")
            os.replace(temporary, destination)
        return destination

    def save_raw(
        self,
        *,
        content: bytes,
        content_type: str | None,
        canonical_url: str,
    ) -> str:
        digest = hashlib.sha256(canonical_url.encode("utf-8")).hexdigest()
        content_type_lower = (content_type or "").lower()
        if "pdf" in content_type_lower or content.startswith(b"%PDF"):
            destination = self.paths.raw_pdf / f"{digest}.pdf"
            destination.write_bytes(content)
        elif "json" in content_type_lower:
            destination = self.paths.raw_json / f"{digest}.json.gz"
            with gzip.open(destination, "wb", compresslevel=6) as handle:
                handle.write(content)
        else:
            destination = self.paths.raw_html / f"{digest}.html.gz"
            with gzip.open(destination, "wb", compresslevel=6) as handle:
                handle.write(content)
        return str(destination.relative_to(self.paths.root)).replace("\\", "/")


class StateStore:
    """Small disk-backed checkpoint and LLM cache used only during a smoke run."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA synchronous=NORMAL")
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS seen_urls (
                canonical_url TEXT PRIMARY KEY,
                stage TEXT NOT NULL,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS llm_cache (
                cache_key TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                model_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS best_assertion_bundles (
                entity_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                assertions_json TEXT NOT NULL,
                quality_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(entity_id, field_name)
            );
            CREATE TABLE IF NOT EXISTS shared_assertion_bundles (
                institution_id TEXT NOT NULL,
                degree_level TEXT NOT NULL,
                audience TEXT NOT NULL,
                academic_cycle TEXT NOT NULL,
                field_name TEXT NOT NULL,
                assertions_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(
                    institution_id,
                    degree_level,
                    audience,
                    academic_cycle,
                    field_name
                )
            );
            """
        )
        self._connection.commit()

    def mark_url(self, canonical_url: str, stage: str, status: str) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO seen_urls(canonical_url, stage, status, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(canonical_url) DO UPDATE SET
                    stage=excluded.stage,
                    status=excluded.status,
                    updated_at=excluded.updated_at
                """,
                (canonical_url, stage, status, utc_now_iso()),
            )
            self._connection.commit()

    def url_status(self, canonical_url: str) -> tuple[str, str] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT stage, status FROM seen_urls WHERE canonical_url=?",
                (canonical_url,),
            ).fetchone()
        return (str(row[0]), str(row[1])) if row else None

    def set_value(self, key: str, value: Any) -> None:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO kv(key, value_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value_json=excluded.value_json,
                    updated_at=excluded.updated_at
                """,
                (key, encoded, utc_now_iso()),
            )
            self._connection.commit()

    def get_value(self, key: str, default: Any = None) -> Any:
        with self._lock:
            row = self._connection.execute(
                "SELECT value_json FROM kv WHERE key=?", (key,)
            ).fetchone()
        return json.loads(row[0]) if row else default

    def get_llm(self, cache_key: str) -> tuple[str, dict[str, Any]] | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT model_name, response_json FROM llm_cache WHERE cache_key=?",
                (cache_key,),
            ).fetchone()
        if not row:
            return None
        return str(row[0]), json.loads(row[1])

    def put_llm(
        self, cache_key: str, model_name: str, response: dict[str, Any]
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT OR REPLACE INTO llm_cache(
                    cache_key, response_json, model_name, created_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    cache_key,
                    json.dumps(response, ensure_ascii=False, separators=(",", ":")),
                    model_name,
                    utc_now_iso(),
                ),
            )
            self._connection.commit()

    def get_best_assertion_bundle(
        self,
        entity_id: str,
        field_name: str,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]] | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT assertions_json, quality_json
                FROM best_assertion_bundles
                WHERE entity_id=? AND field_name=?
                """,
                (entity_id, field_name),
            ).fetchone()
        if not row:
            return None
        assertions = json.loads(row[0])
        quality = json.loads(row[1])
        if not isinstance(assertions, list) or not isinstance(quality, dict):
            return None
        return assertions, quality

    def put_best_assertion_bundle(
        self,
        entity_id: str,
        field_name: str,
        assertions: list[dict[str, Any]],
        quality: dict[str, Any],
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO best_assertion_bundles(
                    entity_id,
                    field_name,
                    assertions_json,
                    quality_json,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(entity_id, field_name) DO UPDATE SET
                    assertions_json=excluded.assertions_json,
                    quality_json=excluded.quality_json,
                    updated_at=excluded.updated_at
                """,
                (
                    entity_id,
                    field_name,
                    json.dumps(
                        assertions,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    json.dumps(
                        quality,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    utc_now_iso(),
                ),
            )
            self._connection.commit()

    def delete_best_assertion_bundle(
        self,
        entity_id: str,
        field_name: str,
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                DELETE FROM best_assertion_bundles
                WHERE entity_id=? AND field_name=?
                """,
                (entity_id, field_name),
            )
            self._connection.commit()

    def get_shared_assertion_bundle(
        self,
        *,
        institution_id: str,
        degree_level: str,
        audience: str,
        academic_cycle: str,
        field_name: str,
    ) -> list[dict[str, Any]]:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT assertions_json
                FROM shared_assertion_bundles
                WHERE institution_id=?
                  AND degree_level=?
                  AND audience=?
                  AND academic_cycle=?
                  AND field_name=?
                """,
                (
                    institution_id,
                    degree_level,
                    audience,
                    academic_cycle,
                    field_name,
                ),
            ).fetchone()
        if not row:
            return []
        assertions = json.loads(row[0])
        return assertions if isinstance(assertions, list) else []

    def list_shared_assertion_bundles(
        self,
        *,
        institution_id: str,
        degree_level: str,
    ) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT audience, academic_cycle, field_name, assertions_json
                FROM shared_assertion_bundles
                WHERE institution_id=? AND degree_level=?
                ORDER BY field_name, audience, academic_cycle
                """,
                (institution_id, degree_level),
            ).fetchall()
        records: list[dict[str, Any]] = []
        for audience, academic_cycle, field_name, encoded in rows:
            assertions = json.loads(encoded)
            if not isinstance(assertions, list):
                continue
            records.append(
                {
                    "audience": str(audience),
                    "academic_cycle": str(academic_cycle),
                    "field_name": str(field_name),
                    "assertions": assertions,
                }
            )
        return records

    def put_shared_assertion_bundle(
        self,
        *,
        institution_id: str,
        degree_level: str,
        audience: str,
        academic_cycle: str,
        field_name: str,
        assertions: list[dict[str, Any]],
    ) -> None:
        encoded = json.dumps(
            assertions,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO shared_assertion_bundles(
                    institution_id,
                    degree_level,
                    audience,
                    academic_cycle,
                    field_name,
                    assertions_json,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(
                    institution_id,
                    degree_level,
                    audience,
                    academic_cycle,
                    field_name
                ) DO UPDATE SET
                    assertions_json=excluded.assertions_json,
                    updated_at=excluded.updated_at
                """,
                (
                    institution_id,
                    degree_level,
                    audience,
                    academic_cycle,
                    field_name,
                    encoded,
                    utc_now_iso(),
                ),
            )
            self._connection.commit()

    def close(self) -> None:
        with self._lock:
            self._connection.close()
