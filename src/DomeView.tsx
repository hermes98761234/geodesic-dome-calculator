import { useEffect, useRef, useState } from 'react'
import type { Dome } from './lib/geodesic'

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316']

export function DomeView({ dome, spin, label }: { dome: Dome; spin: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState({ yaw: 0.6, pitch: 0.45, zoom: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    if (!spin) return
    let raf = 0
    const tick = () => {
      setView((v) => ({ ...v, yaw: v.yaw + 0.006 }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spin])

  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    c.width = w * dpr
    c.height = h * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, w, h)
    const { yaw, pitch, zoom } = view
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
    const scale = Math.min(w, h) * 0.5 * zoom
    // z-up world: spin about z, then tilt toward the viewer
    const proj = (v: [number, number, number]) => {
      const x = v[0] * cy - v[1] * sy
      const y = v[0] * sy + v[1] * cy
      const z = v[2]
      const yy = y * cp + z * sp // depth (away from viewer positive)
      const zz = z * cp - y * sp
      return { x: w / 2 + x * scale, y: h * 0.62 - zz * scale, d: yy }
    }
    const P = dome.verts.map(proj)
    const order = dome.edges.map((e, i) => ({ i, d: (P[e[0]].d + P[e[1]].d) / 2 })).sort((a, b) => b.d - a.d)
    g.lineCap = 'round'
    for (const { i, d } of order) {
      const [a, b, t] = dome.edges[i]
      g.strokeStyle = COLORS[t % COLORS.length]
      g.globalAlpha = d > 0.15 ? 0.35 : 1
      g.lineWidth = d > 0.15 ? 1.2 : 2.4
      g.beginPath()
      g.moveTo(P[a].x, P[a].y)
      g.lineTo(P[b].x, P[b].y)
      g.stroke()
    }
    g.globalAlpha = 1
  }, [view, dome])

  return (
    <div className="scene-canvas" style={{ touchAction: 'none' }}>
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const dx = e.clientX - drag.current.x
          const dy = e.clientY - drag.current.y
          drag.current = { x: e.clientX, y: e.clientY }
          setView((v) => ({ ...v, yaw: v.yaw + dx * 0.01, pitch: Math.max(-1.4, Math.min(1.4, v.pitch + dy * 0.01)) }))
        }}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => setView((v) => ({ ...v, zoom: Math.max(0.4, Math.min(3, v.zoom * (e.deltaY < 0 ? 1.1 : 0.9))) }))}
      />
    </div>
  )
}
