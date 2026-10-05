import { useState } from 'react'
import { buttonClass, inputClass } from '../../auth/ui'
import { Collapsible } from '../../components/Collapsible'
import { createCategoryOps } from '../../data/categoryOps'
import { db } from '../../data/db'
import type { Area, Category, CategoryType } from '../../domain/types'
import { useOpenSet } from '../../lib/useOpenSet'
import { groupByArea, plural, TYPE_LABEL, type Run } from './shared'

const ops = createCategoryOps(db)

function CategoryRow({
  cat,
  areas,
  month,
  canUp,
  canDown,
  run,
}: {
  cat: Category
  areas: Area[]
  month: string
  canUp: boolean
  canDown: boolean
  run: Run
}) {
  const [editing, setEditing] = useState(false)
  return (
    <li className={`space-y-2 px-4 py-2 ${cat.hidden ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span>{cat.name}</span>
          <span className="whitespace-nowrap rounded bg-border px-2 py-0.5 text-xs">
            {TYPE_LABEL[cat.type]}
          </span>
          {cat.fix && <span className="rounded bg-border px-2 py-0.5 text-xs">Fix</span>}
          {cat.rolloverFrom !== null && (
            <span className="rounded bg-border px-2 py-0.5 text-xs">Rest wird übertragen</span>
          )}
          {cat.hidden && (
            <span className="rounded bg-border px-2 py-0.5 text-xs">ausgeblendet</span>
          )}
        </span>
        <button
          type="button"
          className="min-h-11 px-2 text-accent underline"
          aria-expanded={editing}
          aria-label={`Kategorie bearbeiten ${cat.name}`}
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>
      {editing && (
        <div className="space-y-2 pb-2">
          <input
            aria-label={`Name ${cat.name}`}
            className={inputClass}
            defaultValue={cat.name}
            key={cat.name}
            onBlur={(e) =>
              e.target.value.trim() !== cat.name &&
              run(() => ops.updateCategory(cat, { name: e.target.value }))
            }
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {cat.type === 'ausgabe' && (
              <>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={cat.fix}
                    onChange={(e) => run(() => ops.updateCategory(cat, { fix: e.target.checked }))}
                  />
                  Fixkosten
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={cat.rolloverFrom !== null}
                    onChange={(e) =>
                      run(() =>
                        ops.updateCategory(cat, { rolloverFrom: e.target.checked ? month : null }),
                      )
                    }
                  />
                  Rest übertragen{cat.rolloverFrom ? ` (ab ${cat.rolloverFrom})` : ''}
                </label>
              </>
            )}
            <label className="flex items-center gap-1">
              Bereich
              <select
                aria-label={`Bereich ${cat.name}`}
                className="rounded-md border border-control bg-surface px-2 py-1"
                value={cat.areaId}
                onChange={(e) => run(() => ops.updateCategory(cat, { areaId: e.target.value }))}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded border border-border px-2 py-1 disabled:opacity-30"
              disabled={!canUp}
              aria-label={`${cat.name} nach oben`}
              onClick={() => run(() => ops.move(cat, -1))}
            >
              ↑
            </button>
            <button
              className="rounded border border-border px-2 py-1 disabled:opacity-30"
              disabled={!canDown}
              aria-label={`${cat.name} nach unten`}
              onClick={() => run(() => ops.move(cat, 1))}
            >
              ↓
            </button>
            <button
              className="text-accent underline"
              onClick={() => run(() => ops.updateCategory(cat, { hidden: !cat.hidden }))}
            >
              {cat.hidden ? 'Einblenden' : 'Ausblenden'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function AddCategory({ area, run }: { area: Area; run: (fn: () => Promise<void>) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('ausgabe')
  return (
    <form
      className="flex flex-wrap gap-2 border-t border-border px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          await ops.addCategory(area.id, name, type)
          setName('')
        })
      }}
    >
      <input
        aria-label={`Neue Kategorie in ${area.name}`}
        className={`${inputClass} flex-1`}
        placeholder="Neue Kategorie"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        aria-label={`Art der neuen Kategorie in ${area.name}`}
        className="rounded-md border border-control bg-surface px-2 py-2"
        value={type}
        onChange={(e) => setType(e.target.value as CategoryType)}
      >
        {Object.entries(TYPE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button className={buttonClass} type="submit">
        Hinzufügen
      </button>
    </form>
  )
}

export function Kategorien({
  month,
  areas,
  categories,
  run,
}: {
  month: string
  areas: Area[]
  categories: Category[]
  run: Run
}) {
  const [showHidden, setShowHidden] = useState(false)
  const [newArea, setNewArea] = useState('')
  const groups = groupByArea(areas, categories, showHidden)
  const open = useOpenSet(
    'studibudget:budget-kategorien-offen',
    groups.map((g) => g.area.id),
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Hier verwaltest du Bereiche und Kategorien: umbenennen, Fixkosten und Übertrag festlegen,
        verschieben, ausblenden oder neue anlegen. Die Beträge stellst du im Monatsbudget ein.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Ausgeblendete Kategorien anzeigen
        </label>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 py-2 text-sm"
          onClick={() => open.setAll(true)}
        >
          Alle aufklappen
        </button>
        <button
          type="button"
          className="min-h-11 rounded-md border border-border px-3 py-2 text-sm"
          onClick={() => open.setAll(false)}
        >
          Alle zuklappen
        </button>
      </div>

      <div className="space-y-3">
        {groups.map(({ area, all, visible }) => (
          <Collapsible
            key={area.id}
            headingLevel={3}
            title={area.name}
            summary={plural(visible.length, 'Kategorie', 'Kategorien')}
            open={open.isOpen(area.id)}
            onToggle={() => open.toggle(area.id)}
          >
            <div className="border-b border-border px-4 py-3">
              <input
                aria-label={`Bereich umbenennen ${area.name}`}
                className={inputClass}
                defaultValue={area.name}
                key={area.name}
                onBlur={(e) =>
                  e.target.value.trim() !== area.name &&
                  run(() => ops.renameArea(area, e.target.value))
                }
              />
            </div>
            <ul className="divide-y divide-border">
              {visible.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  areas={areas}
                  month={month}
                  canUp={all.indexOf(cat) > 0}
                  canDown={all.indexOf(cat) < all.length - 1}
                  run={run}
                />
              ))}
              {visible.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted">Keine Kategorien.</li>
              )}
            </ul>
            <AddCategory area={area} run={run} />
          </Collapsible>
        ))}
      </div>

      <form
        className="flex gap-2 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            await ops.addArea(newArea)
            setNewArea('')
          })
        }}
      >
        <input
          aria-label="Neuer Bereich"
          className={`${inputClass} flex-1`}
          placeholder="Neuer Bereich, z. B. Haustier"
          value={newArea}
          onChange={(e) => setNewArea(e.target.value)}
        />
        <button className={buttonClass} type="submit">
          Bereich anlegen
        </button>
      </form>
    </div>
  )
}
