# Path: scripts/analyze_json_keys.py
import sqlite3
import json
import os
from pathlib import Path
from collections import Counter
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

def analyze(db_path):
    console = Console()
    conn = sqlite3.connect(db_path)
    
    try:
        console.print("[bold yellow]📊 Analyzing definition_json keys...[/bold yellow]")
        
        # 1. Count Total Entries
        total_entries = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
        console.print(f"Total Entries: [bold cyan]{total_entries}[/bold cyan]")
        
        # 2. Scan and Count Keys
        key_counter = Counter()
        cursor = conn.execute("SELECT definition_json FROM entries")
        
        processed = 0
        error_count = 0
        
        for row in cursor:
            try:
                data = json.loads(row[0])
                if isinstance(data, dict):
                    key_counter.update(data.keys())
                processed += 1
            except Exception:
                error_count += 1
                
        # 3. Load Key Mapping (Optional - to show full names if available)
        # Assuming we have a mapping or just guessing based on common knowledge
        key_meaning = {
            "p": "POS (Part of Speech)",
            "m": "Meaning",
            "c": "Construction",
            "d": "Degree of Completion",
            "ml": "Meaning Lit (Nghĩa đen)",
            "id": "ID",
            "s": "Source/Sanskrit",
            "pc": "Plus Case (Case usage)",
            "comp": "Compound Info",
            "vd": "Verb Detail?"
        }

        # 4. Render Table
        table = Table(title="JSON Key Frequency Analysis")
        table.add_column("Key", style="green")
        table.add_column("Full Name (Guess)", style="dim")
        table.add_column("Count", style="cyan", justify="right")
        table.add_column("Coverage %", style="bold magenta", justify="right")
        table.add_column("Recommendation", style="yellow")

        for key, count in key_counter.most_common():
            percent = (count / total_entries) * 100
            
            recommendation = "Column" if percent > 80 else ("Sparse Col" if percent > 20 else "JSON/Extra")
            
            table.add_row(
                key,
                key_meaning.get(key, "???"),
                f"{count:,}",
                f"{percent:.1f}%",
                recommendation
            )
            
        console.print(table)
        
        if error_count > 0:
            console.print(f"[red]⚠️ Failed to parse {error_count} rows.[/red]")

    finally:
        conn.close()

if __name__ == "__main__":
    db_path = find_db()
    if db_path:
        analyze(db_path)
    else:
        print("DB Not Found")
