"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ReactFlow, Handle, Position, getBezierPath, applyNodeChanges, applyEdgeChanges, useNodesInitialized, useReactFlow,
  type Node, type Edge, type NodeProps, type EdgeProps, type Connection,
  type ReactFlowInstance, type NodeChange, type EdgeChange,
} from "@xyflow/react";
import { PanelRightClose, PanelRightOpen, Settings2 } from "lucide-react";
import "@xyflow/react/dist/style.css";

export type WorkflowKind = "trigger" | "agent" | "integration" | "knowledge" | "review" | "delivery";
export interface WorkflowAction extends Record<string, unknown> {
  label: string;
  detail: string;
  kind: WorkflowKind;
  tool?: string;
  /** Optional tool mark; it is decorative beside the text label. */
  logo?: string;
  /** Live or switched off: an off step is drawn dimmed, with dashed links. */
  status?: "live" | "off";
  /** When set (and the host passes onNodeConfigure), the node shows a configure button. */
  configKey?: string;
}
export interface WorkflowApp {
  id: string;
  name: string;
  logo?: string;
  actions: WorkflowAction[];
}
export type WorkflowNode = Node<WorkflowAction, "blueprint">;
export interface WorkflowGraph { nodes: WorkflowNode[]; edges: Edge[] }
export interface WorkflowBlueprintProps {
  /** Initial graph. Change the component's key to load a different document. */
  initialGraph: WorkflowGraph;
  apps: WorkflowApp[];
  title?: string;
  /** Small caption under the title. */
  eyebrow?: string;
  /** Replaces the plain title text (e.g. an inline rename control). Keep it one line. */
  titleSlot?: ReactNode;
  className?: string;
  style?: CSSProperties;
  animated?: boolean;
  /** Fill the parent's height: the canvas grows and the step tools scroll. */
  fill?: boolean;
  /** Whether the connection stack starts expanded. */
  defaultStackOpen?: boolean;
  onStackOpenChange?: (open: boolean) => void;
  /** Starting content for the Add agent button. The step can be edited in the demo. */
  agentTemplate?: WorkflowAction;
  /** Fires after edits and node moves. Persistence belongs to the host app. */
  onChange?: (graph: WorkflowGraph) => void;
  /** "compact" draws one-line nodes (name, kind, tool) without the description. */
  nodeSize?: "full" | "compact";
  /** Called with a node's configKey when its configure button is pressed. */
  onNodeConfigure?: (configKey: string) => void;
  /** Title of the side panel. */
  stackTitle?: string;
  /** Host content at the top of the side panel, above the "add to canvas" groups. */
  stackTop?: ReactNode;
  /** Extra tiles for the collapsed side strip, shown before the app tiles. */
  stackMarks?: { id: string; label: string; title: string; active?: boolean; onClick: () => void }[];
  /** Expanded side panel width in px (default 256). */
  stackWidth?: number;
  /** Drawn over the canvas column (e.g. an editor drawer); the side panel stays visible. */
  overlay?: ReactNode;
}

const NodeUi = createContext<{ compact: boolean; onConfigure?: (configKey: string) => void }>({ compact: false });

const labels: Record<WorkflowKind, string> = {
  trigger: "Trigger", agent: "AI agent", integration: "Integration", knowledge: "Knowledge", review: "Review", delivery: "Delivery",
};
const glyphs: Record<WorkflowKind, string> = {
  trigger: "M13 3 5 13h5l-1 8 9-12h-5z",
  agent: "M12 3l2.2 5.5L20 10l-5.8 1.5L12 17l-2.2-5.5L4 10l5.8-1.5z",
  integration: "M10.5 13.5a3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1 1 M13.5 10.5a3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1-1",
  knowledge: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19 M9 7h6 M9 10.5h4",
  review: "M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7z M9 12l2 2 4-5",
  delivery: "M5 12h12M13 6l6 6-6 6",
};

function BrandMark({ src, fallback }: { src?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element -- tiny decorative marks from arbitrary hosts
  return src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : fallback;
}

function BlueprintNode({ data, selected }: NodeProps<WorkflowNode>) {
  const { compact, onConfigure } = useContext(NodeUi);
  const configKey = data.configKey;
  return <div className="wb-node" data-kind={data.kind} data-selected={selected} data-compact={compact} data-status={data.status}>
    <Handle type="target" position={Position.Left} aria-label={`Input for ${data.label}`} />
    <div className="wb-node-head">
      <span className="wb-glyph"><BrandMark key={data.logo} src={data.logo} fallback={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[data.kind]} /></svg>} /></span>
      <div className="wb-node-title"><strong>{data.status === "live" && <i className="wb-live" aria-hidden="true" />}{data.label}</strong><small>{labels[data.kind]}{compact && data.tool ? ` · ${data.tool}` : ""}</small></div>
      {configKey && onConfigure && <button type="button" className="wb-node-cfg nodrag nopan" onClick={event => { event.stopPropagation(); onConfigure(configKey); }} aria-label={`Configure ${data.label}`} title="Configure"><Settings2 aria-hidden="true" /></button>}
    </div>
    {!compact && <div className="wb-node-body"><p>{data.detail}</p>{data.tool && <span>{data.tool}</span>}</div>}
    <Handle type="source" position={Position.Right} aria-label={`Output for ${data.label}`} />
  </div>;
}

