import { useMemo } from 'react';
import QR from 'qrcode';

/**
 * Renders the SIMULATED ticket QR as crisp SVG. The encoded text itself states
 * "DEMO ONLY — NOT VALID FOR TRAVEL"; it is not a railway travel credential.
 */
export function QRCode({ value, size = 168, label = 'Simulated QR code — demo only, not a travel credential', void: isVoid }: { value: string; size?: number; label?: string; void?: boolean }) {
  const { path, n } = useMemo(() => {
    const qr = QR.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.modules.get(r, c)) d += `M${c},${r}h1v1h-1z`;
    return { path: d, n: count };
  }, [value]);
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg role="img" aria-label={label} viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} shapeRendering="crispEdges" className={isVoid ? 'opacity-25' : undefined}>
        <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
        <path d={path} fill="#0f172a" />
      </svg>
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="-rotate-[28deg] rounded bg-white/85 px-1.5 py-0.5 text-[11px] font-extrabold tracking-wider text-red-600 ring-1 ring-red-300">DEMO</span>
      </span>
    </div>
  );
}
