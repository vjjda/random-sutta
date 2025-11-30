# Random Sutta Reader

Một trình đọc kinh điển Phật giáo sơ kỳ (EBT) đơn giản, tập trung vào trải nghiệm đọc ngẫu nhiên (Random) và hỗ trợ chạy offline hoàn toàn. Dữ liệu được lấy từ dự án [Bilara](https://github.com/suttacentral/sc-data) của SuttaCentral.

## 🌟 Tính năng

  * **Random Sutta:** Ngẫu nhiên chọn một bài kinh để đọc.
  * **Bộ lọc sách (Book Filters):** Tùy chọn random trong các bộ Nikaya (DN, MN, SN, AN) hoặc Khuddaka Nikaya (Dhp, Ud, Iti, v.v.).
  * **Song ngữ:** Hiển thị song song Pāli và tiếng Anh (bản dịch của Bhante Sujato).
  * **Chú giải:** Hỗ trợ hiển thị chú giải (comment) dạng popup.
  * **Offline-first:** Chạy trực tiếp trên trình duyệt mà không cần internet hay server backend (sau khi đã build dữ liệu).

## 🛠️ Yêu cầu hệ thống (Cho Developer/Builder)

Để build dữ liệu từ nguồn, bạn cần:

  * Python 3.8 trở lên.
  * Git.
  * Kết nối Internet (để tải dữ liệu từ SuttaCentral).

## 🚀 Hướng dẫn Cài đặt & Build

### 1\. Clone dự án

```bash
git clone https://github.com/vjjda/random-sutta.git
cd random-sutta
```

### 2\. Tải dữ liệu nguồn

Dự án cần 2 nguồn dữ liệu:

1.  **Nội dung kinh (Text & HTML):** Tải từ Bilara Git repo.
2.  **Thông tin Metadata (Tên kinh):** Tải từ SuttaCentral API.

Chạy lần lượt các lệnh sau:

```bash
# Tải nội dung kinh (Pali/English) vào data/bilara
python3 src/sutta_fetcher.py

# Tải tên bài kinh (Metadata) vào data/json
python3 src/api_fetcher.py
```

### 3\. Xử lý dữ liệu (Build)

Bước này sẽ chuyển đổi dữ liệu thô (JSON) thành các file JavaScript tối ưu cho web, lưu tại `web/assets/sutta/`.

```bash
python3 -m src.sutta_processor
```

### 4\. Chạy ứng dụng

Sau khi build xong, toàn bộ ứng dụng nằm trong thư mục `web/`.
Bạn có thể mở trực tiếp file `web/index.html` bằng trình duyệt (Chrome, Firefox, Edge...) để sử dụng.

## 📂 Cấu trúc dự án

  * `src/`: Mã nguồn Python (Tools).
      * `sutta_fetcher.py`: Đồng bộ dữ liệu từ Bilara Git.
      * `api_fetcher.py`: Tải metadata từ API.
      * `sutta_processor/`: Xử lý logic, convert JSON -\> JS Assets.
  * `data/`: Chứa dữ liệu thô (không commit lên Git, được tải về bởi các fetcher).
  * `web/`: Giao diện người dùng (Frontend).
      * `assets/sutta/`: Dữ liệu đã được build (Database của App).
      * `assets/modules/`: Các module JS xử lý logic hiển thị.

## 🤝 Đóng góp

Mọi đóng góp đều được hoan nghênh. Vui lòng tạo Issue hoặc Pull Request trên GitHub.

## 📄 License

Dự án này sử dụng dữ liệu từ SuttaCentral (Creative Commons Zero - CC0).
Mã nguồn của ứng dụng được phát hành dưới giấy phép MIT.