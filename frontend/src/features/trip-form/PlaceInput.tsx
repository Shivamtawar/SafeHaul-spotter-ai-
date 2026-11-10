import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { searchPlaces } from '../../shared/api/client'
import type { Place } from '../../shared/api/schemas'
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue'

const MIN_QUERY_LENGTH = 3

interface PlaceInputProps {
  label: string
  value: Place | null
  onChange: (place: Place | null) => void
  error?: string
  debounceMs?: number
  icon?: LucideIcon
}

/** Accessible autocomplete: type to search, arrow keys to move, Enter to choose. */
export function PlaceInput({
  label,
  value,
  onChange,
  error,
  debounceMs = 300,
  icon: Icon,
}: PlaceInputProps) {
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const errorId = `${uid}-error`

  const [text, setText] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = useDebouncedValue(text.trim(), debounceMs)

  // A place chosen elsewhere (a sample trip, the swap button) must show in the box.
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    if (value) setText(value.name)
  }

  const search = useQuery({
    queryKey: ['places', query],
    queryFn: ({ signal }) => searchPlaces(query, signal),
    enabled: open && value === null && query.length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
  })
  const places = search.data ?? []
  const showList = open && value === null && text.trim().length >= MIN_QUERY_LENGTH

  function choose(place: Place) {
    onChange(place)
    setText(place.name)
    setOpen(false)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setText(event.target.value)
    setOpen(true)
    setActive(0)
    if (value !== null) onChange(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
    } else if (event.key === 'ArrowDown' && places.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive((index) => (index + 1) % places.length)
    } else if (event.key === 'ArrowUp' && places.length > 0) {
      event.preventDefault()
      setActive((index) => (index - 1 + places.length) % places.length)
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault() // keep the form from submitting while choosing
      const place = places[active]
      if (place) choose(place)
    }
  }

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="input-wrap">
        {Icon && <Icon className="input-icon" aria-hidden="true" />}
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && places[active] ? `${uid}-option-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="City, address or place"
          value={text}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {showList && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="suggestions">
          {search.isFetching && <li className="suggestion-status">Searching…</li>}
          {search.isError && <li className="suggestion-status">Could not search places.</li>}
          {search.isSuccess && places.length === 0 && (
            <li className="suggestion-status">No places found.</li>
          )}
          {places.map((place, index) => (
            <li
              key={`${place.name}-${place.lat}-${place.lon}`}
              id={`${uid}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'suggestion active' : 'suggestion'}
              onMouseDown={(event) => {
                event.preventDefault() // choose before the input loses focus
                choose(place)
              }}
            >
              {place.name}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
