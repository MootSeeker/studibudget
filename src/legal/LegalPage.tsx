import { LEGAL_DOCS, openTodos, type LegalDoc } from './content'

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  const open = openTodos([doc])
  return (
    <article className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold">{doc.title}</h1>
      {open.length > 0 && (
        <p role="note" className="rounded-md border border-warn/60 bg-warn/10 px-3 py-2 text-sm">
          <strong>Entwurf:</strong> Dieser Text ist noch nicht ausgefüllt und rechtlich nicht
          gültig. Er wird vor der öffentlichen Freigabe vom Betreiber ergänzt.
        </p>
      )}
      {doc.intro && <p className="text-muted">{doc.intro}</p>}
      {doc.sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          {s.body?.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {s.todo && (
            <p className="rounded-md border border-dashed border-control px-3 py-2 text-sm text-muted">
              {s.todo}
            </p>
          )}
        </section>
      ))}
    </article>
  )
}

export function LegalPage({ slug }: { slug: LegalDoc['slug'] }) {
  const doc = LEGAL_DOCS.find((d) => d.slug === slug)!
  return <LegalDocView doc={doc} />
}
