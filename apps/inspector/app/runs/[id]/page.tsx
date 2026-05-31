'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { getGraph, getRun, getTrace, type GraphShape, type Run, type TraceEvent } from '../../../lib/api'
import { GraphView } from '../../../components/GraphView'

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [run, setRun] = useState<Run | null>(null)
  const [trace, setTrace] = useState<TraceEvent[]>([])
  const [graph, setGraph] = useState<GraphShape | null>(null)

  useEffect(() => {
    const load = async () => {
      const r = await getRun(id).catch(() => null)
      if (!r) return
      setRun(r)
      setTrace(await getTrace(id).catch(() => []))
      setGraph(await getGraph(r.graph).catch(() => null))
    }
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [id])

  if (!run) {
    return (
      <main style={{ padding: '4rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/" style={{ color: '#a78bfa' }}>&larr; Runs</Link>
        <p style={{ opacity: 0.6, marginTop: 24 }}>Loading run {id}...</p>
      </main>
    )
  }

  const executed = new Set(trace.filter((t) => t.kind === 'exit').map((t) => t.node))

  return (
    <main style={{ padding: '3rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <Link href="/" style={{ color: '#a78bfa' }}>&larr; Runs</Link>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 16 }}>{run.graph}</h1>
      <p style={{ opacity: 0.6, fontFamily: 'monospace', fontSize: 13 }}>{run.id}</p>
      <p style={{ marginTop: 8 }}>
        Status <strong>{run.status}</strong> &middot; {run.tokensUsed} tokens &middot; {run.toolsUsed} tool calls
        {run.error ? <span style={{ color: '#f87171' }}> &middot; {run.error}</span> : null}
      </p>

      {graph && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Graph</h2>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 8 }}>
            <GraphView graph={graph} executed={executed} />
          </div>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Trace</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.6, textTransform: 'uppercase', fontSize: 11 }}>
              <th style={{ padding: 8 }}>Step</th>
              <th>Node</th>
              <th>Kind</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {trace.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <td style={{ padding: 8 }}>{t.step}</td>
                <td style={{ fontFamily: 'monospace' }}>{t.node}</td>
                <td>{t.kind}</td>
                <td style={{ opacity: 0.6 }}>{t.durationMs != null ? `${t.durationMs}ms` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
