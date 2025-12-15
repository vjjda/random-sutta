# Path: scripts/git_tag_deleter.py

#!/usr/bin/env python
import logging
from typing import List, Tuple
import subprocess

# ==============================================================================
# 🎯 PHẦN CẤU HÌNH (CONSTANTS) - DỄ DÀNG ĐIỀU CHỈNH
# ==============================================================================

# Tiền tố của tags bạn muốn xóa (ví dụ: 'v' sẽ chọn v1.0.0, v2.0.0...).
TAG_PREFIX_TO_DELETE: str = 'v'

# Danh sách các tags CỤ THỂ bạn muốn giữ lại (Mặc định: rỗng).
# Ví dụ: ['v1.0.0', 'v2.0.0']
TAGS_TO_KEEP: List[str] = []

# Tên của remote (thường là 'origin').
REMOTE_NAME: str = 'origin'

# ==============================================================================
# LOGIC & HÀM CHỨC NĂNG
# ==============================================================================

# Thiết lập Logging (Tách biệt theo nguyên tắc)
def setup_logging() -> None:
    """Cấu hình logging cơ bản cho script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)s | %(message)s',
        datefmt='%H:%M:%S'
    )

def get_all_tags() -> List[str]:
    """Lấy danh sách tất cả các tags local."""
    logging.info("Đang lấy danh sách tất cả các tags local...")
    try:
        # Lệnh: git tag -l
        result = subprocess.run(
            ['git', 'tag', '-l'],
            capture_output=True,
            text=True,
            check=True
        )
        # Tách chuỗi output thành list, loại bỏ dòng trống
        tags = [tag.strip() for tag in result.stdout.split('\n') if tag.strip()]
        logging.info(f"✅ Đã tìm thấy {len(tags)} tags.")
        return tags
    except subprocess.CalledProcessError as e:
        logging.error(f"❌ Lỗi khi chạy lệnh git tag -l: {e.stderr.strip()}")
        raise
    except FileNotFoundError:
        logging.error("❌ Lỗi: Không tìm thấy lệnh 'git'. Đảm bảo Git đã được cài đặt và thêm vào PATH.")
        raise

def filter_tags(all_tags: List[str]) -> List[str]:
    """
    Lọc danh sách tags dựa trên cấu hình global (TAG_PREFIX_TO_DELETE, TAGS_TO_KEEP).

    :param all_tags: Danh sách tất cả các tags.
    :return: Danh sách các tags đã lọc cần xóa.
    """
    tags_to_delete = [
        tag for tag in all_tags
        if tag.startswith(TAG_PREFIX_TO_DELETE) and tag not in TAGS_TO_KEEP
    ]

    return tags_to_delete

def delete_tags(tags: List[str]) -> Tuple[int, int]:
    """
    Thực hiện xóa tags trên local và remote dựa trên cấu hình global.

    :param tags: Danh sách các tags cần xóa.
    :return: Tuple (số lượng local đã xóa, số lượng remote đã xóa).
    """
    if not tags:
        logging.warning("⚠️ Không có tags nào được chọn để xóa. Đã dừng.")
        return 0, 0

    local_deleted_count = 0
    remote_deleted_count = 0

    # 1. Xóa Local Tags
    logging.info(f"\n--- BẮT ĐẦU XÓA {len(tags)} LOCAL TAGS ---")
    for tag in tags:
        try:
            # Lệnh: git tag -d <tag>
            subprocess.run(['git', 'tag', '-d', tag], check=True, capture_output=True)
            logging.info(f"  ✅ Local: Đã xóa tag '{tag}'")
            local_deleted_count += 1
        except subprocess.CalledProcessError as e:
            logging.warning(f"  ❌ Local: Không thể xóa tag '{tag}'. Lỗi: {e.stderr.strip()}")

    # 2. Xóa Remote Tags
    logging.info(f"\n--- BẮT ĐẦU XÓA {len(tags)} REMOTE TAGS TRÊN '{REMOTE_NAME}' ---")
    
    # Định dạng cho push delete
    delete_args = [f':refs/tags/{tag}' for tag in tags] 
    
    try:
        # Lệnh: git push <REMOTE_NAME> :refs/tags/<tag1> :refs/tags/<tag2> ...
        command = ['git', 'push', REMOTE_NAME, *delete_args]
        logging.info(f"  Đang thực thi: {' '.join(command)}")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        success_lines = [line for line in result.stdout.split('\n') if 'deleted' in line and '(tag)' in line]
        remote_deleted_count = len(success_lines)
        logging.info(f"  ✅ Remote: Đã gửi yêu cầu xóa thành công. Remote báo cáo {remote_deleted_count} tag đã được xóa.")
    except subprocess.CalledProcessError as e:
        logging.error(f"  ❌ Remote: Lỗi khi xóa tags trên remote '{REMOTE_NAME}'. Lỗi: {e.stderr.strip()}")
        logging.info("  *Lưu ý: Có thể một số tags đã bị xóa trước đó hoặc không tồn tại trên remote.*")

    return local_deleted_count, remote_deleted_count


if __name__ == "__main__":
    setup_logging()

    try:
        # 1. Lấy tất cả tags
        all_tags = get_all_tags()

        # 2. Lọc tags cần xóa
        tags_to_delete = filter_tags(all_tags)

        logging.info(f"\n✅ Đã chọn **{len(tags_to_delete)}** tags để xóa (tiền tố: '{TAG_PREFIX_TO_DELETE}', giữ lại: {TAGS_TO_KEEP if TAGS_TO_KEEP else 'Không có'}).")
        
        # In tối đa 10 tags để xem trước, tránh tràn màn hình
        if tags_to_delete:
            preview = tags_to_delete[:10]
            if len(tags_to_delete) > 10:
                logging.info(f"Danh sách tags sẽ xóa (10/Tổng {len(tags_to_delete)}): {preview}...")
            else:
                logging.info(f"Danh sách tags sẽ xóa: {preview}")

        # 3. Yêu cầu xác nhận
        confirmation = input("\n⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA CÁC TAGS NÀY KHÔNG? (gõ 'YES' để tiếp tục): ")
        if confirmation.upper() != 'YES':
            logging.warning("⚠️ Hủy bỏ thao tác xóa theo yêu cầu của người dùng.")
        else:
            # 4. Thực hiện xóa
            local_count, remote_count = delete_tags(tags_to_delete)
            logging.info(f"\n*** HOÀN THÀNH ***")
            logging.info(f"Tags local đã xóa: {local_count}")
            logging.info(f"Tags remote đã xóa: {remote_count}")

    except Exception as e:
        logging.critical(f"❌ Lỗi nghiêm trọng xảy ra: {e}")