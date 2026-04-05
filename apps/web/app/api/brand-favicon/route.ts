import { NextResponse } from 'next/server'

/** Allow only safe hex for SVG fill (no `#`). */
function sanitizeHex(raw: string | null): string {
  if (!raw) return 'd97706'
  const h = raw.replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
  if (h.length === 3 || h.length === 6) return h.toLowerCase()
  return 'd97706'
}

/** 1–2 display characters for the favicon glyph. */
function sanitizeGlyph(raw: string | null): string {
  if (!raw) return 'OB'
  const g = raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  return g.length >= 1 ? g : 'OB'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * SVG favicon for businesses without a logo. Query: `i` = initials, `c` = hex color (no #).
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const glyph = sanitizeGlyph(searchParams.get('i'))
  const fill = sanitizeHex(searchParams.get('c'))

  const t = escapeXml(glyph)
  const fontSize = glyph.length === 1 ? '18' : '14'

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#${fill}"/>
  <text x="16" y="22" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="600" font-family="ui-sans-serif,system-ui,sans-serif">${t}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
