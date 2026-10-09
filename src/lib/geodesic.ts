export type Vec = [number, number, number]
export type Orientation = 'vertex' | 'edge' | 'face'

const PHI = (1 + Math.sqrt(5)) / 2

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2])
const norm = (a: Vec): Vec => {
  const l = len(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
const dist = (a: Vec, b: Vec) => len(sub(a, b))

/** The 12 vertices (unit sphere) and 20 faces of the icosahedron. */
export function icosahedron(): { verts: Vec[]; faces: [number, number, number][] } {
  const raw: Vec[] = []
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) raw.push([0, a, b], [a, b, 0], [b, 0, a])
  const verts = raw.map(norm)
  const edge = dist(verts[0], nearest(verts, 0))
  const faces: [number, number, number][] = []
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if (near(dist(verts[i], verts[j]), edge) && near(dist(verts[j], verts[k]), edge) && near(dist(verts[i], verts[k]), edge)) faces.push([i, j, k])
  return { verts, faces }
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
function nearest(v: Vec[], i: number): Vec {
  let best = -1
  let bd = Infinity
  for (let j = 0; j < v.length; j++) if (j !== i && dist(v[i], v[j]) < bd) {
      bd = dist(v[i], v[j])
      best = j
    }
  return v[best]
}

/** Rotation taking unit vector `a` onto +z (Rodrigues). */
function alignToZ(a: Vec): (p: Vec) => Vec {
  const z: Vec = [0, 0, 1]
  const c = dot(a, z)
  if (c > 1 - 1e-12) return (p) => p
  if (c < -1 + 1e-12) return (p) => [p[0], -p[1], -p[2]]
  const k = norm(cross(a, z))
  const s = Math.sqrt(1 - c * c)
  return (p) => {
    const kp = cross(k, p)
    const kd = dot(k, p)
    return [p[0] * c + kp[0] * s + k[0] * kd * (1 - c), p[1] * c + kp[1] * s + k[1] * kd * (1 - c), p[2] * c + kp[2] * s + k[2] * kd * (1 - c)]
  }
}

export interface Mesh {
  verts: Vec[]
  edges: [number, number][]
  faces: [number, number, number][]
}

/** Class I (alternate-free) geodesic subdivision of the icosahedron at frequency `freq`, on the unit sphere, z up. */
export function geodesicMesh(freq: number, orient: Orientation = 'vertex'): Mesh {
  const ico = icosahedron()
  let axis: Vec
  if (orient === 'vertex') axis = ico.verts[0]
  else if (orient === 'edge') {
    const f = ico.faces[0]
    axis = norm([ico.verts[f[0]][0] + ico.verts[f[1]][0], ico.verts[f[0]][1] + ico.verts[f[1]][1], ico.verts[f[0]][2] + ico.verts[f[1]][2]])
  } else {
    const f = ico.faces[0]
    const [a, b, c] = f.map((i) => ico.verts[i])
    axis = norm([a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]])
  }
  const rot = alignToZ(axis)
  const base = ico.verts.map(rot)
  const verts: Vec[] = []
  const index = new Map<string, number>()
  const add = (p: Vec) => {
    const key = p.map((x) => Math.round(x * 1e6) + 0).join(',')
    let i = index.get(key)
    if (i === undefined) {
      i = verts.length
      verts.push(p)
      index.set(key, i)
    }
    return i
  }
  const faces: [number, number, number][] = []
  for (const [ia, ib, ic] of ico.faces) {
    const A = base[ia]
    const B = base[ib]
    const C = base[ic]
    const pt = (i: number, j: number) =>
      add(norm([(A[0] * (freq - i - j) + B[0] * i + C[0] * j) / freq, (A[1] * (freq - i - j) + B[1] * i + C[1] * j) / freq, (A[2] * (freq - i - j) + B[2] * i + C[2] * j) / freq]))
    for (let i = 0; i < freq; i++)
      for (let j = 0; i + j < freq; j++) {
        faces.push([pt(i, j), pt(i + 1, j), pt(i, j + 1)])
        if (i + j + 1 < freq) faces.push([pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)])
      }
  }
  const es = new Set<string>()
  const edges: [number, number][] = []
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      const a = f[k]
      const b = f[(k + 1) % 3]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      if (!es.has(key)) {
        es.add(key)
        edges.push(a < b ? [a, b] : [b, a])
      }
    }
  return { verts, edges, faces }
}

