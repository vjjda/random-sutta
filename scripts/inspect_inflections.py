import sqlite3
import json
import os
import re

DB_PATH = "data/dpd/dpd.db"

def generate_inflections():
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database not found at {DB_PATH}")
        return

    print(f"🔌 Connecting to {DB_PATH}...\n")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Lấy 3 từ có đầy đủ stem và pattern
        # Cập nhật điều kiện lọc: Stem không bắt đầu bằng '!' hoặc '-'
        print("🎲 Selecting 3 random headwords with valid stem & pattern...")
        query = """
            SELECT lemma_1, stem, pattern 
            FROM dpd_headwords 
            WHERE pattern IS NOT NULL AND pattern != '' 
              AND stem IS NOT NULL AND stem != ''
              AND stem NOT LIKE '!%' 
              AND stem NOT LIKE '-%'
            ORDER BY RANDOM() 
            LIMIT 3
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            print("⚠️ No suitable headwords found.")
            return

        for row in rows:
            lemma = row["lemma_1"]
            stem = row["stem"]
            pattern = row["pattern"]
            
            print("=" * 80)
            print(f"📖 Word:    {lemma}")
            print(f"🌱 Stem:    {stem}")
            print(f"🔗 Pattern: {pattern}")
            print("-" * 80)

            # 2. Lấy Template
            cursor.execute("SELECT data FROM inflection_templates WHERE pattern = ?", (pattern,))
            template_row = cursor.fetchone()

            if not template_row or not template_row["data"]:
                print("⚠️ Template data missing.")
                continue

            try:
                grid = json.loads(template_row["data"])
                
                if grid:
                    headers = []
                    header_row = grid[0]
                    for i, cell in enumerate(header_row):
                        if i % 2 != 0 and cell: 
                            headers.append(cell[0])
                    
                    print(f"{ 'Case':<15} | " + " | ".join([f"{h:<25}" for h in headers]))
                    print("-" * (15 + 28 * len(headers)))

                for row_data in grid[1:]:
                    if not row_data: continue
                    
                    case_name = row_data[0][0] if row_data[0] else ""
                    
                    generated_forms = []
                    
                    # Duyệt bước nhảy 2 để lấy ô Suffix (1, 3, 5...)
                    # Cấu trúc: [Name], [Suffixes 1], [Meta 1], [Suffixes 2], [Meta 2]
                    for i in range(1, len(row_data), 2):
                        suffixes = row_data[i] 
                        # metadata = row_data[i+1] # Đây chính là cái bạn muốn lấy sau này (Meta 1)
                        
                        forms = []
                        for sfx in suffixes:
                            if sfx == "":
                                form = stem
                            else:
                                form = f"{stem}{sfx}"
                            forms.append(form)
                        
                        generated_forms.append(", ".join(forms))
                    
                    print(f"{case_name:<15} | " + " | ".join([f"{f:<25}" for f in generated_forms]))

            except json.JSONDecodeError:
                print(f"❌ JSON Error.")
            except Exception as e:
                print(f"❌ Process Error: {e}")
        
        print("=" * 80)

    except sqlite3.Error as e:
        print(f"❌ Database Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    generate_inflections()