function BlueprintEdge(props: EdgeProps) {
  const gradient = `wb-${useId().replace(/:/g, "")}`;
  const [path] = getBezierPath(props);
  return <>
    <defs><linearGradient id={gradient}><stop stopColor="var(--wb-primary)" /><stop offset="1" stopColor="var(--wb-secondary)" /></linearGradient></defs>
    <path d={path} className="wb-edge-halo" />
    <path d={path} className="wb-edge" style={{ stroke: `url(#${gradient})` }} />
    <path d={path} className="wb-edge-pulse" />
  </>;
}
const nodeTypes = { blueprint: BlueprintNode };
const edgeTypes = { blueprint: BlueprintEdge };

function InitialViewport({ width, height }: { width: number; height: number }) {
  const ready = useNodesInitialized();
  const flow = useReactFlow();
  const previous = useRef("");
  useEffect(() => {
    const size = `${Math.round(width)}x${Math.round(height)}`;
    if (!ready || !width || previous.current === size) return;
    // React Flow measures its own pane in a ResizeObserver too. Wait for that
    // measurement before fitting, otherwise a resized canvas uses stale bounds.
    let nextFrame = 0;
    const frame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => {
        previous.current = size;
        if (width < 600) void flow.setViewport({ x: 24, y: 20, zoom: 0.9 });
        else void flow.fitView({ padding: 0.08, maxZoom: 1 });
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(nextFrame); };
  }, [ready, width, height, flow]);
  return null;
}

/** Reject duplicate links, self-links and cycles for both handle and form connections. */
function canConnect(connection: Pick<Connection, "source" | "target">, graph: WorkflowGraph) {
  const { source, target } = connection;
  if (!source || !target || source === target || !graph.nodes.some(n => n.id === source) || !graph.nodes.some(n => n.id === target)) return false;
  if (graph.edges.some(e => e.source === source && e.target === target)) return false;
  const visited = new Set<string>();
  const reachesSource = (id: string): boolean => {
    if (id === source) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return graph.edges.filter(e => e.source === id).some(e => reachesSource(e.target));
  };
  return !reachesSource(target);
}

function normalizeGraph(graph: WorkflowGraph): WorkflowGraph {
  const ids = new Set(graph.nodes.map(n => n.id));
  return {
    nodes: graph.nodes.map(n => ({ ...n, type: "blueprint", ariaLabel: `${n.data.label}. ${labels[n.data.kind]}. ${n.data.detail}`, data: { ...n.data } })),
    edges: graph.edges.filter(e => ids.has(e.source) && ids.has(e.target)).map(e => ({ ...e, type: "blueprint", ariaLabel: `Connection from ${graph.nodes.find(n => n.id === e.source)?.data.label} to ${graph.nodes.find(n => n.id === e.target)?.data.label}` })),
  };
}

