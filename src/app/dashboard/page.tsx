'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
  hourly_rate: number
}

type PersonRecord = {
  id: string
  name: string
  active: boolean
}

type Entry = {
  person_id: string
  total_hours: number
  total_pay: number
  paid: boolean
  people: PersonRecord | PersonRecord[] | null
}

type Summary = {
  personId: string
  name: string
  hours: number
  pay: number
  unpaidPay: number
}

export default function DashboardPage() {
  const router = useRouter()

  const [people, setPeople] = useState<Person[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [personId, setPersonId] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [hoursWorked, setHoursWorked] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
    loadWeeklySummary()
  }, [])

  function getPersonRecord(peopleValue: Entry['people']) {
    if (Array.isArray(peopleValue)) return peopleValue[0] || null
    return peopleValue || null
  }

  function getStartOfWeek() {
    const today = new Date()
    const day = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - day)
    start.setHours(0, 0, 0, 0)

    return start.toISOString().split('T')[0]
  }

  async function loadPeople() {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, hourly_rate')
      .eq('active', true)
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPeople((data as Person[]) || [])
  }

  async function loadWeeklySummary() {
    const startOfWeek = getStartOfWeek()

    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        person_id,
        total_hours,
        total_pay,
        paid,
        people (
          id,
          name,
          active
        )
      `)
      .gte('work_date', startOfWeek)

    if (error) {
      setMessage(error.message)
      return
    }

    const grouped: Record<string, Summary> = {}

    ;(data as unknown as Entry[]).forEach((entry) => {
      const personRecord = getPersonRecord(entry.people)

      if (!personRecord?.active) {
        return
      }

      const name = personRecord.name

      if (!grouped[name]) {
        grouped[name] = {
          personId: entry.person_id,
          name,
          hours: 0,
          pay: 0,
          unpaidPay: 0,
        }
      }

      grouped[name].hours += Number(entry.total_hours || 0)
      grouped[name].pay += Number(entry.total_pay || 0)

      if (!entry.paid) {
        grouped[name].unpaidPay += Number(entry.total_pay || 0)
      }
    })

    setSummary(Object.values(grouped))
  }

  async function addQuickEntry(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const selectedPerson = people.find((person) => person.id === personId)

    if (!selectedPerson) {
      setMessage('Please select a person.')
      return
    }

    const hours = Number(hoursWorked || 0)
    const rate = Number(selectedPerson.hourly_rate || 0)
    const pay = hours * rate

    const { error } = await supabase.from('time_entries').upsert(
      {
        person_id: selectedPerson.id,
        work_date: workDate,
        start_time: '00:00',
        end_time: '00:00',
        break_minutes: 0,
        hourly_rate_snapshot: rate,
        total_hours: Number(hours.toFixed(2)),
        total_pay: Number(pay.toFixed(2)),
        notes,
        paid: false,
        cash_paid: 0,
        venmo_paid: 0,
        paid_at: null,
      },
      {
        onConflict: 'person_id,work_date',
      }
    )

    if (error) {
      setMessage(error.message)
      return
    }

    setPersonId('')
    setWorkDate('')
    setHoursWorked('')
    setNotes('')
    setMessage('Quick entry added.')
    loadWeeklySummary()
  }

  const selectedPerson = people.find((person) => person.id === personId)

  const estimatedPay =
    selectedPerson && hoursWorked
      ? Number(hoursWorked) * Number(selectedPerson.hourly_rate)
      : 0

  const totalAmountDue = summary.reduce(
    (sum, person) => sum + person.unpaidPay,
    0
  )

  return (
    <main className="min-h-screen px-4 py-5 md:p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Time Tracker Dashboard
        </p>

        <h1 className="text-5xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="text-gray-600 mt-2">
          Add hours quickly and review weekly totals by person.
        </p>
      </div>

      {message && (
        <p className="mb-6 bg-white border rounded-2xl shadow-sm p-4">
          {message}
        </p>
      )}

      <section className="mb-10">
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Total Amount Due
          </p>

          <p className="text-5xl font-bold mt-2">
            ${totalAmountDue.toFixed(2)}
          </p>

          <p className="text-gray-600 mt-2">
            Total unpaid balance across all people this week.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-5">
          <h2 className="text-2xl font-bold">
            Current Week
          </h2>

          <p className="text-gray-500">
            Weekly running totals by person
          </p>
        </div>

        {summary.length === 0 ? (
          <div className="bg-white border rounded-2xl shadow-sm p-8 text-center">
            <h3 className="text-2xl font-bold mb-2">
              No entries yet this week
            </h3>

            <p className="text-gray-600">
              Add a quick entry to start tracking weekly totals.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {summary.map((person) => (
              <button
                key={person.personId}
                type="button"
                onClick={() => router.push(`/history?personId=${person.personId}`)}
                className="text-left bg-white border rounded-2xl shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h3 className="font-bold text-3xl">
                      {person.name}
                    </h3>

                    <p className="text-gray-500 text-sm">
                      Tap to view history
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold border ${
                      person.unpaidPay > 0
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                    }`}
                  >
                    {person.unpaidPay > 0
                      ? `$${person.unpaidPay.toFixed(2)} Due`
                      : 'Paid'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Hours</p>
                    <p className="text-2xl font-bold">
                      {person.hours.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Earned</p>
                    <p className="text-2xl font-bold">
                      ${person.pay.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Unpaid</p>
                    <p className="text-2xl font-bold">
                      ${person.unpaidPay.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-bold">
            Quick Entry
          </h2>

          <p className="text-gray-500">
            Add hours without entering start and end times
          </p>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <form onSubmit={addQuickEntry} className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="border rounded-xl p-3"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                required
              >
                <option value="">Person</option>

                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} — ${Number(person.hourly_rate).toFixed(2)}/hr
                  </option>
                ))}
              </select>

              <input
                className="border rounded-xl p-3"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
              />

              <select
                className="border rounded-xl p-3"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                required
              >
                <option value="">Hours</option>

                {Array.from({ length: 65 }, (_, i) => {
                  const value = (i * 0.25).toFixed(2)

                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                })}
              </select>

              <input
                className="border rounded-xl p-3"
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">
                  Estimated Pay
                </p>

                <p className="text-3xl font-bold">
                  ${estimatedPay.toFixed(2)}
                </p>
              </div>

              <button className="bg-gray-900 text-white rounded-xl px-6 py-3 font-semibold">
                Add Quick Entry
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}