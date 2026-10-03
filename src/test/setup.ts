import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { db } from '../data/db'

// Die Seiten lesen aus IndexedDB; unter Last (CI, parallele Prozesse) brauchen waitFor/findBy länger als die 1 s Vorgabe.
configure({ asyncUtilTimeout: 4000 })

/**
 * Mit SLOW_DB=<ms> (siehe `npm run test:slow`) wird jeder Datenbank-Lesezugriff um diese Zeit verzögert. So lassen sich
 * Zeitfehler nachstellen, die sonst nur auf langsamen Rechnern auftreten: Tests, die lesen, bevor die Daten geladen sind,
 * oder Oberflächen, die auf einem veralteten Bildschirmzustand speichern.
 */
if (process.env.SLOW_DB) {
  const delay = Number(process.env.SLOW_DB)
  const collection = Object.getPrototypeOf(db.persons.toCollection())
  const original = collection.toArray
  collection.toArray = function (this: unknown, ...args: unknown[]) {
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      original.apply(this, args),
    )
  }
}
