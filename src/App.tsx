import { useMemo, useState } from 'react'
import { DomeView } from './DomeView'
import { UK } from './i18n'
import { buildDome, cutLevels, cutListCsv, domeDimensions, fmtFeetInches, geodesicMesh, type Orientation } from './lib/geodesic'
import { CheckField, NumField, SelectField, Shell, download, shareLink, useUi, usePersisted } from './shell'

const REPO = 'geodesic-dome-calculator'
type Unit = 'm' | 'cm' | 'ft' | 'in'
const DEFAULTS = { freq: 3, orient: 'vertex' as Orientation, radius: 3, unit: 'm' as Unit, deduction: 0.02, level: 0.0 as number | 'full' }

function frac(x: number): string {
  for (const d of [2, 3, 4, 5, 6, 8, 9, 12, 16, 24])
    for (let n = 1; n < d; n++) if (Math.abs(x - n / d) < 0.0006) return `${n}/${d}`
  return x.toFixed(3)
}

export default function App() {
  const ui = useUi(REPO, UK)
  const { t } = ui
  const [s, set] = usePersisted(REPO, DEFAULTS)
  const [spin, setSpin] = useState(true)
  const [copied, setCopied] = useState(false)
  const levels = useMemo(() => cutLevels(geodesicMesh(s.freq, s.orient)), [s.freq, s.orient])
  const nearest = s.level === 'full' ? 'full' : levels.reduce((b, z) => (Math.abs(z - (s.level as number)) < Math.abs(b - (s.level as number)) ? z : b), levels[0])
  const dome = useMemo(() => buildDome(s.freq, s.orient, nearest), [s.freq, s.orient, nearest])
  const R = s.radius > 0 ? s.radius : 1
  const dim = domeDimensions(dome, R)
  const bad = s.radius <= 0 || s.deduction < 0 || dome.struts.some((x) => x.factor * R - 2 * s.deduction <= 0)
  const u = s.unit
  const fmt = (v: number) => (u === 'in' ? fmtFeetInches(v) : u === 'ft' ? `${v.toFixed(3)} ft` : u === 'cm' ? v.toFixed(1) : v.toFixed(u === 'm' ? 3 : 2))
  const fmtLen = (v: number) => (u === 'ft' ? `${v.toFixed(3)}` : fmt(v))
  const area = (v: number) => v.toFixed(2)
  const dig = u === 'cm' ? 1 : u === 'm' ? 3 : 3
  const rows = dome.struts.map((x) => ({ ...x, L: x.factor * R, cut: x.factor * R - 2 * s.deduction }))
  const unitOpts: { value: Unit; label: string }[] = [
    { value: 'm', label: t('Metres') },
    { value: 'cm', label: t('Centimetres') },
    { value: 'ft', label: t('Feet') },
    { value: 'in', label: t('Inches') },
  ]
  const levelOpts = [
    ...levels.map((z) => ({ value: String(z), label: `${((1 - z) / 2 * 100).toFixed(1)}% (${frac((1 - z) / 2)} ${t('of sphere')})` })),
    { value: 'full', label: t('Full sphere') },
  ]
  const total = dome.struts.reduce((a, x) => a + x.count, 0)
  return (
    <Shell title={t('Geodesic Dome Calculator')} tagline={t('Struts, counts and hub angles for class I icosahedral domes, 1V to 6V.')} ui={ui} repo={REPO}
      side={
        <>
          <div className="section">
            <h3>{t('Dome')}</h3>
            <div className="grid2">
              <SelectField label={t('Frequency')} value={s.freq} options={[1, 2, 3, 4, 5, 6].map((f) => ({ value: f, label: `${f}V` }))} onChange={(freq) => set({ freq })} />
              <SelectField label={t('Orientation')} value={s.orient} options={[{ value: 'vertex', label: t('Vertex up (5-fold)') }, { value: 'edge', label: t('Edge up (2-fold)') }, { value: 'face', label: t('Face up (3-fold)') }]} onChange={(orient) => set({ orient })} />
              <NumField label={t('Dome radius')} value={s.radius} min={0.001} onChange={(radius) => set({ radius })} unit={u} />
              <SelectField label={t('Unit')} value={u} options={unitOpts} onChange={(unit) => set({ unit })} />
            </div>
            <SelectField label={t('Dome cut level')} value={String(nearest)} options={levelOpts} onChange={(v) => set({ level: v === 'full' ? 'full' : Number(v) })} />
            <NumField label={t('Hub deduction per strut end')} value={s.deduction} min={0} onChange={(deduction) => set({ deduction })} unit={u} />
            <p className="hint">{t('Subtracted from each strut end for hub/connector size.')}</p>
            {bad && <p className="err-text">{t('Fix the highlighted fields.')}</p>}
          </div>
          <div className="btnrow noprint">
            <button className="primary" disabled={bad} onClick={() => download(`dome-${s.freq}V-cutlist.csv`, cutListCsv(dome, R, s.deduction, u, dig), 'text/csv')}>{t('Download cut list (CSV)')}</button>
            <button onClick={() => { void navigator.clipboard?.writeText(shareLink(s)); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? t('Link copied') : t('Copy share link')}</button>
            <button onClick={() => window.print()}>{t('Print')}</button>
            <button onClick={() => set(DEFAULTS)}>{t('Reset')}</button>
          </div>
        </>
      }
    >
      <div className="box">
        <h3>{t('3D view')} — {s.freq}V, {(dome.fraction * 100).toFixed(1)}%</h3>
        <DomeView dome={dome} spin={spin} label={t('3D view')} />
        <div className="row noprint">
          <CheckField label={t('Rotate')} value={spin} onChange={setSpin} />
          <span className="hint">{t('Drag to rotate, wheel to zoom.')}</span>
        </div>
        <div className="stats">
          <span>{t('Vertices')}: <b>{dome.verts.length}</b></span>
          <span>{t('Struts')}: <b>{total}</b></span>
          <span>{t('Panels')}: <b>{dome.faces.length}</b></span>
          <span>{t('Base vertices')}: <b>{dome.baseVertices}</b></span>
          <span>{t('Height')}: <b>{fmt(dim.height)}</b></span>
          <span>{t('Base diameter')}: <b>{fmt(dim.baseDiameter)}</b></span>
          <span>{t('Floor area')}: <b>{area(dim.floorArea)} {u}²</b></span>
          <span>{t('Surface area')}: <b>{area(dim.surfaceArea)} {u}²</b></span>
          <span>{t('Volume')}: <b>{area(dim.volume)} {u}³</b></span>
          <span>{t('Total strut length')}: <b>{fmtLen(dim.totalStrutLength)}</b></span>
        </div>
      </div>
      <div className="box table-wrap">
        <h3>{t('Strut types')}</h3>
        <table className="data">
          <thead><tr><td>{t('Type')}</td><td>{t('Count')}</td><td>{t('Chord factor')}</td><td>{t('Length')}</td><td>{t('Cut length')}</td><td>{t('Central angle')}</td><td>{t('End angle to tangent')}</td></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.letter}><td><b>{r.letter}</b></td><td>{r.count}</td><td>{r.factor.toFixed(5)}</td><td>{fmt(r.L)}</td><td className={r.cut <= 0 ? 'err-text' : ''}>{fmt(r.cut)}</td><td>{r.centralAngle.toFixed(2)}°</td><td>{r.tangentAngle.toFixed(2)}°</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="box table-wrap">
        <h3>{t('Angles between struts at hubs')}</h3>
        <table className="data">
          <thead><tr><td>{t('Panel (edges)')}</td><td>{t('Count')}</td><td colSpan={3}>{t('Angles between struts at hubs')}</td></tr></thead>
          <tbody>
            {dome.panels.map((p) => (
              <tr key={p.key}><td><b>{p.key}</b></td><td>{p.count}</td>{p.angles.map((a, i) => <td key={i}>{a.toFixed(2)}°</td>)}</tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: 10 }}>{t('Hubs')}</h3>
        <table className="data">
          <thead><tr><td>{t('struts at hub')}</td><td>{t('Count')}</td><td>{t('on base')}</td></tr></thead>
          <tbody>
            {dome.hubs.map((h) => (
              <tr key={`${h.struts}${h.base}`}><td>{h.struts}</td><td>{h.count}</td><td>{h.base ? t('Yes') : t('No')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}
