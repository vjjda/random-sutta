import sqlite3
import os
import re

DB_PATH = "data/dpd/dpd.db"

def inspect_exclamation_stem():
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database not found at {DB_PATH}")
        return

    print(f"🔌 Connecting to {DB_PATH}...")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Tìm các từ có stem bắt đầu bằng '!'
        print("🔍 Searching for stem LIKE '!%' cases...")
        query = """
            SELECT lemma_1, pattern, stem, inflections, inflections_html 
            FROM dpd_headwords 
            WHERE stem LIKE '!%'
            LIMIT 5
        """
        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            print("   ⚠️ No stem LIKE '!%' cases found.")
            return

        for row in rows:
            print("=" * 80)
            print(f"📖 Word:    {row['lemma_1']}")
            print(f"🌱 Stem:    {row['stem']}")
            print(f"🔗 Pattern: {row['pattern']}")
            print(f"🔗 Inflections: {row['inflections']}")
            print("-" * 80)
            print("📝 Inflections HTML Preview:")
            
            html = row['inflections_html'] if row['inflections_html'] else "Empty"
            # Lấy 1000 ký tự đầu và in đẹp
            print(html[:1000] + "..." if len(html) > 1000 else html)
            
            # Phân tích sơ bộ
            if "irregular" in html:
                print("\n💡 Note: HTML mentions 'irregular'")
            
            # Thử trích xuất bảng
            matches = re.findall(r'<td>(.*?)</td>', html)
            if matches:
                print("\n🧪 Extracted table cells (candidates):")
                clean_matches = [re.sub(r'<[^>]+>', '', m) for m in matches[:10]] # Strip tags
                print(f"   {clean_matches}")

    except sqlite3.Error as e:
        print(f"❌ Database Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    inspect_exclamation_stem()
