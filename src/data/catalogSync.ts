import { catalogFor, type CatalogItem } from './catalog'
import type { StudiBudgetDB } from './db'
import { newId } from './seed'
import { storeFor, type Store } from './store'
import type { Area, Category, Country, Living } from '../domain/types'

export interface CatalogContext {
  country: Country
  living: Living
  hasCar: boolean
}

export interface CatalogPlan {
  /** Neue Standardkategorien, die es noch nicht gibt. */
  add: CatalogItem[]
  /** Standardkategorien, die zur neuen Situation nicht mehr passen (werden nur ausgeblendet, nie gelöscht). */
  hide: Category[]
  /** Ausgeblendete Standardkategorien, die wieder passen. */
  unhide: Category[]
  /** Standardkategorien mit unverändertem Namen, deren Landesname sich ändert. */
  rename: { category: Category; name: string }[]
  empty: boolean
}

/** Was würde sich an den Kategorien ändern, wenn Land, Wohnsituation oder Auto wechseln? */
export async function planCatalogChange(
  db: StudiBudgetDB,
  prev: CatalogContext,
  next: CatalogContext,
): Promise<CatalogPlan> {
  const cats = (await db.categories.toArray()).filter((c) => !c.deleted && c.catalogKey)
  const nextItems = catalogFor(next.country, next.living, next.hasCar)
  const prevItems = catalogFor(prev.country, prev.living, prev.hasCar)
  const nextByKey = new Map(nextItems.map((i) => [i.key, i]))
  const prevByKey = new Map(prevItems.map((i) => [i.key, i]))
  const byKey = new Map(cats.map((c) => [c.catalogKey!, c]))

  const hide = cats.filter((c) => !nextByKey.has(c.catalogKey!) && !c.hidden)
  const unhide = cats.filter((c) => nextByKey.has(c.catalogKey!) && c.hidden)
  const add = nextItems.filter((i) => !byKey.has(i.key))
  const rename = cats.flatMap((c) => {
    const n = nextByKey.get(c.catalogKey!)
    const old = prevByKey.get(c.catalogKey!)
    return n && old && c.name === old.name && old.name !== n.name
      ? [{ category: c, name: n.name }]
      : []
  })
  return {
    add,
    hide,
    unhide,
    rename,
    empty: !add.length && !hide.length && !unhide.length && !rename.length,
  }
}

export async function applyCatalogPlan(
  db: StudiBudgetDB,
  plan: CatalogPlan,
  store: Store = storeFor(db),
): Promise<void> {
  const strip = <T extends { updatedAt: string }>({ updatedAt: _u, ...rest }: T) => rest
  const areas = (await db.areas.toArray()).filter((a) => !a.deleted)
  const cats = (await db.categories.toArray()).filter((c) => !c.deleted)

  const newAreas: Area[] = []
  const areaId = (name: string) => {
    const found = [...areas, ...newAreas].find((a) => a.name === name)
    if (found) return found.id
    const area: Area = {
      id: newId(),
      updatedAt: '',
      deleted: false,
      name,
      order: areas.length + newAreas.length,
      hidden: false,
    }
    newAreas.push(area)
    return area.id
  }
  const created = plan.add.map((it, i) => ({
    id: newId(),
    deleted: false,
    areaId: areaId(it.area),
    name: it.name,
    type: it.type,
    fix: it.fix,
    rolloverFrom: null,
    hidden: false,
    order: cats.length + i,
    catalogKey: it.key,
  }))

  await store.putMany('areas', newAreas.map(strip))
  await store.putMany('categories', [
    ...created,
    ...plan.hide.map((c) => ({ ...strip(c), hidden: true })),
    ...plan.unhide.map((c) => ({ ...strip(c), hidden: false })),
    ...plan.rename.map((r) => ({ ...strip(r.category), name: r.name })),
  ])
}