/** Distinct vertex heights (unit sphere), highest first. Each is a possible flat base level. */
export function cutLevels(mesh: Mesh): number[] {
  const zs = [...new Set(mesh.verts.map((v) => Math.round(v[2] * 1e6) / 1e6))].sort((a, b) => b - a)
  return zs
}

/** Fraction of the sphere's height (and surface area) above level z. */
export const domeFraction = (z: number) => (1 - z) / 2

export interface StrutType {
  letter: string
  /** Chord factor: length / sphere radius. */
  factor: number
  count: number
  /** Angle at the sphere centre subtended by the strut, degrees. */
  centralAngle: number
  /** Angle between the strut and the tangent plane at either end, degrees. */
  tangentAngle: number
}
export interface PanelType {
  key: string
  count: number
  angles: [number, number, number]
}
export interface Dome {
  freq: number
  level: number
  fraction: number
  verts: Vec[]
  edges: [number, number, number][] // a, b, strut type index
  struts: StrutType[]
  panels: PanelType[]
  faces: [number, number, number][]
  baseVertices: number
  flatBase: boolean
  hubs: { struts: number; count: number; base: boolean }[]
}

const letterOf = (i: number) => String.fromCharCode(65 + i)

export function buildDome(freq: number, orient: Orientation, level: number | 'full'): Dome {
  const mesh = geodesicMesh(freq, orient)
  const levels = cutLevels(mesh)
  const lv = level === 'full' ? -2 : levels.reduce((b, z) => (Math.abs(z - level) < Math.abs(b - level) ? z : b), levels[0])
  const keep = mesh.verts.map((v) => v[2] >= lv - 1e-6)
  const map = new Map<number, number>()
  const verts: Vec[] = []
  mesh.verts.forEach((v, i) => {
    if (keep[i]) {
      map.set(i, verts.length)
      verts.push(v)
    }
  })
  const faces = mesh.faces.filter((f) => f.every((i) => keep[i])).map((f) => f.map((i) => map.get(i)!) as [number, number, number])
  const edgeSet = new Map<string, [number, number]>()
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      const a = f[k]
      const b = f[(k + 1) % 3]
      edgeSet.set(a < b ? `${a}-${b}` : `${b}-${a}`, a < b ? [a, b] : [b, a])
    }
  // Struts also include edges on the cut boundary that border no kept face (never happens for closed caps, but is cheap to guard).
  for (const [a, b] of mesh.edges) if (keep[a] && keep[b]) edgeSet.set(`${map.get(a)}-${map.get(b)}`, [map.get(a)!, map.get(b)!])
  const raw = [...edgeSet.values()].map(([a, b]) => ({ a, b, l: dist(verts[a], verts[b]) }))
  const lengths = [...new Set(raw.map((e) => Math.round(e.l * 1e6)))].sort((x, y) => x - y)
  const struts: StrutType[] = lengths.map((l, i) => {
    const factor = l / 1e6
    const central = 2 * Math.asin(Math.min(1, factor / 2))
    return { letter: letterOf(i), factor, count: 0, centralAngle: (central * 180) / Math.PI, tangentAngle: (central * 90) / Math.PI }
  })
  const typeOf = (l: number) => lengths.indexOf(Math.round(l * 1e6))
  const edges = raw.map((e) => {
    const t = typeOf(e.l)
    struts[t].count++
    return [e.a, e.b, t] as [number, number, number]
  })
  const panelMap = new Map<string, PanelType>()
  for (const f of faces) {
    const ls = [dist(verts[f[0]], verts[f[1]]), dist(verts[f[1]], verts[f[2]]), dist(verts[f[2]], verts[f[0]])]
    const key = ls.map((l) => letterOf(typeOf(l))).sort().join('')
    let p = panelMap.get(key)
    if (!p) {
      const s = [...ls].sort((a, b) => a - b)
      const ang = (a: number, b: number, c: number) => (Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c)))) * 180) / Math.PI
      p = { key, count: 0, angles: [ang(s[0], s[1], s[2]), ang(s[1], s[0], s[2]), ang(s[2], s[0], s[1])] }
      panelMap.set(key, p)
    }
    p.count++
  }
  const deg = new Array<number>(verts.length).fill(0)
  for (const [a, b] of edges) {
    deg[a]++
    deg[b]++
  }
  const hubMap = new Map<string, { struts: number; count: number; base: boolean }>()
  verts.forEach((v, i) => {
    const base = level !== 'full' && Math.abs(v[2] - lv) < 1e-6
    const key = `${deg[i]}-${base}`
    const h = hubMap.get(key) ?? { struts: deg[i], count: 0, base }
    h.count++
    hubMap.set(key, h)
  })
  const baseVertices = level === 'full' ? 0 : verts.filter((v) => Math.abs(v[2] - lv) < 1e-6).length
  return {
    freq,
    level: level === 'full' ? -1 : lv,
    fraction: level === 'full' ? 1 : domeFraction(lv),
    verts,
    edges,
    struts,
    panels: [...panelMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    faces,
    baseVertices,
    flatBase: true,
    hubs: [...hubMap.values()].sort((a, b) => Number(a.base) - Number(b.base) || a.struts - b.struts),
  }
}

