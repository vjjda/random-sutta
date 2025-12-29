import sqlite3
import time
import os
import random
import statistics
from pathlib import Path
from rich.console import Console
from rich.table import Table

# Cấu hình đường dẫn DB
POSSIBLE_DBS = [
    "data/dpd/dpd_mini.db",
    "dist/dpd.db",
]

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
    terms = {
        "entries": [],
        "decons": [],
        "prefixes": []
    }
    try:
        # 1. Random Entries
        cur = conn.execute("SELECT key FROM lookups WHERE type=1 ORDER BY RANDOM() LIMIT 20")
        terms["entries"] = [r['key'] for r in cur.fetchall()]
        
        # 2. Random Deconstructions
        cur = conn.execute("SELECT word FROM deconstructions ORDER BY RANDOM() LIMIT 20")
        terms["decons"] = [r['word'] for r in cur.fetchall()]

        # 3. Prefixes (Lấy 3 ký tự đầu của entries)
        terms["prefixes"] = [t[:3] for t in terms["entries"] if len(t) > 3]
        
    finally:
        conn.close()
    return terms

def benchmark_query(db_path, term):
    conn = get_db_connection(db_path)
    try:
        start = time.perf_counter()
        
        # 1. Update Params
        conn.execute("UPDATE _search_params SET term = ?", (term,))
        
        # 2. Select Results
        cursor = conn.execute("SELECT * FROM view_search_results")
        rows = cursor.fetchall()
        
        duration = (time.perf_counter() - start) * 1000
        return duration, len(rows)
    finally:
        conn.close()

def run_suite(console, db_path, suite_name, terms):
    if not terms:
        return
    
    times = []
    console.print(f"[bold cyan]Running Suite: {suite_name} ({len(terms)} terms)...[/bold cyan]")
    
    for term in terms:
        ms, count = benchmark_query(db_path, term)
        times.append(ms)
        # console.print(f"  - {term}: {ms:.2f}ms ({count} rows)")
        
    avg = statistics.mean(times)
    med = statistics.median(times)
    p95 = statistics.quantiles(times, n=20)[-1] if len(times) >= 20 else max(times)
    
    return avg, med, p95

def main():
    console = Console()
    db_path = find_db()
    if not db_path:
        console.print("[red]DB Not Found[/red]")
        return
        
    console.print(f"DB: {db_path}")
    
    # Prepare Data
    terms_data = get_test_terms(db_path)
    
    table = Table(title="📊 view_search_results Benchmark")
    table.add_column("Suite", style="bold")
    table.add_column("Avg (ms)", style="green")
    table.add_column("Median (ms)", style="cyan")
    table.add_column("P95 (ms)", style="red")
    
    results = []
    
    # Run Benchmarks
    for suite, terms in terms_data.items():
        avg, med, p95 = run_suite(console, db_path, suite, terms)
        table.add_row(suite.upper(), f"{avg:.2f}", f"{med:.2f}", f"{p95:.2f}")
        results.append(avg)
        
    console.print(table)
    console.print(f"[bold]Overall Avg:[/bold] {statistics.mean(results):.2f} ms")

if __name__ == "__main__":
    main()
