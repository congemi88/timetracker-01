'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
  hourly_rate: number
}

export default function EntriesPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [personId, setPersonId] = useState('')
  const [workDate, setWorkDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [breakMinutes, setBreakMinutes] = useState('0')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
  }, [])

  async function loadPeople() {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('active', true)
      .order('name')

    if (error) {
      alert(error.message)
      return
    }

    setPeople(data || [])
  }

  function calculateHours() {
    if (!startTime || !endTime) return 0

    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)

    const diffMs = end.getTime() - start.getTime()
    const diffHours = diffMs / 1000 / 60 / 60
    const breakHours = Number(breakMinutes || 0) / 60

    return Math.max(diffHours - breakHours, 0)
  }

  const selectedPerson = people.find((p) => p.id === personId)
  const totalHours = calculateHours()
  const totalPay = selectedPerson
    ? totalHours * Number(selectedPerson.hourly_rate)
    : 0

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!selectedPerson) {
      setMessage('Please select a person.')
      return
    }

    const { error } = await supabase.from('time_entries').insert({
      person_id: selectedPerson.id,
      work_date: workDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: Number(breakMinutes || 0),
      hourly_rate_snapshot: Number(selectedPerson.hourly_rate),
      total_hours: Number(totalHours.toFixed(2)),
      total_pay: Number(totalPay.toFixed(2)),
      notes,
      paid: false,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setPersonId('')
    setWorkDate('')
    setStartTime('')
    setEndTime('')
    setBreakMinutes('0')
    setNotes('')
    setMessage('Time entry saved.')
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Add Time Entry</h1>

      <form onSubmit={saveEntry} className="space-y-4">
        <select
          className="w-full border rounded p-3"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          required
        >
          <option value="">Select person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} — ${person.hourly_rate}/hr
            </option>
          ))}
        </select>

        <input
          className="w-full border rounded p-3"
          type="date"
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
          required
        />

        <input
          className="w-full border rounded p-3"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />

        <input
          className="w-full border rounded p-3"
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />

        <input
          className="w-full border rounded p-3"
          type="number"
          placeholder="Break minutes"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(e.target.value)}
        />

        <textarea
          className="w-full border rounded p-3"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="border rounded p-4 bg-gray-50">
          <div>Hours: {totalHours.toFixed(2)}</div>
          <div>Pay: ${totalPay.toFixed(2)}</div>
        </div>

        <button className="w-full bg-black text-white rounded p-3">
          Save Entry
        </button>
      </form>

      {message && <p className="mt-4">{message}</p>}
    </main>
  )
}