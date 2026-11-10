import type { ZodType } from 'zod'
import { z } from 'zod'
import { errorEnvelopeSchema, placeSchema, planSchema } from './schemas'
import type { Place, Plan, PlanRequest } from './schemas'

const BASE = '/api/v1'

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('network_error', 'Could not reach the server. Check your connection.', 0)
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const envelope = errorEnvelopeSchema.safeParse(body)
    if (envelope.success) {
      const { code, message } = envelope.data.error
      throw new ApiError(code, message, response.status)
    }
    throw new ApiError('server_error', 'Something went wrong. Please try again.', response.status)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError('bad_response', 'The server sent an unexpected response.', response.status)
  }
  return parsed.data
}

export function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  return request(`/geocode?q=${encodeURIComponent(query)}`, z.array(placeSchema), { signal })
}

export function planTrip(body: PlanRequest, signal?: AbortSignal): Promise<Plan> {
  return request('/plan', planSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}
