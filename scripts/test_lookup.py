# Path: scripts/test_lookup.py
import sqlite3
import time
import os
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Cấu hình DB
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

# ==========================================
# METHOD A: Current Logic (View Search Results)
# ==========================================
def query_method_a(db_path, term):
    """
    Sử dụng view_search_results có sẵn.
    Logic: Update _search_params -> Select View.
    """
    conn = get_db_connection(db_path)
    try:
        start = time.perf_counter()
        
        # 1. Update params
        conn.execute("UPDATE _search_params SET term = ?", (term,))
        conn.commit()
        
        # 2. Query
        cursor = conn.execute("SELECT * FROM view_search_results")
        rows = cursor.fetchall()
        
        duration = (time.perf_counter() - start) * 1000
        return rows, duration
    finally:
        conn.close()

# ==========================================
# METHOD B: New Logic (Direct Grand View + FTS)
# ==========================================
def query_method_b(db_path, term):
    """
    Sử dụng view_grand_lookups kết hợp subquery FTS.
    Logic: Filter ID từ lookups_fts -> Select Grand View.
    """
    conn = get_db_connection(db_path)
    try:
        start = time.perf_counter()
        
        # Query trực tiếp (Mô phỏng user highlight đúng từ đó)
        # Lưu ý: FTS MATCH mặc định là whole word match nếu không có dấu *
        sql = """
        SELECT 
            (key = ?) as is_exact, 
            *
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
        
        # Param 1: Để check is_exact
        # Param 2: Để chạy FTS Match (chúng ta dùng chính term đó, giả sử user highlight trọn vẹn từ)
        cursor = conn.execute(sql, (term, term))
        rows = cursor.fetchall()
        
        duration = (time.perf_counter() - start) * 1000
        return rows, duration
    finally:
        conn.close()

# ==========================================
# REPORTING
# ==========================================
def print_comparison(console, term, res_a, res_b):
    rows_a, time_a = res_a
    rows_b, time_b = res_b
    
    console.print(Panel(f"🔍 Testing Term: [bold yellow]'{term}'[/bold yellow]", expand=False))

    # 1. Benchmark Table
    table_bench = Table(title="⏱️ Performance Benchmark")
    table_bench.add_column("Method", style="cyan")
    table_bench.add_column("Time (ms)", style="green")
    table_bench.add_column("Rows Found", style="magenta")
    table_bench.add_column("Logic Note")
    
    table_bench.add_row("A: view_search_results", f"{time_a:.2f}", str(len(rows_a)), "Smart (Prefix + Decon)")
    table_bench.add_row("B: GrandView + FTS", f"{time_b:.2f}", str(len(rows_b)), "Exact/Whole Word FTS")
    
    console.print(table_bench)

    # 2. Data Integrity Check (Focus on Method B)
    if rows_b:
        console.print(f"\n[bold]Checking Data Content (Method B - Top 3):[/bold]")
        table_data = Table(show_lines=True)
        table_data.add_column("is_exact")
        table_data.add_column("Key")
        table_data.add_column("Headword")
        table_data.add_column("Components (Decon)")
        table_data.add_column("Grammar Note")
        
        # Chỉ check cột component và gn_grammar xem có dữ liệu không
        for row in rows_b[:3]:
            # Xử lý an toàn cho cột không tồn tại
            comp = row['components'] if 'components' in row.keys() else "N/A"
            gn = row['gn_grammar'] if 'gn_grammar' in row.keys() else "N/A"
            is_exact = row['is_exact'] if 'is_exact' in row.keys() else "N/A"
            
            table_data.add_row(
                str(is_exact),
                row['key'],
                row['headword'] or "",
                str(comp),
                str(gn)
            )
        console.print(table_data)
        
        # Check giả thuyết của bạn
        exact_matches = [r for r in rows_b if r['is_exact'] == 1]
        if len(exact_matches) > 1:
            first_comp = exact_matches[0]['components']
            all_same = all(r['components'] == first_comp for r in exact_matches)
            console.print(f"[dim]ℹ️  Found {len(exact_matches)} exact matches. Components identical? {{'[green]YES[/green]' if all_same else '[red]NO[/red]'}}[/dim]")
    else:
        console.print("[red]Method B found no results for this exact FTS match.[/red]")

    console.print("-" * 50)

def main():
    console = Console()
    db_path = find_db()
    
    if not db_path:
        console.print("[bold red]❌ No Database found![/bold red]")
        return

    console.print(f"[dim]DB: {db_path}[/dim]")
    # conn = get_db_connection(db_path) # Removed shared conn

    # TEST CASES
    # 1. Từ đơn thông thường
    # 2. Từ ghép (Deconstruction) - giả sử 'kāyānamantarena' có trong DB mini hoặc full
    # 3. Một prefix (buddh) để xem sự khác biệt hành vi
    
    test_terms = ["buddha", "buddhassa", "kāyānamantarena", "buddh", "punabbhavoti"]
    
    try:
        for term in test_terms:
            res_a = query_method_a(db_path, term) # Pass db_path
            res_b = query_method_b(db_path, term) # Pass db_path
            print_comparison(console, term, res_a, res_b)
            
    except Exception as e:
        console.print(f"[bold red]Error running test:[/bold red] {e}")
    # finally:
    #     conn.close()

if __name__ == "__main__":
    main()
