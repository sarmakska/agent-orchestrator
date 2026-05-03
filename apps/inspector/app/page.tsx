'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Run {
  id: string
  graph: string
  status: string
  startedAt: string
  finishedAt?: string | null
  tokensUsed: number
  toolsUsed: number
}

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([])

  useEffect(() => {
    fetch(`${API}/runs`).then((r) => r.json()).then(setRuns).catch(() => {})
  }, [])

  return (
    <main style={{ padding: '4rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>Agent Orchestrator</h1>
      <p style={{ opacity: 0.6, marginBottom: 32 }}>Runs (live + historical)</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.6, fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: 12 }}>ID</th>
            <th>Graph</th>
            <th>Status</th>
            <th>Tokens</th>
            <th>Tools</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13 }}>{r.id.slice(0, 8)}</td>
              <td>{r.graph}</td>
              <td>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,.2)', color: '#a78bfa', fontSize: 12 }}>
                  {r.status}
                </span>
              </td>
              <td>{r.tokensUsed}</td>
              <td>{r.toolsUsed}</td>
              <td style={{ fontSize: 13, opacity: 0.6 }}>{new Date(r.startedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {runs.length === 0 && (
        <p style={{ marginTop: 48, textAlign: 'center', opacity: 0.5 }}>
          No runs yet. POST a run to <code>{API}/runs</code> to get started.
        </p>
      )}
    </main>
  )
}
