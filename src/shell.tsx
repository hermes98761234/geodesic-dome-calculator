import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'uk'
export type Theme = 'system' | 'light' | 'dark'
export type T = (s: string, ...args: (string | number)[]) => string

export function makeT(lang: Lang, UK: Record<string, string>): T {
  return (s, ...args) => {
    const src = lang === 'uk' ? (UK[s] ?? s) : s
    return src.replace(/\{(\d+)\}/g, (_, i: string) => String(args[+i]))
  }
}

const KEY = (APP: string) => `${APP}:state`

function readHash(): unknown {
  try {
    const m = /[#&]s=([^&]+)/.exec(location.hash)
    if (!m) return null
    return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))))
  } catch {
    return null
  }
}

/** App state persisted in localStorage; a `#s=` share link overrides the stored value on load. */
export function usePersisted<S extends object>(app: string, defaults: S): [S, (p: Partial<S>) => void] {
  const [state, setState] = useState<S>(() => {
    let stored: unknown = null
    try {
      stored = JSON.parse(localStorage.getItem(KEY(app)) ?? 'null')
    } catch {
      stored = null
    }
    const fromHash = readHash()
    const base = typeof fromHash === 'object' && fromHash ? fromHash : stored
    return { ...defaults, ...(typeof base === 'object' && base ? base : {}) } as S
  })
  useEffect(() => {
    try {
      localStorage.setItem(KEY(app), JSON.stringify(state))
    } catch {
      /* storage unavailable */
    }
  }, [app, state])
  const patch = useCallback((p: Partial<S>) => setState((s) => ({ ...s, ...p })), [])
  return [state, patch]
}

export function shareLink(state: object): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${location.origin}${location.pathname}#s=${b64}`
}

export function useUi(app: string, UK: Record<string, string>) {
  const [ui, set] = usePersisted(app + '-ui', {
    lang: (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('uk') ? 'uk' : 'en') as Lang,
    theme: 'system' as Theme,
  })
  useEffect(() => {
    const el = document.documentElement
    if (ui.theme === 'system') el.removeAttribute('data-theme')
    else el.dataset.theme = ui.theme
    el.lang = ui.lang
  }, [ui.theme, ui.lang])
  return { lang: ui.lang, theme: ui.theme, setLang: (lang: Lang) => set({ lang }), setTheme: (theme: Theme) => set({ theme }), t: makeT(ui.lang, UK) }
}
export type Ui = ReturnType<typeof useUi>

export function download(name: string, data: string | Blob | Uint8Array, mime = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = width * scale
      c.height = height * scale
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, c.width, c.height)
      g.drawImage(img, 0, 0, c.width, c.height)
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
    }
    img.onerror = () => reject(new Error('svg load'))
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}

export function NumField(p: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  const id = useId()
  const [text, setText] = useState(String(p.value))
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    if (!focus) setText(String(p.value))
  }, [p.value, focus])
  const n = Number(text)
  const bad = text.trim() === '' || !Number.isFinite(n) || (p.min !== undefined && n < p.min) || (p.max !== undefined && n > p.max)
  return (
    <div className="field">
      <label htmlFor={id}>
        {p.label}
        {p.unit ? ` (${p.unit})` : ''}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={bad ? 'bad' : ''}
        value={text}
        min={p.min}
        max={p.max}
        step={p.step ?? 'any'}
        aria-invalid={bad}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false)
          if (bad) setText(String(p.value))
        }}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(v) && (p.min === undefined || v >= p.min) && (p.max === undefined || v <= p.max)) p.onChange(v)
        }}
      />
    </div>
  )
}

export function SelectField<V extends string | number>(p: { label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}</label>
      <select
        id={id}
        value={String(p.value)}
        onChange={(e) => {
          const o = p.options.find((x) => String(x.value) === e.target.value)
          if (o) p.onChange(o.value)
        }}
      >
        {p.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CheckField(p: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={p.value} onChange={(e) => p.onChange(e.target.checked)} /> {p.label}
    </label>
  )
}

export function Shell(p: { title: string; tagline: string; ui: Ui; repo: string; side: ReactNode; children: ReactNode }) {
  const { t } = p.ui
  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{p.title}</span>
        <span className="hint tagline">{p.tagline}</span>
        <span className="spacer" />
        <label>
          {t('Language')}{' '}
          <select value={p.ui.lang} onChange={(e) => p.ui.setLang(e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label>
          {t('Theme')}{' '}
          <select value={p.ui.theme} onChange={(e) => p.ui.setTheme(e.target.value as Theme)}>
            <option value="system">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">{p.side}</div>
        </aside>
        <main className="main">{p.children}</main>
      </div>
      <p className="hint foot">
        {t('Runs entirely in your browser; nothing is uploaded.')} ·{' '}
        <a href={`https://github.com/hermes98761234/${p.repo}`} target="_blank" rel="noreferrer">
          {t('Source on GitHub')}
        </a>
      </p>
    </div>
  )
}

export const COMMON_UK: Record<string, string> = {
  Language: 'Мова',
  Theme: 'Тема',
  System: 'Системна',
  Light: 'Світла',
  Dark: 'Темна',
  'Source on GitHub': 'Код на GitHub',
  'Runs entirely in your browser; nothing is uploaded.': 'Працює повністю у браузері; нічого не завантажується.',
  'Copy share link': 'Копіювати посилання',
  'Link copied': 'Посилання скопійовано',
  Settings: 'Налаштування',
  Export: 'Експорт',
  Print: 'Друк',
  Reset: 'Скинути',
}
