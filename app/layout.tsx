import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SMC Journal',
  description: 'Smart Money Concept Trading Journal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
