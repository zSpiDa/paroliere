import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paroliere - Il gioco delle parole italiane',
  description: 'Gioco multiplayer di parole in italiano, ispirato a Scarabeo',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
