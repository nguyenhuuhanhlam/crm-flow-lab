import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, addEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
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
  initialEdgesData.forEach(e => { (adj[e.source] ||= []).push(e.target); (adj[e.target] ||= []).push(e.source) })
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
        {(data.hasHidden || data.canCollapse) ? (
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

// Icon SVG nhỏ cho các nút ở topbar (chỉ icon cho gọn, nhãn nằm trong tooltip)
const ICONS = {
  search: (<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>),
  layout: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  collapse: (<><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  save: (<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>),
  reset: (<><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>),
}
function IconBtn({ icon, label, onClick }) {
  return (
    <button className="icon-btn" onClick={onClick} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
    </button>
  )
}

let seq = 100
function Flow() {
  const rf = useReactFlow()
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id)))
  const [query, setQuery] = useState('')
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
    const saved = (() => { try { return JSON.parse(localStorage.getItem('crm-node-proto-v3') || 'null') } catch { return null } })()
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    let ns = initialNodesData.map(d => toFlowNode(d, hidden))
    let es = initialEdgesData.map(e => ({ ...e, animated: false, style: { stroke: '#94a3b8' }, labelStyle: { fontSize: 11, fill: '#64748b' } }))
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

  // Gắn cờ hasHidden / canCollapse + handler gạt mở-thu vào data của từng node
  const decorated = useMemo(() => nodes.map(n => {
    const myLevel = n.data.level ?? 1
    let neighbourHidden = false, canCollapse = false
    edges.forEach(e => {
      const other = e.source === n.id ? e.target : e.target === n.id ? e.source : null
      if (!other) return
      if (collapsedIds.has(other)) neighbourHidden = true
      const otherNode = nodes.find(x => x.id === other)
      if (otherNode && !collapsedIds.has(other) && (otherNode.data.level ?? 1) > myLevel) canCollapse = true
    })
    return { ...n, data: { ...n.data, dark, hasHidden: neighbourHidden, canCollapse, onToggle: (id) => toggleNode(id) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, edges, collapsedIds, dark])

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

  const visibleNodes = useMemo(() => decorated.filter(n => typeFilter[n.data.type] !== false), [decorated, typeFilter])
  const visibleEdges = useMemo(() => edges.filter(e => {
    const s = decorated.find(n => n.id === e.source), t = decorated.find(n => n.id === e.target)
    return s && t && typeFilter[s.data.type] !== false && typeFilter[t.data.type] !== false && !s.hidden && !t.hidden
  }).map(e => ({ ...e, labelStyle: { fontSize: 11, fill: dark ? '#cbd5e1' : '#64748b' } })), [edges, decorated, typeFilter, dark])

  const selected = nodes.find(n => n.id === selectedId)

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
    localStorage.setItem('crm-node-proto-v3', JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, position: n.position })), extraNodes, extraEdges }))
    alert('Đã lưu vị trí + node mới vào trình duyệt (localStorage). Tải lại trang sẽ khôi phục.')
  }
  const reset = () => { localStorage.removeItem('crm-node-proto-v3'); location.reload() }

  const doSearch = () => {
    const q = query.trim().toLowerCase(); if (!q) return
    const hit = nodes.find(n => !n.hidden && n.data.title.toLowerCase().includes(q))
    if (hit) { setSelectedId(hit.id); rf.fitView({ nodes: [{ id: hit.id }], padding: 0.6, duration: 500 }) }
    else alert('Không thấy node đang hiển thị nào khớp. Thử mở thêm nhánh bằng nút ＋.')
  }

  const counts = useMemo(() => {
    const c = {}; nodes.forEach(n => { c[n.data.type] = (c[n.data.type] || 0) + 1 }); return c
  }, [nodes])

  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      <header className="topbar">
        <div>
          <h1>CRM dạng Node — Prototype</h1>
          <p>Kéo thả node • Kéo từ chấm bên phải node này sang chấm bên trái node khác để nối quan hệ • Click node để sửa ở panel phải</p>
        </div>
        <div className="top-actions">
          <label className="theme-select">Theme
            <select value={themeMode} onChange={e => setThemeMode(e.target.value)} title="Chọn giao diện sáng / tối">
              <option value="system">Theo hệ thống</option>
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </label>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="Tìm bộ môn / nhân viên…" />
          <IconBtn icon="search" label="Tìm" onClick={doSearch} />
          <IconBtn icon="layout" label="Sắp xếp lại" onClick={relayout} />
          <IconBtn icon="collapse" label="Thu gọn nhánh phụ" onClick={collapseAll} />
          <IconBtn icon="save" label="Lưu bố cục" onClick={save} />
          <IconBtn icon="reset" label="Đặt lại mẫu" onClick={reset} />
        </div>
      </header>

      <div className="toolbar">
        <span className="toolbar-label">Thêm node (nối vào node đang chọn):</span>
        {Object.entries(TYPE_META).map(([k, m]) => <button key={k} onClick={() => addNode(k)}>{m.icon} {m.label}</button>)}
        <span className="sep" />
        <span className="toolbar-label">Lọc loại:</span>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <label key={k} className="chk"><input type="checkbox" checked={!!typeFilter[k]} onChange={e => setTypeFilter(f => ({ ...f, [k]: e.target.checked }))} /> {m.label} ({counts[k] || 0})</label>
        ))}
      </div>

      <div className="main">
        <div className="canvas">
          <ReactFlow
            nodes={visibleNodes} edges={visibleEdges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)} onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.8}
            colorMode={dark ? 'dark' : 'light'}
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        <aside className="panel">
          {!selected ? (
            <div className="panel-empty">
              <h3>Chưa chọn node nào</h3>
              <p>Click vào một node trên canvas để xem và sửa chi tiết tại đây. Đây là mẫu UX khuyến nghị cho CRM dạng graph: canvas để nhìn quan hệ, panel để nhập liệu — không nhồi form lên canvas.</p>
              <h4>Cách thử cảm giác dùng</h4>
              <ol>
                <li>Bấm nút <b>＋</b> trên từng bộ môn để mở danh sách nhân viên đang thu gọn.</li>
                <li>Kéo thả node, cuộn để zoom, kéo nền để pan, xem MiniMap góc trái dưới.</li>
                <li>Kéo nối 2 node để tạo quan hệ mới, chọn edge rồi nhấn Delete để xóa.</li>
                <li>Thêm node mới, sửa tên/trạng thái/ghi chú ở panel này, bấm Lưu bố cục rồi tải lại trang.</li>
              </ol>
            </div>
          ) : (
            <div>
              <div className="panel-type" style={{ color: TYPE_META[selected.data.type].color }}>{TYPE_META[selected.data.type].icon} {TYPE_META[selected.data.type].label}</div>
              <label>Tên / Tiêu đề<input value={selected.data.title} onChange={e => updateSelected({ title: e.target.value })} /></label>
              <label>Dòng phụ<input value={selected.data.subtitle} onChange={e => updateSelected({ subtitle: e.target.value })} /></label>
              <label>Trạng thái<input value={selected.data.status} onChange={e => updateSelected({ status: e.target.value })} /></label>
              <label>Giá trị / Thông tin chính<input value={selected.data.value} onChange={e => updateSelected({ value: e.target.value })} /></label>
              <label>Ghi chú<textarea rows={5} value={selected.data.note} onChange={e => updateSelected({ note: e.target.value })} /></label>
              <div className="panel-rel">
                <h4>Quan hệ của node này</h4>
                {edges.filter(e => e.source === selected.id || e.target === selected.id).map(e => {
                  const otherId = e.source === selected.id ? e.target : e.source
                  const other = nodes.find(n => n.id === otherId)
                  return <button key={e.id} className="rel-item" onClick={() => other && setSelectedId(other.id)}>{e.label || 'liên quan'} → {other?.data.title || otherId}</button>
                })}
                {edges.every(e => e.source !== selected.id && e.target !== selected.id) && <p className="muted">Chưa có quan hệ nào.</p>}
              </div>
              <button className="danger" onClick={deleteSelected}>Xóa node này</button>
            </div>
          )}
        </aside>
      </div>
      <footer className="footer">Prototype thử cảm giác dùng — dữ liệu mẫu hư cấu, lưu cục bộ trong trình duyệt. Stack: React Flow (@xyflow/react) + Dagre auto-layout.</footer>
    </div>
  )
}

export default function App() {
  return <ReactFlowProvider><Flow /></ReactFlowProvider>
}
