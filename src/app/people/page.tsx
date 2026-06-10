'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Person = {
  id: string
  name: string
  hourly_rate: number
  active: boolean
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [name, setName] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPeople()
  }, [])

  async function loadPeople() {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .order('name')

    if (error) {
      setMessage(error.message)
      return
    }

    setPeople((data as Person[]) || [])
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.from('people').insert({
      name,
      hourly_rate: Number(hourlyRate),
      active: true,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setName('')
    setHourlyRate('')
    setMessage('Person added.')
    loadPeople()
  }

  async function toggleActive(person: Person) {
    const { error } = await supabase
      .from('people')
      .update({ active: !person.active })
      .eq('id', person.id)

    if (error) {
      setMessage(error.message)
      return
    }

    loadPeople()
  }

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">People</h1>

      <form onSubmit={addPerson} className="space-y-4 mb-8">
        <input
          className="w-full border rounded p-3"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          className="w-full border rounded p-3"
          placeholder="Hourly rate"
          type="number"
          step="0.01"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          required
        />

        <button className="w-full bg-black text-white rounded p-3">
          Add Person
        </button>
      </form>

      {message && <p className="mb-4">{message}</p>}

      <div className="space-y-3">
        {people.map((person) => (
          <div key={person.id} className="border rounded p-4 flex justify-between">
            <div>
              <div className="font-bold text-xl">{person.name}</div>
              <div>${Number(person.hourly_rate).toFixed(2)}/hr</div>
              <div>{person.active ? 'Active' : 'Inactive'}</div>
            </div>

            <button
              onClick={() => toggleActive(person)}
              className="border rounded px-3 py-2"
            >
              {person.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}