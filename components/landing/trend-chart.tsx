/**
 * Gráfico ilustrativo de la evolución del PHQ-9 (datos ficticios). SVG puro,
 * sin librerías: la línea se dibuja con CSS cuando su bloque entra en pantalla.
 */

const POINTS = [14, 15, 12, 13, 11, 10]
const WEEKS = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6']
const BANDS = [
  { from: 0, to: 4, label: 'Mínima' },
  { from: 5, to: 9, label: 'Leve' },
  { from: 10, to: 14, label: 'Moderada' },
  { from: 15, to: 19, label: 'Mod. grave' },
] as const

const W = 320
const H = 180
const PAD = { top: 12, right: 12, bottom: 26, left: 12 }
const MAX = 20

const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (POINTS.length - 1)
const y = (v: number) => PAD.top + (1 - v / MAX) * (H - PAD.top - PAD.bottom)

export function TrendChart() {
  const path = POINTS.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${path} L${x(POINTS.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`

  return (
    <figure className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,80,75,0.5)] sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">PHQ-9</p>
          <p className="mt-0.5 text-sm text-stone-600">Ánimo en las últimas seis semanas</p>
        </div>
        <p className="text-right text-[11px] text-stone-400">Ejemplo con datos ficticios</p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Gráfico de ejemplo con puntuaciones ficticias del PHQ-9: ${POINTS.join(', ')}.`}
      >
        {BANDS.map((band, i) => (
          <g key={band.label}>
            <rect
              x={PAD.left}
              width={W - PAD.left - PAD.right}
              y={y(band.to + 1)}
              height={y(band.from) - y(band.to + 1)}
              className={i % 2 === 0 ? 'fill-stone-50' : 'fill-white'}
            />
            <text x={W - PAD.right - 4} y={y(band.to + 1) + 11} textAnchor="end" className="fill-stone-400 text-[8px]">
              {band.label}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(13 148 136)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(13 148 136)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trend-fill)" className="trend-area" />
        <path
          d={path}
          pathLength={1}
          fill="none"
          stroke="rgb(15 118 110)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trend-line"
        />
        {POINTS.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={3.5}
            className="trend-dot fill-white stroke-teal-700"
            strokeWidth={2}
            style={{ animationDelay: `${300 + i * 180}ms` }}
          />
        ))}
        {WEEKS.map((label, i) => (
          <text key={label} x={x(i)} y={H - 8} textAnchor="middle" className="fill-stone-400 text-[9px]">
            {label}
          </text>
        ))}
      </svg>
    </figure>
  )
}
