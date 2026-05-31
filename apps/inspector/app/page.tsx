'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listRuns, type Run } from '../lib/api'

const statusColour: Record<string, string> = {
  completed: '#34d399',
  running: '#60a5fa',
  failed: '#f87171',
  budget_exceeded: '#fbbf24',
  pending: '#a78bfa',
}

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = () => listRuns().then(setRuns).catch(() => setError(true))
    load()
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <main style={{ padding: '4rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>Agent Orchestrator</h1>
      <p style={{ opacity: 0.6, marginBottom: 32 }}>Runs (live + historical), refreshed every 2s</p>

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
              <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13 }}>
                <Link href={`/runs/${r.id}`} style={{ color: '#a78bfa' }}>{r.id.slice(0, 8)}</Link>
              </td>
              <td>{r.graph}</td>
              <td>
                <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.06)', color: statusColour[r.status] ?? '#cbd5e1', fontSize: 12 }}>
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
          {error ? 'Cannot reach the API. Is it running on :4000?' : 'No runs yet. POST a run to /runs to get started.'}
        </p>
      )}
    </main>
  )
}
