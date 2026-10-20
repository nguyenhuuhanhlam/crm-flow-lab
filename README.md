# CRM Node Prototype — React Flow

Prototype thử cảm giác dùng cho ý tưởng CRM trình bày dạng node / mindmap.

## Chạy local

```bash
npm install
npm run dev
# mở http://127.0.0.1:5178
```

## Dữ liệu — mở rộng dần theo giai đoạn

Giai đoạn 1 — 3 loại thực thể:

- **Công ty**: Công Ty Miền Tây (node trung tâm)
- **Bộ môn (phòng ban)**: Ban Giám Đốc, Bộ môn Bê tông & Xi măng, Bộ môn Cơ học Đất, Bộ môn Thép & Vật liệu xây, Bộ môn Hiện trường & Kiểm định — trực thuộc công ty
- **Nhân viên**: 11 người, mỗi người thuộc 1 bộ môn (ban đầu thu gọn trong bộ môn)

Giai đoạn 2 — thêm loại thứ 4:

- **Công việc (được giao)**: 5 công việc mẫu gắn dưới nhân viên phụ trách (quan hệ "giao cho"), có hạn hoàn thành, mức ưu tiên và trạng thái (Chưa bắt đầu / Đang làm / Quá hạn); ban đầu thu gọn theo nhân viên — mở nhân viên ra mới thấy công việc của người đó.

Quan hệ: Bộ môn → trực thuộc → Công ty; Nhân viên → thuộc bộ môn → Bộ môn.

Kiêm nhiệm: nhân viên vẫn là 1 node duy nhất — thêm 1 quan hệ phụ (nét đứt cam, nhãn 'kiêm nhiệm') sang bộ môn kiêm nhiệm, kèm badge 'kiêm nhiệm' trên card. Mẫu: Phạm Quốc Dũng (chính: Bê tông & Xi măng) kiêm Bộ môn Hiện trường & Kiểm định. Thu/mở nhánh chỉ đi theo quan hệ chính.

## Thử gì trong prototype này

- Node là thực thể thật (Công ty / Bộ môn / Nhân viên), mỗi loại 1 màu, node là card có trạng thái + thông tin chính.
- Bấm nút ＋ trên từng bộ môn để mở danh sách nhân viên đang thu gọn (mô phỏng lazy-load ego-graph theo hop).
- Click node → sửa chi tiết ở panel phải (mẫu UX: canvas nhìn quan hệ, panel nhập liệu).
- Kéo nối 2 node để tạo quan hệ, thêm/xóa node, lọc theo loại, tìm kiếm nhảy tới node.
- "Sắp xếp lại" = auto-layout bằng Dagre; vị trí kéo tay được giữ nguyên cho tới khi bấm nút này.
- "Lưu bố cục" lưu vị trí + node mới vào localStorage.

## Ghi chú kiến trúc (khi làm thật)

- Nodes lấy từ các bảng nghiệp vụ, edges từ 1 bảng relations riêng, vị trí node lưu theo từng board/view.
- API chỉ trả ego-graph quanh node trung tâm (`?center=...&depth=2`), không tải toàn bộ DB lên canvas.
- Stack bản thật đề xuất: React Flow (@xyflow/react) + ELK/Dagre + FastAPI + MySQL/Postgres.