export default function WorkflowBlueprint({ initialGraph, apps, title = "Workflow editor", eyebrow = "Build canvas", titleSlot, className = "", style, animated = true, fill = false, defaultStackOpen = true, onStackOpenChange, agentTemplate, onChange, nodeSize = "full", onNodeConfigure, stackTitle = "Connection stack", stackTop, stackMarks = [], stackWidth, overlay }: WorkflowBlueprintProps) {
  const [graph, setGraph] = useState(() => normalizeGraph(initialGraph));
  const [selected, setSelected] = useState(initialGraph.nodes[0]?.id ?? "");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<WorkflowGraph[]>([]);
  const [flow, setFlow] = useState<ReactFlowInstance<WorkflowNode> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [motionPaused, setMotionPaused] = useState(false);
  const [stackOpen, setStackOpenState] = useState(defaultStackOpen);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; label: string; detail: string; tool: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance<WorkflowNode> | null>(null);
  const editLabelRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLSelectElement>(null);
  const initialRef = useRef(normalizeGraph(initialGraph));
  const sequence = useRef(0);
  const uid = useId().replace(/:/g, "");
  const changed = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const width = size.width;

  const setStackOpen = (open: boolean) => {
    setStackOpenState(open);
    onStackOpenChange?.(open);
  };
  /** From the collapsed strip: expand the stack and open that app's actions. */
  const openApp = (appId: string) => {
    setStackOpen(true);
    requestAnimationFrame(() => {
      const details = document.getElementById(`${uid}-app-${appId}`) as HTMLDetailsElement | null;
      if (!details) return;
      details.open = true;
      details.querySelector("summary")?.focus();
    });
  };

  useEffect(() => {
    if (changed.current) onChangeRef.current?.(graph);
  }, [graph]);
  const editingId = editing?.id;
  useEffect(() => {
    if (editingId) editLabelRef.current?.focus();
  }, [editingId]);
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const commit = (next: WorkflowGraph, announcement: string) => {
    setHistory(h => [...h.slice(-19), graph]);
    changed.current = true;
    setGraph(normalizeGraph(next));
    setMessage(announcement);
  };
  const connect = (connection: Pick<Connection, "source" | "target">) => {
    if (!canConnect(connection, graph)) { setMessage("Choose two different nodes without an existing link or a cycle."); return; }
    commit({ ...graph, edges: [...graph.edges, { id: `${uid}-edge-${++sequence.current}`, ...connection, type: "blueprint" }] }, "Connection added.");
  };
  const add = (action: WorkflowAction, editNow = false) => {
    if (graph.nodes.length >= 20) { setMessage("This canvas supports up to 20 nodes. Remove a node before adding another."); return; }
    const after = graph.nodes.find(n => n.id === selected);
    const id = `${uid}-node-${++sequence.current}`;
    const position = { x: after ? after.position.x + 260 : 30, y: after ? after.position.y : 80 };
    while (graph.nodes.some(n => Math.abs(n.position.x - position.x) < 212 && Math.abs(n.position.y - position.y) < 184)) position.y += 194;
    const node: WorkflowNode = { id, type: "blueprint", position, data: { ...action }, selected: true };
    const outgoing = graph.edges.filter(e => e.source === after?.id);
    let edges = graph.edges;
    // A single successor can be preserved when inserting. Branches are never silently rewired.
    if (after) {
      if (outgoing.length === 1) edges = edges.map(e => e.id === outgoing[0].id ? { ...e, source: id } : e);
      edges = [...edges, { id: `${uid}-edge-${++sequence.current}`, source: after.id, target: id, type: "blueprint" }];
    }
    commit({ nodes: [...graph.nodes.map(n => ({ ...n, selected: false })), node], edges }, `${action.label} added${after ? ` after ${after.data.label}` : ""}.`);
    setSelected(id);
    setEditing(editNow ? { id, label: action.label, detail: action.detail, tool: action.tool ?? "" } : null);
    void flow?.setCenter(position.x + 98, position.y + 84, { zoom: width < 600 ? 0.9 : 1 });
  };
  const remove = () => {
    const node = graph.nodes.find(n => n.id === selected);
    if (!node) return;
    const incoming = graph.edges.filter(edge => edge.target === selected);
    const outgoing = graph.edges.filter(edge => edge.source === selected);
    const remaining = { nodes: graph.nodes.filter(n => n.id !== selected), edges: graph.edges.filter(e => e.source !== selected && e.target !== selected) };
    const bridge = incoming.length === 1 && outgoing.length === 1 ? { source: incoming[0].source, target: outgoing[0].target } : null;
    const reconnect = bridge && canConnect(bridge, remaining);
    if (reconnect) remaining.edges.push({ id: `${uid}-edge-${++sequence.current}`, ...bridge, type: "blueprint" });
    commit(remaining, reconnect ? `${node.data.label} removed. The surrounding steps remain connected.` : `${node.data.label} and its connections removed.`);
    setSelected("");
    setEditing(null);
    selectedRef.current?.focus();
  };
  const onNodesChange = useCallback((changes: NodeChange<WorkflowNode>[]) => {
    // React Flow also reports measuring and selection as changes: only real edits count as a draft.
    if (changes.some(change => change.type === "position" || change.type === "remove" || change.type === "add" || change.type === "replace")) changed.current = true;
    setGraph(g => {
      const viewport = flowRef.current?.getViewport();
      const canvas = canvasRef.current?.getBoundingClientRect();
      const boundedChanges = changes.map(change => {
        if (change.type !== "position" || !change.position || !viewport || !canvas) return change;
        const node = g.nodes.find(item => item.id === change.id);
        if (!node) return change;
        const inset = 4;
        const minX = (inset - viewport.x) / viewport.zoom;
        const minY = (inset - viewport.y) / viewport.zoom;
        const maxX = (canvas.width - inset - viewport.x) / viewport.zoom - (node.measured?.width ?? 196);
        const maxY = (canvas.height - inset - viewport.y) / viewport.zoom - (node.measured?.height ?? 166);
        return { ...change, position: {
          x: Math.max(minX, Math.min(change.position.x, Math.max(minX, maxX))),
          y: Math.max(minY, Math.min(change.position.y, Math.max(minY, maxY))),
        } };
      });
      return { ...g, nodes: applyNodeChanges(boundedChanges, g.nodes) };
    });
    const selection = changes.find(c => c.type === "select" && c.selected);
    if (selection && "id" in selection) setSelected(selection.id);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(change => change.type !== "select")) changed.current = true;
    setGraph(g => ({ ...g, edges: applyEdgeChanges(changes, g.edges) }));
  }, []);
  const focusNode = (id: string) => {
    setSelected(id);
    setEditing(null);
    setGraph(g => ({ ...g, nodes: g.nodes.map(n => ({ ...n, selected: n.id === id })) }));
    const node = graph.nodes.find(n => n.id === id);
    if (node) void flow?.setCenter(node.position.x + 98, node.position.y + 84, { zoom: 1 });
  };
  const editSelected = () => {
    const node = graph.nodes.find(item => item.id === selected);
    if (node) setEditing({ id: node.id, label: node.data.label, detail: node.data.detail, tool: node.data.tool ?? "" });
  };
  const saveStep = () => {
    if (!editing || !editing.label.trim()) return;
    const name = editing.label.trim();
    commit({ ...graph, nodes: graph.nodes.map(node => node.id === editing.id
      ? { ...node, data: { ...node.data, label: name, detail: editing.detail.trim(), tool: editing.tool.trim() || undefined } }
      : node) }, `${name} updated.`);
    setEditing(null);
    editButtonRef.current?.focus();
  };
  const download = () => {
    const clean = { nodes: graph.nodes.map(({ id, position, data }) => ({ id, type: "blueprint", position, data })), edges: graph.edges.map(({ id, source, target }) => ({ id, source, target, type: "blueprint" })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "workflow.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Workflow downloaded as JSON. No live integrations are connected.");
  };
  const hasSelection = graph.nodes.some(n => n.id === selected);

  const rootStyle = stackWidth ? { ...style, "--wb-stack-open-w": `${stackWidth}px` } as CSSProperties : style;
  return <NodeUi.Provider value={{ compact: nodeSize === "compact", onConfigure: onNodeConfigure }}><section className={`wb-root ${className}`} style={rootStyle} aria-label={title} data-animated={animated && !motionPaused} data-fill={fill} data-stack={stackOpen ? "open" : "closed"}>
    <style>{styles}</style>
    <header className="wb-header">
      <span className="wb-mark" aria-hidden="true">+</span>
      <div className="wb-heading">{titleSlot ? <div className="wb-title-slot">{titleSlot}</div> : <h2>{title}</h2>}<span>{eyebrow}</span></div>
      <div className="wb-header-actions">
        <button type="button" onClick={() => add({ ...agentTemplate, label: agentTemplate?.label ?? "New AI agent", detail: agentTemplate?.detail ?? "Describe what this agent does.", kind: "agent" }, true)} disabled={graph.nodes.length >= 20}>+ Add agent</button>
        <button type="button" onClick={() => { const previous = history.at(-1); if (previous) { changed.current = true; setGraph(previous); setHistory(h => h.slice(0, -1)); setSelected(""); setEditing(null); setMessage("Last edit undone."); } }} disabled={!history.length}>Undo</button>
        <button type="button" className="wb-primary" onClick={download}>Export JSON <span aria-hidden="true">↗</span></button>
      </div>
    </header>
    <div className="wb-workspace">
      <div className="wb-canvas-column">
        <div className="wb-canvas" ref={canvasRef}>
          <ReactFlow<WorkflowNode> nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onInit={instance => { flowRef.current = instance; setFlow(instance); }} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={connect}
            isValidConnection={connection => canConnect(connection, graph)}
            onNodeClick={(_, node) => { setSelected(node.id); setEditing(null); }}
            nodesFocusable edgesFocusable disableKeyboardA11y={false}
            minZoom={0.3} maxZoom={1.5} zoomOnScroll={false} zoomOnDoubleClick={false} autoPanOnNodeDrag={false} preventScrolling={false}
            deleteKeyCode={null} snapToGrid snapGrid={[10, 10]} aria-label={`${title} diagram`}
            proOptions={{ hideAttribution: true }}
            >
            <InitialViewport width={size.width} height={size.height} />
          </ReactFlow>
          {!graph.nodes.length && <p className="wb-empty">Add an action from the connection stack to begin.</p>}
          <div className="wb-tools" role="group" aria-label="Canvas controls">
            <button type="button" aria-label="Zoom out" onClick={() => void flow?.zoomOut()}>−</button>
            <button type="button" onClick={() => void flow?.fitView({ padding: 0.08, maxZoom: 1 })}>Fit all</button>
            <button type="button" aria-label="Zoom in" onClick={() => void flow?.zoomIn()}>+</button>
            {animated && <button type="button" onClick={() => setMotionPaused(p => !p)} aria-pressed={motionPaused}>{motionPaused ? "Resume motion" : "Pause motion"}</button>}
          </div>
          <p className="wb-message" role="status" aria-live="polite" data-empty={!message}>{message}</p>
        </div>
        <div className="wb-status"><span><i aria-hidden="true" /> {graph.nodes.length} nodes · {graph.edges.length} connections</span><span>Draft · not connected to live services</span></div>
        <details className="wb-editor" open={toolsOpen || Boolean(editing)} onToggle={event => setToolsOpen(event.currentTarget.open)}>
          <summary>Step tools<small>edit, connect, keyboard help</small></summary>
          <div className="wb-editor-body">
            <div className="wb-edit-row"><label htmlFor={`${uid}-selected`}>Insert after / selected node</label><select ref={selectedRef} id={`${uid}-selected`} value={hasSelection ? selected : ""} onChange={e => focusNode(e.target.value)}><option value="">Unconnected new node</option>{graph.nodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select><button ref={editButtonRef} type="button" onClick={editSelected} disabled={!hasSelection}>Edit step</button><button type="button" onClick={remove} disabled={!hasSelection}>Remove selected</button></div>
            {editing && <form className="wb-step-form" onSubmit={event => { event.preventDefault(); saveStep(); }}>
              <label>Step name<input ref={editLabelRef} required maxLength={60} value={editing.label} onChange={event => setEditing({ ...editing, label: event.target.value })} /></label>
              <label>What it does<textarea maxLength={160} rows={2} value={editing.detail} onChange={event => setEditing({ ...editing, detail: event.target.value })} /></label>
              <label>Tool (optional)<input maxLength={40} value={editing.tool} onChange={event => setEditing({ ...editing, tool: event.target.value })} /></label>
              <div><button type="submit" className="wb-primary">Save step</button><button type="button" onClick={() => { setEditing(null); editButtonRef.current?.focus(); }}>Cancel</button></div>
            </form>}
            <form className="wb-connect" onSubmit={e => { e.preventDefault(); connect({ source, target }); }}>
              <label>From<select value={source} onChange={e => setSource(e.target.value)}><option value="">Choose source</option>{graph.nodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>
              <span aria-hidden="true">→</span>
              <label>To<select value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose destination</option>{graph.nodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>
              <button type="submit" disabled={!source || !target}>Connect nodes</button>
            </form>
            <details className="wb-details"><summary>Connections ({graph.edges.length}) and keyboard help</summary><p>Tab to a node, press Enter to select it, then use the arrow keys to move it. Drag between ports or use the connection form. Removing a step reconnects its neighbors when there is one incoming and one outgoing connection; branches must be connected manually. Undo restores the last addition, removal or connection.</p>{graph.edges.length ? <ul>{graph.edges.map(edge => <li key={edge.id}><span>{graph.nodes.find(n => n.id === edge.source)?.data.label} → {graph.nodes.find(n => n.id === edge.target)?.data.label}</span><button type="button" aria-label={`Remove connection from ${graph.nodes.find(n => n.id === edge.source)?.data.label} to ${graph.nodes.find(n => n.id === edge.target)?.data.label}`} onClick={() => commit({ ...graph, edges: graph.edges.filter(e => e.id !== edge.id) }, "Connection removed.")}>Remove</button></li>)}</ul> : <p>No connections yet.</p>}</details>
            <button type="button" className="wb-reset" onClick={() => { commit(normalizeGraph(initialRef.current), "Initial workflow restored. Undo can recover your changes."); setSelected(initialRef.current.nodes[0]?.id ?? ""); setEditing(null); }}>Start fresh</button>
          </div>
        </details>
      </div>
      <aside className="wb-stack" id={`${uid}-stack`} aria-label="Connection stack">
        {stackOpen ? <div className="wb-stack-inner">
          <div className="wb-stack-heading"><h3>{stackTitle}</h3><button type="button" className="wb-icon" onClick={() => setStackOpen(false)} aria-label={`Collapse ${stackTitle.toLowerCase()}`} title="Collapse"><PanelRightClose aria-hidden="true" /></button></div>
          {stackTop ? <>{stackTop}<p className="wb-stack-label">Add to canvas</p></> : <p>Pick an action to add it after the selected node.</p>}
          {apps.map((app, index) => <details key={app.id} id={`${uid}-app-${app.id}`} open={!stackTop && index === 0} className="wb-app">
            <summary><span className="wb-app-mark" aria-hidden="true"><BrandMark key={app.logo} src={app.logo} fallback={app.name.slice(0, 1)} /></span><strong>{app.name}</strong><small>{app.actions.length}</small></summary>
            <div className="wb-actions">{app.actions.map((action, i) => <button key={`${app.id}-${i}`} type="button" onClick={() => add({ ...action, logo: action.logo ?? app.logo })} disabled={graph.nodes.length >= 20} aria-label={`Add ${action.label} from ${app.name}`}><span>{action.label}<small>{labels[action.kind]}</small></span><b aria-hidden="true">+</b></button>)}</div>
          </details>)}
        </div> : <div className="wb-stack-rail">
          <button type="button" className="wb-icon" onClick={() => setStackOpen(true)} aria-label={`Expand ${stackTitle.toLowerCase()}`} title={`Expand ${stackTitle.toLowerCase()}`}><PanelRightOpen aria-hidden="true" /></button>
          <span className="wb-rail-label" aria-hidden="true">Stack</span>
          {stackMarks.map(mark => <button key={mark.id} type="button" className="wb-rail-app" data-active={mark.active} onClick={mark.onClick} aria-label={mark.title} title={mark.title}>{mark.label}</button>)}
          {stackMarks.length ? <span className="wb-rail-sep" aria-hidden="true" /> : null}
          {apps.map(app => <button key={app.id} type="button" className="wb-rail-app" onClick={() => openApp(app.id)} aria-label={`Show ${app.name} actions`} title={app.name}><BrandMark key={app.logo} src={app.logo} fallback={app.name.slice(0, 1)} /></button>)}
        </div>}
      </aside>
      {overlay ? <div className="wb-overlay">{overlay}</div> : null}
    </div>
  </section></NodeUi.Provider>;
}

const styles = String.raw`
.wb-root{--wb-bg:var(--color-background,var(--background,Canvas));--wb-fg:var(--color-foreground,var(--foreground,CanvasText));--wb-card:var(--color-card,var(--card,Canvas));--wb-muted:var(--color-muted-foreground,var(--muted-foreground,GrayText));--wb-border:var(--color-border,var(--border,GrayText));--wb-primary:var(--color-primary,var(--primary,Highlight));--wb-on-primary:var(--color-primary-foreground,var(--primary-foreground,HighlightText));--wb-secondary:var(--color-chart-2,var(--chart-2,var(--wb-primary)));--wb-tertiary:var(--color-chart-3,var(--chart-3,var(--wb-primary)));width:100%;min-width:0;border:1px solid var(--wb-border);border-radius:16px;overflow:hidden;background:var(--wb-bg);color:var(--wb-fg);font-size:14px;line-height:1.5;font-family:inherit;container-type:inline-size;box-sizing:border-box;text-align:left;isolation:isolate}
.wb-root{--wb-stack-w:var(--wb-stack-open-w,256px)}.wb-root[data-stack=closed]{--wb-stack-w:52px}.wb-root{position:relative}
.wb-root[data-fill=true]{height:100%;display:flex;flex-direction:column}
.wb-root *{box-sizing:border-box}:where(.wb-root) button:not(:where(.wb-overlay *)),:where(.wb-root) select:not(:where(.wb-overlay *)){font:inherit;color:inherit}:where(.wb-root) button:not(:where(.wb-overlay *)){cursor:pointer}:where(.wb-root) button:not(:where(.wb-overlay *)):disabled{opacity:.45;cursor:not-allowed}:where(.wb-root) button:not(:where(.wb-overlay *)),:where(.wb-root) select:not(:where(.wb-overlay *)){border:1px solid var(--wb-border);border-radius:8px;background:var(--wb-card);min-height:36px;padding:7px 12px;transition:background-color .15s ease,border-color .15s ease}:where(.wb-root) button:not(:where(.wb-overlay *)):hover:enabled{background:color-mix(in srgb,var(--wb-primary) 12%,var(--wb-card))}:where(.wb-root) :is(button,select,summary):not(:where(.wb-overlay *)):focus-visible{outline:2px solid var(--wb-primary);outline-offset:2px}.wb-root .wb-primary{background:var(--wb-primary);color:var(--wb-on-primary);border-color:var(--wb-primary)}.wb-root .wb-primary:hover:enabled{background:var(--wb-primary);filter:brightness(1.08)}
.wb-root .wb-icon{display:inline-grid;place-items:center;width:36px;min-width:36px;padding:0;color:var(--wb-muted)}.wb-root .wb-icon:hover:enabled{color:var(--wb-fg)}.wb-icon svg{width:16px;height:16px}
.wb-header{display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-bottom:1px solid var(--wb-border);background:var(--wb-card);flex:none}.wb-mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:var(--wb-primary);color:var(--wb-on-primary);font:22px/1 system-ui;flex:none}.wb-heading{flex:1;min-width:0}.wb-heading h2{font-size:14px;line-height:1.25;font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wb-heading>span{font:10px/1.7 ui-monospace,monospace;letter-spacing:.13em;text-transform:uppercase;color:var(--wb-muted)}.wb-root .wb-title-slot button{border:0;background:none;min-height:0;padding:0;border-radius:6px}.wb-root .wb-title-slot button:hover:enabled{background:none}.wb-title-slot{min-width:0}.wb-header-actions{display:flex;gap:6px;font-size:12px;flex-wrap:wrap;justify-content:flex-end}.wb-header-actions span{margin-left:6px}
.wb-workspace{display:grid;grid-template-columns:minmax(0,1fr) var(--wb-stack-w);transition:grid-template-columns .22s cubic-bezier(.2,.8,.2,1)}.wb-root[data-fill=true] .wb-workspace{flex:1;min-height:0}
.wb-canvas-column{min-width:0;display:flex;flex-direction:column;min-height:0}
.wb-canvas{position:relative;height:460px;background-image:radial-gradient(color-mix(in srgb,var(--wb-muted) 30%,transparent) 1px,transparent 1px),radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--wb-primary) 9%,transparent),transparent 68%);background-size:18px 18px,100% 100%}.wb-root[data-fill=true] .wb-canvas{height:auto;flex:1;min-height:300px}
.wb-root .react-flow{background:transparent;--xy-edge-stroke:var(--wb-primary);--xy-connectionline-stroke:var(--wb-primary)}.wb-root .react-flow__node:focus-visible{outline:2px solid var(--wb-primary);outline-offset:6px;border-radius:18px}.wb-root .react-flow__node{background:none;border:none;padding:0}
.wb-node{width:196px;min-height:150px;border:1px solid color-mix(in srgb,var(--wb-node-accent,var(--wb-primary)) 55%,var(--wb-border));border-radius:16px;background:var(--wb-card);box-shadow:0 14px 32px -20px rgb(0 0 0/.6),0 0 26px -21px var(--wb-node-accent,var(--wb-primary));color:var(--wb-fg);position:relative}.wb-node[data-kind=agent]{--wb-node-accent:var(--wb-primary)}.wb-node[data-kind=trigger],.wb-node[data-kind=delivery]{--wb-node-accent:var(--wb-secondary)}.wb-node[data-kind=integration],.wb-node[data-kind=review],.wb-node[data-kind=knowledge]{--wb-node-accent:var(--wb-tertiary)}.wb-node[data-selected=true]{outline:2px solid var(--wb-node-accent,var(--wb-primary));outline-offset:4px}.wb-node-head{padding:13px 13px 10px;display:flex;gap:10px;align-items:center}.wb-node-head strong{font-size:13px;line-height:1.25;display:block;font-weight:600;overflow-wrap:anywhere}.wb-node-head small{font:9px/1.5 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--wb-muted);display:block;margin-top:4px}.wb-glyph{display:grid;place-items:center;flex:0 0 34px;height:34px;border:1px solid var(--wb-border);border-radius:10px;background:color-mix(in srgb,var(--wb-node-accent,var(--wb-primary)) 12%,var(--wb-card));color:var(--wb-node-accent,var(--wb-primary))}.wb-glyph svg{width:19px;height:19px}.wb-glyph img{width:21px;height:21px;object-fit:contain}.wb-node-body{padding:9px 13px 12px;border-top:1px solid var(--wb-border)}.wb-node-body p{font-size:12px;line-height:1.5;color:var(--wb-muted);margin:0 0 8px;overflow-wrap:anywhere}.wb-node-body>span{display:inline-block;border:1px solid var(--wb-border);border-radius:5px;padding:2px 6px;color:var(--wb-muted);font:9px/1.5 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.04em}
.wb-root .react-flow__handle{width:12px;height:12px;min-width:12px;min-height:12px;border:2px solid var(--wb-card);background:var(--wb-node-accent,var(--wb-primary))}.wb-root .react-flow__handle:hover{outline:3px solid color-mix(in srgb,var(--wb-primary) 30%,transparent)}
.wb-edge-halo{fill:none;stroke:color-mix(in srgb,var(--wb-primary) 13%,transparent);stroke-width:9}.wb-edge{fill:none;stroke-width:2.5}.wb-edge-pulse{fill:none;stroke:var(--wb-fg);stroke-opacity:.45;stroke-width:2;stroke-dasharray:3 45;animation:wb-travel 6s linear infinite}.wb-port{fill:var(--wb-primary)}@keyframes wb-travel{to{stroke-dashoffset:-192}}.wb-root[data-animated=false] .wb-edge-pulse{animation:none}.wb-root .react-flow__edge.selected .wb-edge{stroke-width:5}.wb-root .react-flow__edge:focus-visible{outline:none}.wb-root .react-flow__edge:focus-visible .wb-edge{stroke-width:5;filter:drop-shadow(0 0 3px var(--wb-primary))}
.wb-empty{position:absolute;inset:40% 20px auto;text-align:center;color:var(--wb-muted);pointer-events:none}
.wb-tools{position:absolute;left:14px;bottom:14px;display:flex;gap:2px;padding:3px;border:1px solid var(--wb-border);border-radius:10px;background:var(--wb-card);z-index:5}.wb-root .wb-tools button{border:0;min-width:34px;min-height:32px;padding:5px 9px;font-size:12px}
.wb-message{position:absolute;right:14px;bottom:14px;max-width:min(46%,380px);margin:0;padding:6px 10px;border:1px solid var(--wb-border);border-radius:8px;background:color-mix(in srgb,var(--wb-card) 88%,transparent);backdrop-filter:blur(6px);font-size:11.5px;color:var(--wb-muted);z-index:5;pointer-events:none}
.wb-message[data-empty=true]{opacity:0}.wb-status{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--wb-border);padding:9px 16px;color:var(--wb-muted);font:10px/1.5 ui-monospace,monospace;flex:none}.wb-status i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--wb-secondary);margin-right:5px}
.wb-editor{border-top:1px solid var(--wb-border);background:var(--wb-card);font-size:12px;flex:none}.wb-editor>summary{list-style:none;display:flex;align-items:baseline;gap:8px;padding:10px 16px;cursor:pointer;font-weight:600;font-size:12px}.wb-editor>summary::-webkit-details-marker{display:none}.wb-editor>summary:before{content:'+';color:var(--wb-muted);font-weight:400;width:10px}.wb-editor[open]>summary:before{content:'−'}.wb-editor>summary small{font-weight:400;color:var(--wb-muted)}.wb-editor-body{padding:4px 16px 16px;max-height:40vh;overflow:auto}
.wb-edit-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.wb-edit-row>label{color:var(--wb-muted)}.wb-edit-row select{flex:1;min-width:120px;max-width:100%}.wb-connect{display:flex;gap:10px;align-items:end;margin-top:14px}.wb-connect label{flex:1;min-width:0;color:var(--wb-muted);display:grid;gap:5px}.wb-connect select{width:100%;min-width:0;color:var(--wb-fg)}.wb-connect>span{align-self:center;padding-top:19px;color:var(--wb-muted)}.wb-connect button{white-space:nowrap}.wb-details{margin-top:14px}.wb-details summary{cursor:pointer;color:var(--wb-muted);padding:6px 0}.wb-details p{line-height:1.7;max-width:65ch;color:var(--wb-muted)}.wb-details ul{list-style:none;padding:0;margin:8px 0}.wb-details li{display:flex;justify-content:space-between;gap:12px;align-items:center;border-top:1px solid var(--wb-border);padding:7px 0}.wb-details li span{overflow-wrap:anywhere}.wb-details li button{font-size:11px;padding:5px 9px}.wb-root .wb-reset{border:0;background:none;text-decoration:underline;color:var(--wb-muted);padding:6px 0;font-size:11px;min-height:0}
.wb-step-form{display:grid;gap:12px;margin-top:14px;padding:14px;border:1px solid var(--wb-border);border-radius:10px;background:var(--wb-bg)}.wb-step-form label{display:grid;gap:5px;color:var(--wb-muted)}.wb-step-form input,.wb-step-form textarea{width:100%;min-width:0;min-height:38px;padding:8px 10px;border:1px solid var(--wb-border);border-radius:8px;background:var(--wb-card);color:var(--wb-fg);font:inherit;resize:vertical}.wb-step-form :is(input,textarea):focus-visible{outline:2px solid var(--wb-primary);outline-offset:2px}.wb-step-form>div{display:flex;gap:8px;flex-wrap:wrap}
.wb-stack{border-left:1px solid var(--wb-border);background:color-mix(in srgb,var(--wb-card) 94%,var(--wb-primary));min-width:0;min-height:0;overflow:hidden}.wb-stack-inner{width:var(--wb-stack-w);height:100%;overflow-y:auto;padding:14px 14px 18px;animation:wb-fade .2s ease both}.wb-stack-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.wb-stack h3{font-size:13px;letter-spacing:-.01em;margin:0;font-weight:600}.wb-stack-inner>p{font-size:11px;line-height:1.6;color:var(--wb-muted);margin:4px 0 12px}
.wb-stack-rail{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;height:100%;animation:wb-fade .2s ease both}.wb-rail-label{writing-mode:vertical-rl;transform:rotate(180deg);font:9px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--wb-muted);margin:4px 0}.wb-root .wb-rail-app{display:grid;place-items:center;width:34px;height:34px;min-height:34px;padding:0;border-radius:9px;color:var(--wb-primary);font-size:13px;font-weight:700}.wb-rail-app img{width:18px;height:18px;object-fit:contain}
@keyframes wb-fade{from{opacity:0}to{opacity:1}}
.wb-node[data-compact=true]{width:188px;min-height:0;border-radius:14px}.wb-node[data-compact=true] .wb-node-head{padding:10px 10px 10px 11px;gap:9px}.wb-node[data-compact=true] .wb-glyph{flex-basis:30px;height:30px;border-radius:9px}.wb-node[data-compact=true] .wb-glyph svg{width:16px;height:16px}.wb-node-title{min-width:0;flex:1}.wb-node[data-compact=true] .wb-node-head strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}.wb-node[data-compact=true] .wb-node-head small{margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-node[data-status=off]{opacity:.55;border-style:dashed;box-shadow:none}.wb-node[data-status=off] .wb-glyph{color:var(--wb-muted)}.wb-live{flex:none;width:6px;height:6px;border-radius:50%;background:var(--wb-secondary);box-shadow:0 0 0 3px color-mix(in srgb,var(--wb-secondary) 22%,transparent)}
.wb-root .wb-node-cfg{flex:none;display:grid;place-items:center;width:26px;height:26px;min-height:0;padding:0;border:1px solid transparent;border-radius:7px;background:none;color:var(--wb-muted);opacity:.7}.wb-root .wb-node-cfg:hover:enabled{opacity:1;color:var(--wb-fg);border-color:var(--wb-border);background:color-mix(in srgb,var(--wb-primary) 12%,var(--wb-card))}.wb-node-cfg svg{width:14px;height:14px}
.wb-root .react-flow__edge.wb-off .wb-edge{stroke:var(--wb-muted)!important;stroke-dasharray:4 6;opacity:.45}.wb-root .react-flow__edge.wb-off :is(.wb-edge-pulse,.wb-edge-halo){display:none}
.wb-workspace{position:relative}.wb-overlay{font-size:14px;line-height:1.5;position:absolute;top:0;bottom:0;left:0;right:var(--wb-stack-w);z-index:20;transition:right .22s cubic-bezier(.2,.8,.2,1);pointer-events:none}.wb-overlay>*{pointer-events:auto}
.wb-stack-label{font:9.5px/1.4 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--wb-muted);margin:18px 2px 0}.wb-stack-inner>.wb-stack-label:first-of-type{margin-top:10px}.wb-rail-sep{width:18px;height:1px;background:var(--wb-border);margin:2px 0}.wb-root .wb-rail-app[data-active=true]{border-color:color-mix(in srgb,var(--wb-primary) 70%,transparent);background:color-mix(in srgb,var(--wb-primary) 16%,var(--wb-card));color:var(--wb-fg)}
.wb-canvas-column{position:relative}.wb-editor>summary{height:38px;box-sizing:border-box;align-items:center}.wb-editor-body{position:absolute;left:0;right:0;bottom:38px;z-index:15;max-height:min(70%,420px);background:var(--wb-card);border-top:1px solid var(--wb-border);box-shadow:0 -18px 40px -24px rgb(0 0 0/.7);padding:14px 16px 16px!important;animation:wb-sheet .18s ease-out both}.wb-root .wb-actions button[data-active=true]{background:color-mix(in srgb,var(--wb-primary) 15%,var(--wb-card));box-shadow:inset 2px 0 0 var(--wb-primary)}.wb-actions button>span small b{font-weight:500;color:var(--wb-fg)}.wb-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--wb-border);margin-right:2px}.wb-dot[data-on=true]{background:var(--wb-secondary);box-shadow:0 0 0 3px color-mix(in srgb,var(--wb-secondary) 20%,transparent)}.wb-actions button>.wb-dot{align-self:center}.wb-subs{display:flex;flex-wrap:wrap;gap:4px;padding:2px 6px 8px 24px}.wb-root .wb-actions .wb-subs button{width:auto;min-height:0;padding:3px 7px;font:9.5px/1.5 ui-monospace,monospace;letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--wb-border);border-radius:5px;color:var(--wb-muted);background:none}.wb-root .wb-actions .wb-subs button:hover{color:var(--wb-fg);border-color:color-mix(in srgb,var(--wb-primary) 55%,var(--wb-border))}.wb-root .wb-actions .wb-subs button[data-active=true]{color:var(--wb-fg);border-color:var(--wb-primary);background:color-mix(in srgb,var(--wb-primary) 14%,transparent);box-shadow:none}.wb-app summary small[data-warn=true]{color:#fbbf24}
@keyframes wb-sheet{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.wb-app{border:1px solid var(--wb-border);border-radius:11px;background:var(--wb-card);margin-top:8px;overflow:hidden}.wb-app summary{list-style:none;display:flex;gap:9px;align-items:center;padding:10px 12px;cursor:pointer}.wb-app summary::-webkit-details-marker{display:none}.wb-app summary:after{content:'+';margin-left:auto;color:var(--wb-muted)}.wb-app[open] summary:after{content:'−'}.wb-app summary strong{font-size:12px;font-weight:600}.wb-app summary small{font:10px ui-monospace,monospace;color:var(--wb-muted)}.wb-app-mark{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--wb-border);color:var(--wb-primary);font-size:12px;font-weight:700;flex:none}.wb-app-mark img{width:16px;height:16px;object-fit:contain}.wb-actions{border-top:1px solid var(--wb-border);padding:5px}.wb-root .wb-actions button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font-size:12px;border:0;border-radius:6px;padding:8px 9px;background:none}.wb-actions button>span{flex:1}.wb-actions small{display:block;font:9px/1.7 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.09em;color:var(--wb-muted);margin-top:2px}.wb-actions b{font-size:16px;font-weight:400;color:var(--wb-primary)}
@container(max-width:640px){.wb-workspace{position:static}.wb-overlay{inset:0;right:0;z-index:30}.wb-workspace{grid-template-columns:1fr}.wb-root[data-fill=true] .wb-workspace{display:flex;flex-direction:column;overflow-y:auto}.wb-root[data-fill=true] :is(.wb-canvas-column,.wb-stack){flex:none}.wb-root[data-fill=true] .wb-canvas{flex:none;height:380px}.wb-stack{border-left:0;border-top:1px solid var(--wb-border)}.wb-stack-inner{width:auto}.wb-stack-rail{flex-direction:row;padding:8px 12px;height:auto}.wb-rail-label{writing-mode:horizontal-tb;transform:none}.wb-header{flex-wrap:wrap}.wb-header-actions{width:100%}.wb-canvas{height:360px}.wb-message{display:none}.wb-status{flex-wrap:wrap;gap:4px}.wb-edit-row{display:grid;grid-template-columns:1fr}.wb-connect{flex-wrap:wrap}.wb-connect label{flex:1 1 40%}.wb-connect>span{display:none}.wb-connect button{width:100%}}
@media(prefers-reduced-motion:reduce){.wb-root .wb-edge-pulse{animation:none}.wb-editor-body{animation:none}.wb-overlay{transition:none}.wb-workspace{transition:none}.wb-stack-inner,.wb-stack-rail{animation:none}}
`;
