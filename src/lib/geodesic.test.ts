import { describe, expect, it } from 'vitest'
import { buildDome, cutLevels, domeDimensions, cutListCsv, fmtFeetInches, geodesicMesh, icosahedron } from './geodesic'

describe('icosahedron', () => {
  it('has 12 vertices and 20 faces', () => {
    const i = icosahedron()
    expect(i.verts).toHaveLength(12)
    expect(i.faces).toHaveLength(20)
  })
})

describe('geodesic mesh', () => {
  it.each([1, 2, 3, 4, 5, 6])('V=10f^2+2, E=30f^2, F=20f^2 for %iV', (f) => {
    for (const o of ['vertex', 'edge', 'face'] as const) {
      const m = geodesicMesh(f, o)
      expect(m.verts).toHaveLength(10 * f * f + 2)
      expect(m.edges).toHaveLength(30 * f * f)
      expect(m.faces).toHaveLength(20 * f * f)
      for (const v of m.verts) expect(Math.hypot(...v)).toBeCloseTo(1, 9)
    }
  })
})

describe('chord factors (textbook values)', () => {
  const f = (n: number) => buildDome(n, 'vertex', 'full').struts.map((s) => s.factor)
  it('1V', () => expect(f(1)[0]).toBeCloseTo(1.05146, 4))
  it('2V', () => {
    const s = f(2)
    expect(s[0]).toBeCloseTo(0.54654, 4)
    expect(s[1]).toBeCloseTo(0.61803, 4)
  })
  it('3V', () => {
    const s = f(3)
    expect(s[0]).toBeCloseTo(0.34862, 4)
    expect(s[1]).toBeCloseTo(0.40355, 4)
    expect(s[2]).toBeCloseTo(0.41241, 4)
  })
  it('4V has six strut types', () => expect(f(4)).toHaveLength(6))
  it('strut counts: 2V 60 A + 60 B; totals 30 f^2', () => {
    const d = buildDome(2, 'vertex', 'full')
    expect(d.struts.map((s) => s.count)).toEqual([60, 60])
    expect(buildDome(3, 'vertex', 'full').struts.reduce((s, t) => s + t.count, 0)).toBe(270)
  })
})

describe('dome', () => {
  it('hemisphere on a level through z=0 is half the sphere', () => {
    const d = buildDome(4, 'edge', 0)
    expect(d.fraction).toBeCloseTo(0.5, 6)
    const dim = domeDimensions(d, 3)
    expect(dim.height).toBeCloseTo(3, 9)
    expect(dim.baseDiameter).toBeCloseTo(6, 9)
    expect(dim.surfaceArea).toBeCloseTo(2 * Math.PI * 9, 9)
    expect(dim.volume).toBeCloseTo((2 / 3) * Math.PI * 27, 9)
  })
  it('levels are sorted from the top', () => {
    const l = cutLevels(geodesicMesh(3, 'vertex'))
    expect(l[0]).toBeCloseTo(1, 9)
    expect(l[l.length - 1]).toBeCloseTo(-1, 9)
  })
  it('cap has fewer struts than the full sphere and euler holds', () => {
    const full = buildDome(3, 'vertex', 'full')
    const cap = buildDome(3, 'vertex', -0.2)
    expect(cap.edges.length).toBeLessThan(full.edges.length)
    expect(cap.verts.length - cap.edges.length + cap.faces.length).toBe(1)
  })
  it('interior angles of each panel sum to 180', () => {
    for (const p of buildDome(5, 'vertex', 'full').panels) expect(p.angles[0] + p.angles[1] + p.angles[2]).toBeCloseTo(180, 6)
  })
  it('hubs: a full sphere has 12 five-strut hubs', () => {
    const h = buildDome(3, 'vertex', 'full').hubs
    expect(h.find((x) => x.struts === 5)?.count).toBe(12)
  })
})

describe('exports', () => {
  it('csv', () => {
    const csv = cutListCsv(buildDome(2, 'vertex', 'full'), 1, 0.01, 'm')
    expect(csv.split('\n')[1]).toBe('A,60,0.54653,0.55,0.53,31.717,15.859,31.59')
  })
  it('feet-inches', () => expect(fmtFeetInches(30.5)).toBe(`2' 6 1/2"`))
})
