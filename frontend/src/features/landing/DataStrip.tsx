const SOURCES = ['Open-Meteo', 'OpenRouteService', 'OpenStreetMap', 'Valhalla']

export function DataStrip() {
  return (
    <section className="data-strip" aria-label="Data sources">
      <p className="eyebrow">Built on open data</p>
      <ul>
        {SOURCES.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  )
}
