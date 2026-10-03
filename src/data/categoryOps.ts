import type { StudiBudgetDB } from './db'
import { newId } from './seed'
import { createStore, type Store } from './store'
import { moveWithin } from '../domain/budgetPlan'
import type { Area, Category, CategoryType } from '../domain/types'

const strip = <T extends { updatedAt: string }>({ updatedAt: _u, ...rest }: T) => rest

/** Änderungen an Bereichen und Kategorien. Alles läuft über den Store, wird also synchronisiert. */
export function createCategoryOps(db: StudiBudgetDB, store: Store = createStore(db)) {
  const live = async <T extends { deleted: boolean }>(rows: Promise<T[]>) =>
    (await rows).filter((r) => !r.deleted)

  async function nextCategoryOrder() {
    const cats = await live(db.categories.toArray())
    return cats.reduce((m, c) => Math.max(m, c.order), -1) + 1
  }

  return {
    async addCategory(areaId: string, name: string, type: CategoryType): Promise<void> {
      const clean = name.trim()
      if (!clean) throw new Error('Bitte gib einen Namen ein.')
      const cats = await live(db.categories.toArray())
      if (cats.some((c) => c.areaId === areaId && c.name.toLowerCase() === clean.toLowerCase()))
        throw new Error('Diese Kategorie gibt es in diesem Bereich schon.')
      await store.put('categories', {
        id: newId(),
        deleted: false,
        areaId,
        name: clean,
        type,
        fix: false,
        rolloverFrom: null,
        hidden: false,
        order: await nextCategoryOrder(),
      })
    },
    async updateCategory(
      cat: Category,
      patch: Partial<Pick<Category, 'name' | 'fix' | 'rolloverFrom' | 'hidden' | 'areaId'>>,
    ): Promise<void> {
      if (patch.name !== undefined) {
        patch = { ...patch, name: patch.name.trim() }
        if (!patch.name) throw new Error('Der Name darf nicht leer sein.')
      }
      const moving = patch.areaId !== undefined && patch.areaId !== cat.areaId
      await store.patch('categories', cat.id, {
        ...patch,
        ...(moving ? { order: await nextCategoryOrder() } : {}),
      })
    },
    async move(cat: Category, dir: -1 | 1): Promise<void> {
      const siblings = (await live(db.categories.toArray())).filter((c) => c.areaId === cat.areaId)
      const changed = moveWithin(siblings, cat.id, dir)
      if (changed.length) await store.putMany('categories', changed.map(strip))
    },
    async addArea(name: string): Promise<void> {
      const clean = name.trim()
      if (!clean) throw new Error('Bitte gib einen Namen ein.')
      const areas = await live(db.areas.toArray())
      if (areas.some((a) => a.name.toLowerCase() === clean.toLowerCase()))
        throw new Error('Diesen Bereich gibt es schon.')
      await store.put('areas', {
        id: newId(),
        deleted: false,
        name: clean,
        hidden: false,
        order: areas.reduce((m, a) => Math.max(m, a.order), -1) + 1,
      })
    },
    async renameArea(area: Area, name: string): Promise<void> {
      const clean = name.trim()
      if (!clean) throw new Error('Der Name darf nicht leer sein.')
      await store.patch('areas', area.id, { name: clean })
    },
  }
}

export type CategoryOps = ReturnType<typeof createCategoryOps>
