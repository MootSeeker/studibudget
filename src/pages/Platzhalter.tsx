export function Platzhalter({ titel }: { titel: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{titel}</h1>
      <p className="mt-2 text-muted">Diese Seite folgt in einer der nächsten Phasen.</p>
    </section>
  )
}
