import Link from 'next/link'
import './globals.css'
import AuthGuard from './AuthGuard'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          <nav className="hidden md:block sticky top-0 z-50 bg-white/90 backdrop-blur border-b">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <Link href="/dashboard" className="font-bold text-xl">
                TimeTracker
              </Link>

              <div className="flex gap-4 text-sm font-medium">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/schedule">Schedule</Link>
                <Link href="/payment">Pay</Link>
                <Link href="/entries">Add Entry</Link>
                <Link href="/history">History</Link>
                <Link href="/people">People</Link>
              </div>
            </div>
          </nav>

          <div className="pb-24 md:pb-0">
            {children}
          </div>

          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t">
            <div className="grid grid-cols-6 text-xs font-semibold">
              <Link className="p-3 text-center" href="/dashboard">Home</Link>
              <Link className="p-3 text-center" href="/schedule">Schedule</Link>
              <Link className="p-3 text-center" href="/payment">Pay</Link>
              <Link className="p-3 text-center" href="/entries">Entry</Link>
              <Link className="p-3 text-center" href="/history">History</Link>
              <Link className="p-3 text-center" href="/people">People</Link>
            </div>
          </nav>
        </AuthGuard>
      </body>
    </html>
  )
}