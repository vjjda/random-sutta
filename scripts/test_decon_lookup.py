# Path: scripts/test_decon_lookup.py
import sqlite3
import time
import os
import random
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

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

def get_random_deconstructions(db_path, limit=5):
    conn = get_db_connection(db_path)
    try:
        cursor = conn.execute("SELECT word FROM deconstructions ORDER BY RANDOM() LIMIT ?", (limit,))
        return [row['word'] for row in cursor.fetchall()]
    except Exception as e:
        print(f"Error getting random words: {e}")
        return []
    finally:
        conn.close()

def query_method_b(db_path, term):
    conn = get_db_connection(db_path)
    try:
        start = time.perf_counter()
        
        sql = """
        SELECT 
            (key = ?) as is_exact, 
            key, type, headword, definition, components, grammar
        FROM view_grand_lookups
        WHERE key IN (
            SELECT key
            FROM lookups_fts
            WHERE key MATCH ?
        )
        ORDER BY 
          is_exact DESC,
          LENGTH(key) ASC;
        """
        
        cursor = conn.execute(sql, (term, term))
        rows = cursor.fetchall()
        duration = (time.perf_counter() - start) * 1000
        return rows, duration
    finally:
        conn.close()

def query_method_c(db_path, term):
    """
    Method C: Advanced Union Logic
    Simulation of what View or Frontend should do to cover all cases.
    """
    conn = get_db_connection(db_path)
    try:
        start = time.perf_counter()
        
        sql = """
        WITH matches AS (
            -- 1. Find in FTS (Entries, Roots, Variants)
            SELECT key, 1 as source_type 
            FROM lookups_fts 
            WHERE key MATCH ?
            
            UNION
            
            -- 2. Find in Deconstructions (Orphans)
            -- Note: Deconstruction table is small enough for indexed lookup, 
            -- but ideally should be FTS too if very large.
            SELECT word as key, -1 as source_type
            FROM deconstructions 
            WHERE word = ?
        )
        SELECT 
            (m.key = ?) as is_exact,
            v.*,
            -- If not found in view (because it's an orphan decon), fill from decon table
            COALESCE(v.components, d.components) as final_components,
            COALESCE(v.type, -1) as final_type
        FROM matches m
        LEFT JOIN view_grand_lookups v ON m.key = v.key
        LEFT JOIN deconstructions d ON m.key = d.word
        ORDER BY is_exact DESC, LENGTH(m.key) ASC;
        """
        
        cursor = conn.execute(sql, (term, term, term))
        rows = cursor.fetchall()
        duration = (time.perf_counter() - start) * 1000
        return rows, duration
    finally:
        conn.close()

def main():
    console = Console()
    db_path = find_db()
    
    if not db_path:
        console.print("[bold red]❌ No Database found![/bold red]")
        return

    console.print(f"[dim]DB: {db_path}[/dim]")

    # 1. Get Random Decon Words
    words = get_random_deconstructions(db_path, 5)
    if not words:
        console.print("[yellow]⚠️ No deconstructions found or DB error.[/yellow]")
        return

    console.print(f"[bold cyan]🎲 Testing with Random Deconstructions: {words}[/bold cyan]\n")

    # 2. Test
    for term in words:
        console.print(Panel(f"Testing: [bold yellow]'{term}'[/bold yellow]", expand=False))
        
        # --- Method B ---
        rows_b, ms_b = query_method_b(db_path, term)
        console.print(f"[cyan]Method B (Standard):[/cyan] {ms_b:.2f} ms | Found: {len(rows_b)}")
        
        # --- Method C ---
        rows_c, ms_c = query_method_c(db_path, term)
        console.print(f"[green]Method C (Union):   [/green] {ms_c:.2f} ms | Found: {len(rows_c)}")

        # Show Content of C if B failed
        if not rows_b and rows_c:
            console.print("[bold green]✅ Method C rescued the result![/bold green]")
            table = Table(show_lines=True)
            table.add_column("Type", style="dim")
            table.add_column("Key", style="green")
            table.add_column("Components", style="magenta")
            
            for row in rows_c:
                comp = row['final_components']
                table.add_row(
                    str(row['final_type']),
                    row['key'],
                    str(comp) if comp else "[dim]None[/dim]"
                )
            console.print(table)
        elif rows_b:
             console.print("[dim]Method B worked fine.[/dim]")

        console.print("\n" + "-"*40 + "\n")

if __name__ == "__main__":
    main()
