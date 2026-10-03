import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Die Seiten lesen aus IndexedDB; unter Last (CI, parallele Prozesse) brauchen waitFor/findBy länger als die 1 s Vorgabe.
configure({ asyncUtilTimeout: 4000 })
