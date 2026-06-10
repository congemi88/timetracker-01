'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
  hourly_rate: number
}

type DayRow = {
  date: string
  label: string
  start_time: string
  end_time: string
  break_minutes: string
  notes: string
}

export default function EntriesPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [personId, setPersonId] = useState('')
  const [weekStart, setWeekStart] = useState(getStartOfCurrentWeek())
  const [rows, setRows] = useState<DayRow[]>(buildWeekRows(getStartOfCurrentWeek()))
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
  }, [])

  useEffect(() => {
    setRows(buildWeekRows(weekStart))
  }, [weekStart])

  function getStartOfCurrentWeek() {
    const today = new Date()
    const day = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - day)
    return formatDate(start)
  }

  function formatDate(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function buildWeekRows(startDate: string) {
    const start = new Date(`${startDate}T00:00:00`)
    const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    return labels.map((label, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)

      return {
        date: formatDate(date),
        label,
        start_time: '',
        end_time: '',
        break_minutes: '0',
        notes: '',
      }
    })
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

  function updateRow(index: number, field: keyof DayRow, value: string) {
    const nextRows = [...rows]
    nextRows[index] = {
      ...nextRows[index],
      [field]: value,
    }
    setRows(nextRows)
  }

  function calculateHours(row: DayRow) {
    if (!row.start_time || !row.end_time) return 0

    const start = new Date(`2000-01-01T${row.start_time}`)
    const end = new Date(`2000-01-01T${row.end_time}`)

    const diffMs = end.getTime() - start.getTime()
    const diffHours = diffMs / 1000 / 60 / 60
    const breakHours = Number(row.break_minutes || 0) / 60

    return Math.max(diffHours - breakHours, 0)
  }

  function changeWeek(amount: number) {
    const current = new Date(`${weekStart}T00:00:00`)
    current.setDate(current.getDate() + amount * 7)
    setWeekStart(formatDate(current))
  }

  const selectedPerson = people.find((person) => person.id === personId)

  const weeklyHours = rows.reduce((sum, row) => {
    return sum + calculateHours(row)
  }, 0)

  const weeklyPay = selectedPerson
    ? weeklyHours * Number(selectedPerson.hourly_rate)
    : 0

  async function saveWeek(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!selectedPerson) {
      setMessage('Please select a person.')
      return
    }

    const filledRows = rows.filter((row) => row.start_time && row.end_time)

    if (filledRows.length === 0) {
      setMessage('Enter at least one day.')
      return
    }

    const rowsToSave = filledRows.map((row) => {
      const hours = calculateHours(row)
      const rate = Number(selectedPerson.hourly_rate)
      const pay = hours * rate

      return {
        person_id: selectedPerson.id,
        work_date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        break_minutes: Number(row.break_minutes || 0),
        hourly_rate_snapshot: rate,
        total_hours: Number(hours.toFixed(2)),
        total_pay: Number(pay.toFixed(2)),
        notes: row.notes,
        paid: false,
      }
    })

    const { error } = await supabase
      .from('time_entries')
      .upsert(rowsToSave, {
        onConflict: 'person_id, work_date',
      })    

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Weekly timesheet saved.')
    setRows(buildWeekRows(weekStart))
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Weekly Timesheet
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Add Time
        </h1>

        <p className="text-gray-600 mt-2">
          Select one person and enter in/out times for the full week.
        </p>
      </div>

      {message && (
        <p className="mb-6 bg-white border rounded-2xl shadow-sm p-4">
          {message}
        </p>
      )}

      <form onSubmit={saveWeek} className="space-y-6">
        <section className="bg-white border rounded-2xl shadow-sm p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="border rounded-xl p-3"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              required
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} — ${Number(person.hourly_rate).toFixed(2)}/hr
                </option>
              ))}
            </select>

            <input
              className="border rounded-xl p-3"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              required
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changeWeek(-1)}
                className="flex-1 border rounded-xl px-4 py-2 bg-white"
              >
                Previous Week
              </button>

              <button
                type="button"
                onClick={() => changeWeek(1)}
                className="flex-1 border rounded-xl px-4 py-2 bg-white"
              >
                Next Week
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-7 gap-0 bg-gray-50 border-b p-3 text-sm font-bold text-gray-600">
            <div>Day</div>
            <div>Date</div>
            <div>In</div>
            <div>Out</div>
            <div>Break</div>
            <div>Notes</div>
            <div>Hours</div>
          </div>

          {rows.map((row, index) => {
            const hours = calculateHours(row)

            return (
              <div
                key={row.date}
                className="grid gap-3 md:grid-cols-7 p-4 border-b last:border-b-0 items-center"
              >
                <div>
                  <p className="font-bold">{row.label}</p>
                  <p className="text-sm text-gray-500 md:hidden">{row.date}</p>
                </div>

                <div className="hidden md:block text-gray-600">
                  {row.date}
                </div>

                <input
                  className="border rounded-xl p-3"
                  type="time"
                  value={row.start_time}
                  onChange={(e) => updateRow(index, 'start_time', e.target.value)}
                />

                <input
                  className="border rounded-xl p-3"
                  type="time"
                  value={row.end_time}
                  onChange={(e) => updateRow(index, 'end_time', e.target.value)}
                />

                <select
                  className="border rounded-xl p-3"
                  value={row.break_minutes}
                  onChange={(e) => updateRow(index, 'break_minutes', e.target.value)}
                >
                  <option value="0">No break</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hr</option>
                </select>

                <input
                  className="border rounded-xl p-3"
                  placeholder="Notes"
                  value={row.notes}
                  onChange={(e) => updateRow(index, 'notes', e.target.value)}
                />

                <div className="bg-gray-50 rounded-xl p-3 font-bold">
                  {hours.toFixed(2)} hrs
                </div>
              </div>
            )
          })}
        </section>

        <section className="bg-white border rounded-2xl shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Weekly Total</p>
            <p className="text-3xl font-bold">
              {weeklyHours.toFixed(2)} hrs
            </p>
            <p className="text-gray-600">
              Estimated Pay: ${weeklyPay.toFixed(2)}
            </p>
          </div>

          <button className="bg-gray-900 text-white rounded-xl px-6 py-3 font-semibold">
            Save Week
          </button>
        </section>
      </form>
    </main>
  )
}