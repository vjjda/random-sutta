import sqlite3
import json
import os

DB_PATH = "data/dpd/dpd_mini.db"

def check_map():
    if not os.path.exists(DB_PATH):
        print(f"❌ Error: Database not found at {DB_PATH}")
        return

    print(f"🔌 Connecting to {DB_PATH}...\n")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Check Table lookups
        print("🔍 Checking 'lookups' table...")
        
        # Count non-null maps
        cursor.execute("SELECT COUNT(*) as count FROM lookups WHERE inflection_map IS NOT NULL")
        count = cursor.fetchone()["count"]
        print(f"   Found {count} rows with inflection_map.")

        if count > 0:
            print("\n🎲 Sample Data:")
            cursor.execute("SELECT key, inflection_map FROM lookups WHERE inflection_map IS NOT NULL LIMIT 5")
            for row in cursor.fetchall():
                print(f"   Key: {row['key']}")
                print(f"   Map: {row['inflection_map']}")
                print("-" * 40)
        else:
            print("   ⚠️ No inflection_map data found in 'lookups'. Something is wrong with the Insert logic.")

        # 2. Check View (if exists)
        print("\n🔍 Checking 'view_lookup_results' (if exists)...")
        try:
            # Fake params to test view
            cursor.execute("DROP TABLE IF EXISTS _lookup_params")
            cursor.execute("CREATE TABLE _lookup_params (term TEXT)")
            cursor.execute("INSERT INTO _lookup_params (term) VALUES ('ka')")

            # Query View
            cursor.execute("SELECT key, target_id, type, inflection_map FROM view_lookup_results")
            rows = cursor.fetchall()
            print(f"   View returned {len(rows)} rows for 'ka'.")
            for row in rows:
                print(f"   - Key: {row['key']} | Type: {row['type']} | Target: {row['target_id']} | Map: {row['inflection_map']}")
                
        except sqlite3.Error as e:
            print(f"   ⚠️ View check failed (View might not exist): {e}")

    except sqlite3.Error as e:
        print(f"❌ Database Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_map()
