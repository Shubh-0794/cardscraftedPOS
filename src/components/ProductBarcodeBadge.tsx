import React, { useMemo } from 'react';

interface ProductBarcodeBadgeProps {
  code: string;
  className?: string;
  height?: number;
  width?: number;
  showText?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
}

/**
 * High-fidelity vector mini-barcode graphic for product cards and stock indicators.
 * Generates deterministic 1D barcode stripes based on the product's barcode string.
 */
export const ProductBarcodeBadge: React.FC<ProductBarcodeBadgeProps> = ({
  code,
  className = '',
  height = 14,
  width = 46,
  showText = false,
  onClick,
  clickable = false,
}) => {
  const bars = useMemo(() => {
    const raw = (code || '000000000000').trim();
    // Deterministic hash to seed realistic 1D barcode bar widths
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    }
    hash = Math.abs(hash);

    const elements: { isBar: boolean; width: number }[] = [];
    // Start guard bars (3 bars: 1 0 1)
    elements.push({ isBar: true, width: 1.5 });
    elements.push({ isBar: false, width: 1.2 });
    elements.push({ isBar: true, width: 1.5 });
    elements.push({ isBar: false, width: 1.2 });

    let currentHash = hash;
    for (let i = 0; i < 14; i++) {
      const bit = currentHash % 3;
      currentHash = Math.floor(currentHash / 3) + (raw.charCodeAt(i % raw.length) * 7);
      const isBar = i % 2 === 0;
      const barWidth = isBar ? (bit === 0 ? 1.2 : bit === 1 ? 2.2 : 1.6) : (bit === 0 ? 1.2 : 1.8);
      elements.push({ isBar, width: barWidth });
    }

    // End guard bars
    elements.push({ isBar: false, width: 1.2 });
    elements.push({ isBar: true, width: 1.5 });
    elements.push({ isBar: false, width: 1.2 });
    elements.push({ isBar: true, width: 1.5 });

    return elements;
  }, [code]);

  let totalWidth = 2;
  const renderedBars = bars.map((b, idx) => {
    const x = totalWidth;
    totalWidth += b.width;
    if (!b.isBar) return null;
    return (
      <rect
        key={idx}
        x={x}
        y={1}
        width={b.width}
        height={height - 2}
        fill="#0f172a"
      />
    );
  });

  const viewBoxWidth = Math.max(totalWidth + 2, 44);
  const isInteractive = Boolean(onClick || clickable);

  return (
    <span
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={`inline-flex items-center gap-1 bg-white/95 px-1 py-0.5 rounded-[3px] border border-slate-300 shadow-2xs transition-all select-none ${
        isInteractive
          ? 'cursor-pointer hover:scale-110 hover:border-blue-500 hover:shadow-md hover:ring-1 hover:ring-blue-400'
          : 'cursor-default'
      } ${className}`}
      title={isInteractive ? `Click to view large barcode & download PNG (${code})` : `Barcode: ${code}`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        className="shrink-0 block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width={viewBoxWidth} height={height} fill="#ffffff" rx="1" />
        {renderedBars}
      </svg>
      {showText && (
        <span className="text-[8px] font-mono font-bold text-slate-800 leading-none">
          {code.slice(-4)}
        </span>
      )}
    </span>
  );
};
