'use client'

import type { GraphShape } from '../lib/api'

/**
 * Agent-graph visualisation.
 *
 * Computes a layered layout (longest-path from the entry nodes) and draws the
 * topology as SVG. Nodes that the supplied trace has executed are highlighted,
 * so a run can be read against its graph at a glance.
 */
export function GraphView({ graph, executed }: { graph: GraphShape; executed?: Set<string> }) {
  const layers = layerNodes(graph)
  const colW = 200
  const rowH = 90
  const boxW = 150
  const boxH = 52
  const padX = 30
  const padY = 30

  const pos = new Map<string, { x: number; y: number }>()
  layers.forEach((layer, col) => {
    layer.forEach((name, row) => {
      pos.set(name, { x: padX + col * colW, y: padY + row * rowH })
    })
  })

  const width = padX * 2 + (layers.length - 1) * colW + boxW
  const height = padY * 2 + Math.max(1, ...layers.map((l) => l.length)) * rowH

  const agentColour: Record<string, string> = {
    supervisor: '#a78bfa',
    swarm: '#34d399',
    pipeline: '#60a5fa',
  }

  return (
    <svg width={width} height={height} role="img" aria-label={`graph ${graph.name}`}>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <path d="M0,0 L9,3 L0,6 Z" fill="rgba(255,255,255,0.45)" />
        </marker>
      </defs>

      {graph.edges.map((e, i) => {
        const a = pos.get(e.from)
        const b = pos.get(e.to)
        if (!a || !b) return null
        const x1 = a.x + boxW
        const y1 = a.y + boxH / 2
        const x2 = b.x
        const y2 = b.y + boxH / 2
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.5}
            strokeDasharray={e.conditional ? '5 4' : undefined}
            markerEnd="url(#arrow)"
          />
        )
      })}

      {graph.nodes.map((n) => {
        const p = pos.get(n.name)
        if (!p) return null
        const colour = agentColour[n.agent] ?? '#94a3b8'
        const ran = executed?.has(n.name)
        return (
          <g key={n.name} transform={`translate(${p.x},${p.y})`}>
            <rect
              width={boxW}
              height={boxH}
              rx={8}
              fill={ran ? `${colour}33` : 'rgba(255,255,255,0.04)'}
              stroke={colour}
              strokeWidth={ran ? 2 : 1}
            />
            <text x={12} y={22} fill="#f5f5f7" fontSize={14} fontWeight={600}>
              {n.name}
            </text>
            <text x={12} y={40} fill={colour} fontSize={11}>
              {n.agent}
              {n.concurrency ? ` x${n.concurrency}` : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Longest-path layering so every edge points strictly left to right. */
function layerNodes(graph: GraphShape): string[][] {
  const depth = new Map<string, number>()
  const names = graph.nodes.map((n) => n.name)
  const incoming = (name: string) => graph.edges.filter((e) => e.to === name).map((e) => e.from)

  function compute(name: string, seen: Set<string>): number {
    if (depth.has(name)) return depth.get(name)!
    if (seen.has(name)) return 0
    seen.add(name)
    const parents = incoming(name)
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => compute(p, seen)))
    depth.set(name, d)
    return d
  }

  for (const name of names) compute(name, new Set())
  const maxDepth = Math.max(0, ...[...depth.values()])
  const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => [])
  for (const name of names) layers[depth.get(name) ?? 0].push(name)
  return layers
}
