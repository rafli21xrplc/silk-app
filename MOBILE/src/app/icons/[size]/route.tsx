import { ImageResponse } from 'next/og';

const SIZES = new Set([180, 192, 512]);

/** Ikon aplikasi PNG (layar utama, manifest). Bentuk: denyut di atas ubin teal, aman untuk ikon "maskable". */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const stroke = Math.round(size * 0.07);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #2e9e8c, #0a5650)' }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={(stroke / size) * 24 * 1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l3-8 4 16 3-8h4" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'cache-control': 'public, max-age=86400, immutable' } },
  );
}
