import argparse
import sqlite3
import sys
import os
import time
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Cấu hình đường dẫn DB mặc định
POSSIBLE_DBS = [
    "data/dpd/dpd_mini.db",
    "dist/dpd.db",
    "data/processed/dpd.db",
]

def find_db():
    if "DPD_DB_PATH" in os.environ:
        return Path(os.environ["DPD_DB_PATH"])
    for path in POSSIBLE_DBS:
        if os.path.exists(path):
            return Path(path)
    return None

def lookup_single_term(conn, term, console):
    try:
        start_time = time.perf_counter()
        
        # 1. Update Params
        conn.execute("UPDATE _lookup_params SET term = ?", (term,))
        
        # 2. Select Results
        cursor = conn.execute("SELECT * FROM view_lookup_results")
        rows = cursor.fetchall()
        
        end_time = time.perf_counter()
        duration_ms = (end_time - start_time) * 1000

        console.print(Panel(f"🔍 Lookup: [bold yellow]'{term}'[/bold yellow] ({duration_ms:.2f} ms)", expand=False))

        if not rows:
            console.print(f"[dim]No results found for '{term}'[/dim]\n")
            return

        # Render Table
        table = Table(show_lines=True)
        table.add_column("Type", style="cyan", width=8)
        table.add_column("Key", style="green")
        table.add_column("Headword", style="bold")
        table.add_column("Definition / Components")
        
        for row in rows:
            # Type Display
            type_str = str(row['type'])
            if row['type'] == -1: type_str = "DECON"
            elif row['type'] == 0: type_str = "ROOT"
            elif row['type'] == 1: type_str = "ENTRY"

            # Definition Truncate
            defn = str(row['definition'])
            if len(defn) > 100:
                defn = defn[:97] + "..."

            table.add_row(
                type_str,
                row['key'],
                row['headword'] or "",
                defn
            )
        
        console.print(table)
        console.print("") # Spacer

    except Exception as e:
        console.print(f"[bold red]Error looking up '{term}':[/bold red] {e}")

def main():
    parser = argparse.ArgumentParser(description="Lookup terms using the new View System (Exact + Decon).")
    parser.add_argument("terms", nargs="+", type=str, help="List of terms to lookup")
    parser.add_argument("-d", "--db", type=str, help="Path to .db file", default=None)
    
    args = parser.parse_args()
    console = Console()
    
    db_path = args.db if args.db else find_db()
    
    if not db_path:
        console.print("[bold red]❌ No Database found![/bold red]")
        sys.exit(1)

    console.print(f"[dim]DB: {db_path}[/dim]\n")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    try:
        # Check if table exists first
        try:
            conn.execute("SELECT 1 FROM _lookup_params LIMIT 1")
        except sqlite3.OperationalError:
            console.print("[bold red]❌ System Error: '_lookup_params' table not found.[/bold red]")
            console.print("Did you run [bold]make dv[/bold] to inject the new Lookup Views?")
            sys.exit(1)

        for term in args.terms:
            lookup_single_term(conn, term, console)
            
    finally:
        conn.close()

if __name__ == "__main__":
    main()
