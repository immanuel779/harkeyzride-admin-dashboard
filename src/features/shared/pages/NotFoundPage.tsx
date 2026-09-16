import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas text-ink p-6 text-center">
      <h1 className="text-5xl font-bold mb-3">404</h1>
      <p className="text-ink-secondary mb-8">Page not found</p>
      <Link
        to="/login"
        className="px-6 py-3 rounded-lg bg-navy text-white font-semibold hover:bg-navy-dark transition-colors"
      >
        Go to login
      </Link>
    </div>
  )
}