export interface Dimensions {
  height: number
  baseDiameter: number
  floorArea: number
  surfaceArea: number
  volume: number
  totalStrutLength: number
}
/** Metric properties of the spherical cap for radius R. */
export function domeDimensions(d: Dome, R: number): Dimensions {
  const full = d.level <= -1
  const h = full ? 2 * R : R * (1 - d.level)
  const baseR = full ? 0 : R * Math.sqrt(Math.max(0, 1 - d.level * d.level))
  return {
    height: h,
    baseDiameter: 2 * baseR,
    floorArea: Math.PI * baseR * baseR,
    surfaceArea: 2 * Math.PI * R * h,
    volume: (Math.PI * h * h * (3 * R - h)) / 3,
    totalStrutLength: d.struts.reduce((s, t) => s + t.count * t.factor * R, 0),
  }
}

export function cutListCsv(d: Dome, R: number, deduction: number, unit: string, digits = 2): string {
  const rows = ['Type,Count,Chord factor,Theoretical length (' + unit + '),Cut length (' + unit + '),Central angle (deg),End angle to tangent (deg),Total length (' + unit + ')']
  for (const s of d.struts) {
    const L = s.factor * R
    const cut = L - 2 * deduction
    rows.push([s.letter, s.count, s.factor.toFixed(5), L.toFixed(digits), cut.toFixed(digits), s.centralAngle.toFixed(3), s.tangentAngle.toFixed(3), (cut * s.count).toFixed(digits)].join(','))
  }
  return rows.join('\n') + '\n'
}

/** Imperial helper: decimal inches to feet-inches-sixteenths text. */
export function fmtFeetInches(inches: number): string {
  const total = Math.round(inches * 16)
  const sign = total < 0 ? '-' : ''
  const t = Math.abs(total)
  const ft = Math.floor(t / 192)
  let rest = t - ft * 192
  const inch = Math.floor(rest / 16)
  rest -= inch * 16
  let frac = ''
  if (rest) {
    let n = rest
    let dd = 16
    while (n % 2 === 0) {
      n /= 2
      dd /= 2
    }
    frac = ` ${n}/${dd}`
  }
  return `${sign}${ft}' ${inch}${frac}"`
}
