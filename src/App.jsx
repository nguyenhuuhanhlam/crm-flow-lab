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

// ---------- Custom node dạng card CRM ----------
function CrmNode({ id, data, selected }) {
  const meta = TYPE_META[data.type]
  return (
    <div className={`crm-node ${selected ? 'selected' : ''}`} style={{ background: meta.bg, borderColor: selected ? meta.color : meta.border }}>
      <Handle type="target" position={Position.Left} />
      <div className="crm-node-head">
        <span className="crm-node-icon">{meta.icon}</span>
        <span className="crm-node-type" style={{ color: meta.color }}>{meta.label}</span>
        {data.hasHidden ? (
          <button className="expand-btn nodrag" title="Mở / thu nhánh liên quan" onClick={(e) => { e.stopPropagation(); data.onExpand(id) }}>＋</button>
        ) : null}
      </div>
      <div className="crm-node-title">{data.title}</div>
      <div className="crm-node-sub">{data.subtitle}</div>
      <div className="crm-node-foot">
        <span className="badge" style={{ color: meta.color, borderColor: meta.border }}>{data.status}</span>
        <span className="crm-node-value">{data.value}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { crm: CrmNode }

let seq = 100
function Flow() {
  const rf = useReactFlow()
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id)))
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState(() => Object.fromEntries(Object.keys(TYPE_META).map(k => [k, true])))
  const [selectedId, setSelectedId] = useState('co-anphat')

  const toFlowNode = useCallback((d, hiddenIds) => ({
    id: d.id, type: 'crm', position: { x: 0, y: 0 },
    hidden: hiddenIds.has(d.id),
    data: { ...d },
  }), [])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const initDone = useRef(false)

  // Khởi tạo + auto-layout lần đầu, khôi phục vị trí đã lưu nếu có
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    const saved = (() => { try { return JSON.parse(localStorage.getItem('crm-node-proto') || 'null') } catch { return null } })()
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    let ns = initialNodesData.map(d => toFlowNode(d, hidden))
    let es = initialEdgesData.map(e => ({ ...e, animated: e.label === 'phụ trách', style: { stroke: '#94a3b8' }, labelStyle: { fontSize: 11, fill: '#64748b' } }))
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

  // Gắn cờ hasHidden + handler expand vào data của từng node
  const decorated = useMemo(() => nodes.map(n => {
    const neighbourHidden = edges.some(e => ((e.source === n.id && collapsedIds.has(e.target)) || (e.target === n.id && collapsedIds.has(e.source))))
    return { ...n, data: { ...n.data, hasHidden: neighbourHidden, onExpand: (id) => expandFrom(id) } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nodes, edges, collapsedIds])

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

  const collapseAll = () => {
    const hidden = new Set(initialNodesData.filter(n => n.collapsed).map(n => n.id))
    setCollapsedIds(hidden)
    setNodes(ns => ns.map(n => ({ ...n, hidden: hidden.has(n.id) })))
  }

  const visibleNodes = useMemo(() => decorated.filter(n => typeFilter[n.data.type] !== false), [decorated, typeFilter])
  const visibleEdges = useMemo(() => edges.filter(e => {
    const s = decorated.find(n => n.id === e.source), t = decorated.find(n => n.id === e.target)
    return s && t && typeFilter[s.data.type] !== false && typeFilter[t.data.type] !== false && !s.hidden && !t.hidden
  }), [edges, decorated, typeFilter])

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
    const d = { id, type, title: `${meta.label} mới`, subtitle: 'Chưa cập nhật', status: 'Mới', value: '', note: '' }
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
    localStorage.setItem('crm-node-proto', JSON.stringify({ nodes: nodes.map(n => ({ id: n.id, position: n.position })), extraNodes, extraEdges }))
    alert('Đã lưu vị trí + node mới vào trình duyệt (localStorage). Tải lại trang sẽ khôi phục.')
  }
  const reset = () => { localStorage.removeItem('crm-node-proto'); location.reload() }

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
    <div className="app">
      <header className="topbar">
        <div>
          <h1>CRM dạng Node — Prototype</h1>
          <p>Kéo thả node • Kéo từ chấm bên phải node này sang chấm bên trái node khác để nối quan hệ • Click node để sửa ở panel phải</p>
        </div>
        <div className="top-actions">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="Tìm khách / deal / ticket…" />
          <button onClick={doSearch}>Tìm</button>
          <button onClick={relayout}>Sắp xếp lại</button>
          <button onClick={collapseAll}>Thu gọn nhánh phụ</button>
          <button onClick={save}>Lưu bố cục</button>
          <button onClick={reset}>Đặt lại mẫu</button>
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
                <li>Bấm nút <b>＋</b> trên node Công Ty Miền Tây để mở nhánh Sao Mai / Minh Khang đang thu gọn.</li>
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
