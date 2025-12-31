# Path: scripts/export_inflection_mismatches.py
import sqlite3
import csv
import re
import time
import multiprocessing
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ProcessPoolExecutor, as_completed

# Cấu hình
DB_PATH = Path('data/dpd/dpd.db')
TMP_DIR = Path('tmp')
OUTPUT_FILE = TMP_DIR / 'inflection_mismatches.csv'
BATCH_SIZE = 2500  # Số lượng dòng mỗi process xử lý 1 lần

def setup_environment():
    if not TMP_DIR.exists():
        TMP_DIR.mkdir(parents=True)

def normalize_word(word):
    return word.strip()

def clean_lemma_key(lemma):
    return re.sub(r'\s\d+(\.\d+)?$', '', lemma)

def extract_from_html(html_content):
    """
    Trích xuất từ biến thể từ HTML (Logic Robust v2).
    Hàm này phải độc lập để có thể pickle qua các process.
    """
    if not html_content:
        return set()

    soup = BeautifulSoup(html_content, 'html.parser')
    words = set()

    table = soup.find('table', class_='inflection')
    if not table:
        return words

    BR_MARKER = "###BR###"

    for td in table.find_all('td'):
        for br in td.find_all('br'):
            br.replace_with(BR_MARKER)
        for b in td.find_all('b'):
            b.unwrap()

        text = td.get_text(strip=True)
        text = text.replace(BR_MARKER, " ")
        tokens = text.split()
        
        for token in tokens:
            clean_w = re.sub(r'[^\wāīūṅñṭḍṇḷṃṁĀĪŪṄÑṬḌṆḶṂṀ]', '', token)
            if clean_w:
                words.add(clean_w)
    return words

def process_batch(rows):
    """
    Worker function: Xử lý một lô dữ liệu.
    Input: List of dicts/tuples (NOT sqlite3.Row objects).
    Output: List of mismatched rows.
    """
    mismatches = []
    
    for row in rows:
        # row structure: (id, lemma_1, stem, pattern, inflections, inflections_thai, inflections_html)
        r_id, lemma_1, stem, pattern, inflections, inf_thai, inf_html = row
        
        # --- LỌC BỎ STEM ĐẶC BIỆT ---
        # Bỏ qua nếu stem bắt đầu bằng '!' hoặc '-'
        if stem and (stem.startswith('!') or stem.startswith('-')):
            continue
        
        lemma_clean = clean_lemma_key(lemma_1)

        # 1. Parse CSV
        csv_raw = inflections.split(',')
        set_csv = {normalize_word(w) for w in csv_raw if w.strip()}
        
        # 2. Parse HTML
        set_html = extract_from_html(inf_html)
        
        # 3. Discard lemma
        set_csv.discard(lemma_clean)
        set_html.discard(lemma_clean)

        # 4. Compare
        missing = set_csv - set_html
        extra = set_html - set_csv

        if missing or extra:
            mismatches.append([
                r_id,
                lemma_1,
                stem,
                pattern,
                inflections,
                inf_thai,
                inf_html,
                ", ".join(missing),
                ", ".join(extra)
            ])
            
    return mismatches

def scan_and_export_parallel():
    setup_environment()
    start_time = time.time()
    
    # Xác định số lượng CPU
    max_workers = multiprocessing.cpu_count()
    print(f"🚀 Bắt đầu quét đa luồng trên {max_workers} nhân CPU.")
    print(f"📦 Batch Size: {BATCH_SIZE}")

    try:
        conn = sqlite3.connect(DB_PATH)
        # Không dùng Row factory để dễ convert sang tuple cho multiprocessing
        cursor = conn.cursor()

        # Đếm tổng số dòng để ước lượng (đã lọc điều kiện cơ bản)
        print("⚡ Đang đếm tổng số bản ghi...")
        cursor.execute("SELECT Count(*) FROM dpd_headwords WHERE inflections IS NOT NULL AND inflections != ''")
        total_records = cursor.fetchone()[0]
        print(f"⚡ Tổng cộng: {total_records} dòng cần xử lý (chưa lọc stem).")

        # Query chính
        sql = """
            SELECT id, lemma_1, stem, pattern, inflections, inflections_thai, inflections_html 
            FROM dpd_headwords 
            WHERE inflections IS NOT NULL 
              AND inflections_html IS NOT NULL 
              AND inflections != ''
        """
        cursor.execute(sql)
        
        total_mismatches = 0
        processed_count = 0

        with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'lemma_1', 'stem', 'pattern', 'inflections', 'inflections_thai', 'inflections_html', 'missing_in_html', 'extra_in_html'])

            # Sử dụng ProcessPoolExecutor
            with ProcessPoolExecutor(max_workers=max_workers) as executor:
                futures = []
                
                while True:
                    # Fetch batch từ DB (Main Thread làm việc này rất nhanh)
                    db_rows = cursor.fetchmany(BATCH_SIZE)
                    if not db_rows:
                        break
                    
                    # Submit job cho worker
                    future = executor.submit(process_batch, db_rows)
                    futures.append(future)

                print("⚡ Đã gửi toàn bộ task, đang chờ xử lý...")

                # Thu thập kết quả khi hoàn thành
                for future in as_completed(futures):
                    try:
                        batch_results = future.result()
                        if batch_results:
                            writer.writerows(batch_results)
                            total_mismatches += len(batch_results)
                        
                        processed_count += BATCH_SIZE
                        # Progress log đơn giản
                        if processed_count % (BATCH_SIZE * 4) == 0:
                            percent = min(100, (processed_count / total_records) * 100)
                            print(f"   ... {percent:.1f}% - Đã tìm thấy {total_mismatches} lỗi.")
                            
                    except Exception as e:
                        print(f"❌ Lỗi trong worker: {e}")

        duration = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"✅ HOÀN TẤT SAU {duration:.2f} GIÂY.")
        print(f"   - Tổng số dòng sai lệch: {total_mismatches}")
        print(f"   - File kết quả:          {OUTPUT_FILE}")
        print(f"{'='*60}")

    except sqlite3.Error as e:
        print(f"❌ Lỗi Database: {e}")
    except Exception as e:
        print(f"❌ Lỗi: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    scan_and_export_parallel()