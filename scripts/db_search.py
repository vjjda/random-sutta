# Path: scripts/db_search.py
import argparse
import sqlite3
import sys
import os
import csv
import subprocess
import time
from pathlib import Path
from rich.console import Console
from rich.table import Table

# Cấu hình đường dẫn DB mặc định
POSSIBLE_DBS = [
    "data/dpd/dpd_mini.db",
]

def find_db():
    if "DPD_DB_PATH" in os.environ:
        return Path(os.environ["DPD_DB_PATH"])
    for path in POSSIBLE_DBS:
        if os.path.exists(path):
            return Path(path)
    return None

def open_in_vscode(file_path, console):
    """Mở file bằng VS Code CLI."""
    try:
        # Kiểm tra xem lệnh 'code' có tồn tại không
        subprocess.run(["code", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        # Mở file
        subprocess.run(["code", str(file_path)])
        console.print(f"[green]✅ Đã mở file trong VS Code: {file_path}[/green]")
    except (subprocess.CalledProcessError, FileNotFoundError):
        console.print(f"[yellow]⚠️ Không tìm thấy lệnh 'code'. File đã được lưu tại: {file_path}[/yellow]")
        console.print("Bạn có thể mở thủ công bằng cách click vào đường dẫn trên.")

def export_to_csv(rows, term):
    """Xuất kết quả ra file CSV trong thư mục tmp/."""
    # 1. Tạo thư mục tmp nếu chưa có
    tmp_dir = Path("tmp")
    tmp_dir.mkdir(exist_ok=True)

    # 2. Tạo tên file unique
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    clean_term = "".join(x for x in term if x.isalnum() or x in ('-', '_'))
    filename = f"search_{clean_term}_{timestamp}.csv"
    file_path = tmp_dir / filename

    # 3. Ghi file
    if rows:
        keys = rows[0].keys()
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(keys) # Header
            for row in rows:
                # Xử lý None thành chuỗi rỗng để CSV sạch hơn
                row_data = [str(item) if item is not None else "" for item in row]
                writer.writerow(row_data)
    
    return file_path

def search(term, db_path, use_csv=False):
    console = Console()
    
    if not db_path:
        console.print("[bold red]❌ Không tìm thấy file database (.db)![/bold red]")
        return

    console.print(f"[dim]DB: {db_path}[/dim]")
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Update Params
        cursor.execute("UPDATE _search_params SET term = ?", (term,))
        conn.commit() # Commit để chắc chắn param được lưu nếu có transaction khác
        
        # 2. Select Results
        start_time = time.perf_counter()
        cursor.execute("SELECT * FROM view_search_results")
        rows = cursor.fetchall()
        end_time = time.perf_counter()
        
        duration_ms = (end_time - start_time) * 1000
        console.print(f"[cyan]⏱️  Query Executed in: {duration_ms:.2f} ms[/cyan]")

        if not rows:
            console.print(f"[yellow]Không tìm thấy kết quả cho: [bold]{term}[/bold][/yellow]")
            return

        # 3. Handle Output
        if use_csv:
            file_path = export_to_csv(rows, term)
            open_in_vscode(file_path, console)
        else:
            # Render Table (Simplified)
            table = Table(title=f"Search Results: '{term}' ({len(rows)})", show_lines=True)
            
            # Define specific columns we want to see
            table.add_column("Type", style="cyan", width=8)
            table.add_column("Key", style="green")
            table.add_column("Headword", style="bold yellow")
            table.add_column("Definition / Info")
            
            for row in rows:
                # Type mapping
                type_val = row['type']
                if type_val == 1: type_str = "ENTRY"
                elif type_val == 0: type_str = "ROOT"
                elif type_val == -1: type_str = "DECON"
                else: type_str = str(type_val)

                # Definition Truncation
                definition = str(row['definition']) if row['definition'] else ""
                if len(definition) > 150:
                    definition = definition[:147] + "..."
                
                # Handling NULLs cleanly
                key = row['key'] or ""
                headword = row['headword'] or ""
                
                table.add_row(type_str, key, headword, definition)

            console.print(table)
            console.print("[dim]💡 Tip: Use [bold]-c[/bold] or [bold]--csv[/bold] to see full details in VS Code.[/dim]")
        
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Search the dictionary database.")
    parser.add_argument("term", type=str, help="Từ khóa tìm kiếm")
    parser.add_argument("-d", "--db", type=str, help="Đường dẫn file .db", default=None)
    parser.add_argument("-c", "--csv", action="store_true", help="Xuất ra CSV và mở bằng VS Code")
    
    args = parser.parse_args()
    
    db_path = args.db if args.db else find_db()
    search(args.term, db_path, args.csv)