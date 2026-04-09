'use client'

/**
 * Maps Tailwind amber/orange utility classes used on dashboard pages to the
 * business brand color. Parent must set `data-dashboard` and inline
 * `--brand`, `--brand-light`, etc. on the same wrapper (see DashboardLayout).
 */
export function DashboardBrandCss() {
  return (
    <style>{`
        [data-dashboard] .bg-amber-600 { background-color: var(--brand) !important; }
        [data-dashboard] .hover\\:bg-amber-700:hover { background-color: var(--brand) !important; filter: brightness(0.88); }
        [data-dashboard] .bg-amber-50 { background-color: var(--brand-light) !important; }
        [data-dashboard] .hover\\:bg-amber-50:hover { background-color: var(--brand-light) !important; }
        [data-dashboard] .bg-amber-100 { background-color: var(--brand-mid) !important; }
        [data-dashboard] .hover\\:bg-amber-100:hover { background-color: var(--brand-mid) !important; }
        [data-dashboard] .text-amber-600 { color: var(--brand) !important; }
        [data-dashboard] .text-amber-700 { color: var(--brand) !important; }
        [data-dashboard] .text-amber-800 { color: var(--brand-dark) !important; }
        [data-dashboard] .text-amber-900 { color: var(--brand-dark) !important; }
        [data-dashboard] .hover\\:text-amber-700:hover { color: var(--brand) !important; }
        [data-dashboard] .hover\\:text-amber-800:hover { color: var(--brand-dark) !important; }
        [data-dashboard] .border-amber-100 { border-color: var(--brand-light) !important; }
        [data-dashboard] .border-amber-200 { border-color: var(--brand-mid) !important; }
        [data-dashboard] .hover\\:border-amber-200:hover { border-color: var(--brand-mid) !important; }
        [data-dashboard] .ring-amber-300 { --tw-ring-color: color-mix(in srgb, var(--brand) 40%, white) !important; }
        [data-dashboard] .ring-amber-500 { --tw-ring-color: var(--brand) !important; }
        [data-dashboard] .text-orange-600 { color: var(--brand) !important; }
        [data-dashboard] .text-orange-700 { color: var(--brand-dark) !important; }
        [data-dashboard] .bg-orange-50 { background-color: var(--brand-light) !important; }
        [data-dashboard] .text-amber-700.underline { color: var(--brand) !important; }
        [data-dashboard] .focus\\:ring-amber-500:focus { --tw-ring-color: var(--brand) !important; }
        [data-dashboard] .border-orange-100 { border-color: var(--brand-light) !important; }
        [data-dashboard] .border-orange-200 { border-color: var(--brand-mid) !important; }
        [data-dashboard] .text-orange-900 { color: var(--brand-dark) !important; }
        [data-dashboard] .border-amber-300 { border-color: color-mix(in srgb, var(--brand) 40%, white) !important; }
        [data-dashboard] .hover\\:border-amber-300:hover { border-color: color-mix(in srgb, var(--brand) 40%, white) !important; }
        [data-dashboard] .text-amber-950 { color: var(--brand-dark) !important; }
        [data-dashboard] .bg-amber-950 { background-color: var(--brand-dark) !important; }
        [data-dashboard] .text-amber-100 { color: var(--brand-light) !important; }
        [data-dashboard] .border-amber-400 { border-color: color-mix(in srgb, var(--brand) 60%, white) !important; }
        [data-dashboard] .hover\\:border-amber-400:hover { border-color: color-mix(in srgb, var(--brand) 60%, white) !important; }
      `}</style>
  )
}
