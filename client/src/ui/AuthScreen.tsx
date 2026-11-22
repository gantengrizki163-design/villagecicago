import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase/config';

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Email atau kata sandi salah.';
  }
  if (code.includes('user-not-found')) return 'Akun tidak ditemukan. Silakan daftar dulu.';
  if (code.includes('email-already-in-use')) return 'Email ini sudah terdaftar.';
  if (code.includes('weak-password')) return 'Kata sandi minimal 6 karakter.';
  if (code.includes('popup-closed-by-user')) return 'Login Google dibatalkan.';
  if (code.includes('operation-not-allowed')) {
    return 'Provider Email/Password belum diaktifkan di Firebase Console (atau gunakan Emulator / Google Sign-In).';
  }
  return (err as Error)?.message || 'Gagal masuk ke akun.';
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overscroll-y-contain touch-pan-y bg-slate-950 text-slate-100 px-4 pt-6 pb-10 sm:py-8">
      <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-emerald-500/30 bg-slate-900 p-5 sm:p-8 shadow-2xl">
        <div className="text-center">
          <span className="inline-block rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
            Kab. Bandung · Jawa Barat
          </span>
          <h1 className="mt-2 text-2xl font-bold text-white">Cicalengka Life 3D</h1>
          <p className="mt-1 text-xs text-slate-400">
            Wilujeng Sumping! Masuk pikeun ngajajah Stasiun, Alun-Alun, jeung Warung Cicalengka.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'register' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Daftar Baru
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="akang@cicalengka.id"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk ka Cicalengka' : 'Buat Akun'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <span>atau</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogle}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Masuk dengan Google
        </button>
        </div>
      </div>
    </div>
  );
};
