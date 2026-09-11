import React, { useMemo, useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface ProductQrBadgeProps {
  code: string;
  className?: string;
  size?: number;
  showText?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
}

/**
 * High-fidelity micro QR Code badge component for products, inventory, and invoices.
 * Renders an authentic crisp QR matrix with interactive click-to-expand capabilities.
 */
export const ProductQrBadge: React.FC<ProductQrBadgeProps> = ({
  code,
  className = '',
  size = 18,
  showText = false,
  onClick,
  clickable = false,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  const rawCode = (code || '000000000000').trim();

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(rawCode, {
      width: 120,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'L',
    })
      .then((url) => {
        if (isMounted) setQrUrl(url);
      })
      .catch(() => {
        // fallback
      });

    return () => {
      isMounted = false;
    };
  }, [rawCode]);

  const isInteractive = Boolean(onClick || clickable);

  return (
    <span
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={`inline-flex items-center gap-1.5 bg-white px-1.5 py-0.5 rounded-[4px] border border-slate-300 shadow-2xs transition-all select-none ${
        isInteractive
          ? 'cursor-pointer hover:scale-105 hover:border-blue-500 hover:shadow-md hover:ring-1 hover:ring-blue-400'
          : 'cursor-default'
      } ${className}`}
      title={isInteractive ? `Click to view large QR Code & download PNG (${rawCode})` : `QR Code: ${rawCode}`}
    >
      {qrUrl ? (
        <img
          src={qrUrl}
          alt={`QR ${rawCode}`}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="shrink-0 block rounded-[2px]"
        />
      ) : (
        <span
          style={{ width: `${size}px`, height: `${size}px` }}
          className="shrink-0 bg-slate-200 animate-pulse rounded-[2px]"
        />
      )}

      {showText && (
        <span className="text-[9px] font-mono font-bold text-slate-800 leading-none">
          {rawCode.slice(-6)}
        </span>
      )}
    </span>
  );
};

// Backwards compatibility alias
export const ProductBarcodeBadge = ProductQrBadge;
