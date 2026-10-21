import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, addEdge, reconnectEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { CommandPalette } from '@astryxdesign/core/CommandPalette'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { DropdownMenu, DropdownMenuItem } from '@astryxdesign/core/DropdownMenu'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { SideNav, SideNavHeading } from '@astryxdesign/core/SideNav'
import { Stack } from '@astryxdesign/core/Stack'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { TopNav } from '@astryxdesign/core/TopNav'
import { TreeList } from '@astryxdesign/core/TreeList'
import { createStaticSource } from '@astryxdesign/core/Typeahead'
import { ArrowLeftRight, Building2, ChevronLeft, ChevronRight, ClipboardList, Factory, FileText, Focus, Folder, LayoutGrid, LogOut, Minimize2, Network, RotateCcw, Save, Search, ShieldCheck, Spline, Trash2, User, X } from 'lucide-react'
import { TYPE_META, initialNodesData, initialEdgesData } from './data'

// ---------- Auto-layout bằng Dagre (hierarchical, trái -> phải) ----------
// Chiều mở rộng của cây: 'right' = gốc bên trái, mở sang phải (rankdir RL vì edge đi từ con lên cha);
// 'left' = gốc bên phải, mở sang trái (rankdir LR)
const rankFor = (d) => (d === 'right' ? 'RL' : 'LR')
const NODE_W = 250, NODE_H = 92
function layout(nodes, edges, direction = 'RL') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 28, ranksep: 90 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
  })
}

// Cấp bậc theo khoảng cách từ node gốc (công ty): gốc 0, bộ môn 1, nhân viên 2.
// Dùng để biết node nào là "nhánh dưới" của node nào khi thu gọn tại 1 node.
const LEVELS = (() => {
  const lvl = { 'co-mientay': 0 }
  const adj = {}
  initialEdgesData.filter(e => !e.secondary).forEach(e => { (adj[e.source] ||= []).push(e.target); (adj[e.target] ||= []).push(e.source) })
  const queue = ['co-mientay']
  while (queue.length) {
    const cur = queue.shift()
    for (const nb of adj[cur] || []) if (!(nb in lvl)) { lvl[nb] = lvl[cur] + 1; queue.push(nb) }
  }
  return lvl
})()

