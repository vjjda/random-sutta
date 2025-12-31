# Path: scripts/investigate_idioms.py
import sqlite3
import json
import os
from pathlib import Path
from rich.console import Console
from rich.table import Table

POSSIBLE_DBS = ["data/dpd/dpd_mini.db"]

def find_db():
    if "DPD_DB_PATH" in os.environ:
        return Path(os.environ["DPD_DB_PATH"])
    for path in POSSIBLE_DBS:
        if os.path.exists(path):
            return Path(path)
    return None

def investigate(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    console = Console()
    
    try:
        console.print("[bold yellow]🕵️‍♂️  Investigating Idioms in DB...[/bold yellow]")
        
        # 1. Tìm các Entry là Idiom (dựa vào definition_json hoặc query thủ công nếu có cột pos)
        # Vì cấu trúc bảng entries là: id, headword, ..., definition_json
        # Ta phải scan definition_json để tìm "p": "idiom" (hơi chậm nhưng chắc chắn)
        
        # Lấy mẫu 20 idioms
        sql_find_idioms = """
        SELECT id, headword, definition_json 
        FROM entries 
        WHERE definition_json LIKE '%"p": "idiom"%'
        LIMIT 20
        """
        
        idioms = conn.execute(sql_find_idioms).fetchall()
        
        table = Table(title=f"Found {len(idioms)} Sample Idioms")
        table.add_column("ID", style="cyan")
        table.add_column("Headword", style="bold green")
        table.add_column("Lookup Keys Triggers", style="yellow")
        
        for idiom in idioms:
            idiom_id = idiom['id']
            headword = idiom['headword']
            
            # 2. Tìm tất cả Lookup Keys trỏ về ID này
            sql_keys = "SELECT key FROM lookups WHERE target_id = ?"
            keys = conn.execute(sql_keys, (idiom_id,)).fetchall()
            
            key_list = [k['key'] for k in keys]
            
            # Highlight key nào KHÁC với headword (nghi phạm)
            display_keys = []
            for k in key_list:
                if k == headword:
                    display_keys.append(k)
                else:
                    display_keys.append(f"[bold red]{k}[/bold red]") # Key lạ!
            
            table.add_row(str(idiom_id), headword, ", ".join(display_keys))
            
        console.print(table)
        
    finally:
        conn.close()

if __name__ == "__main__":
    db_path = find_db()
    if db_path:
        investigate(db_path)
    else:
        print("DB Not Found")
