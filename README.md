# CRM Node Prototype — React Flow

Prototype thử cảm giác dùng cho ý tưởng CRM trình bày dạng node / mindmap.

## Chạy local

```bash
npm install
npm run dev
# mở http://127.0.0.1:5178
```

## Thử gì trong prototype này

- Node là thực thể CRM thật (Công ty / Liên hệ / Deal / Ticket / Việc), mỗi loại 1 màu, node là card có trạng thái + giá trị.
- Canvas là đồ thị quan hệ (không phải cây): 1 Deal nối được nhiều Contact, 1 Contact giới thiệu được Công ty khác, v.v.
- Bấm nút ＋ trên node để mở nhánh đang thu gọn (mô phỏng lazy-load ego-graph theo hop).
- Click node → sửa chi tiết ở panel phải (mẫu UX: canvas nhìn quan hệ, panel nhập liệu).
- Kéo nối 2 node để tạo quan hệ, thêm/xóa node, lọc theo loại, tìm kiếm nhảy tới node.
- "Sắp xếp lại" = auto-layout bằng Dagre; vị trí kéo tay được giữ nguyên cho tới khi bấm nút này.
- "Lưu bố cục" lưu vị trí + node mới vào localStorage.

## Ghi chú kiến trúc (khi làm thật)

- Nodes lấy từ các bảng nghiệp vụ, edges từ 1 bảng relations riêng, vị trí node lưu theo từng board/view.
- API chỉ trả ego-graph quanh node trung tâm (`?center=...&depth=2`), không tải toàn bộ DB lên canvas.
- Stack bản thật đề xuất: React Flow (@xyflow/react) + ELK/Dagre + FastAPI + MySQL/Postgres.
