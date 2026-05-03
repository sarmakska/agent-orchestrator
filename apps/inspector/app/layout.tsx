import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agent Orchestrator Inspector',
  description: 'Live + replay view of orchestrator runs.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: '#0a0a14', color: '#f5f5f7', fontFamily: 'ui-sans-serif, system-ui' }}>
        {children}
      </body>
    </html>
  )
}
