import sqlite3
import json

db_path = "data/dpd/dpd_mini.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

def check_term(term):
    print(f"\n--- Checking term: '{term}' ---")
    conn.execute("UPDATE _lookup_params SET term = ?", (term,))
    cursor = conn.execute("SELECT * FROM view_lookup_results WHERE type = -2")
    row = cursor.fetchone()
    
    if row:
        print(f"Key: {row['key']}")
        raw_json = row['meaning']
        print(f"Raw JSON: {raw_json}")
        try:
            parsed = json.loads(raw_json)
            print(f"Parsed Type: {type(parsed)}")
            if isinstance(parsed, list) and len(parsed) > 0:
                first_group = parsed[0]
                print(f"First Group Type: {type(first_group)}")
                print(f"First Group Len: {len(first_group)}")
                print(f"First Group Content: {first_group}")
        except Exception as e:
            print(f"JSON Parse Error: {e}")
    else:
        print("No grammar note found (Type -2)")

check_term("ukkaṭṭhāyaṃ")
conn.close()

