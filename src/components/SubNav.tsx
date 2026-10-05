import { useSearchParams } from 'react-router'
import { useSubNav, type SubNavItem } from '../lib/useSubNav'

export function SubNav({
  param,
  items,
  label,
}: {
  param: string
  items: SubNavItem[]
  label: string
}) {
  const [params, setParams] = useSearchParams()
  const current = useSubNav(param, items)
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          aria-current={i.id === current ? 'page' : undefined}
          className={`min-h-11 rounded-md border px-4 py-2 text-sm font-medium ${
            i.id === current
              ? 'border-accent bg-accent text-accent-text'
              : 'border-border hover:bg-surface'
          }`}
          onClick={() => {
            const next = new URLSearchParams(params)
            if (i.id === items[0].id) next.delete(param)
            else next.set(param, i.id)
            setParams(next)
          }}
        >
          {i.label}
        </button>
      ))}
    </nav>
  )
}
