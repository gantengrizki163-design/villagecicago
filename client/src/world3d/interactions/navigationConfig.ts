export const NAVIGATION_FEATURE_FLAGS = {
  /** Fitur jalan otomatis ("Jalan ke Sana") dapat dinonaktifkan cepat lewat flag ini */
  AUTO_WALK_ENABLED: true,
  /** Tampilkan minimap navigasi saat panduan arah aktif atau ditoggle pemain */
  MINIMAP_ENABLED: true,
} as const;

export const NAVIGATION_TUNING = {
  /** Kecepatan berjalan standar karakter (m/detik) sesuai BASE_SPEED di LocalPlayer.tsx */
  WALK_SPEED_MPS: 5.4,
  /** Toleransi mencapai waypoint antara sebelum lanjut ke waypoint berikutnya (m) */
  WAYPOINT_REACH_RADIUS_METERS: 1.35,
  /** Durasi tanpa progres (<0.2m) sebelum jalan otomatis dianggap macet & dihentikan (detik) */
  AUTO_WALK_STUCK_TIMEOUT_SEC: 3.5,
  /** Ambang jarak minimal untuk mendeteksi progres gerakan (m) */
  AUTO_WALK_MIN_PROGRESS_METERS: 0.25,
  /** Lebar koridor pencarian path A* pada peta Cicalengka (m per sel) */
  ASTAR_GRID_STEP_METERS: 2,
} as const;
