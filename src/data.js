// Dữ liệu CRM mẫu — mô hình graph: nodes là thực thể CRM thật, edges là quan hệ.
// Trong sản phẩm thật: nodes đến từ các bảng companies/contacts/deals/tickets/tasks,
// edges đến từ 1 bảng relations riêng. Ở prototype này dữ liệu đóng cứng để thử cảm giác dùng.

export const TYPE_META = {
  company: { label: 'Công ty', icon: '🏢', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  contact: { label: 'Liên hệ', icon: '👤', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  deal:    { label: 'Deal',    icon: '💰', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  ticket:  { label: 'Ticket',  icon: '🎫', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  task:    { label: 'Việc',    icon: '✅', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
}

export const initialNodesData = [
  { id: 'co-anphat', type: 'company', title: 'Công Ty Miền Tây', subtitle: 'Khách hàng chính • TP.HCM', status: 'Đang giao dịch', value: 'Doanh thu năm: 4,2 tỷ', note: 'Khách VIP, mua định kỳ hằng quý. Ưu tiên chăm sóc qua chị Bình.' },
  { id: 'ct-binh', type: 'contact', title: 'Trần Thị Bình', subtitle: 'Giám đốc mua hàng', status: 'Người quyết định', value: '0903 111 222', note: 'Thích trao đổi qua Zalo buổi sáng. Là đầu mối chính của Miền Tây.' },
  { id: 'ct-cuong', type: 'contact', title: 'Lê Văn Cường', subtitle: 'Kế toán trưởng', status: 'Người ảnh hưởng', value: '0903 333 444', note: 'Quan tâm điều khoản thanh toán 30 ngày.' },
  { id: 'ct-dung', type: 'contact', title: 'Phạm Quốc Dũng', subtitle: 'Trưởng phòng IT', status: 'Người dùng cuối', value: '0903 555 666', note: 'Phụ trách tích hợp hệ thống.' },
  { id: 'deal-q1', type: 'deal', title: 'Hợp đồng cung cấp Q1/2026', subtitle: 'Giai đoạn: Đàm phán', status: 'Đang mở', value: '850.000.000 ₫', note: 'Xác suất chốt 70%. Chờ duyệt giá từ chị Bình.' },
  { id: 'deal-morong', type: 'deal', title: 'Mở rộng chi nhánh miền Trung', subtitle: 'Giai đoạn: Khảo sát', status: 'Đang mở', value: '1.200.000.000 ₫', note: 'Deal mở rộng, phụ thuộc deal Q1 thành công.' },
  { id: 'tk-giao', type: 'ticket', title: 'Chậm giao lô hàng tháng 9', subtitle: 'Ưu tiên: Cao', status: 'Đang xử lý', value: 'Mở 3 ngày', note: 'Kho báo thiếu xe. Cường đang theo dõi.' },
  { id: 'tk-baogia', type: 'ticket', title: 'Yêu cầu báo giá bổ sung', subtitle: 'Ưu tiên: Trung bình', status: 'Mới', value: 'Mở hôm nay', note: 'Chị Bình yêu cầu báo giá thêm 2 mặt hàng.' },
  { id: 'task-goi', type: 'task', title: 'Gọi chốt điều khoản Deal Q1', subtitle: 'Hạn: 22-10-2026', status: 'Chưa làm', value: 'Giao cho: Sales Hùng', note: 'Gọi chị Bình trước 10h sáng.' },
  { id: 'task-gui', type: 'task', title: 'Gửi báo giá bổ sung', subtitle: 'Hạn: 21-10-2026', status: 'Đang làm', value: 'Giao cho: Sales Hùng', note: 'Đính kèm catalogue mới.' },
  // Nhánh ban đầu bị thu gọn — bấm nút + trên Công Ty Miền Tây / Sao Mai để mở ra
  { id: 'co-saomai', type: 'company', title: 'Chuỗi bán lẻ Sao Mai', subtitle: 'Khách tiềm năng • Hà Nội', status: 'Tiềm năng', value: '28 cửa hàng', note: 'Được chị Bình giới thiệu. Chưa ký hợp đồng.', collapsed: true },
  { id: 'ct-ha', type: 'contact', title: 'Nguyễn Thu Hà', subtitle: 'CEO Sao Mai', status: 'Người quyết định', value: '0912 777 888', note: 'Gặp lần đầu tại hội chợ tháng 8.', collapsed: true },
  { id: 'deal-saomai', type: 'deal', title: 'Deal thử nghiệm 3 cửa hàng', subtitle: 'Giai đoạn: Tiếp cận', status: 'Đang mở', value: '300.000.000 ₫', note: 'Thử nghiệm trước khi nhân rộng 28 cửa hàng.', collapsed: true },
  { id: 'co-minhkhang', type: 'company', title: 'Minh Khang Logistics', subtitle: 'Đối tác vận chuyển', status: 'Đối tác', value: 'Hợp đồng khung 2025-2027', note: 'Đối tác giao hàng chính, liên quan ticket chậm giao.', collapsed: true },
]

export const initialEdgesData = [
  { id: 'e1', source: 'ct-binh', target: 'co-anphat', label: 'làm việc tại' },
  { id: 'e2', source: 'ct-cuong', target: 'co-anphat', label: 'làm việc tại' },
  { id: 'e3', source: 'ct-dung', target: 'co-anphat', label: 'làm việc tại' },
  { id: 'e4', source: 'deal-q1', target: 'co-anphat', label: 'của công ty' },
  { id: 'e5', source: 'ct-binh', target: 'deal-q1', label: 'phụ trách' },
  { id: 'e6', source: 'ct-cuong', target: 'deal-q1', label: 'duyệt thanh toán' },
  { id: 'e7', source: 'deal-morong', target: 'deal-q1', label: 'phụ thuộc' },
  { id: 'e8', source: 'tk-giao', target: 'co-anphat', label: 'của công ty' },
  { id: 'e9', source: 'tk-baogia', target: 'ct-binh', label: 'người yêu cầu' },
  { id: 'e10', source: 'task-goi', target: 'deal-q1', label: 'cho deal' },
  { id: 'e11', source: 'task-gui', target: 'tk-baogia', label: 'xử lý ticket' },
  { id: 'e12', source: 'ct-binh', target: 'co-saomai', label: 'giới thiệu' },
  { id: 'e13', source: 'ct-ha', target: 'co-saomai', label: 'làm việc tại' },
  { id: 'e14', source: 'deal-saomai', target: 'co-saomai', label: 'của công ty' },
  { id: 'e15', source: 'co-minhkhang', target: 'tk-giao', label: 'đơn vị giao hàng' },
]
