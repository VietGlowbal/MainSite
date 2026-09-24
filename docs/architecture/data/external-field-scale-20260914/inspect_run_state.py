from __future__ import annotations

import sqlite3
from pathlib import Path

path = Path(__file__).parent / "runs" / "external-field-scale-20260914a" / "crawl_state.sqlite"
connection = sqlite3.connect(path)
print(connection.execute("select name from sqlite_master where type='table'").fetchall())
for table in ("state", "kv", "crawl_state", "metadata"):
    try:
        print(table, connection.execute(f"select * from {table} limit 20").fetchall())
    except sqlite3.Error:
        pass
