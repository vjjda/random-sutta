import sqlite3
import json
import os

DB_PATH = "data/dpd/dpd.db"

def inspect_template():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    pattern = "āsi aor"
    print(f"🔍 Inspecting template data for pattern: '{pattern}'")
    cursor.execute("SELECT data FROM inflection_templates WHERE pattern = ?", (pattern,))
    row = cursor.fetchone()
    
    if row and row["data"]:
        data = json.loads(row["data"])
        # In hàng đầu tiên chứa suffix
        if len(data) > 1:
            print(f"   Row 1 sample: {data[1]}")
    
    conn.close()

if __name__ == "__main__":
    inspect_template()
