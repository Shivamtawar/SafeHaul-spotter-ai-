export function formatMiles(miles: number): string {
  return `${miles.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi`
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/** Value for an `<input type="datetime-local">`, in the user's local time. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** The next quarter hour, at least `minutesAhead` from now. A sensible default departure. */
export function defaultDeparture(now: Date = new Date(), minutesAhead = 30): Date {
  const quarter = 15 * 60 * 1000
  const target = now.getTime() + minutesAhead * 60 * 1000
  return new Date(Math.ceil(target / quarter) * quarter)
}
