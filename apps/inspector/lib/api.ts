export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface Run {
  id: string
  graph: string
  status: string
  startedAt: string
  finishedAt?: string | null
  tokensUsed: number
  toolsUsed: number
  error?: string | null
}

export interface TraceEvent {
  id: string
  step: number
  node: string
  kind: string
  payload: unknown
  durationMs?: number | null
}

export interface GraphNode {
  name: string
  agent: 'supervisor' | 'swarm' | 'pipeline'
  llm?: string
  tools?: string[]
  concurrency?: number
}

export interface GraphShape {
  name: string
  nodes: GraphNode[]
  edges: { from: string; to: string; conditional: boolean }[]
  budgets: { tokens?: number; tools?: number; wallClockSec?: number }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export const listRuns = () => get<Run[]>('/runs')
export const getRun = (id: string) => get<Run>(`/runs/${id}`)
export const getTrace = (id: string) => get<TraceEvent[]>(`/runs/${id}/trace`)
export const getGraph = (name: string) => get<GraphShape>(`/graphs/${name}`)
