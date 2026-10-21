import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, addEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Button } from '@astryxdesign/core/Button'
import { CommandPalette } from '@astryxdesign/core/CommandPalette'
import { Divider } from '@astryxdesign/core/Divider'
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
import { Building2, Folder, LogOut, Network, Search, ShieldCheck } from 'lucide-react'
import { TYPE_META, initialNodesData, initialEdgesData } from './data'

// ---------- Auto-layout bằng Dagre (hierarchical, trái -> phải) ----------
const NODE_W = 250, NODE_H = 92
function layout(nodes, edges, direction = 'LR') {
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
    <div className={`crm-node ${selected ? 'selected' : ''}`} style={{ background: data.dark ? meta.darkBg : meta.bg, borderColor: selected ? accent : (data.dark ? meta.darkBorder : meta.border) }}>
      <Handle type="target" position={Position.Left} />
      <div className="crm-node-head">
        <span className="crm-node-icon">{meta.icon}</span>
        <span className="crm-node-type" style={{ color: accent }}>{meta.label}</span>
        {data.concurrent ? <span className="badge-concurrent" title={`Kiêm nhiệm: ${data.concurrent}`}>kiêm nhiệm</span> : null}
        {!data.focusMode && (data.hasHidden || data.canCollapse) ? (
          <button className="expand-btn nodrag" title={data.hasHidden ? 'Mở nhánh tại node này' : 'Thu gọn nhánh tại node này'} onClick={(e) => { e.stopPropagation(); data.onToggle(id) }}>{data.hasHidden ? '＋' : '−'}</button>
        ) : null}
      </div>
      <div className="crm-node-title">{data.title}</div>
      <div className="crm-node-sub">{data.subtitle}</div>
      <div className="crm-node-foot">
        <span className="badge" style={{ color: accent, borderColor: data.dark ? meta.darkBorder : meta.border }}>{data.status}</span>
        <span className="crm-node-value">{data.value}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { crm: CrmNode }
// Chuẩn hoá để tìm kiếm không dấu (giống command palette của NSDT)
const norm = (s) => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Icon SVG nhỏ cho các nút ở topbar (chỉ icon cho gọn, nhãn nằm trong tooltip)
const ICONS = {
  search: (<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>),
  layout: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  collapse: (<><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  save: (<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>),
  reset: (<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>),
  chevronRight: (<><polyline points="9 18 15 12 9 6" /></>),
  chevronLeft: (<><polyline points="15 18 9 12 15 6" /></>),
}
function IconBtn({ icon, label, onClick }) {
  return (
    <IconButton label={label} onClick={onClick} variant="ghost"
      icon={<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>} />
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
  const initDone = useRef(false)

  // Khởi tạo + auto-layout lần đầu, khôi phục vị trí đã lưu nếu có
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    const saved = (() => { try { return JSON.parse(localStorage.getItem('crm-node-proto-v5') || 'null') } catch { return null } })()
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    let ns = initialNodesData.map(d => toFlowNode(d, hidden))
    let es = initialEdgesData.map(e => ({ ...e, animated: false, style: e.secondary ? { stroke: '#d97706', strokeWidth: 2, strokeDasharray: '7 5' } : { stroke: '#94a3b8' }, labelStyle: { fontSize: 11, fill: e.secondary ? '#d97706' : '#64748b', fontWeight: e.secondary ? 700 : 400 } }))
    if (saved?.nodes?.length) {
      const pos = Object.fromEntries(saved.nodes.map(n => [n.id, n.position]))
      ns = ns.map(n => pos[n.id] ? { ...n, position: pos[n.id] } : n)
      if (saved.extraNodes) ns = [...ns, ...saved.extraNodes]
      if (saved.extraEdges) es = [...es, ...saved.extraEdges]
    } else {
      ns = layout(ns.filter(n => !n.hidden), es).concat(ns.filter(n => n.hidden).map(n => ({ ...n, position: { x: 60, y: 60 } })))
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

  const focusSet = useMemo(() => (focusId ? computeFocusSet(focusId) : null), [focusId, computeFocusSet])

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
    return { ...n, data: { ...n.data, dark, focusMode: !!focusId, hasHidden: neighbourHidden, canCollapse, onToggle: (id) => toggleNode(id) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, edges, collapsedIds, dark, focusId])

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
      const laid = layout(vis.filter(n => !n.hidden), edges)
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
  }).map(e => ({ ...e, labelStyle: { fontSize: 11, fill: dark ? '#cbd5e1' : '#64748b' } })), [edges, decorated, typeFilter, dark, focusSet])

  const selected = nodes.find(n => n.id === selectedId)

  // ----- Panel phải dạng tabs: Tổng quan / Chi tiết / Hoạt động / Tài liệu -----
  const [panelTab, setPanelTab] = useState('tongquan')
  useEffect(() => { setPanelTab('tongquan') }, [selectedId])

  // ----- Panel phải: thu gọn + kéo ngang đổi độ rộng (lưu localStorage) -----
  const [panelW, setPanelW] = useState(() => { try { return JSON.parse(localStorage.getItem('crm-panel') || '{}').w || 330 } catch { return 330 } })
  const [panelCollapsed, setPanelCollapsed] = useState(() => { try { return !!JSON.parse(localStorage.getItem('crm-panel') || '{}').collapsed } catch { return false } })
  useEffect(() => { localStorage.setItem('crm-panel', JSON.stringify({ w: panelW, collapsed: panelCollapsed })) }, [panelW, panelCollapsed])

  function enterFocus(id) {
    if (!focusId) {
      focusBackup.current = { positions: Object.fromEntries(nodes.map(n => [n.id, n.position])), collapsedIds: new Set(collapsedIds) }
    }
    setFocusId(id); setSelectedId(id); setPanelCollapsed(false)
    const set = computeFocusSet(id)
    setNodes(ns => {
      const sub = ns.filter(n => set.has(n.id)).map(n => ({ ...n, hidden: false }))
      const laid = layout(sub, edges.filter(e => set.has(e.source) && set.has(e.target)))
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

  // Bấm 1 tổ chức ở sidebar: tự tách nhánh đó ra xem chi tiết —
  // mở toàn bộ nhánh (nhân viên + công việc của nhân viên), thu các nhánh tổ chức khác, khung hình vào nhánh
  function openBranch(deptId) {
    let basePositions = null
    if (focusId) {
      const b = focusBackup.current
      if (b) { basePositions = b.positions; focusBackup.current = null }
      setFocusId(null)
    }
    const children = (id) => edges.filter(e => e.target === id && !e.secondary).map(e => e.source)
    const branch = new Set([deptId])
    children(deptId).forEach(e1 => { branch.add(e1); children(e1).forEach(t => branch.add(t)) })
    const next = new Set(nodes.filter(n => n.data.type === 'department' && n.id !== deptId).map(n => n.id))
    setCollapsedIds(next)
    setNodes(ns => ns.map(n => ({
      ...n,
      position: basePositions?.[n.id] ?? n.position,
      hidden: ancestorChain(n.id).some(a => next.has(a)),
    })))
    setSelectedId(deptId); setPanelCollapsed(false)
    setTimeout(() => rf.fitView({ nodes: [...branch].map(id => ({ id })), padding: 0.25, duration: 500 }), 80)
  }

  // Bấm "Sơ đồ quan hệ" ở sidebar: về tổng quan — thu mọi nhánh tổ chức, hiện công ty + các tổ chức
  function resetOverview() {
    let basePositions = null
    if (focusId) {
      const b = focusBackup.current
      if (b) { basePositions = b.positions; focusBackup.current = null }
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

  const onConnect = useCallback((params) => setEdges(es => addEdge({ ...params, label: 'liên quan', style: { stroke: '#94a3b8' } }, es)), [setEdges])

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
    if (focusId === selectedId) { // xóa đúng node đang xem riêng -> thoát focus, khôi phục trạng thái thu/mở
      if (focusBackup.current) { setCollapsedIds(focusBackup.current.collapsedIds); focusBackup.current = null }
      setFocusId(null)
    }
    setNodes(ns => ns.filter(n => n.id !== selectedId))
    setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  const relayout = () => {
    setNodes(ns => {
      const vis = ns.filter(n => !n.hidden)
      const laid = layout(vis, edges)
      const byId = Object.fromEntries(laid.map(n => [n.id, n]))
      return ns.map(n => byId[n.id] ? { ...n, position: byId[n.id].position } : n)
    })
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 60)
  }

  const save = () => {
    const builtin = new Set(initialNodesData.map(n => n.id))
    const extraNodes = nodes.filter(n => !builtin.has(n.id))
    const extraEdges = edges.filter(e => !initialEdgesData.some(x => x.id === e.id))
    localStorage.setItem('crm-node-proto-v5', JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, position: n.position })), extraNodes, extraEdges }))
    alert('Đã lưu vị trí + node mới vào trình duyệt (localStorage). Tải lại trang sẽ khôi phục.')
  }
  const reset = () => { localStorage.removeItem('crm-node-proto-v5'); location.reload() }

  const sideGroups = useMemo(() => ({
    department: nodes.filter(n => n.data.type === 'department'),
    employee: nodes.filter(n => n.data.type === 'employee'),
    task: nodes.filter(n => n.data.type === 'task'),
  }), [nodes])

  // Command palette của Astryx (đúng mẫu Ahri): lệnh + mọi node
  const paletteCommands = useMemo(() => [
    { id: 'cmd-fit', label: 'Xem toàn cảnh sơ đồ' },
    { id: 'cmd-layout', label: 'Sắp xếp lại bố cục' },
    { id: 'cmd-collapse', label: 'Thu gọn nhánh phụ' },
    ...nodes.map(n => ({ id: `node-${n.id}`, label: n.data.title })),
  ], [nodes])
  const paletteSource = useMemo(() => createStaticSource(paletteCommands), [paletteCommands])

  function handlePaletteSelect(id) {
    if (!id) return
    setPaletteOpen(false)
    if (id.startsWith('node-')) jumpToNode(id.slice(5))
    else if (id === 'cmd-fit') rf.fitView({ padding: 0.15, duration: 400 })
    else if (id === 'cmd-layout') relayout()
    else if (id === 'cmd-collapse') collapseAll()
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
        onClick: () => openBranch(n.id),
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
                  label="Tìm kiếm node và lệnh"
                  isLabelHidden
                  size="sm"
                  width={240}
                  startIcon={Search}
                  placeholder="Tìm kiếm node và lệnh…"
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
            {Object.entries(TYPE_META).map(([k, m]) => <Button key={k} size="sm" label={`${m.icon} ${m.label}`} onClick={() => addNode(k)} />)}
            <span className="sep" />
            <span className="toolbar-label">Lọc loại:</span>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <Button key={k} size="sm" variant={typeFilter[k] ? 'primary' : 'secondary'} label={`${m.label} (${counts[k] || 0})`} onClick={() => setTypeFilter(f => ({ ...f, [k]: !f[k] }))} />
            ))}
            <span className="toolbar-spacer" />
            <IconBtn icon="layout" label="Sắp xếp lại" onClick={relayout} />
            <IconBtn icon="collapse" label="Thu gọn nhánh phụ" onClick={collapseAll} />
            <IconBtn icon="save" label="Lưu bố cục" onClick={save} />
            <IconBtn icon="reset" label="Đặt lại mẫu" onClick={reset} />
          </div>

          <div className="main">
        <div className="canvas">
          <ReactFlow
            nodes={visibleNodes} edges={visibleEdges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => { setSelectedId(n.id); setPanelCollapsed(false) }} onNodeDoubleClick={(_, n) => enterFocus(n.id)} onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.8}
            colorMode={dark ? 'dark' : 'light'}
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          {focusId && (
            <div className="focus-banner">
              <span>Đang xem riêng: <b>{nodes.find(n => n.id === focusId)?.data.title}</b> — chỉ hiện node này, các quan hệ trực tiếp và chuỗi cấp trên</span>
              <button onClick={exitFocus}>Thoát xem riêng</button>
            </div>
          )}
          {panelCollapsed && (
            <button className="panel-reopen" onClick={() => setPanelCollapsed(false)} title="Mở panel thông tin" aria-label="Mở panel thông tin">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS.chevronLeft}</svg>
            </button>
          )}
        </div>

        {!panelCollapsed && <div className="panel-resizer" onMouseDown={startResize} title="Kéo để đổi độ rộng panel" />}
        {!panelCollapsed && (
        <aside className="panel" style={{ width: panelW }}>
          <div className="panel-head">
            <span>Thông tin node</span>
            <IconBtn icon="chevronRight" label="Thu gọn panel" onClick={() => setPanelCollapsed(true)} />
          </div>
          {!selected ? (
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
              <div className="panel-type" style={{ color: TYPE_META[selected.data.type].color }}>{TYPE_META[selected.data.type].icon} {TYPE_META[selected.data.type].label}</div>
              <div className="focus-btn-wrap">
                {focusId === selected.id
                  ? <Button variant="destructive" label="✕ Thoát xem riêng" onClick={exitFocus} />
                  : <Button label="◎ Xem riêng node này" onClick={() => enterFocus(selected.id)} />}
              </div>
              <TabList value={panelTab} onChange={setPanelTab} role="tablist" layout="fill" size="sm" hasDivider>
                {[['tongquan', 'Tổng quan'], ['chitiet', 'Chi tiết'], ['hoatdong', 'Hoạt động'], ['tailieu', 'Tài liệu']].map(([k, label]) => (
                  <Tab key={k} value={k} label={label} />
                ))}
              </TabList>

              {panelTab === 'tongquan' && (
                <div>
                  <Stack gap={3}>
                    <TextInput label="Tên / Tiêu đề" value={selected.data.title} onChange={v => updateSelected({ title: v })} />
                    <TextInput label="Dòng phụ" value={selected.data.subtitle} onChange={v => updateSelected({ subtitle: v })} />
                    <TextInput label="Trạng thái" value={selected.data.status} onChange={v => updateSelected({ status: v })} />
                    <TextInput label="Giá trị / Thông tin chính" value={selected.data.value} onChange={v => updateSelected({ value: v })} />
                    <TextArea label="Ghi chú" value={selected.data.note} onChange={v => updateSelected({ note: v })} />
                  </Stack>
                  <div className="panel-rel">
                    <h4>Quan hệ của node này</h4>
                    <Stack gap={1}>
                      {edges.filter(e => e.source === selected.id || e.target === selected.id).map(e => {
                        const otherId = e.source === selected.id ? e.target : e.source
                        const other = nodes.find(n => n.id === otherId)
                        return <Button key={e.id} variant="ghost" size="sm" label={`${e.label || 'liên quan'} → ${other?.data.title || otherId}`} onClick={() => other && setSelectedId(other.id)} />
                      })}
                    </Stack>
                    {edges.every(e => e.source !== selected.id && e.target !== selected.id) && <p className="muted">Chưa có quan hệ nào.</p>}
                  </div>
                  <div className="delete-wrap">
                    <Button variant="destructive" label="Xóa node này" onClick={deleteSelected} />
                  </div>
                </div>
              )}

              {panelTab === 'chitiet' && (
                <dl className="detail-list">
                  {detailRows(selected).map(([k, v]) => (
                    <div key={k} className="detail-row"><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                  <p className="muted">Thuộc tính mở rộng theo loại node — dữ liệu đánh dấu (mẫu) là minh họa, sẽ nối API thật sau.</p>
                </dl>
              )}

              {panelTab === 'hoatdong' && (
                <div className="activity-list">
                  {activityRows(selected).map(([date, text]) => (
                    <div key={date + text} className="activity-row"><span className="activity-date">{date}</span><span>{text}</span></div>
                  ))}
                  <p className="muted">Dòng thời gian hoạt động liên quan đến node này (dữ liệu mẫu).</p>
                </div>
              )}

              {panelTab === 'tailieu' && (
                <div className="doc-list">
                  {docRows(selected).map(([name, meta]) => (
                    <div key={name} className="doc-row"><span className="doc-icon">📄</span><span className="doc-main"><span className="doc-name">{name}</span><span className="doc-meta">{meta}</span></span><Button size="sm" label="Tải" onClick={() => alert('Tài liệu mẫu — chưa nối kho file thật.')} /></div>
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

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        searchSource={paletteSource}
        label="Tìm kiếm node và lệnh"
        onValueChange={handlePaletteSelect}
      />
    </div>
    </Theme>
  )
}

export default function App() {
  return <ReactFlowProvider><Flow /></ReactFlowProvider>
}
