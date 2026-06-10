'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
  hourly_rate: number
}

type Entry = {
  total_hours: number
  total_pay: number
  paid: boolean
  people: { name: string } | { name: string }[] | null
}

type Summary = {
  name: string
  hours: number
  pay: number
  unpaidPay: number
}

export default function DashboardPage() {
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

  function getPersonName(people: Entry['people']) {
    if (Array.isArray(people)) return people[0]?.name || 'Unknown'
    return people?.name || 'Unknown'
  }

  function getStartOfWeek() {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day

    const start = new Date(today)
    start.setDate(diff)
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
        total_hours,
        total_pay,
        paid,
        people (
          name
        )
      `)
      .gte('work_date', startOfWeek)

    if (error) {
      console.error(error)
      return
    }

    const grouped: Record<string, Summary> = {}

    ;(data as unknown as Entry[]).forEach((entry) => {
      const name = getPersonName(entry.people)

      if (!grouped[name]) {
        grouped[name] = {
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

    const { error } = await supabase.from('time_entries').insert({
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
    })

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

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          This Week
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Running Totals
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

      <section className="bg-white border rounded-2xl shadow-sm p-5 mb-8">
        <h2 className="text-xl font-bold mb-1">Quick Entry</h2>
        <p className="text-gray-600 mb-5">
          Add total hours without entering start and end times.
        </p>

        <form onSubmit={addQuickEntry} className="grid gap-3 md:grid-cols-4">
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
                const hours = (i * 0.25).toFixed(2)

                return (
                <option key={hours} value={hours}>
                    {hours}
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

          <div className="md:col-span-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm text-gray-500">Estimated Pay</p>
              <p className="text-2xl font-bold">
                ${estimatedPay.toFixed(2)}
              </p>
            </div>

            <button className="bg-gray-900 text-white rounded-xl px-5 py-3 font-semibold">
              Add Quick Entry
            </button>
          </div>
        </form>
      </section>

      {summary.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">
            No entries yet this week
          </h2>
          <p className="text-gray-600">
            Add a quick entry to start tracking weekly totals.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {summary.map((person) => (
            <div
              key={person.name}
              className="bg-white border rounded-2xl shadow-sm p-6"
            >
              <h2 className="font-bold text-2xl mb-4">
                {person.name}
              </h2>

              <div className="grid grid-cols-3 gap-3">
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
            </div>
          ))}
        </div>
      )}
    </main>
  )
}