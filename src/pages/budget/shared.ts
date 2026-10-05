import type { Area, Category, CategoryType } from '../../domain/types'

export const TYPE_LABEL: Record<CategoryType, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  sparen: 'Sparen',
}

export type Run = (fn: () => Promise<void>) => void

/** Bereiche mit ihren Kategorien (nach Reihenfolge); ausgeblendete nur auf Wunsch. */
export function groupByArea(areas: Area[], categories: Category[], showHidden: boolean) {
  return areas.map((area) => {
    const all = categories.filter((c) => c.areaId === area.id).sort((a, b) => a.order - b.order)
    return { area, all, visible: all.filter((c) => showHidden || !c.hidden) }
  })
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