// ---------- Custom node dạng card CRM ----------
function CrmNode({ id, data, selected }) {
  const meta = TYPE_META[data.type]
  const accent = data.dark ? meta.darkColor : meta.color
  return (
    <div className={`crm-node crm-node-${data.type} ${selected ? 'selected' : ''}`} style={{ background: data.dark ? meta.darkBg : meta.bg, borderColor: selected ? accent : (data.dark ? meta.darkBorder : meta.border) }}>
      <Handle type="source" id="s-left" position={Position.Left} />
      <Handle type="target" id="t-left" position={Position.Left} />
      <div className="crm-node-head">
        <span className="crm-node-icon">{(() => { const TypeIcon = TYPE_ICONS[data.type]; return <TypeIcon size={15} color={accent} strokeWidth={2.2} /> })()}</span>
        <span className="crm-node-type" style={{ color: accent }}>{meta.label}</span>
        {data.concurrent ? <span className="badge-concurrent" title={`Kiêm nhiệm: ${data.concurrent}`}>kiêm nhiệm</span> : null}
        {!data.focusMode && (data.hasHidden || data.canCollapse) ? (
          <button className="expand-btn nodrag" title={data.hasHidden ? 'Mở nhánh tại node này' : 'Thu gọn nhánh tại node này'} onClick={(e) => { e.stopPropagation(); data.onToggle(id) }}>{data.hasHidden ? '＋' : '−'}</button>
        ) : null}
      </div>
      <div className="crm-node-title" title={data.title}>{data.title}</div>
      <div className="crm-node-sub" title={data.subtitle}>{data.subtitle}</div>
      {data.type === 'employee' ? (
        // Thẻ nhân viên chỉ giữ thông tin cần thiết: bỏ email, trạng thái "Đang làm việc" thu còn 1 ô màu xanh
        // (đã nghỉ việc = ô xám; rê chuột vào ô xem chữ trạng thái). Email vẫn xem đầy đủ ở panel chi tiết.
        <div className="crm-node-foot">
          <span className="status-cell" title={data.status} style={{ background: data.status === 'Đang làm việc' ? '#22c55e' : '#9ca3af' }} />
        </div>
      ) : (
        <div className="crm-node-foot">
          <span className="badge" style={{ color: accent, borderColor: data.dark ? meta.darkBorder : meta.border }}>{data.status}</span>
          <span className="crm-node-value">{data.value}</span>
        </div>
      )}
      <Handle type="source" id="s-right" position={Position.Right} />
      <Handle type="target" id="t-right" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { crm: CrmNode }
// Chuẩn hoá để tìm kiếm không dấu (giống command palette của NSDT)
const norm = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Icon SVG nhỏ cho các nút ở topbar (chỉ icon cho gọn, nhãn nằm trong tooltip)
const ICONS = {
  search: Search,
  layout: LayoutGrid,
  flip: ArrowLeftRight,
  collapse: Minimize2,
  save: Save,
  reset: RotateCcw,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
}
// Icon theo loại node (Lucide) — dùng cho thẻ node, panel và nút Thêm node
const TYPE_ICONS = { company: Factory, department: Building2, employee: User, task: ClipboardList }
function IconBtn({ icon, label, onClick }) {
  return (
    <IconButton label={label} onClick={onClick} variant="ghost"
      icon={<Icon icon={ICONS[icon]} size="sm" />} />
  )
}

let seq = 100
function Flow() {
  const rf = useReactFlow()
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id)))
  // ----- Khung shell đúng mẫu Ahri App (Astryx ShellNav) + command palette -----
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [typeFilter, setTypeFilter] = useState(() => Object.fromEntries(Object.keys(TYPE_META).map(k => [k, true])))
  const [selectedId, setSelectedId] = useState('co-mientay')
  // Theme: 'system' | 'light' | 'dark' — lưu lựa chọn vào localStorage
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('crm-theme') || 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  useEffect(() => { localStorage.setItem('crm-theme', themeMode) }, [themeMode])
  const dark = themeMode === 'dark' || (themeMode === 'system' && systemDark)

  const toFlowNode = useCallback((d, hiddenIds) => ({
    id: d.id, type: 'crm', position: { x: 0, y: 0 },
    hidden: hiddenIds.has(d.id),
    data: { ...d, level: LEVELS[d.id] ?? 1 },
  }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [dir, setDir] = useState(() => { try { return localStorage.getItem('crm-dir') || 'right' } catch { return 'right' } })
  useEffect(() => { try { localStorage.setItem('crm-dir', dir) } catch { /* bỏ qua */ } }, [dir])
  const ROOT_ID = 'co-mientay'
  // ----- Mindmap 2 phía: mỗi nhánh con trực tiếp của Công ty mọc về phía mà line của nó bám vào
  // Công ty (handle t-left -> mọc sang trái, t-right -> sang phải); nhánh chưa tùy chỉnh phía thì
  // theo chiều mặc định `dir`. Toàn bộ subtree (nhân viên, công việc) đi theo phía của nhánh.
  const sideAtRoot = (e, dflt) => (e && e.customHandles && e.targetHandle ? (e.targetHandle === 't-left' ? 'left' : 'right') : dflt)
  const branchRootOf = (nodeId, edgeList) => {
    let cur = nodeId, guard = 0
    while (cur && cur !== ROOT_ID && guard++ < 30) {
      const pe = edgeList.find(e => e.source === cur && !e.secondary)
      if (!pe) return null
      if (pe.target === ROOT_ID) return cur
      cur = pe.target
    }
    return null
  }
  const branchSideOf = (nodeId, edgeList = edges, dflt = dir) => {
    if (nodeId === ROOT_ID) return dflt
    const br = branchRootOf(nodeId, edgeList)
    if (!br) return dflt
    return sideAtRoot(edgeList.find(x => x.source === br && x.target === ROOT_ID && !x.secondary), dflt)
  }
  // Layout mindmap: tách tập node theo phía nhánh, chạy Dagre riêng từng phía
  // (phải: rankdir RL, trái: LR) rồi ghép lại, căn trùng vị trí node Công ty của 2 lượt chạy.
  const layoutMindmap = (list, induced, allEdges, dflt) => {
    const root = list.find(n => n.data.type === 'company')
    if (!root) return layout(list, induced, rankFor(branchSideOf(list[0]?.id, allEdges, dflt)))
    const rightIds = new Set(list.filter(n => n.id === root.id || branchSideOf(n.id, allEdges, dflt) === 'right').map(n => n.id))
    const leftIds = new Set(list.filter(n => n.id === root.id || branchSideOf(n.id, allEdges, dflt) === 'left').map(n => n.id))
    const inSet = (set) => (e) => set.has(e.source) && set.has(e.target)
    const laidR = layout(list.filter(n => rightIds.has(n.id)), induced.filter(inSet(rightIds)), 'RL')
    const laidL = layout(list.filter(n => leftIds.has(n.id)), induced.filter(inSet(leftIds)), 'LR')
    const rPos = laidR.find(n => n.id === root.id)?.position || { x: 0, y: 0 }
    const lPos = laidL.find(n => n.id === root.id)?.position || { x: 0, y: 0 }
    const merged = new Map(laidR.map(n => [n.id, n]))
    laidL.forEach(n => { if (n.id !== root.id) merged.set(n.id, { ...n, position: { x: n.position.x + (rPos.x - lPos.x), y: n.position.y + (rPos.y - lPos.y) } }) })
    return list.map(n => merged.get(n.id) || n)
  }
  const layoutDir = (ns, es, d = dir, allEdges = es) => layoutMindmap(ns, es, allEdges, d)
  const initDone = useRef(false)

  // Chặn xóa bằng phím Delete/Backspace trên canvas đối với node quan trọng (công ty, bộ môn):
  // các node này chỉ xóa được qua panel — bộ môn còn phải gõ xác nhận, công ty thì không bao giờ
  const handleNodesChange = (changes) => {
    const safe = changes.filter(c => {
      if (c.type !== 'remove') return true
      const n = nodes.find(x => x.id === c.id)
      return !n || (n.data.type !== 'company' && n.data.type !== 'department')
    })
    onNodesChange(safe)
  }

  // Khởi tạo + auto-layout lần đầu, khôi phục vị trí đã lưu nếu có
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    const saved = (() => { try { return JSON.parse(localStorage.getItem('crm-node-proto-v6') || 'null') } catch { return null } })()
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    let ns = initialNodesData.map(d => toFlowNode(d, hidden))
    let es = initialEdgesData.map(e => ({ ...e, animated: false, style: e.secondary ? { stroke: '#d97706', strokeWidth: 2, strokeDasharray: '7 5' } : { stroke: '#94a3b8' }, labelStyle: { fontSize: 11, fill: e.secondary ? '#d97706' : '#64748b', fontWeight: e.secondary ? 700 : 400 } }))
    if (saved?.nodes?.length) {
      const pos = Object.fromEntries(saved.nodes.map(n => [n.id, n.position]))
      ns = ns.map(n => pos[n.id] ? { ...n, position: pos[n.id] } : n)
      if (saved.extraNodes) ns = [...ns, ...saved.extraNodes]
      if (saved.extraEdges) es = [...es, ...saved.extraEdges]
    } else {
      ns = layoutDir(ns.filter(n => !n.hidden), es).concat(ns.filter(n => n.hidden).map(n => ({ ...n, position: { x: 60, y: 60 } })))
      // giữ hidden cho các node thu gọn sau layout
      ns = ns.map(n => ({ ...n, hidden: hidden.has(n.id) }))
    }
    setNodes(ns); setEdges(es)
    setTimeout(() => rf.fitView({ padding: 0.15 }), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trạng thái Xem riêng — PHẢI khai báo trước mọi useMemo dùng tới (decorated, visibleNodes...)
  const [focusId, setFocusId] = useState(null)
  const focusBackup = useRef(null)
  // Node bổ sung khi Xem riêng theo NHÁNH (vào từ sidebar tổ chức): công việc của các nhân viên trong nhánh
  const [focusExtra, setFocusExtra] = useState(null)

  // Tập node khi Xem riêng: node + quan hệ trực tiếp + chuỗi cấp trên (đi ngược quan hệ chính)
  const computeFocusSet = useCallback((id) => {
    const s = new Set([id])
    edges.forEach(e => { if (e.source === id) s.add(e.target); if (e.target === id) s.add(e.source) })
    let cur = id
    const chainSeen = new Set([id])
    while (cur) {
      const up = edges.find(e => e.source === cur && !e.secondary)
      if (!up) break
      const parent = up.target
      if (parent === cur || chainSeen.has(parent)) break
      chainSeen.add(parent); s.add(parent)
      if (parent === 'co-mientay') break
      cur = parent
    }
    return s
  }, [edges])

  const focusSet = useMemo(() => {
    if (!focusId) return null
    const s = computeFocusSet(focusId)
    if (focusExtra) focusExtra.forEach(x => s.add(x))
    return s
  }, [focusId, computeFocusSet, focusExtra])

  // Gắn cờ hasHidden / canCollapse + handler gạt mở-thu vào data của từng node
  const decorated = useMemo(() => nodes.map(n => {
    const myLevel = n.data.level ?? 1
    let neighbourHidden = false, canCollapse = false
    edges.forEach(e => {
      const other = e.source === n.id ? e.target : e.target === n.id ? e.source : null
      if (!other) return
      if (collapsedIds.has(other)) neighbourHidden = true
      if (e.secondary) return // quan hệ kiêm nhiệm không quyết định thu/mở nhánh
      const otherNode = nodes.find(x => x.id === other)
      if (otherNode && !collapsedIds.has(other) && (otherNode.data.level ?? 1) > myLevel) canCollapse = true
    })
    return { ...n, deletable: n.data.type !== 'company' && n.data.type !== 'department', data: { ...n.data, dark, flip: dir === 'left', focusMode: !!focusId, hasHidden: neighbourHidden, canCollapse, onToggle: (id) => toggleNode(id) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, edges, collapsedIds, dark, focusId, dir])

  function expandFrom(id) {
    const next = new Set(collapsedIds)
    let changed = false
    edges.forEach(e => {
      const other = e.source === id ? e.target : e.target === id ? e.source : null
      if (other && next.has(other)) { next.delete(other); changed = true }
    })
    if (!changed) return
    setCollapsedIds(next)
    setNodes(ns => {
      const vis = ns.map(n => ({ ...n, hidden: next.has(n.id) }))
      const laid = layoutDir(vis.filter(n => !n.hidden), edges)
      const byId = Object.fromEntries(laid.map(n => [n.id, n]))
      return vis.map(n => byId[n.id] ? { ...n, position: byId[n.id].position } : n)
    })
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 60)
  }

  // Thu gọn tại 1 node: ẩn toàn bộ nhánh dưới của node đó (các node có cấp lớn hơn,
  // nối liên tiếp từ node đó) — node gốc và các nhánh khác không bị ảnh hưởng.
  function collapseFrom(id) {
    const start = nodes.find(n => n.id === id)
    if (!start) return
    const startLevel = start.data.level ?? 1
    const levelOf = (nid) => nodes.find(n => n.id === nid)?.data.level ?? 1
    const toHide = new Set(), visited = new Set([id]), queue = [id]
    while (queue.length) {
      const cur = queue.shift()
      edges.forEach(e => {
        if (e.secondary) return // chỉ thu theo quan hệ chính, đường kiêm nhiệm là nối chéo tham khảo
        const other = e.source === cur ? e.target : e.target === cur ? e.source : null
        if (!other || visited.has(other)) return
        visited.add(other)
        if (levelOf(other) > startLevel) { toHide.add(other); queue.push(other) }
      })
    }
    if (!toHide.size) return
    const next = new Set([...collapsedIds, ...toHide])
    setCollapsedIds(next)
    setNodes(ns => ns.map(n => ({ ...n, hidden: next.has(n.id) })))
    if (selectedId && toHide.has(selectedId)) setSelectedId(id)
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 60)
  }

  function toggleNode(id) {
    const hasHiddenNeighbour = edges.some(e => ((e.source === id && collapsedIds.has(e.target)) || (e.target === id && collapsedIds.has(e.source))))
    if (hasHiddenNeighbour) expandFrom(id); else collapseFrom(id)
  }

  const collapseAll = () => {
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    setCollapsedIds(hidden)
    setNodes(ns => ns.map(n => ({ ...n, hidden: hidden.has(n.id) })))
  }

  const visibleNodes = useMemo(() => {
    if (focusSet) return decorated.filter(n => focusSet.has(n.id)).map(n => ({ ...n, hidden: false }))
    return decorated.filter(n => typeFilter[n.data.type] !== false)
  }, [decorated, typeFilter, focusSet])
  const visibleEdges = useMemo(() => edges.filter(e => {
    if (focusSet) return focusSet.has(e.source) && focusSet.has(e.target)
    const s = decorated.find(n => n.id === e.source), t = decorated.find(n => n.id === e.target)
    return s && t && typeFilter[s.data.type] !== false && typeFilter[t.data.type] !== false && !s.hidden && !t.hidden
  }).map(e => {
    if (e.customHandles && e.sourceHandle && e.targetHandle) return { ...e, label: undefined, reconnectable: true }
    // Phía nối mặc định theo phía mọc của NHÁNH chứa node con (mindmap): con quay mặt về cha, cha quay mặt về con
    const sl = decorated.find(n => n.id === e.source)?.data.level ?? 1
    const tl = decorated.find(n => n.id === e.target)?.data.level ?? 1
    const sourceIsChild = sl >= tl
    const g = branchSideOf(sourceIsChild ? e.source : e.target)
    const childSide = g === 'right' ? 'left' : 'right'
    const parentSide = g === 'right' ? 'right' : 'left'
    return {
      ...e, label: undefined, reconnectable: true,
      sourceHandle: `s-${sourceIsChild ? childSide : parentSide}`,
      targetHandle: `t-${sourceIsChild ? parentSide : childSide}`,
    }
  }), [edges, decorated, typeFilter, focusSet, dir])

  const selected = nodes.find(n => n.id === selectedId)
  const selectedEdge = edges.find(e => e.selected)
  const deleteSelectedEdge = () => { if (selectedEdge) setEdges(es => es.filter(e => e.id !== selectedEdge.id)) }
  // Phím Delete/Backspace xóa line đang chọn: xử lý riêng vì khi click chuột vào line, tiêu điểm
  // rơi vào phần tử SVG nên phím tắt mặc định của React Flow không kích hoạt. Bỏ qua khi đang gõ trong ô nhập.
  useEffect(() => {
    if (!selectedEdge) return undefined
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      deleteSelectedEdge()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedEdge])

  // ----- Panel phải dạng tabs: Tổng quan / Chi tiết / Hoạt động / Tài liệu -----
  const [panelTab, setPanelTab] = useState('tongquan')
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  // Xóa node: công ty (node gốc) không bao giờ xóa; bộ môn phải gõ lại đúng tên trong dialog xác nhận;
  // nhân viên / công việc xóa ngay như cũ
  const requestDelete = () => {
    if (!selected) return
    if (selected.data.type === 'company') return
    if (selected.data.type === 'department') { setDelText(''); setDelOpen(true); return }
    deleteSelected()
  }
  useEffect(() => { setPanelTab('tongquan') }, [selectedId])

  // ----- Panel phải: thu gọn + kéo ngang đổi độ rộng (lưu localStorage) -----
  const [panelW, setPanelW] = useState(() => { try { return JSON.parse(localStorage.getItem('crm-panel') || '{}'  ).w || 440 } catch { return 440 } })
  const [panelCollapsed, setPanelCollapsed] = useState(() => { try { return !!JSON.parse(localStorage.getItem('crm-panel') || '{}').collapsed } catch { return false } })
  useEffect(() => { localStorage.setItem('crm-panel', JSON.stringify({ w: panelW, collapsed: panelCollapsed })) }, [panelW, panelCollapsed])

  function enterFocus(id, branch = false) {
    if (!focusId) {
      focusBackup.current = { positions: Object.fromEntries(nodes.map(n => [n.id, n.position])), collapsedIds: new Set(collapsedIds) }
    }
    // Xem riêng theo nhánh (bấm tổ chức ở sidebar): kèm thêm công việc của từng nhân viên trong nhánh
    const extra = new Set()
    if (branch) {
      const children = (x) => edges.filter(e => e.target === x && !e.secondary).map(e => e.source)
      children(id).forEach(c => children(c).forEach(g => extra.add(g)))
    }
    setFocusExtra(branch ? extra : null)
    setFocusId(id); setSelectedId(id); setPanelCollapsed(false)
    const set = computeFocusSet(id)
    extra.forEach(x => set.add(x))
    setNodes(ns => {
      const sub = ns.filter(n => set.has(n.id)).map(n => ({ ...n, hidden: false }))
      const laid = layoutDir(sub, edges.filter(e => set.has(e.source) && set.has(e.target)))
      const byId = Object.fromEntries(laid.map(n => [n.id, n]))
      return ns.map(n => byId[n.id] ? { ...n, position: byId[n.id].position } : n)
    })
    setTimeout(() => rf.fitView({ padding: 0.2, duration: 400 }), 60)
  }

  function exitFocus() {
    const b = focusBackup.current
    if (b) {
      setCollapsedIds(b.collapsedIds)
      setNodes(ns => ns.map(n => ({ ...n, position: b.positions[n.id] ?? n.position, hidden: b.collapsedIds.has(n.id) })))
      focusBackup.current = null
    }
    setFocusExtra(null)
    setFocusId(null)
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 60)
  }

  // Chuỗi cấp trên của 1 node (đi ngược quan hệ chính)
  function ancestorChain(id) {
    const chain = []
    let cur = id
    const seen = new Set([id])
    while (cur) {
      const e = edges.find(x => x.source === cur && !x.secondary)
      if (!e || seen.has(e.target)) break
      seen.add(e.target); chain.push(e.target); cur = e.target
    }
    return chain
  }

  // Nhảy tới 1 node từ sidebar / command palette: thoát xem riêng nếu đang bật,
  // mở lại các nhánh đang thu trên đường đi, chọn node và đưa vào giữa canvas
  function jumpToNode(id) {
    let baseCollapsed = collapsedIds
    let basePositions = null
    if (focusId) {
      const b = focusBackup.current
      if (b) { baseCollapsed = b.collapsedIds; basePositions = b.positions; focusBackup.current = null }
      setFocusExtra(null)
      setFocusId(null)
    }
    const chain = ancestorChain(id)
    const next = new Set([...baseCollapsed].filter(x => !chain.includes(x)))
    setCollapsedIds(next)
    setNodes(ns => ns.map(n => ({
      ...n,
      position: basePositions?.[n.id] ?? n.position,
      hidden: ancestorChain(n.id).some(a => next.has(a)),
    })))
    setSelectedId(id); setPanelCollapsed(false)
    const target = nodes.find(n => n.id === id)
    const pos = basePositions?.[id] ?? target?.position
    if (pos) setTimeout(() => rf.setCenter(pos.x + 125, pos.y + 45, { zoom: 1.05, duration: 500 }), 80)
  }

  // Bấm "Sơ đồ quan hệ" ở sidebar: về tổng quan — thoát Xem riêng nếu đang bật, thu mọi nhánh tổ chức
  function resetOverview() {
    let basePositions = null
    if (focusId) {
      const b = focusBackup.current
      if (b) { basePositions = b.positions; focusBackup.current = null }
      setFocusExtra(null)
      setFocusId(null)
    }
    const next = new Set(nodes.filter(n => n.data.type === 'department').map(n => n.id))
    setCollapsedIds(next)
    setNodes(ns => ns.map(n => ({
      ...n,
      position: basePositions?.[n.id] ?? n.position,
      hidden: ancestorChain(n.id).some(a => next.has(a)),
    })))
    setSelectedId('co-mientay')
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 500 }), 80)
  }

  const startResize = (e) => {
    e.preventDefault()
    const onMove = (ev) => setPanelW(Math.min(700, Math.max(260, window.innerWidth - ev.clientX)))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  const childrenOf = (id) => edges.filter(e => e.target === id).map(e => nodes.find(n => n.id === e.source)).filter(Boolean)
  const parentOf = (id) => { const e = edges.find(x => x.source === id); return e ? nodes.find(n => n.id === e.target) : null }

  function detailRows(n) {
    const d = n.data
    const code = n.id.replace(/^(co|dept|emp)-/, '').toUpperCase()
    if (d.type === 'company') return [
      ['Mã số thuế', '1801234567 (mẫu)'], ['Lĩnh vực', d.subtitle], ['Trụ sở', 'TP. Cần Thơ (mẫu)'],
      ['Điện thoại', '0292 000 000 (mẫu)'], ['Email', 'info@mientay.example'], ['Website', 'mientay.example'],
      ['Ngày thành lập', '15-03-2012 (mẫu)'], ['Số bộ môn', String(childrenOf(n.id).length)], ['Tổng nhân viên', String(nodes.filter(x => x.data.type === 'employee').length)],
    ]
    if (d.type === 'department') {
      const members = childrenOf(n.id)
      const lead = members.find(m => /Trưởng|Giám đốc/.test(m.data.subtitle))
      return [
        ['Mã bộ môn', `BM-${code}`], ['Trực thuộc', parentOf(n.id)?.data.title || '—'],
        ['Trưởng bộ môn', lead?.data.title || 'Chưa phân công'], ['Số nhân viên', String(members.length)], ['Chức năng', d.note || '—'],
      ]
    }
    if (d.type === 'task') {
      const assignee = parentOf(n.id)
      const dept = assignee ? parentOf(assignee.id) : null
      return [
        ['Mã công việc', `CV-${code}`], ['Nội dung', d.note || '—'], ['Người được giao', assignee?.data.title || '—'],
        ['Thuộc bộ môn', dept?.data.title || '—'], ['Hạn hoàn thành', d.subtitle.replace('Hạn: ', '')], ['Mức ưu tiên', d.value.replace('Ưu tiên: ', '')], ['Trạng thái', d.status],
      ]
    }
    const rows = [
      ['Mã nhân viên', `NV-${code}`], ['Chức vụ', d.subtitle], ['Thuộc bộ môn (chính)', parentOf(n.id)?.data.title || '—'],
      ['Email', d.value || '—'], ['Điện thoại', '0900 000 000 (mẫu)'], ['Ngày vào làm', '04-01-2021 (mẫu)'], ['Trạng thái', d.status],
      ['Công việc được giao', `${childrenOf(n.id).length} công việc`],
    ]
    if (d.concurrent) rows.splice(3, 0, ['Kiêm nhiệm', `Bộ môn ${d.concurrent} — vai trò: Thí nghiệm viên hiện trường, từ 01-09-2026 (mẫu)`])
    return rows
  }

  function activityRows(n) {
    const t = n.data.type
    if (t === 'company') return [['18-10-2026', 'Cập nhật thông tin công ty'], ['02-10-2026', 'Hoàn thành hiệu chuẩn định kỳ thiết bị thí nghiệm'], ['15-09-2026', 'Ký hợp đồng thí nghiệm vật liệu mới']]
    if (t === 'department') return [['17-10-2026', 'Tiếp nhận đợt mẫu thí nghiệm mới'], ['08-10-2026', 'Hoàn thành báo cáo thí nghiệm kỳ trước'], ['28-09-2026', 'Bảo trì thiết bị trong bộ môn']]
    if (t === 'task') return [['19-10-2026', 'Công việc được giao cho nhân viên phụ trách'], ['20-10-2026', 'Cập nhật tiến độ thực hiện'], ['21-10-2026', 'Nhắc hạn hoàn thành']]
    return [['16-10-2026', 'Cập nhật hồ sơ cá nhân'], ['05-10-2026', 'Hoàn thành nhiệm vụ thí nghiệm được giao'], ['20-09-2026', 'Tham gia đào tạo an toàn phòng thí nghiệm']]
  }

  function docRows(n) {
    const t = n.data.type
    if (t === 'company') return [['Giấy chứng nhận đăng ký doanh nghiệp.pdf', 'PDF • 1,2 MB • 10-01-2024'], ['Quyết định công nhận phòng thí nghiệm LAS-XD.pdf', 'PDF • 860 KB • 22-05-2024'], ['Hồ sơ năng lực công ty.pdf', 'PDF • 4,5 MB • 03-02-2026']]
    if (t === 'department') return [['Quy trình thí nghiệm của bộ môn.pdf', 'PDF • 2,1 MB • 14-03-2025'], ['Danh mục thiết bị thí nghiệm.xlsx', 'Excel • 320 KB • 30-08-2026'], ['Sổ tay chất lượng bộ môn.pdf', 'PDF • 1,7 MB • 12-01-2026']]
    if (t === 'task') return [['Phiếu giao việc.pdf', 'PDF • 210 KB • 19-10-2026'], ['Biểu mẫu kết quả thí nghiệm.xlsx', 'Excel • 150 KB • 19-10-2026'], ['Hình ảnh hiện trường.zip', 'ZIP • 8,4 MB • 20-10-2026']]
    return [['Hồ sơ nhân viên.pdf', 'PDF • 940 KB • 04-01-2021'], ['Chứng chỉ thí nghiệm viên.pdf', 'PDF • 410 KB • 18-06-2023'], ['Hợp đồng lao động.pdf', 'PDF • 620 KB • 04-01-2021']]
  }

  const onConnect = useCallback((params) => setEdges(es => addEdge({ ...params, customHandles: true, label: 'liên quan', style: { stroke: '#94a3b8' } }, es)), [setEdges])

  // Kéo đầu line đang nối vào Công ty sang phía đối diện -> nhánh đó đổi phía mọc (mindmap), sắp xếp lại ngay
  const onReconnect = (oldEdge, conn) => {
    const next = reconnectEdge(oldEdge, { ...conn, customHandles: true }, edges)
    setEdges(next)
    if (oldEdge.target === ROOT_ID || conn.target === ROOT_ID) applyLayout(next)
  }
  // Nút trong panel bộ môn: đưa cả nhánh sang phía đối diện của Công ty
  const flipBranch = () => {
    if (!selected || selected.data.type !== 'department') return
    const e = edges.find(x => x.source === selected.id && x.target === ROOT_ID && !x.secondary)
    if (!e) return
    const nextSide = branchSideOf(selected.id) === 'right' ? 'left' : 'right'
    const next = edges.map(x => x.id === e.id ? { ...x, customHandles: true, sourceHandle: nextSide === 'left' ? 's-right' : 's-left', targetHandle: nextSide === 'left' ? 't-left' : 't-right' } : x)
    setEdges(next)
    applyLayout(next)
  }

  const updateSelected = (patch) => {
    setNodes(ns => ns.map(n => n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n))
  }

  const addNode = (type) => {
    const id = `n-${type}-${++seq}`
    const meta = TYPE_META[type]
    const center = selected || nodes[0]
    const pos = center ? { x: center.position.x + 320, y: center.position.y + (Math.random() * 160 - 80) } : { x: 100, y: 100 }
    const d = { id, type, title: `${meta.label} mới`, subtitle: 'Chưa cập nhật', status: 'Mới', value: '', note: '', level: (center?.data.level ?? 0) + 1 }
    setNodes(ns => [...ns, { id, type: 'crm', position: pos, data: d }])
    if (center) setEdges(es => [...es, { id: `e-${id}`, source: center.id, target: id, label: 'liên quan', style: { stroke: '#94a3b8' } }])
    setSelectedId(id)
  }

  const deleteSelected = () => {
    if (!selectedId) return
    if (nodes.find(n => n.id === selectedId)?.data.type === 'company') return // node gốc — không bao giờ xóa
    if (focusId === selectedId) { // xóa đúng node đang xem riêng -> thoát focus, khôi phục trạng thái thu/mở
      if (focusBackup.current) { setCollapsedIds(focusBackup.current.collapsedIds); focusBackup.current = null }
      setFocusId(null)
    }
    setNodes(ns => ns.filter(n => n.id !== selectedId))
    setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  // Sắp xếp lại kiểu mindmap (mỗi nhánh theo phía nối của nó). Đang Xem riêng thì CHỈ sắp xếp
  // trong tập node đang xem, không layout lại toàn đồ thị — tránh các node đang hiện nhảy lung tung.
  // edgeList/d cho phép sắp xếp ngay theo dữ liệu vừa đổi (chưa kịp qua state).
  const applyLayout = (edgeList = edges, d = dir) => {
    if (focusSet) {
      setNodes(ns => {
        const sub = ns.filter(n => focusSet.has(n.id)).map(n => ({ ...n, hidden: false }))
        const laid = layoutDir(sub, edgeList.filter(e => focusSet.has(e.source) && focusSet.has(e.target)), d, edgeList)
        const byId = Object.fromEntries(laid.map(n => [n.id, n]))
        return ns.map(n => byId[n.id] ? { ...n, position: byId[n.id].position } : n)
      })
      setTimeout(() => rf.fitView({ padding: 0.2, duration: 400 }), 60)
      return
    }
    setNodes(ns => {
      const vis = ns.filter(n => !n.hidden)
      const laid = layoutDir(vis, edgeList, d, edgeList)
      const byId = Object.fromEntries(laid.map(n => [n.id, n]))
      return ns.map(n => byId[n.id] ? { ...n, position: byId[n.id].position } : n)
    })
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 60)
  }
  const relayout = () => applyLayout()

  // Đổi chiều MẶC ĐỊNH: chỉ các nhánh chưa được tùy chỉnh phía mới đổi theo; nhánh đã ghim
  // phía bằng nút chuyển nhánh / kéo nối lại thì giữ nguyên phía của nó
  const flipDirection = () => {
    const nd = dir === 'right' ? 'left' : 'right'
    setDir(nd)
    applyLayout(edges, nd)
  }

  const save = () => {
    const builtin = new Set(initialNodesData.map(n => n.id))
    const extraNodes = nodes.filter(n => !builtin.has(n.id))
    const extraEdges = edges.filter(e => !initialEdgesData.some(x => x.id === e.id))
    localStorage.setItem('crm-node-proto-v6', JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, position: n.position })), extraNodes, extraEdges }))
    alert('Đã lưu vị trí + node mới vào trình duyệt (localStorage). Tải lại trang sẽ khôi phục.')
  }
  const reset = () => { localStorage.removeItem('crm-node-proto-v6'); location.reload() }

  const sideGroups = useMemo(() => ({
    department: nodes.filter(n => n.data.type === 'department'),
    employee: nodes.filter(n => n.data.type === 'employee'),
    task: nodes.filter(n => n.data.type === 'task'),
  }), [nodes])

  // Tìm kiếm ở top menu (Astryx CommandPalette): CHỈ tìm tên Nhân viên và tên Công việc
  // (không tìm công ty/bộ môn, không kèm lệnh) — ƯU TIÊN Công việc trước Nhân viên trong kết quả
  const paletteCommands = useMemo(() => [
    ...nodes.filter(n => n.data.type === 'task'),
    ...nodes.filter(n => n.data.type === 'employee'),
  ].map(n => ({ id: `node-${n.id}`, label: n.data.title })), [nodes])
  const paletteSource = useMemo(() => createStaticSource(paletteCommands), [paletteCommands])

  function handlePaletteSelect(id) {
    if (!id) return
    setPaletteOpen(false)
    if (id.startsWith('node-')) jumpToNode(id.slice(5))
  }

  // Cây điều hướng cho TreeList — chỉ còn Tổng quan + Tổ chức (theo yêu cầu: bỏ menu Nhân sự / Công việc;
  // bấm vào 1 tổ chức thì canvas tự tách nhánh của tổ chức đó ra xem chi tiết)
  const treeItems = useMemo(() => [
    {
      id: 'g-overview',
      label: <Text maxLines={1}>Tổng quan</Text>,
      startContent: <Icon icon={Folder} size="xsm" />,
      isExpanded: true,
      children: [
        { id: 'nav-graph', label: <Text maxLines={1}>Sơ đồ quan hệ</Text>, startContent: <Icon icon={Network} size="xsm" />, isSelected: selectedId === 'co-mientay', onClick: () => resetOverview() },
      ],
    },
    {
      id: 'g-dept',
      label: <Text maxLines={1}>Tổ chức</Text>,
      startContent: <Icon icon={Folder} size="xsm" />,
      isExpanded: true,
      children: sideGroups.department.map(n => ({
        id: `n-${n.id}`,
        label: <Text maxLines={1}>{n.data.title}</Text>,
        startContent: <Icon icon={Building2} size="xsm" />,
        isSelected: selectedId === n.id,
        onClick: () => enterFocus(n.id, true),
      })),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sideGroups, selectedId])

  const counts = useMemo(() => {
    const c = {}; nodes.forEach(n => { c[n.data.type] = (c[n.data.type] || 0) + 1 }); return c
  }, [nodes])

  return (
    <Theme theme={neutralTheme} mode={themeMode}>
    <div className={`app ${dark ? 'dark' : ''}`}>
      <AppShell
        contentPadding={4}
        topNav={(
          <TopNav
            label="Thanh menu ứng dụng"
            startContent={(
              <DropdownMenu
                button={{ label: 'Tài khoản', variant: 'ghost', size: 'sm' }}
                hasChevron={false}
                menuWidth={280}
              >
                <DropdownMenuItem
                  label="Quản trị viên"
                  description="admin@mientay.example"
                  icon={<Icon icon={ShieldCheck} size="xsm" />}
                />
                <Divider />
                <DropdownMenuItem label={`Giao diện: Theo hệ thống${themeMode === 'system' ? ' ✓' : ''}`} onClick={() => setThemeMode('system')} />
                <DropdownMenuItem label={`Giao diện: Sáng${themeMode === 'light' ? ' ✓' : ''}`} onClick={() => setThemeMode('light')} />
                <DropdownMenuItem label={`Giao diện: Tối${themeMode === 'dark' ? ' ✓' : ''}`} onClick={() => setThemeMode('dark')} />
                <Divider />
                <DropdownMenuItem
                  label="Đăng xuất"
                  icon={<Icon icon={LogOut} size="xsm" />}
                  onClick={() => {}}
                />
              </DropdownMenu>
            )}
            endContent={(
              <Stack onClick={() => setPaletteOpen(true)}>
                <TextInput
                  label="Tìm nhân viên, công việc"
                  isLabelHidden
                  size="sm"
                  width={240}
                  startIcon={Search}
                  placeholder="Tìm nhân viên, công việc…"
                  value=""
                  onChange={() => {}}
                />
              </Stack>
            )}
          />
        )}
        sideNav={(
          <SideNav
            label="Điều hướng ứng dụng"
            resizable={{ defaultWidth: 240, minWidth: 180, maxWidth: 400 }}
            header={
              <SideNavHeading
                icon={<Network size={18} />}
                heading="CRM Miền Tây"
                superheading="Sơ đồ quan hệ"
              />
            }
          >
            <TreeList items={treeItems} density="compact" />
          </SideNav>
        )}
      >
        <div className="content">
          <div className="toolbar">
            <span className="toolbar-label">Thêm node (nối vào node đang chọn):</span>
            {Object.entries(TYPE_META).map(([k, m]) => <Button key={k} size="sm" label={m.label} icon={<Icon icon={TYPE_ICONS[k]} size="xsm" />} onClick={() => addNode(k)} />)}
            <span className="sep" />
            <span className="toolbar-label">Lọc loại:</span>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <Button key={k} size="sm" variant={typeFilter[k] ? 'primary' : 'secondary'} label={`${m.label} (${counts[k] || 0})`} onClick={() => setTypeFilter(f => ({ ...f, [k]: !f[k] }))} />
            ))}
            <span className="toolbar-spacer" />
            <IconBtn icon="flip" label={dir === 'right' ? 'Đổi chiều: đang mở sang phải, bấm để mở sang trái' : 'Đổi chiều: đang mở sang trái, bấm để mở sang phải'} onClick={flipDirection} />
            <IconBtn icon="layout" label="Sắp xếp lại" onClick={relayout} />
            <IconBtn icon="collapse" label="Thu gọn nhánh phụ" onClick={collapseAll} />
            <IconBtn icon="save" label="Lưu bố cục" onClick={save} />
            <IconBtn icon="reset" label="Đặt lại mẫu" onClick={reset} />
          </div>

          <div className="main">
        <div className="canvas">
          <ReactFlow
            nodes={visibleNodes} edges={visibleEdges}
            onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onReconnect={onReconnect}
            onNodeClick={(_, n) => { setSelectedId(n.id); setPanelCollapsed(false) }} onEdgeClick={() => { setSelectedId(null); setPanelCollapsed(false) }} onNodeDoubleClick={(_, n) => enterFocus(n.id)} onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.8}
            colorMode={dark ? 'dark' : 'light'}
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          {focusId && (
            <div className="focus-banner">
              <span>Đang xem riêng: <b>{nodes.find(n => n.id === focusId)?.data.title}</b> — chỉ hiện nhánh này cùng các quan hệ trực tiếp và chuỗi cấp trên</span>
              <button onClick={exitFocus}>Thoát xem riêng</button>
            </div>
          )}
          {panelCollapsed && (
            <div className="panel-reopen">
              <IconBtn icon="chevronLeft" label="Mở panel thông tin" onClick={() => setPanelCollapsed(false)} />
            </div>
          )}
        </div>

        {!panelCollapsed && <div className="panel-resizer" onMouseDown={startResize} title="Kéo để đổi độ rộng panel" />}
        {!panelCollapsed && (
        <aside className="panel" style={{ width: panelW }}>
          <div className="panel-head">
            <span>{selectedEdge ? 'Thông tin line' : 'Thông tin node'}</span>
            <IconBtn icon="chevronRight" label="Thu gọn panel" onClick={() => setPanelCollapsed(true)} />
          </div>
          {selectedEdge ? (
            <div style={{ marginTop: 12 }}>
              <div className="panel-type" style={{ color: '#94a3b8' }}><Spline size={14} /> Line kết nối</div>
              <Stack gap={3} style={{ marginTop: 12 }}>
                <Text>{nodes.find(n => n.id === selectedEdge.source)?.data.title} → {nodes.find(n => n.id === selectedEdge.target)?.data.title}</Text>
                {selectedEdge.secondary && <p className="muted">Quan hệ kiêm nhiệm (đường nét đứt).</p>}
                <div className="delete-wrap">
                  <Button variant="destructive" label="Xóa line này" icon={<Icon icon={Trash2} size="xsm" />} onClick={deleteSelectedEdge} />
                </div>
                <p className="muted">Mẹo: cũng có thể nhấn phím Delete khi line đang được chọn.</p>
              </Stack>
            </div>
          ) : !selected ? (
            <div className="panel-empty">
              <h3>Chưa chọn node nào</h3>
              <p>Click vào một node trên canvas để xem và sửa chi tiết tại đây. Đây là mẫu UX khuyến nghị cho CRM dạng graph: canvas để nhìn quan hệ, panel để nhập liệu — không nhồi form lên canvas.</p>
              <h4>Cách thử cảm giác dùng</h4>
              <ol>
                <li>Bấm nút <b>＋</b> trên từng bộ môn để mở danh sách nhân viên đang thu gọn.</li>
                <li><b>Nhấp đúp</b> vào 1 node (hoặc nút "Xem riêng node này" trong panel) để chỉ xem node đó và các quan hệ trực tiếp của nó.</li>
                <li>Kéo thả node, cuộn để zoom, kéo nền để pan, xem MiniMap góc trái dưới.</li>
                <li>Kéo nối 2 node để tạo quan hệ mới, chọn edge rồi nhấn Delete để xóa.</li>
                <li>Thêm node mới, sửa tên/trạng thái/ghi chú ở panel này, bấm Lưu bố cục rồi tải lại trang.</li>
              </ol>
            </div>
          ) : (
            <div>
              <div className="panel-type" style={{ color: TYPE_META[selected.data.type].color }}>{(() => { const TypeIcon = TYPE_ICONS[selected.data.type]; return <TypeIcon size={14} /> })()} {TYPE_META[selected.data.type].label}</div>
              <div className="focus-btn-wrap">
                {focusId === selected.id
                  ? <Button variant="destructive" label="Thoát xem riêng" icon={<Icon icon={X} size="xsm" />} onClick={exitFocus} />
                  : <Button label="Xem riêng node này" icon={<Icon icon={Focus} size="xsm" />} onClick={() => enterFocus(selected.id)} />}
              </div>
              {selected.data.type === 'department' && (
                <div className="focus-btn-wrap" style={{ marginTop: 8 }}>
                  <Button variant="secondary" label={branchSideOf(selected.id) === 'right' ? 'Đưa nhánh sang trái' : 'Đưa nhánh sang phải'} icon={<Icon icon={ArrowLeftRight} size="xsm" />} onClick={flipBranch} />
                </div>
              )}
              <TabList value={panelTab} onChange={setPanelTab} hasDivider>
                {[['tongquan', 'Tổng quan'], ['chitiet', 'Chi tiết'], ['hoatdong', 'Hoạt động'], ['tailieu', 'Tài liệu']].map(([k, label]) => (
                  <Tab key={k} value={k} label={label} panelId={`paneltab-${k}`} />
                ))}
              </TabList>

              {panelTab === 'tongquan' && (
                <div role="tabpanel" id="paneltab-tongquan">
                  <Stack gap={3}>
                    <TextInput label="Tên / Tiêu đề" value={selected.data.title} onChange={v => updateSelected({ title: v })} />
                    <TextInput label="Dòng phụ" value={selected.data.subtitle} onChange={v => updateSelected({ subtitle: v })} />
                    <TextInput label="Trạng thái" value={selected.data.status} onChange={v => updateSelected({ status: v })} />
                    <TextInput label="Giá trị / Thông tin chính" value={selected.data.value} onChange={v => updateSelected({ value: v })} />
                    <TextArea label="Ghi chú" value={selected.data.note} onChange={v => updateSelected({ note: v })} />
                  </Stack>
                  <div className="delete-wrap">
                    {selected.data.type === 'company'
                      ? <p className="muted">Node gốc (công ty) — không thể xóa.</p>
                      : <Button variant="destructive" label="Xóa node này" onClick={requestDelete} />}
                  </div>
                </div>
              )}

              {panelTab === 'chitiet' && (
                <dl className="detail-list" role="tabpanel" id="paneltab-chitiet">
                  {detailRows(selected).map(([k, v]) => (
                    <div key={k} className="detail-row"><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                  <p className="muted">Thuộc tính mở rộng theo loại node — dữ liệu đánh dấu (mẫu) là minh họa, sẽ nối API thật sau.</p>
                </dl>
              )}

              {panelTab === 'hoatdong' && (
                <div className="activity-list" role="tabpanel" id="paneltab-hoatdong">
                  {activityRows(selected).map(([date, text]) => (
                    <div key={date + text} className="activity-row"><span className="activity-date">{date}</span><span>{text}</span></div>
                  ))}
                  <p className="muted">Dòng thời gian hoạt động liên quan đến node này (dữ liệu mẫu).</p>
                </div>
              )}

              {panelTab === 'tailieu' && (
                <div className="doc-list" role="tabpanel" id="paneltab-tailieu">
                  {docRows(selected).map(([name, meta]) => (
                    <div key={name} className="doc-row"><span className="doc-icon"><FileText size={17} /></span><span className="doc-main"><span className="doc-name">{name}</span><span className="doc-meta">{meta}</span></span><Button size="sm" label="Tải" onClick={() => alert('Tài liệu mẫu — chưa nối kho file thật.')} /></div>
                  ))}
                  <p className="muted">Tài liệu đính kèm theo node (dữ liệu mẫu).</p>
                </div>
              )}
            </div>
          )}
        </aside>
        )}
          </div>
        </div>
      </AppShell>

      {/* Xóa bộ môn rất nguy hiểm: bắt buộc gõ lại đúng tên bộ môn mới cho xóa (mẫu NSDT) */}
      <Dialog isOpen={delOpen} onOpenChange={(o) => { if (!o) setDelOpen(false) }} width={480}>
        <DialogHeader title={<Heading level={4}>Xóa bộ môn</Heading>} onOpenChange={() => setDelOpen(false)} />
        <div style={{ padding: 16 }}>
          <Stack gap={3}>
            <Text>
              Hành động này sẽ xóa vĩnh viễn &ldquo;{selected?.data.title}&rdquo; cùng các quan hệ của nó và không thể hoàn tác.
              Để xác nhận, hãy gõ lại đúng tên bộ môn vào ô bên dưới.
            </Text>
            <TextInput label="Gõ lại tên bộ môn" value={delText} onChange={setDelText} placeholder={selected?.data.title} hasAutoFocus width="100%" />
            <HStack gap={2} justify="end">
              <Button variant="ghost" label="Hủy" onClick={() => setDelOpen(false)} />
              <Button variant="destructive" label="Xóa" isDisabled={delText.trim() !== (selected?.data.title ?? '')} onClick={() => { setDelOpen(false); deleteSelected() }} />
            </HStack>
          </Stack>
        </div>
      </Dialog>

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        searchSource={paletteSource}
        label="Tìm nhân viên, công việc"
        onValueChange={handlePaletteSelect}
      />
    </div>
    </Theme>
  )
}

export default function App() {
  return <ReactFlowProvider><Flow /></ReactFlowProvider>
}
