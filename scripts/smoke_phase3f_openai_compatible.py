"""Run one live OpenAI-compatible extraction-provider connectivity smoke.

The API key is read from the process environment only. This script prints
status and aggregate usage, never the request, response body, or credential.
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
INGESTION_SRC = REPO_ROOT / "services" / "data-ingestion" / "src"
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from glowbal_ingestion.config import SmokeConfig  # noqa: E402
from glowbal_ingestion.deepseek import DeepSeekClient, DeepSeekError  # noqa: E402
from glowbal_ingestion.storage import StateStore  # noqa: E402


def main() -> int:
    config = SmokeConfig(run_name="phase3f-provider-connectivity-smoke", institutions=())
    with tempfile.TemporaryDirectory(prefix="phase3f-provider-") as temporary:
        state = StateStore(Path(temporary) / "state.sqlite")
        try:
            client = DeepSeekClient(config, state)
            model = os.environ.get("OPENAI_COMPATIBLE_MODEL", "").strip()
            result = {
                "provider": "OpenAI-compatible",
                "base_url_host": re.sub(
                    r"^https?://([^/]+).*$", r"\1", client.base_url
                ),
                "model": model or None,
            }
            if not model:
                result.update(
                    {
                        "status": "FAIL",
                        "error_code": "MODEL_NOT_CONFIGURED",
                    }
                )
                print(json.dumps(result, sort_keys=True))
                return 2
            try:
                started = time.perf_counter()
                payload = client._request_raw(
                    model_name=model,
                    prompt=(
                        'Return exactly this JSON object and no prose: '
                        '{"smoke":"ok"}.'
                    ),
                    thinking=False,
                )
                latency_ms = round((time.perf_counter() - started) * 1000, 1)
            except DeepSeekError as exc:
                match = re.search(r"HTTP (\d+)", str(exc))
                result.update(
                    {
                        "status": "FAIL",
                        "http_status": int(match.group(1)) if match else None,
                        "error_code": exc.code.value,
                        "retryable": exc.retryable,
                    }
                )
                print(json.dumps(result, sort_keys=True))
                return 2
            result.update(
                {
                    "status": "PASS",
                    "http_status": 200,
                    "latency_ms": latency_ms,
                    "assistant_content_non_empty": bool(payload),
                    "usage": client.stats.to_dict(),
                }
            )
            print(json.dumps(result, sort_keys=True))
            return 0
        finally:
            state.close()


if __name__ == "__main__":
    raise SystemExit(main())
