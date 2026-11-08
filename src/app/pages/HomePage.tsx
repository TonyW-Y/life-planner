import { PomPals } from '../../features/pups/PomPals'

export function HomePage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="h1">Hi there 💕</h1>
      <PomPals />
    </div>
  )
}
