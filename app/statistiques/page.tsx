import { Suspense } from 'react'
import StatsClient from '@/components/StatsClient'

export default function StatistiquesPage() {
  return (
    <Suspense fallback={null}>
      <StatsClient />
    </Suspense>
  )
}
