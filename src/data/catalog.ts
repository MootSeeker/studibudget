import type { CategoryType, Country, Living } from '../domain/types'

interface Entry {
  key: string
  area: string
  names: string | Record<Country, string>
  type: CategoryType
  fix?: boolean
  only?: Country
  car?: boolean
  onlyLiving?: Living[]
  notLiving?: Living[]
}

const E = (e: Entry): Entry => e

const isCarEntry = (key: string | undefined) => key !== undefined && key.startsWith('auto_')

/** Gehört die Kategorie zum Auto-Bereich? Gilt auch für selbst angelegte Kategorien im selben Bereich. */
export function isCarCategory(
  cat: { areaId: string; catalogKey?: string },
  categories: { areaId: string; catalogKey?: string }[],
): boolean {
  if (isCarEntry(cat.catalogKey)) return true
  return categories.some((c) => c.areaId === cat.areaId && isCarEntry(c.catalogKey))
}

/** Standardkatalog: Bereich › Kategorie. Grundlage ist die Budgetplanung_Student_Schweiz-Vorlage. */
const CATALOG: Entry[] = [
  E({ key: 'lohn', area: 'Einnahmen', names: 'Nettolohn / Nebenjob', type: 'einnahme' }),
  E({ key: 'bonus', area: 'Einnahmen', names: '13. Monatslohn / Bonus', type: 'einnahme' }),
  E({
    key: 'stipendium',
    area: 'Einnahmen',
    names: { CH: 'Stipendium / Ausbildungsbeitrag', DE: 'BAföG / Stipendium' },
    type: 'einnahme',
  }),
  E({ key: 'familie', area: 'Einnahmen', names: 'Unterstützung Familie', type: 'einnahme' }),
  E({ key: 'kindergeld', area: 'Einnahmen', names: 'Kindergeld', type: 'einnahme', only: 'DE' }),
  E({ key: 'freelance', area: 'Einnahmen', names: 'Freelance / Nebenprojekt', type: 'einnahme' }),

  E({
    key: 'miete',
    area: 'Wohnen',
    names: 'Miete',
    type: 'ausgabe',
    fix: true,
    notLiving: ['eltern'],
  }),
  E({
    key: 'nebenkosten',
    area: 'Wohnen',
    names: 'Nebenkosten',
    type: 'ausgabe',
    fix: true,
    notLiving: ['eltern'],
  }),
  E({
    key: 'nk_nachzahlung',
    area: 'Wohnen',
    names: 'Nebenkosten-Nachzahlung',
    type: 'ausgabe',
    notLiving: ['eltern'],
  }),
  E({
    key: 'kostgeld',
    area: 'Wohnen',
    names: 'Kostgeld / Beitrag Eltern',
    type: 'ausgabe',
    fix: true,
    onlyLiving: ['eltern'],
  }),
  E({ key: 'wg_kasse', area: 'Wohnen', names: 'WG-Kasse', type: 'ausgabe', onlyLiving: ['wg'] }),

  E({ key: 'strom', area: 'Haushalt', names: 'Strom', type: 'ausgabe', notLiving: ['eltern'] }),
  E({
    key: 'internet',
    area: 'Haushalt',
    names: 'Internet / TV',
    type: 'ausgabe',
    fix: true,
    notLiving: ['eltern'],
  }),
  E({
    key: 'rundfunk',
    area: 'Haushalt',
    names: { CH: 'SERAFE', DE: 'Rundfunkbeitrag' },
    type: 'ausgabe',
    notLiving: ['eltern'],
  }),
  E({
    key: 'hausrat',
    area: 'Haushalt',
    names: 'Hausrat / Haftpflicht',
    type: 'ausgabe',
    fix: true,
  }),
  E({
    key: 'haushaltsartikel',
    area: 'Haushalt',
    names: 'Haushaltsartikel / Reinigung',
    type: 'ausgabe',
  }),

  E({
    key: 'krankenkasse',
    area: 'Gesundheit',
    names: { CH: 'Krankenkasse', DE: 'Krankenversicherung' },
    type: 'ausgabe',
    fix: true,
  }),
  E({
    key: 'franchise',
    area: 'Gesundheit',
    names: 'Franchise / Selbstbehalt',
    type: 'ausgabe',
    only: 'CH',
  }),
  E({ key: 'arzt', area: 'Gesundheit', names: 'Arzt / Medikamente', type: 'ausgabe' }),
  E({ key: 'zahnarzt', area: 'Gesundheit', names: 'Zahnarzt / Brille', type: 'ausgabe' }),
  E({ key: 'sport', area: 'Gesundheit', names: 'Sport / Fitness', type: 'ausgabe' }),

  E({
    key: 'steuer_kanton',
    area: 'Steuern',
    names: 'Kantons- und Gemeindesteuern',
    type: 'ausgabe',
    only: 'CH',
  }),
  E({
    key: 'steuer_bund',
    area: 'Steuern',
    names: 'Direkte Bundessteuer',
    type: 'ausgabe',
    only: 'CH',
  }),
  E({ key: 'steuer_kirche', area: 'Steuern', names: 'Kirchensteuer', type: 'ausgabe', only: 'CH' }),
  E({ key: 'steuer_de', area: 'Steuern', names: 'Steuern', type: 'ausgabe', only: 'DE' }),

  E({
    key: 'auto_leasing',
    area: 'Mobilität Auto',
    names: 'Leasing / Kredit',
    type: 'ausgabe',
    fix: true,
    car: true,
  }),
  E({
    key: 'auto_parkplatz',
    area: 'Mobilität Auto',
    names: 'Parkplatz',
    type: 'ausgabe',
    car: true,
  }),
  E({
    key: 'auto_versicherung',
    area: 'Mobilität Auto',
    names: 'Versicherung',
    type: 'ausgabe',
    fix: true,
    car: true,
  }),
  E({
    key: 'auto_steuer',
    area: 'Mobilität Auto',
    names: { CH: 'Verkehrssteuer', DE: 'Kfz-Steuer' },
    type: 'ausgabe',
    car: true,
  }),
  E({
    key: 'auto_treibstoff',
    area: 'Mobilität Auto',
    names: 'Treibstoff / Strom',
    type: 'ausgabe',
    car: true,
  }),
  E({
    key: 'auto_service',
    area: 'Mobilität Auto',
    names: 'Service / Reparaturen',
    type: 'ausgabe',
    car: true,
  }),
  E({
    key: 'auto_reifen',
    area: 'Mobilität Auto',
    names: { CH: 'Reifen / Vignette / MFK', DE: 'Reifen / TÜV' },
    type: 'ausgabe',
    car: true,
  }),

  E({ key: 'halbtax', area: 'ÖV', names: 'Halbtax', type: 'ausgabe', only: 'CH' }),
  E({
    key: 'oev_abo',
    area: 'ÖV',
    names: { CH: 'ÖV-Abo / Studentenabo', DE: 'Semesterticket / Deutschlandticket' },
    type: 'ausgabe',
    fix: true,
  }),
  E({ key: 'tickets', area: 'ÖV', names: 'Einzeltickets', type: 'ausgabe' }),

  E({ key: 'einkauf', area: 'Lebensmittel', names: 'Einkauf zuhause', type: 'ausgabe' }),
  E({ key: 'mensa', area: 'Lebensmittel', names: 'Mensa / Mittagessen', type: 'ausgabe' }),
  E({ key: 'snacks', area: 'Lebensmittel', names: 'Kaffee / Snacks', type: 'ausgabe' }),
  E({ key: 'restaurant', area: 'Lebensmittel', names: 'Restaurant / Take-away', type: 'ausgabe' }),

  E({
    key: 'studiengebuehr',
    area: 'Studium',
    names: { CH: 'Semester- / Studiengebühren', DE: 'Semesterbeitrag' },
    type: 'ausgabe',
  }),
  E({ key: 'buecher', area: 'Studium', names: 'Bücher / Lehrmittel', type: 'ausgabe' }),
  E({ key: 'technik', area: 'Studium', names: 'Laptop / Technik', type: 'ausgabe' }),
  E({ key: 'software', area: 'Studium', names: 'Software / Tools', type: 'ausgabe' }),

  E({ key: 'handy', area: 'Kommunikation', names: 'Handyabo', type: 'ausgabe', fix: true }),
  E({ key: 'streaming', area: 'Kommunikation', names: 'Streaming / Musik', type: 'ausgabe' }),
  E({ key: 'cloud', area: 'Kommunikation', names: 'Cloud / Apps', type: 'ausgabe' }),

  E({ key: 'ausgang', area: 'Freizeit', names: 'Ausgang / Kino', type: 'ausgabe' }),
  E({ key: 'ferien', area: 'Freizeit', names: 'Ferien / Reisen', type: 'ausgabe' }),
  E({ key: 'hobbies', area: 'Freizeit', names: 'Hobbies / Events', type: 'ausgabe' }),
  E({ key: 'geschenke', area: 'Freizeit', names: 'Geschenke', type: 'ausgabe' }),
  E({ key: 'kleider', area: 'Freizeit', names: 'Kleider / Schuhe', type: 'ausgabe' }),
  E({ key: 'coiffeur', area: 'Freizeit', names: 'Coiffeur / Körperpflege', type: 'ausgabe' }),

  E({ key: 'notgroschen', area: 'Sparen', names: 'Notgroschen', type: 'sparen' }),
  E({
    key: 'vorsorge',
    area: 'Sparen',
    names: { CH: 'Säule 3a', DE: 'Altersvorsorge' },
    type: 'sparen',
  }),
  E({ key: 'etf', area: 'Sparen', names: 'ETF / Depot', type: 'sparen' }),

  E({
    key: 'bankgebuehren',
    area: 'Admin / Reserve',
    names: 'Bank- / Kartengebühren',
    type: 'ausgabe',
  }),
  E({ key: 'behoerden', area: 'Admin / Reserve', names: 'Behörden / Dokumente', type: 'ausgabe' }),
  E({
    key: 'unvorhergesehenes',
    area: 'Admin / Reserve',
    names: 'Unvorhergesehenes',
    type: 'ausgabe',
  }),
  E({ key: 'freies_budget', area: 'Admin / Reserve', names: 'Freies Budget', type: 'ausgabe' }),
]

export interface CatalogItem {
  key: string
  area: string
  name: string
  type: CategoryType
  fix: boolean
}

/** Die zu Land, Wohnsituation und Auto passenden Standardkategorien (in Katalogreihenfolge). */
export function catalogFor(country: Country, living: Living, hasCar: boolean): CatalogItem[] {
  return CATALOG.filter(
    (e) =>
      (!e.only || e.only === country) &&
      (!e.car || hasCar) &&
      (!e.onlyLiving || e.onlyLiving.includes(living)) &&
      !e.notLiving?.includes(living),
  ).map((e) => ({
    key: e.key,
    area: e.area,
    name: typeof e.names === 'string' ? e.names : e.names[country],
    type: e.type,
    fix: e.fix ?? false,
  }))
}

export const SUGGESTED_ACCOUNTS = ['Privatkonto', 'Sparkonto', 'Bargeld', 'Kreditkarte', 'Depot']
export const SUGGESTED_GOALS = ['Notgroschen', 'Studium', 'Ferien', 'Technik']
