import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Car,
  CheckCircle2,
  FileCheck2,
  Navigation,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  callRegisterVehicle,
  callRenewRegistration,
  callRetrieveVehicle,
  callTakeLicenseExam,
} from '../firebase/api';
import { formatRupiah } from '../firebase/gameTime';
import {
  computeLazyStnkStatusClient,
  getDefaultVehicleConfig,
} from '../firebase/vehicleConfigCache';
import type { CharacterDoc, DriverLicenseDoc, VehicleDoc } from '../types/game';

interface SamsatSimModalProps {
  open: boolean;
  character: CharacterDoc;
  vehicles: VehicleDoc[];
  driverLicense: DriverLicenseDoc | null;
  serverNowMs: number;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

interface SimQuestion {
  q: string;
  options: [string, string, string];
}

// Urutan jawaban benar disinkronkan 100% dengan backend SIM_ANSWER_KEY:
// SIM C: [1, 0, 2, 1, 0]
// SIM A: [2, 1, 0, 2, 1]
export const SIM_C_QUESTIONS: SimQuestion[] = [
  {
    q: 'Batas kecepatan aman sepeda motor di jalan lingkungan permukiman Cicalengka adalah...',
    options: [
      '70 km/jam agar cepat sampai',
      '25–30 km/jam sambil mewaspadai warga',
      'Bebas asal jalan sedang sepi',
    ],
  },
  {
    q: 'Saat lampu lalu lintas menyala kuning setelah hijau di simpang Alun-Alun, pengendara wajib...',
    options: [
      'Mengurangi kecepatan dan bersiap berhenti sebelum garis putih',
      'Memacu gas penuh agar sempat menerobos',
      'Membunyikan klakson terus-menerus tanpa mengerem',
    ],
  },
  {
    q: 'Palang perlintasan kereta Stasiun Cicalengka mulai menutup dan sirine berbunyi. Sikap yang benar...',
    options: [
      'Menyalip kendaraan di depan lewat jalur kanan',
      'Berhenti tepat di atas rel kereta api',
      'Berhenti di belakang garis aman hingga palang terbuka penuh',
    ],
  },
  {
    q: 'Dokumen wajib yang harus aktif dan dibawa saat mengendarai motor di jalan raya adalah...',
    options: [
      'Kartu belanja warung saja',
      'SIM C aktif dan STNK kendaraan yang masih berlaku',
      'Sertifikat tanah rumah',
    ],
  },
  {
    q: 'Ketika hendak berbelok atau berpindah lajur di Jalan Raya Cicalengka, pengendara harus...',
    options: [
      'Menyalakan lampu sein lebih awal dan memastikan kondisi aman',
      'Langsung berbelok mendadak tanpa isyarat',
      'Mematikan lampu utama saat malam hari',
    ],
  },
];

export const SIM_A_QUESTIONS: SimQuestion[] = [
  {
    q: 'Posisi lajur yang tepat saat mengemudikan mobil penumpang di jalan arteri dua arah Indonesia adalah...',
    options: [
      'Mengambil lajur paling kanan terus-menerus',
      'Berjalan di bahu trotoar pejalan kaki',
      'Menggunakan lajur kiri dan menjaga jarak aman',
    ],
  },
  {
    q: 'Saat mendekati zebra cross dengan pejalan kaki hendak menyeberang di depan Pasar, pengemudi wajib...',
    options: [
      'Mempercepat laju agar pejalan kaki menunggu',
      'Memperlambat laju dan memprioritaskan pejalan kaki',
      'Membelokkan mobil ke atas trotoar',
    ],
  },
  {
    q: 'Bila terjadi hujan deras dan jarak pandang menurun pada malam hari, pengemudi mobil wajib...',
    options: [
      'Menyalakan lampu utama dan menurunkan kecepatan',
      'Mengemudi dengan kecepatan maksimal',
      'Mematikan semua lampu supaya tidak silau',
    ],
  },
  {
    q: 'Manakah tempat parkir mobil yang aman agar terhindar dari derek Dishub dan tilang?',
    options: [
      'Tepat di depan palang pintu rel kereta api',
      'Di tengah persimpangan jalan arteri',
      'Di garasi rumah atau lahan parkir resmi (Stasiun/Pasar/Bank/Alun-Alun)',
    ],
  },
  {
    q: 'Bila kendaraan mengalami gangguan mesin atau berhenti darurat di pinggir jalan, pengemudi harus...',
    options: [
      'Meninggalkan mobil di lajur tengah tanpa tanda',
      'Menyalakan lampu hazard dan menepi ke area aman',
      'Memundurkan mobil melawan arus lalu lintas',
    ],
  },
];

const STEER_DRILLS = [
  {
    title: 'Simulasi 1: Pejalan kaki menyeberang di Pasar Cicalengka',
    choices: ['Tancap gas', 'Rem halus & beri jalan', 'Klason panjang'],
    safeIdx: 1,
  },
  {
    title: 'Simulasi 2: Tikungan basah saat gerimis menuju Nagreg',
    choices: ['Kurangi gas sebelum tikungan', 'Belok patah kecepatan tinggi', 'Matikan lampu'],
    safeIdx: 0,
  },
  {
    title: 'Simulasi 3: Sirine perlintasan KA Cicalengka berbunyi',
    choices: ['Terobos cepat', 'Ikuti motor di depan', 'Berhenti di garis aman'],
    safeIdx: 2,
  },
];

export const SamsatSimModal: React.FC<SamsatSimModalProps> = ({
  open,
  character,
  vehicles,
  driverLicense,
  serverNowMs,
  onClose,
  onNotify,
}) => {
  const cfg = getDefaultVehicleConfig().vehicles;
  const [tab, setTab] = useState<'stnk' | 'sim'>('stnk');
  const [simCategory, setSimCategory] = useState<'C' | 'A'>('C');
  const [answersC, setAnswersC] = useState<number[]>([-1, -1, -1, -1, -1]);
  const [answersA, setAnswersA] = useState<number[]>([-1, -1, -1, -1, -1]);
  const [drillChoices, setDrillChoices] = useState<number[]>([-1, -1, -1]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const currentQuestions = simCategory === 'C' ? SIM_C_QUESTIONS : SIM_A_QUESTIONS;
  const currentAnswers = simCategory === 'C' ? answersC : answersA;
  const setCurrentAnswers = simCategory === 'C' ? setAnswersC : setAnswersA;

  const simCEntry = driverLicense?.simC;
  const simAEntry = driverLicense?.simA;
  const simCValid = Boolean(simCEntry?.active && simCEntry.expiresAtMs > serverNowMs);
  const simAValid = Boolean(simAEntry?.active && simAEntry.expiresAtMs > serverNowMs);

  const simCfg = simCategory === 'C' ? cfg.licenseSettings.simC : cfg.licenseSettings.simA;
  const allMcqAnswered = currentAnswers.every((a) => a >= 0);
  const allDrillsPassed = drillChoices.every((c, idx) => c === STEER_DRILLS[idx].safeIdx);

  const handleRenewStnk = async (vehicleId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callRenewRegistration(vehicleId);
      onNotify(`Pajak STNK diperpanjang! Total dibayar ${formatRupiah(res.totalDue)}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memperpanjang STNK.');
    } finally {
      setBusy(false);
    }
  };

  const handleNewPlate = async (vehicleId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callRegisterVehicle(vehicleId);
      onNotify(`Plat baru diterbitkan: ${res.plateNumber}.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menerbitkan plat baru.');
    } finally {
      setBusy(false);
    }
  };

  const handleRetrieve = async (vehicleId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await callRetrieveVehicle(vehicleId, 'alun_alun');
      onNotify(`Kendaraan ditebus (${formatRupiah(res.fee)}) dan dipindahkan ke Parkir Alun-Alun.`);
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal menebus kendaraan.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitExam = async () => {
    if (busy) return;
    if (!allMcqAnswered) {
      onNotify('Jawab semua 5 soal aturan lalu lintas terlebih dahulu.');
      return;
    }
    if (!allDrillsPassed) {
      onNotify('Selesaikan mini-game tes kemudi dengan pilihan paling aman.');
      return;
    }
    setBusy(true);
    try {
      const res = await callTakeLicenseExam(simCategory, currentAnswers);
      if (res.passed) {
        const licNum = (res.license as { licenseNumber?: string } | undefined)?.licenseNumber || '';
        onNotify(
          `SELAMAT! Lulus ujian SIM ${simCategory} (Nilai ${res.score}/100).${licNum ? ` Nomor: ${licNum}.` : ''}`
        );
      } else {
        onNotify(
          `Nilai teori ${res.score}/100 (minimal ${simCfg.passScore}). Periksa kembali jawaban rambu dan coba lagi.`
        );
      }
    } catch (err) {
      onNotify((err as Error)?.message || 'Gagal memproses ujian SIM.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="truncate">Loket Samsat, STNK &amp; Ujian SIM</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              Tunai {formatRupiah(character.money)} · SIM C: {simCValid ? 'Aktif' : 'Belum'} · SIM A:{' '}
              {simAValid ? 'Aktif' : 'Belum'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white shrink-0 cursor-pointer"
            aria-label="Tutup Samsat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/50 px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => setTab('stnk')}
            className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              tab === 'stnk'
                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <Car className="h-3.5 w-3.5" />
            <span>STNK, Pajak &amp; Sitaan ({vehicles.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('sim')}
            className={`min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              tab === 'sim'
                ? 'bg-sky-500 border-sky-400 text-slate-950'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Ujian SIM C &amp; SIM A</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'stnk' ? (
            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
                  Belum ada kendaraan terdaftar atas nama {character.name}.
                </div>
              ) : (
                vehicles.map((v) => {
                  const stnk = computeLazyStnkStatusClient(v, serverNowMs, cfg);
                  const isImpoundedOrStolen = v.status === 'impounded' || v.status === 'stolen';
                  return (
                    <div
                      key={v.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{v.name}</span>
                            <span className="text-xs font-mono font-bold text-amber-300">
                              {v.plateNumber}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                            {stnk.isExpired
                              ? stnk.inGracePeriod
                                ? 'Masa tenggang pajak STNK'
                                : `STNK mati (${stnk.overduePeriods} periode terlambat)`
                              : 'STNK Aktif'}
                            {isImpoundedOrStolen ? ` · Status: ${v.status.toUpperCase()}` : ''}
                          </div>
                        </div>

                        <div className="text-right font-mono tabular-nums">
                          <div className="text-xs text-slate-400">
                            Pajak {formatRupiah(stnk.baseTax)}
                            {stnk.latePenalty > 0 ? ` + Denda ${formatRupiah(stnk.latePenalty)}` : ''} + Admin{' '}
                            {formatRupiah(cfg.stnkAdminFee)}
                          </div>
                          <div className="text-sm font-bold text-emerald-300">
                            {formatRupiah(stnk.totalDue)}
                          </div>
                        </div>
                      </div>

                      {stnk.isExpired && !stnk.inGracePeriod && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Berkendara dengan STNK mati berisiko ditilang polisi &amp; Dishub.
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRenewStnk(v.id)}
                          className="min-h-[38px] px-3.5 rounded-xl bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Perpanjang STNK ({formatRupiah(stnk.totalDue)})</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleNewPlate(v.id)}
                          className="min-h-[38px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Ganti Plat ({formatRupiah(cfg.stnkAdminFee)})</span>
                        </button>
                        {isImpoundedOrStolen && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRetrieve(v.id)}
                            className="min-h-[38px] px-3 rounded-xl bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Tebus Sitaan ke Alun-Alun</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* License Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSimCategory('C')}
                  className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
                    simCategory === 'C'
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">SIM C (Sepeda Motor)</span>
                    <span
                      className={`text-xs font-semibold ${
                        simCValid ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {simCValid ? 'Aktif' : 'Belum Aktif'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                    Biaya {formatRupiah(cfg.licenseSettings.simC.fee)} · Lulus &ge;{' '}
                    {cfg.licenseSettings.simC.passScore}
                    {simCEntry?.licenseNumber ? ` · ${simCEntry.licenseNumber}` : ''}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimCategory('A')}
                  className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer ${
                    simCategory === 'A'
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">SIM A (Mobil)</span>
                    <span
                      className={`text-xs font-semibold ${
                        simAValid ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {simAValid ? 'Aktif' : 'Belum Aktif'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400 font-mono tabular-nums">
                    Biaya {formatRupiah(cfg.licenseSettings.simA.fee)} · Lulus &ge;{' '}
                    {cfg.licenseSettings.simA.passScore}
                    {simAEntry?.licenseNumber ? ` · ${simAEntry.licenseNumber}` : ''}
                  </div>
                </button>
              </div>

              {/* 5 Theory Questions */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-sky-300">
                  Bagian 1: Soal Teori Rambu &amp; Tata Tertib (SIM {simCategory})
                </div>
                {currentQuestions.map((item, qIdx) => (
                  <div
                    key={`${simCategory}_${qIdx}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"
                  >
                    <div className="text-xs font-semibold text-white">
                      {qIdx + 1}. {item.q}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {item.options.map((opt, optIdx) => {
                        const selected = currentAnswers[qIdx] === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              const next = [...currentAnswers];
                              next[qIdx] = optIdx;
                              setCurrentAnswers(next);
                            }}
                            className={`text-left min-h-[36px] px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                              selected
                                ? 'bg-sky-500/20 border-sky-400 text-sky-100 font-semibold'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini-Game Tes Kemudi */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-emerald-300">
                    Bagian 2: Mini-Game Refleks Kemudi &amp; Rambu (3 Situasi)
                  </div>
                  {allDrillsPassed && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Lulus Praktik
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {STEER_DRILLS.map((drill, dIdx) => (
                    <div key={dIdx} className="space-y-1.5">
                      <div className="text-xs text-slate-200 font-medium">{drill.title}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                        {drill.choices.map((c, cIdx) => {
                          const picked = drillChoices[dIdx] === cIdx;
                          const isSafe = cIdx === drill.safeIdx;
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => {
                                const next = [...drillChoices];
                                next[dIdx] = cIdx;
                                setDrillChoices(next);
                              }}
                              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                picked
                                  ? isSafe
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                    : 'bg-rose-500/20 border-rose-400 text-rose-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={busy || !allMcqAnswered || !allDrillsPassed}
                onClick={() => void handleSubmitExam()}
                className="w-full min-h-[44px] rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 cursor-pointer disabled:opacity-50"
              >
                Kirim Ujian SIM {simCategory} ({formatRupiah(simCfg.fee)})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
