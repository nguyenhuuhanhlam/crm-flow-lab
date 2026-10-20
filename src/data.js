// Dữ liệu mẫu ĐƠN GIẢN — giai đoạn 1 chỉ có 3 loại thực thể:
//   Công ty -> Bộ môn (phòng ban) -> Nhân viên
// Công Ty Miền Tây hoạt động trong lĩnh vực xây dựng — thí nghiệm vật liệu,
// nên các bộ môn là các bộ môn chuyên ngành thí nghiệm.
// Trong sản phẩm thật: nodes đến từ các bảng companies/departments/employees,
// edges đến từ quan hệ trực thuộc (department.company_id, employee.department_id).

export const TYPE_META = {
  company:    { label: 'Công ty', icon: '🏢', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', darkColor: '#60a5fa', darkBg: '#172554', darkBorder: '#1d4ed8' },
  department: { label: 'Bộ môn', icon: '🗂️', color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', darkColor: '#34d399', darkBg: '#022c22', darkBorder: '#047857' },
  employee:   { label: 'Nhân viên', icon: '👤', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', darkColor: '#fbbf24', darkBg: '#451a03', darkBorder: '#b45309' },
}

export const initialNodesData = [
  { id: 'co-mientay', type: 'company', title: 'Công Ty Miền Tây', subtitle: 'Thí nghiệm vật liệu xây dựng', status: 'Đang hoạt động', value: '5 bộ môn • 11 nhân viên', note: 'Công ty chuyên thí nghiệm vật liệu xây dựng. Bấm nút + trên từng bộ môn để xem nhân viên.' },

  { id: 'dept-giamdoc', type: 'department', title: 'Ban Giám Đốc', subtitle: 'Bộ môn trực thuộc công ty', status: 'Đang hoạt động', value: '2 nhân viên', note: 'Điều hành chung toàn công ty.' },
  { id: 'dept-betong', type: 'department', title: 'Bộ môn Bê tông & Xi măng', subtitle: 'Bộ môn trực thuộc công ty', status: 'Đang hoạt động', value: '3 nhân viên', note: 'Thí nghiệm cường độ bê tông, xi măng, cốt liệu.' },
  { id: 'dept-dat', type: 'department', title: 'Bộ môn Cơ học Đất', subtitle: 'Bộ môn trực thuộc công ty', status: 'Đang hoạt động', value: '2 nhân viên', note: 'Thí nghiệm cơ lý đất, đầm chặt, CBR, nền móng.' },
  { id: 'dept-thep', type: 'department', title: 'Bộ môn Thép & Vật liệu xây', subtitle: 'Bộ môn trực thuộc công ty', status: 'Đang hoạt động', value: '2 nhân viên', note: 'Thí nghiệm thép, gạch, đá và vật liệu hoàn thiện.' },
  { id: 'dept-hientruong', type: 'department', title: 'Bộ môn Hiện trường & Kiểm định', subtitle: 'Bộ môn trực thuộc công ty', status: 'Đang hoạt động', value: '2 nhân viên', note: 'Thí nghiệm hiện trường, siêu âm bê tông, kiểm định kết cấu công trình.' },

  // Nhân viên — ban đầu thu gọn theo bộ môn, bấm + trên bộ môn để mở
  { id: 'emp-an', type: 'employee', title: 'Nguyễn Văn An', subtitle: 'Giám đốc', status: 'Đang làm việc', value: 'an@mientay.example', note: 'Người điều hành cao nhất.', collapsed: true },
  { id: 'emp-binh', type: 'employee', title: 'Trần Thị Bình', subtitle: 'Phó giám đốc', status: 'Đang làm việc', value: 'binh@mientay.example', note: 'Phụ trách vận hành hằng ngày.', collapsed: true },
  { id: 'emp-cuong', type: 'employee', title: 'Lê Văn Cường', subtitle: 'Trưởng bộ môn Bê tông & Xi măng', status: 'Đang làm việc', value: 'cuong@mientay.example', note: 'Quản lý bộ môn bê tông & xi măng.', collapsed: true },
  { id: 'emp-dung', type: 'employee', title: 'Phạm Quốc Dũng', subtitle: 'Thí nghiệm viên', status: 'Đang làm việc', value: 'dung@mientay.example', note: '', collapsed: true },
  { id: 'emp-ha', type: 'employee', title: 'Nguyễn Thu Hà', subtitle: 'Thí nghiệm viên', status: 'Đang làm việc', value: 'ha@mientay.example', note: '', collapsed: true },
  { id: 'emp-khoa', type: 'employee', title: 'Võ Minh Khoa', subtitle: 'Trưởng bộ môn Cơ học Đất', status: 'Đang làm việc', value: 'khoa@mientay.example', note: '', collapsed: true },
  { id: 'emp-lan', type: 'employee', title: 'Đặng Ngọc Lan', subtitle: 'Thí nghiệm viên', status: 'Đang làm việc', value: 'lan@mientay.example', note: '', collapsed: true },
  { id: 'emp-minh', type: 'employee', title: 'Bùi Văn Minh', subtitle: 'Trưởng bộ môn Thép & Vật liệu xây', status: 'Đang làm việc', value: 'minh@mientay.example', note: '', collapsed: true },
  { id: 'emp-nam', type: 'employee', title: 'Hoàng Hải Nam', subtitle: 'Thí nghiệm viên', status: 'Đang làm việc', value: 'nam@mientay.example', note: '', collapsed: true },
  { id: 'emp-oanh', type: 'employee', title: 'Lý Kim Oanh', subtitle: 'Trưởng bộ môn Hiện trường & Kiểm định', status: 'Đang làm việc', value: 'oanh@mientay.example', note: '', collapsed: true },
  { id: 'emp-phuc', type: 'employee', title: 'Trịnh Gia Phúc', subtitle: 'Kỹ thuật viên hiện trường', status: 'Đang làm việc', value: 'phuc@mientay.example', note: '', collapsed: true },
]

export const initialEdgesData = [
  { id: 'e1', source: 'dept-giamdoc', target: 'co-mientay', label: 'trực thuộc' },
  { id: 'e2', source: 'dept-betong', target: 'co-mientay', label: 'trực thuộc' },
  { id: 'e3', source: 'dept-dat', target: 'co-mientay', label: 'trực thuộc' },
  { id: 'e4', source: 'dept-thep', target: 'co-mientay', label: 'trực thuộc' },
  { id: 'e5', source: 'dept-hientruong', target: 'co-mientay', label: 'trực thuộc' },
  { id: 'e6', source: 'emp-an', target: 'dept-giamdoc', label: 'thuộc bộ môn' },
  { id: 'e7', source: 'emp-binh', target: 'dept-giamdoc', label: 'thuộc bộ môn' },
  { id: 'e8', source: 'emp-cuong', target: 'dept-betong', label: 'thuộc bộ môn' },
  { id: 'e9', source: 'emp-dung', target: 'dept-betong', label: 'thuộc bộ môn' },
  { id: 'e10', source: 'emp-ha', target: 'dept-betong', label: 'thuộc bộ môn' },
  { id: 'e11', source: 'emp-khoa', target: 'dept-dat', label: 'thuộc bộ môn' },
  { id: 'e12', source: 'emp-lan', target: 'dept-dat', label: 'thuộc bộ môn' },
  { id: 'e13', source: 'emp-minh', target: 'dept-thep', label: 'thuộc bộ môn' },
  { id: 'e14', source: 'emp-nam', target: 'dept-thep', label: 'thuộc bộ môn' },
  { id: 'e15', source: 'emp-oanh', target: 'dept-hientruong', label: 'thuộc bộ môn' },
  { id: 'e16', source: 'emp-phuc', target: 'dept-hientruong', label: 'thuộc bộ môn' },
]
