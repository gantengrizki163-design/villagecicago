import React from 'react';
import { Html } from '@react-three/drei';

interface FloatingTagProps {
  name: string;
  chatBubble?: string | null;
  isSelf?: boolean;
  yOffset?: number;
}

export const FloatingTag: React.FC<FloatingTagProps> = ({
  name,
  chatBubble,
  isSelf = false,
  yOffset = 2.15,
}) => {
  return (
    <Html position={[0, yOffset, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="pointer-events-none flex flex-col items-center gap-1 select-none">
        {chatBubble && (
          <div className="max-w-[180px] rounded-xl bg-white px-2.5 py-1 text-[11px] font-medium text-slate-900 shadow-lg border border-slate-300 text-center leading-snug break-words">
            {chatBubble}
          </div>
        )}
        <div
          className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold shadow ${
            isSelf
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
              : 'bg-slate-900/90 text-slate-100 border border-slate-700'
          }`}
        >
          {name}
        </div>
      </div>
    </Html>
  );
};
