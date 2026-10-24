import type { Metadata, Viewport } from 'next'
import { Unbounded, Onest } from 'next/font/google'
import './globals.css'

const display = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = Onest({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CardMania - Gérez votre collection de cartes',
  description: 'Application moderne pour gérer et répertorier vos cartes à collectionner',
  applicationName: 'CardMania',
  icons: {
    icon: '/assets/Favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'CardMania',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2b4eff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
