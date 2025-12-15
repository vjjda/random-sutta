# Path: scripts/git_tag_deleter.py

#!/usr/bin/env python
import logging
from typing import List, Tuple
import subprocess

# Thiết lập Logging (Tách biệt theo nguyên tắc)
def setup_logging() -> None:
    """Cấu hình logging cơ bản cho script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)s | %(message)s',
        datefmt='%H:%M:%S'
    )

# Hàm chính
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

def filter_tags(all_tags: List[str], prefix: str = 'v', exclude_list: List[str] = None) -> List[str]:
    """
    Lọc danh sách tags dựa trên tiền tố.

    :param all_tags: Danh sách tất cả các tags.
    :param prefix: Tiền tố để lọc (ví dụ: 'v' sẽ chọn 'v1.0.0', 'v2.0.0').
    :param exclude_list: Danh sách các tags CỤ THỂ KHÔNG muốn xóa.
    :return: Danh sách các tags đã lọc.
    """
    if exclude_list is None:
        exclude_list = []

    tags_to_delete = [
        tag for tag in all_tags
        if tag.startswith(prefix) and tag not in exclude_list
    ]

    return tags_to_delete

def delete_tags(tags: List[str], remote: str = 'origin') -> Tuple[int, int]:
    """
    Thực hiện xóa tags trên local và remote.

    :param tags: Danh sách các tags cần xóa.
    :param remote: Tên của remote (mặc định là 'origin').
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
            subprocess.run(['git', 'tag', '-d', tag], check=True, capture_output=True)
            logging.info(f"  ✅ Local: Đã xóa tag '{tag}'")
            local_deleted_count += 1
        except subprocess.CalledProcessError as e:
            logging.warning(f"  ❌ Local: Không thể xóa tag '{tag}'. Lỗi: {e.stderr.strip()}")

    # 2. Xóa Remote Tags
    logging.info(f"\n--- BẮT ĐẦU XÓA {len(tags)} REMOTE TAGS TRÊN '{remote}' ---")
    # Sử dụng lệnh push --delete hàng loạt (có thể hiệu quả hơn)
    delete_args = [f':refs/tags/{tag}' for tag in tags] # Định dạng cho push delete
    try:
        # Lệnh: git push origin --delete <tag1> <tag2> ...
        command = ['git', 'push', remote, *delete_args]
        logging.info(f"  Đang thực thi: {' '.join(command)}")

        # Chạy lệnh
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )

        # Kiểm tra output để xác định số lượng thành công (chỉ là ước tính)
        success_lines = [line for line in result.stdout.split('\n') if 'deleted' in line and '(tag)' in line]
        remote_deleted_count = len(success_lines)
        logging.info(f"  ✅ Remote: Đã gửi yêu cầu xóa thành công. Remote báo cáo {remote_deleted_count} tag đã được xóa.")
        # logging.debug(f"Remote Output:\n{result.stdout}")
    except subprocess.CalledProcessError as e:
        # Nếu có lỗi (ví dụ: không có quyền, remote không tồn tại), nó sẽ bị bắt ở đây
        logging.error(f"  ❌ Remote: Lỗi khi xóa tags trên remote '{remote}'. Lỗi: {e.stderr.strip()}")
        logging.info("  *Lưu ý: Có thể một số tags đã bị xóa trước đó hoặc không tồn tại trên remote.*")

    return local_deleted_count, remote_deleted_count


if __name__ == "__main__":
    setup_logging()

    # --- CẤU HÌNH CỦA BẠN (Tách Biệt Cấu hình) ---
    # Tiền tố của tags bạn muốn xóa (ví dụ: 'v' sẽ chọn v1.0.0, v2.0.0...)
    TAG_PREFIX_TO_DELETE = 'v'

    # Danh sách các tags CỤ THỂ bạn muốn giữ lại (Mặc định: rỗng)
    TAGS_TO_KEEP = ['v1.0.0', 'v2.0.0']

    # Tên của remote (thường là 'origin')
    REMOTE_NAME = 'origin'
    # ---------------------------------------------

    try:
        # 1. Lấy tất cả tags
        all_tags = get_all_tags()

        # 2. Lọc tags cần xóa
        tags_to_delete = filter_tags(all_tags, prefix=TAG_PREFIX_TO_DELETE, exclude_list=TAGS_TO_KEEP)

        logging.info(f"\n✅ Đã chọn **{len(tags_to_delete)}** tags để xóa (tiền tố: '{TAG_PREFIX_TO_DELETE}', giữ lại: {TAGS_TO_KEEP}).")
        logging.info(f"Danh sách tags sẽ xóa: {tags_to_delete}")

        # 3. Yêu cầu xác nhận
        confirmation = input("\n⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA CÁC TAGS NÀY KHÔNG? (gõ 'YES' để tiếp tục): ")
        if confirmation.upper() != 'YES':
            logging.warning("⚠️ Hủy bỏ thao tác xóa theo yêu cầu của người dùng.")
        else:
            # 4. Thực hiện xóa
            local_count, remote_count = delete_tags(tags_to_delete, remote=REMOTE_NAME)
            logging.info(f"\n*** HOÀN THÀNH ***")
            logging.info(f"Tags local đã xóa: {local_count}")
            logging.info(f"Tags remote đã xóa: {remote_count}")

    except Exception as e:
        logging.critical(f"❌ Lỗi nghiêm trọng xảy ra: {e}")