import { afterEach, describe, expect, it, vi } from 'vitest'
import { plan } from '../../test/fixtures'
import { ApiError, planTrip, searchPlaces } from './client'
import type { PlanRequest } from './schemas'

function respond(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })))
}

const request: PlanRequest = {
  origin: { name: 'Dallas', lat: 32.78, lon: -96.8 },
  destination: { name: 'Denver', lat: 39.74, lon: -104.99 },
  departure: '2026-11-12T08:00:00.000Z',
  load_lbs: 45_000,
  interval_miles: 25,
}

afterEach(() => vi.unstubAllGlobals())

describe('searchPlaces', () => {
  it('returns validated places and encodes the query', async () => {
    respond([{ name: 'Dallas, TX, USA', lat: 32.78, lon: -96.8 }])
    const places = await searchPlaces('Dallas TX')
    expect(places).toEqual([{ name: 'Dallas, TX, USA', lat: 32.78, lon: -96.8 }])
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('/api/v1/geocode?q=Dallas%20TX')
  })
})

describe('planTrip', () => {
  it('posts JSON and returns the validated plan', async () => {
    respond(plan())
    const result = await planTrip(request)
    expect(result.recommended_route_id).toBe('route-1')
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(url).toBe('/api/v1/plan')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(request)
  })

  it('turns the error envelope into an ApiError', async () => {
    respond({ error: { code: 'no_route_found', message: 'No route.', details: null } }, 404)
    const failure = await planTrip(request).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ code: 'no_route_found', message: 'No route.', status: 404 })
  })

  it('falls back to a generic message when the error body is not the envelope', async () => {
    respond('<html>boom</html>', 500)
    await expect(planTrip(request)).rejects.toMatchObject({ code: 'server_error', status: 500 })
  })

  it('rejects responses that do not match the schema', async () => {
    respond({ routes: [] })
    await expect(planTrip(request)).rejects.toMatchObject({ code: 'bad_response' })
  })

  it('reports an unreachable server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(planTrip(request)).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })

  it('lets an aborted request through untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(planTrip(request)).rejects.toBe(abort)
  })
})
