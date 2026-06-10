'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Entry = {
  id: string
  person_id: string
  work_date: string
  start_time: string
  end_time: string
  break_minutes: number
  total_hours: number
  total_pay: number
  notes: string | null
  paid: boolean
  cash_paid: number
  venmo_paid: number
  paid_at: string| null
  people: { name: string } | { name: string }[] | null
}

type Person = {
  id: string
  name: string
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [editDate, setEditDate] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editBreak, setEditBreak] = useState('0')
  const [editNotes, setEditNotes] = useState('')
  const [paymentEntryId, setPaymentEntryId] = useState<string | null>(null)
  const [cashPaid, setCashPaid] = useState('')
  const [venmoPaid, setVenmoPaid] = useState('')
  const [paymentError, setPaymentError] = useState('')

  useEffect(() => {
    loadPeople()
    loadEntries()
  }, [])

  function getPersonName(peopleValue: Entry['people']) {
    if (Array.isArray(peopleValue)) {
      return peopleValue[0]?.name || 'Unknown'
    }

    return peopleValue?.name || 'Unknown'
  }

  async function loadPeople() {
    const { data, error } = await supabase
      .from('people')
      .select('id, name')
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPeople(data || [])
  }

  async function loadEntries() {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        person_id,
        work_date,
        start_time,
        end_time,
        break_minutes,
        total_hours,
        total_pay,
        notes,
        paid,
        cash_paid,
        venmo_paid,
        paid_at,
        people (
          name
        )
      `)
      .order('work_date', { ascending: false })
      .order('start_time', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setEntries((data as unknown as Entry[]) || [])
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id)
    setEditDate(entry.work_date)
    setEditStart(entry.start_time)
    setEditEnd(entry.end_time)
    setEditBreak(String(entry.break_minutes || 0))
    setEditNotes(entry.notes || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDate('')
    setEditStart('')
    setEditEnd('')
    setEditBreak('0')
    setEditNotes('')
  }

  function calculateHours(startTime: string, endTime: string, breakMinutes: string) {
    const start = new Date(`2000-01-01T${startTime}`)
    const end = new Date(`2000-01-01T${endTime}`)

    const diffMs = end.getTime() - start.getTime()
    const diffHours = diffMs / 1000 / 60 / 60
    const breakHours = Number(breakMinutes || 0) / 60

    return Math.max(diffHours - breakHours, 0)
  }

  async function saveEdit(entry: Entry) {
    const totalHours = calculateHours(editStart, editEnd, editBreak)

    const hourlyRate =
      Number(entry.total_hours || 0) > 0
        ? Number(entry.total_pay || 0) / Number(entry.total_hours || 1)
        : 0

    const totalPay = totalHours * hourlyRate

    const { error } = await supabase
      .from('time_entries')
      .update({
        work_date: editDate,
        start_time: editStart,
        end_time: editEnd,
        break_minutes: Number(editBreak || 0),
        total_hours: Number(totalHours.toFixed(2)),
        total_pay: Number(totalPay.toFixed(2)),
        notes: editNotes,
      })
      .eq('id', entry.id)

    if (error) {
      setMessage(error.message)
      return
    }

    cancelEdit()
    loadEntries()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this time entry?')) return

    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage(error.message)
      return
    }

    loadEntries()
  }

  function startPayment(entry: Entry) {
  if (paymentEntryId === entry.id) {
    setPaymentEntryId(null)
    setPaymentError('')
    return
  }

  setPaymentEntryId(entry.id)
  setCashPaid(String(Number(entry.cash_paid || 0).toFixed(2)))
  setVenmoPaid(String(Number(entry.venmo_paid || 0).toFixed(2)))
}

  async function savePayment(entry: Entry) {
  const cash = Number(cashPaid || 0)
  const venmo = Number(venmoPaid || 0)
  const totalPaid = cash + venmo
  const totalPay = Number(entry.total_pay || 0)

  if (totalPaid > totalPay) {
    setPaymentError(
      `Payment cannot exceed amount owed. Owed: $${totalPay.toFixed(2)}, entered: $${totalPaid.toFixed(2)}.`
    )
    return
  }

  const { error } = await supabase
    .from('time_entries')
    .update({
      cash_paid: cash,
      venmo_paid: venmo,
      paid: totalPaid >= totalPay,
      paid_at: totalPaid >= totalPay ? new Date().toISOString() : null,
    })
    .eq('id', entry.id)

  if (error) {
    setMessage(error.message)
    return
  }

  setPaymentEntryId(null)
  setCashPaid('')
  setVenmoPaid('')
  setPaymentError('')
  setMessage('Payment saved.')
  loadEntries()
}

  const filteredEntries = selectedPersonId
    ? entries.filter((entry) => entry.person_id === selectedPersonId)
    : entries

  const currentYear = new Date().getFullYear()

  const ytdEntries = filteredEntries.filter((entry) => {
    return new Date(entry.work_date).getFullYear() === currentYear
  })

  const ytdPaid = ytdEntries
    .filter((entry) => entry.paid)
    .reduce((sum, entry) => sum + Number(entry.total_pay || 0), 0)

  const ytdUnpaid = ytdEntries
    .filter((entry) => !entry.paid)
    .reduce((sum, entry) => sum + Number(entry.total_pay || 0), 0)

  const ytdTotal = ytdEntries
    .reduce((sum, entry) => sum + Number(entry.total_pay || 0), 0)

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Time Records
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          History
        </h1>

        <p className="text-gray-600 mt-2">
          Review, edit, delete, and mark time entries as paid.
        </p>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          Filter by person
        </label>

        <select
          className="w-full border rounded-xl p-3"
          value={selectedPersonId}
          onChange={(e) => setSelectedPersonId(e.target.value)}
        >
          <option value="">All People</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-white border rounded-2xl shadow-sm p-5">
         <p className="text-sm text-gray-500">YTD Paid</p>
            <p className="text-3xl font-bold">
            ${ytdPaid.toFixed(2)}
            </p>
      </div>

  <div className="bg-white border rounded-2xl shadow-sm p-5">
    <p className="text-sm text-gray-500">YTD Unpaid</p>
    <p className="text-3xl font-bold">
      ${ytdUnpaid.toFixed(2)}
    </p>
  </div>

  <div className="bg-white border rounded-2xl shadow-sm p-5">
    <p className="text-sm text-gray-500">YTD Total</p>
    <p className="text-3xl font-bold">
      ${ytdTotal.toFixed(2)}
    </p>
  </div>
</div>

      {message && (
        <p className="mb-4 bg-red-50 text-red-600 border border-red-200 rounded-xl p-3">
          {message}
        </p>
      )}

      {filteredEntries.length === 0 ? (
        <div className="bg-white border rounded-2xl shadow-sm p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">
            No history found
          </h2>
          <p className="text-gray-600">
            Try selecting all people or adding a new time entry.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border rounded-2xl shadow-sm p-5"
            >
              {editingId === entry.id ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">
                      Edit Entry
                    </h2>
                    <p className="text-gray-600">
                      {getPersonName(entry.people)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="border rounded-xl p-3"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />

                    <input
                      className="border rounded-xl p-3"
                      type="number"
                      value={editBreak}
                      onChange={(e) => setEditBreak(e.target.value)}
                      placeholder="Break minutes"
                    />

                    <input
                      className="border rounded-xl p-3"
                      type="time"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    />

                    <input
                      className="border rounded-xl p-3"
                      type="time"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    />

                    <textarea
                      className="border rounded-xl p-3 md:col-span-2"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(entry)}
                      className="rounded-xl px-4 py-2 bg-gray-900 text-white"
                    >
                      Save Changes
                    </button>

                    <button
                      onClick={cancelEdit}
                      className="rounded-xl px-4 py-2 border bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="font-bold text-2xl">
                          {getPersonName(entry.people)}
                        </h2>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            entry.paid
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}
                        >
                          {entry.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>

                      <p className="text-gray-600">
                        {entry.work_date}
                      </p>

                      <p className="text-gray-600">
                        {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                        {' '}({entry.break_minutes || 0} min break)
                      </p>

                      {entry.notes && (
                        <p className="mt-3 text-gray-700 bg-gray-50 rounded-xl p-3">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:min-w-[32rem]">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-500">Hours</p>
                        <p className="text-2xl font-bold">
                          {Number(entry.total_hours).toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-500">Pay</p>
                        <p className="text-2xl font-bold">
                          ${Number(entry.total_pay).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-5">
                    <button
                      onClick={() => startEdit(entry)}
                      className="rounded-xl px-4 py-2 bg-gray-900 text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => startPayment(entry)}
                      className="rounded-xl px-4 py-2 border bg-white"
                    >
                      {paymentEntryId === entry.id ? 'Hide Payment Details' : 'Payment Details'}
                    </button>

                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="rounded-xl px-4 py-2 bg-red-50 text-red-600 border border-red-200"
                    >
                      Delete
                    </button>

                    {paymentEntryId === entry.id && (
  <div className="mt-4 bg-gray-50 rounded-xl p-4 border">
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="font-bold text-lg">Payment Details</h3>
        <p className="text-sm text-gray-600">
          View or edit how this entry was paid.
        </p>
      </div>

      <div className="text-right text-sm">
        <p className="text-gray-500">Total Due</p>
        <p className="font-bold">
          ${Number(entry.total_pay).toFixed(2)}
        </p>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          Cash Paid
        </label>
        <input
          className="w-full border rounded-xl p-3"
          type="number"
          step="0.01"
          min="0"
          value={cashPaid}
          onChange={(e) => setCashPaid(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1">
          Venmo Paid
        </label>
        <input
          className="w-full border rounded-xl p-3"
          type="number"
          step="0.01"
          min="0"
          value={venmoPaid}
          onChange={(e) => setVenmoPaid(e.target.value)}
        />
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-3 mt-4">
      <div className="bg-white rounded-xl border p-3">
        <p className="text-sm text-gray-500">Cash</p>
        <p className="text-xl font-bold">
          ${Number(cashPaid || 0).toFixed(2)}
        </p>
      </div>

      <div className="bg-white rounded-xl border p-3">
        <p className="text-sm text-gray-500">Venmo</p>
        <p className="text-xl font-bold">
          ${Number(venmoPaid || 0).toFixed(2)}
        </p>
      </div>

      <div className="bg-white rounded-xl border p-3">
        <p className="text-sm text-gray-500">Total Paid</p>
        <p className="text-xl font-bold">
          ${(Number(cashPaid || 0) + Number(venmoPaid || 0)).toFixed(2)}
        </p>
      </div>
    </div>

    <div className="mt-3">
      <p className="text-sm text-gray-600">
        Remaining:{' '}
        <strong>
          $
          {Math.max(
            Number(entry.total_pay || 0) -
              (Number(cashPaid || 0) + Number(venmoPaid || 0)),
            0
          ).toFixed(2)}
        </strong>
      </p>
    </div>

{paymentError && (
  <p className="mt-4 bg-red-50 text-red-600 border border-red-200 rounded-xl p-3">
    {paymentError}
  </p>
)}
    <div className="flex flex-wrap gap-3 mt-4">
      <button
        onClick={() => savePayment(entry)}
        className="rounded-xl px-4 py-2 bg-gray-900 text-white"
      >
        Save Payment
      </button>

      <button
        onClick={() => setPaymentEntryId(null)}
        className="rounded-xl px-4 py-2 border bg-white"
      >
        Close
      </button>
    </div>
  </div>
)}
<div className="bg-gray-50 rounded-xl p-4">
  <p className="text-sm text-gray-500">Paid</p>
  <p className="text-2xl font-bold">
    $
    {(
      Number(entry.cash_paid || 0) + Number(entry.venmo_paid || 0)
    ).toFixed(2)}
  </p>
  <p className="text-xs text-gray-500">
    Cash ${Number(entry.cash_paid || 0).toFixed(2)} · Venmo $
    {Number(entry.venmo_paid || 0).toFixed(2)}
  </p>
</div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}