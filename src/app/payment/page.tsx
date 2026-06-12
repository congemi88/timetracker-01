'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
}

type Entry = {
  id: string
  person_id: string
  work_date: string
  total_pay: number
  cash_paid: number
  venmo_paid: number
  paid: boolean
  notes: string | null
}

export default function PaymentsPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [personId, setPersonId] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [venmoAmount, setVenmoAmount] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
  }, [])

  useEffect(() => {
    if (personId) {
      loadEntries()
    } else {
      setEntries([])
    }
  }, [personId])

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

  async function loadEntries() {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id,
        person_id,
        work_date,
        total_pay,
        cash_paid,
        venmo_paid,
        paid,
        notes
      `)
      .eq('person_id', personId)
      .order('work_date', { ascending: true })

    if (error) {
      setMessage(error.message)
      return
    }

    setEntries((data as Entry[]) || [])
  }

  function amountPaid(entry: Entry) {
    return Number(entry.cash_paid || 0) + Number(entry.venmo_paid || 0)
  }

  function amountDue(entry: Entry) {
    return Math.max(Number(entry.total_pay || 0) - amountPaid(entry), 0)
  }

  const unpaidEntries = entries.filter((entry) => amountDue(entry) > 0)

  const totalDue = unpaidEntries.reduce((sum, entry) => {
    return sum + amountDue(entry)
  }, 0)

  const enteredCash = Number(cashAmount || 0)
  const enteredVenmo = Number(venmoAmount || 0)
  const enteredTotal = enteredCash + enteredVenmo

  async function applyPayment(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!personId) {
      setMessage('Select a person first.')
      return
    }

    if (enteredTotal <= 0) {
      setMessage('Enter a payment amount.')
      return
    }

    if (enteredTotal > totalDue) {
      setMessage(
        `Payment cannot exceed total due. Due: $${totalDue.toFixed(
          2
        )}, entered: $${enteredTotal.toFixed(2)}.`
      )
      return
    }

    let remainingCash = enteredCash
    let remainingVenmo = enteredVenmo

    for (const entry of unpaidEntries) {
      let remainingDue = amountDue(entry)

      if (remainingDue <= 0) continue
      if (remainingCash <= 0 && remainingVenmo <= 0) break

      let cashApplied = 0
      let venmoApplied = 0

      if (remainingCash > 0) {
        cashApplied = Math.min(remainingCash, remainingDue)
        remainingCash -= cashApplied
        remainingDue -= cashApplied
      }

      if (remainingDue > 0 && remainingVenmo > 0) {
        venmoApplied = Math.min(remainingVenmo, remainingDue)
        remainingVenmo -= venmoApplied
        remainingDue -= venmoApplied
      }

      const newCashPaid = Number(entry.cash_paid || 0) + cashApplied
      const newVenmoPaid = Number(entry.venmo_paid || 0) + venmoApplied
      const newTotalPaid = newCashPaid + newVenmoPaid
      const entryTotalPay = Number(entry.total_pay || 0)

      const { error } = await supabase
        .from('time_entries')
        .update({
          cash_paid: Number(newCashPaid.toFixed(2)),
          venmo_paid: Number(newVenmoPaid.toFixed(2)),
          paid: newTotalPaid >= entryTotalPay,
          paid_at: newTotalPaid >= entryTotalPay ? new Date().toISOString() : null,
        })
        .eq('id', entry.id)

      if (error) {
        setMessage(error.message)
        return
      }
    }

    setCashAmount('')
    setVenmoAmount('')
    setMessage('Payment applied to oldest unpaid entries.')
    loadEntries()
  }

  return (
    <main className="min-h-screen px-4 py-5 md:p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Payments
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Pay Person
        </h1>

        <p className="text-gray-600 mt-2">
          Apply partial or full payments against the oldest unpaid days first.
        </p>
      </div>

      {message && (
        <p className="mb-6 bg-white border rounded-2xl shadow-sm p-4">
          {message}
        </p>
      )}

      <section className="bg-white border rounded-2xl shadow-sm p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          Select Person
        </label>

        <select
          className="w-full border rounded-xl p-3"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">Choose person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </section>

      {personId && (
        <>
          <section className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="bg-white border rounded-2xl shadow-sm p-5">
              <p className="text-sm text-gray-500">Total Due</p>
              <p className="text-3xl font-bold">
                ${totalDue.toFixed(2)}
              </p>
            </div>

            <div className="bg-white border rounded-2xl shadow-sm p-5">
              <p className="text-sm text-gray-500">Unpaid Days</p>
              <p className="text-3xl font-bold">
                {unpaidEntries.length}
              </p>
            </div>

            <div className="bg-white border rounded-2xl shadow-sm p-5">
              <p className="text-sm text-gray-500">Entered Payment</p>
              <p className="text-3xl font-bold">
                ${enteredTotal.toFixed(2)}
              </p>
            </div>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5 mb-6">
            <h2 className="text-xl font-bold mb-1">
              Apply Payment
            </h2>

            <p className="text-gray-600 mb-5">
              Enter cash, Venmo, or both. Payment will be applied from oldest unpaid day forward.
            </p>

            <form onSubmit={applyPayment} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Cash Amount
                  </label>
                  <input
                    className="w-full border rounded-xl p-3"
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">
                    Venmo Amount
                  </label>
                  <input
                    className="w-full border rounded-xl p-3"
                    type="number"
                    step="0.01"
                    min="0"
                    value={venmoAmount}
                    onChange={(e) => setVenmoAmount(e.target.value)}
                  />
                </div>
              </div>

              <button className="bg-gray-900 text-white rounded-xl px-6 py-3 font-semibold">
                Apply Payment
              </button>
            </form>
          </section>

          <section className="bg-white border rounded-2xl shadow-sm p-5">
            <h2 className="text-xl font-bold mb-4">
              Unpaid Entries
            </h2>

            {unpaidEntries.length === 0 ? (
              <p className="text-gray-600">
                No unpaid entries for this person.
              </p>
            ) : (
              <div className="space-y-3">
                {unpaidEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold">
                        {entry.work_date}
                      </p>

                      {entry.notes && (
                        <p className="text-sm text-gray-600">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Pay</p>
                        <p className="font-bold">
                          ${Number(entry.total_pay || 0).toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">Paid</p>
                        <p className="font-bold">
                          ${amountPaid(entry).toFixed(2)}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500">Due</p>
                        <p className="font-bold">
                          ${amountDue(entry).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}