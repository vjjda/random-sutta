# Path: scripts/benchmark_compare_views.py
import sqlite3
import time
import os
import statistics
from pathlib import Path
from rich.console import Console
from rich.table import Table

POSSIBLE_DBS = ["data/dpd/dpd_mini.db", "dist/dpd.db"]

def find_db():
    if "DPD_DB_PATH" in os.environ:
        return Path(os.environ["DPD_DB_PATH"])
    for path in POSSIBLE_DBS:
        if os.path.exists(path):
            return Path(path)
    return None

def get_db_connection(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_test_terms(db_path):
    conn = get_db_connection(db_path)
    terms = {"entries": [], "decons": []}
    try:
        cur = conn.execute("SELECT key FROM lookups WHERE type=1 ORDER BY RANDOM() LIMIT 50")
        terms["entries"] = [r['key'] for r in cur.fetchall()]
        cur = conn.execute("SELECT word FROM deconstructions ORDER BY RANDOM() LIMIT 50")
        terms["decons"] = [r['word'] for r in cur.fetchall()]
    finally:
        conn.close()
    return terms

def bench_view_search(conn, term):
    start = time.perf_counter()
    conn.execute("UPDATE _search_params SET term = ?", (term,))
    cur = conn.execute("SELECT * FROM view_search_results")
    rows = cur.fetchall()
    return (time.perf_counter() - start) * 1000, len(rows)

def bench_view_lookup(conn, term):
    start = time.perf_counter()
    conn.execute("UPDATE _lookup_params SET term = ?", (term,))
    cur = conn.execute("SELECT * FROM view_lookup_results")
    rows = cur.fetchall()
    return (time.perf_counter() - start) * 1000, len(rows)

def run_suite(console, db_path, suite_name, terms):
    conn = get_db_connection(db_path)
    times_search = []
    times_lookup = []
    
    try:
        for term in terms:
            ms_s, _ = bench_view_search(conn, term)
            ms_l, _ = bench_view_lookup(conn, term)
            times_search.append(ms_s)
            times_lookup.append(ms_l)
    finally:
        conn.close()

    return statistics.mean(times_search), statistics.mean(times_lookup)

def main():
    console = Console()
    db_path = find_db()
    if not db_path:
        return console.print("[red]DB Not Found[/red]")
        
    console.print(f"DB: {db_path}")
    terms_data = get_test_terms(db_path)
    
    table = Table(title="⚔️  BATTLE OF VIEWS: Search vs Lookup")
    table.add_column("Suite", style="bold")
    table.add_column("Search View (ms)", style="red")
    table.add_column("Lookup View (ms)", style="green")
    table.add_column("Winner", style="bold yellow")
    table.add_column("Improvement")

    for suite, terms in terms_data.items():
        avg_s, avg_l = run_suite(console, db_path, suite, terms)
        
        diff = avg_s - avg_l
        pct = (diff / avg_s) * 100 if avg_s > 0 else 0
        winner = "LOOKUP" if avg_l < avg_s else "SEARCH"
        
        table.add_row(
            suite.upper(),
            f"{avg_s:.3f}",
            f"{avg_l:.3f}",
            winner,
            f"{pct:.1f}%"
        )
        
    console.print(table)

if __name__ == "__main__":
    main()
