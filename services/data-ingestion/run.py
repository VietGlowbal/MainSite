from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parent
SRC_ROOT = SERVICE_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from glowbal_ingestion.cli import main


def _local_batch_arguments(argv: list[str]) -> list[str]:
    parser = argparse.ArgumentParser(
        prog="python run.py local-batch",
        description="Run one bounded five-institution US batch locally.",
    )
    parser.add_argument("batch_index", type=int, choices=range(1, 5))
    parser.add_argument("--programmes", type=int, default=5)
    parser.add_argument(
        "--institution",
        type=int,
        choices=range(1, 6),
        help="Run only this 1-based institution inside the selected batch.",
    )
    parser.add_argument("--discovery-only", action="store_true")
    parser.add_argument(
        "--render-policy",
        choices=("off", "auto", "always"),
        default="off",
        help="Use Crawl4AI for JS pages and HTTP 403 fallbacks.",
    )
    args = parser.parse_args(argv)
    if not 1 <= args.programmes <= 20:
        parser.error("--programmes must be between 1 and 20")

    main_site_root = SERVICE_ROOT.parent.parent
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    institution_batch_size = 5
    institution_batch_index = args.batch_index
    run_suffix = f"b{args.batch_index:02d}"
    if args.institution is not None:
        institution_batch_size = 1
        institution_batch_index = (
            (args.batch_index - 1) * 5 + args.institution
        )
        run_suffix += f"-i{args.institution:02d}"

    command = [
        "run",
        "--config",
        str(SERVICE_ROOT / "configs" / "us-deep-pilot-5x5.json"),
        "--output-root",
        str(main_site_root / "tmp" / "local-us20" / "runs"),
        "--run-id",
        f"us20-local-{run_suffix}-{timestamp}",
        "--supabase-approved-seeds",
        "--supabase-seed-limit",
        "20",
        "--supabase-seed-country",
        "US",
        "--institution-batch-size",
        str(institution_batch_size),
        "--institution-batch-index",
        str(institution_batch_index),
        "--seed-overrides",
        str(SERVICE_ROOT / "configs" / "us-seed-overrides.json"),
        "--max-deep-programmes",
        str(args.programmes),
        "--max-deep-sources",
        "6",
        "--programme-concurrency",
        "2",
        "--allow-unreviewed-terms",
        "--render-policy",
        args.render_policy,
    ]
    ipeds_programmes = (
        main_site_root
        / "tmp"
        / "ipeds"
        / "us-21-scorecard"
        / "ipeds_popular_programmes.jsonl"
    )
    if ipeds_programmes.is_file():
        command.extend(
            ["--ipeds-programmes", str(ipeds_programmes)]
        )
    if args.discovery_only:
        command.append("--discovery-only")
    return command


if __name__ == "__main__":
    arguments = sys.argv[1:]
    if arguments[:1] == ["local-batch"]:
        arguments = _local_batch_arguments(arguments[1:])
    raise SystemExit(main(arguments))
