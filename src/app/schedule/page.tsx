'use client'

import { useEffect, useState } from 'react'
import ICAL from 'ical.js'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
}

type Schedule = {
  id: string
  person_id: string
  scheduled_date: string
  start_time: string
  end_time: string
  notes: string | null
  source: string | null
  external_uid: string | null
  people: { name: string } | { name: string }[] | null
}

export default function SchedulePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const [personId, setPersonId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [importPersonId, setImportPersonId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
    loadSchedules()
  }, [])

  function getPersonName(peopleValue: Schedule['people']) {
    if (Array.isArray(peopleValue)) return peopleValue[0]?.name || 'Unknown'
    return peopleValue?.name || 'Unknown'
  }

  function formatDateLocal(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function formatTimeLocal(date: Date) {
    return date.toTimeString().slice(0, 5)
  }

  function getMonthDays() {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: (Date | null)[] = []

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  function changeMonth(amount: number) {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1)
    )
  }

  async function loadPeople() {
    const { data, error } = await supabase
      .from('people')
      .select('id, name')
      .eq('active', true)
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPeople(data || [])
  }

  async function loadSchedules() {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id,
        person_id,
        scheduled_date,
        start_time,
        end_time,
        notes,
        source,
        external_uid,
        people (
          name
        )
      `)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      setMessage(error.message)
      return
    }

    setSchedules((data as unknown as Schedule[]) || [])
  }

  async function addSchedule(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.from('schedules').insert({
      person_id: personId,
      scheduled_date: scheduledDate,
      start_time: startTime,
      end_time: endTime,
      notes,
      source: 'manual',
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setPersonId('')
    setScheduledDate('')
    setStartTime('')
    setEndTime('')
    setNotes('')
    setMessage('Schedule added.')
    loadSchedules()
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Delete this scheduled shift?')) return

    const { error } = await supabase.from('schedules').delete().eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    loadSchedules()
  }

  async function importIcsFile(file: File) {
    setMessage('')

    if (!importPersonId) {
      setMessage('Select a person before importing.')
      return
    }

    const text = await file.text()
    const jcalData = ICAL.parse(text)
    const comp = new ICAL.Component(jcalData)
    const vevents = comp.getAllSubcomponents('vevent')

    const rows = vevents.map((eventComponent) => {
      const event = new ICAL.Event(eventComponent)
      const start = event.startDate.toJSDate()
      const end = event.endDate.toJSDate()

      return {
        person_id: importPersonId,
        scheduled_date: formatDateLocal(start),
        start_time: formatTimeLocal(start),
        end_time: formatTimeLocal(end),
        notes: event.summary || '',
        source: 'ical',
        external_uid: event.uid,
      }
    })

    if (rows.length === 0) {
      setMessage('No events found in that file.')
      return
    }

    const { error } = await supabase.from('schedules').upsert(rows, {
      onConflict: 'external_uid',
      ignoreDuplicates: true,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(`Imported ${rows.length} scheduled shifts.`)
    loadSchedules()
  }

  const monthDays = getMonthDays()

  const monthLabel = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Planning
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Schedule
        </h1>

        <p className="text-gray-600 mt-2">
          Manage upcoming shifts and import schedules from iCal/ICS files.
        </p>
      </div>

      {message && (
        <p className="mb-6 bg-white border rounded-2xl shadow-sm p-4">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <section className="bg-white border rounded-2xl shadow-sm p-5">
          <h2 className="text-xl font-bold mb-1">
            Add Scheduled Shift
          </h2>
          <p className="text-gray-600 mb-5">
            Create a planned work window for one person.
          </p>

          <form onSubmit={addSchedule} className="grid gap-3">
            <select
              className="border rounded-xl p-3"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              required
            >
              <option value="">Select person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>

            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="border rounded-xl p-3"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />

              <input
                className="border rounded-xl p-3"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />

              <input
                className="border rounded-xl p-3"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <textarea
              className="border rounded-xl p-3"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <button className="bg-gray-900 text-white rounded-xl p-3 font-semibold">
              Add Scheduled Shift
            </button>
          </form>
        </section>

        <section className="bg-white border rounded-2xl shadow-sm p-5">
          <h2 className="text-xl font-bold mb-1">
            Import iCal / ICS
          </h2>
          <p className="text-gray-600 mb-5">
            Upload a calendar file and assign all imported events to a person.
          </p>

          <select
            className="w-full border rounded-xl p-3 mb-3"
            value={importPersonId}
            onChange={(e) => setImportPersonId(e.target.value)}
          >
            <option value="">Import schedule for...</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>

          <input
            className="w-full border rounded-xl p-3"
            type="file"
            accept=".ics,.ical,text/calendar"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importIcsFile(file)
            }}
          />
        </section>
      </div>

      <section className="bg-white border rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-xl px-4 py-2 border bg-white"
          >
            Previous
          </button>

          <h2 className="text-2xl font-bold">
            {monthLabel}
          </h2>

          <button
            onClick={() => changeMonth(1)}
            className="rounded-xl px-4 py-2 border bg-white"
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 overflow-hidden rounded-2xl border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="bg-gray-50 border-b border-r p-3 text-sm font-bold text-gray-600"
            >
              {day}
            </div>
          ))}

          {monthDays.map((date, index) => {
            const dateKey = date ? formatDateLocal(date) : ''
            const daySchedules = schedules.filter(
              (shift) => shift.scheduled_date === dateKey
            )

            const isToday =
              dateKey === formatDateLocal(new Date())

            return (
              <div
                key={index}
                className="min-h-36 border-r border-b p-2 bg-white"
              >
                {date && (
                  <>
                    <div
                      className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        isToday
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700'
                      }`}
                    >
                      {date.getDate()}
                    </div>

                    <div className="space-y-2">
                      {daySchedules.map((shift) => (
                        <div
                          key={shift.id}
                          className="rounded-xl border bg-gray-50 p-2 text-xs"
                        >
                          <div className="font-bold">
                            {getPersonName(shift.people)}
                          </div>

                          <div className="text-gray-600">
                            {shift.start_time.slice(0, 5)} -{' '}
                            {shift.end_time.slice(0, 5)}
                          </div>

                          {shift.notes && (
                            <div className="mt-1 text-gray-500">
                              {shift.notes}
                            </div>
                          )}

                          <button
                            onClick={() => deleteSchedule(shift.id)}
                            className="mt-2 text-red-600 font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}