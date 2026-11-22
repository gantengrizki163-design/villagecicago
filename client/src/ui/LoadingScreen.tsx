import React from 'react';

interface LoadingScreenProps {
  progress: number;
  label?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  label = 'Menyiapkan Cicalengka 3D...',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-slate-900 p-6 shadow-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Cicalengka Life 3D
        </div>
        <h2 className="mt-1 text-lg font-bold text-white">Wilujeng Sumping</h2>
        <p className="mt-1 text-xs text-slate-400">{label}</p>

        <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            style={{ width: `${clamped}%` }}
            className="h-full bg-emerald-500 transition-all duration-300"
          />
        </div>
        <div className="mt-2 text-xs font-mono text-emerald-300">{clamped}%</div>
      </div>
    </div>
  );
};
