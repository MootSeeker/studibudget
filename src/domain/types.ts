export type Country = 'CH' | 'DE'
export type Living = 'allein' | 'wg' | 'partner' | 'eltern'
export type CategoryType = 'einnahme' | 'ausgabe' | 'sparen'
export type ThemeChoice = 'system' | 'light' | 'dark'

/** Gemeinsame Felder jedes synchronisierbaren Datensatzes. */
export interface Synced {
  id: string
  updatedAt: string
  deleted: boolean
}

/** 'me' bin ich selbst, sonst die ID einer Person. */
export type Who = 'me' | string

export interface SharedInfo {
  paidBy: Who
  parts: { who: Who; cents: number }[]
}

export interface Semester {
  name: string
  startMonth: number
  endMonth: number
}

export interface Settings extends Synced {
  country: Country
  living: Living
  hasCar: boolean
  myPartnerSharePct: number
  semesters: Semester[]
  ampel: { yellowPct: number; redPct: number }
  theme: ThemeChoice
  backupReminderDays: 0 | 7 | 14 | 30
  lastBackupAt: string | null
  onboardingDone: boolean
}

export interface Person extends Synced {
  name: string
  active: boolean
}

export interface Area extends Synced {
  name: string
  order: number
  hidden: boolean
}

export interface Category extends Synced {
  areaId: string
  name: string
  type: CategoryType
  fix: boolean
  /** Monat (YYYY-MM), ab dem Reste übertragen werden; null = kein Übertrag. */
  rolloverFrom: string | null
  hidden: boolean
  order: number
  catalogKey?: string
}

export interface Budget extends Synced {
  categoryId: string
  validFrom: string
  amountCents: number
}

export interface Transaction extends Synced {
  date: string
  categoryId: string
  amountCents: number
  myAmountCents: number
  note: string
  shared?: SharedInfo
  templateId?: string
  templateMonth?: string
  goalId?: string
  goalDirection?: 'einzahlung' | 'entnahme'
  carId?: string
}

export interface Template extends Synced {
  categoryId: string
  amountCents: number
  note: string
  shared?: SharedInfo
  months: number[]
  active: boolean
  /** true = nicht in die Rückstellung für seltene Kosten einrechnen. */
  noReserve?: boolean
  carId?: string
}

export interface Settlement extends Synced {
  date: string
  personId: string
  direction: 'ich_zahle' | 'ich_erhalte'
  amountCents: number
  note: string
}

export type AccountKind = 'bank' | 'spar' | 'bargeld' | 'schuld' | 'depot'

export interface Account extends Synced {
  name: string
  kind: AccountKind
  include: boolean
  order: number
}

export interface AccountBalance extends Synced {
  accountId: string
  month: string
  amountCents: number
}

export interface Car extends Synced {
  name: string
  archived: boolean
  order: number
}

export interface Goal extends Synced {
  name: string
  targetCents: number
  targetDate: string | null
  startCents: number
  archived: boolean
}
