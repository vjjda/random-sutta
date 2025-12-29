import argparse
import sqlite3
import sys
import os
from pathlib import Path
from rich.console import Console
from rich.table import Table

# Cấu hình đường dẫn DB mặc định (Ưu tiên tìm trong dist hoặc data)
POSSIBLE_DBS = [
    "dist/dpd.db",
    "data/processed/dpd.db",
    "data/db_mirror/dpd.db"
]

def find_db():
    # 1. Check env var
    if "DPD_DB_PATH" in os.environ:
        return Path(os.environ["DPD_DB_PATH"])
    
    # 2. Check common paths
    for path in POSSIBLE_DBS:
        if os.path.exists(path):
            return Path(path)
            
    # 3. Not found
    return None

def search(term, db_path):
    console = Console()
    
    if not db_path:
        console.print("[bold red]❌ Không tìm thấy file database (.db)![/bold red]")
        console.print(f"Vui lòng kiểm tra lại các đường dẫn: {POSSIBLE_DBS}")
        console.print("Hoặc sử dụng cờ -d để chỉ định file DB cụ thể.")
        return

    console.print(f"[dim]Connecting to: {db_path}[/dim]")
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Update Params
        cursor.execute("UPDATE _search_params SET term = ?", (term,))
        
        # 2. Select Results
        cursor.execute("SELECT * FROM view_search_results")
        rows = cursor.fetchall()

        if not rows:
            console.print(f"[yellow]Không tìm thấy kết quả cho: [bold]{term}[/bold][/yellow]")
            return

        # 3. Render Table
        table = Table(title=f"Search Results: {term} ({len(rows)})", show_lines=True)
        
        # Add columns dynamically
        if rows:
            keys = rows[0].keys()
            for key in keys:
                table.add_column(key, overflow="fold")

        for row in rows:
            # Convert row values to string and handle None
            row_data = [str(item) if item is not None else "" for item in row]
            table.add_row(*row_data)

        console.print(table)
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search the dictionary database via CLI.")
    parser.add_argument("term", type=str, help="The search term (e.g., 'mahesinti')")
    parser.add_argument("-d", "--db", type=str, help="Path to the .db file", default=None)
    
    args = parser.parse_args()
    
    # Determine DB path: Argument > Auto-detect
    db_path = args.db if args.db else find_db()
    
    search(args.term, db_path)
