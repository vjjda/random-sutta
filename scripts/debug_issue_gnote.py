import sqlite3
import json

db_path = "data/dpd/dpd_mini.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

def check_term(term):
    print(f"\n--- Checking term: '{term}' ---")
    
    # 1. Update params
    conn.execute("UPDATE _lookup_params SET term = ?", (term,))
    
    # 2. Get Results
    cursor = conn.execute("SELECT * FROM view_lookup_results")
    rows = cursor.fetchall()
    
    if not rows:
        print("No results found.")
        return

    found_grammar = False
    for row in rows:
        if row['type'] == -2:
            found_grammar = True
            print(f"[FOUND GRAMMAR NOTE]")
            print(f"  Key in DB: '{row['key']}'")
            print(f"  Search Term: '{term}'")
            print(f"  Match? {row['key'] == term}")
            print(f"  Meaning (len): {len(str(row['meaning']))}")
        else:
            print(f"Type {row['type']}: {row['key']}")

check_term("ukkaṭṭhāyaṃ")
check_term("ukkaṭṭhāya") # thử biến thể không có ṃ

conn.close()

