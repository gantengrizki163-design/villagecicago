import interactionLocationsJson from '../../../../functions/src/config/interactionLocations.json';
import { computeClientNpcPose, DEFAULT_NPCS_CONFIG, type NpcsConfigBundle } from '../../firebase/npcDeterminism';
import { getDefaultVehicleConfig } from '../../firebase/vehicleConfigCache';
import type {
  BusinessDoc,
  BusinessJobPostDoc,
  CharacterDoc,
  JobConfigItem,
  LandPlotDoc,
  PropertyDoc,
  ZoneId,
} from '../../types/game';
import { findLotPlacement, getLotById, LAYOUT_DATA } from '../layout/layoutHelpers';
import {
  AGENT_OFFICE_POS,
  ATM_LOCATIONS,
  BALAI_LELANG_POS,
  BANK_POS,
  BATH_POS,
  COURIER_POS,
  distance2D,
  EMPERAN_SPOTS,
  FACTORY_RANCAEKEK_POS,
  INITIAL_LAND_PLOTS_DATA,
  INITIAL_PROPERTIES_DATA,
  INTERACT_HYSTERESIS_METERS,
  INTERACT_RADIUS_METERS,
  KANTOR_DESA_POS,
  KLINIK_SWASTA_POS,
  KONTRAKAN_POSITIONS,
  MINIMARKET_POS,
  NPC_INTERACT_RADIUS_METERS,
  PASAR_GROSIR_POS,
  PASAR_POS,
  PENAMPUNGAN_POS,
  POLSEK_POS,
  PUSKESMAS_POS,
  SCHOOL_BANDUNG_POS,
  SCHOOL_POS,
  STATION_SPAWN,
  TICKET_BOOTH_POS,
  TOKO_MEBEL_POS,
  WARUNG_POS,
} from '../worldConstants';

export type InteractionMenuId =
  | 'jobs'
  | 'start_shift'
  | 'clinic'
  | 'courses'
  | 'train'
  | 'bank'
  | 'business'
  | 'business_create'
  | 'wholesale'
  | 'auction'
  | 'law'
  | 'police'
  | 'agent_developer'
  | 'furniture_shop'
  | 'furniture_inventory'
  | 'warung'
  | 'penampungan'
  | 'emperan'
  | 'bath_mck'
  | 'kontrakan'
  | 'land_construction'
  | 'buy_land'
  | 'apply_imb'
  | 'mortgage_security'
  | 'apply_mortgage'
  | 'house_search'
  | 'property_survey'
  | 'property_enter'
  | 'business_shop'
  | 'marketplace'
  | 'economy'
  | 'my_property'
  | 'offers'
  | 'profile'
  | 'quests'
  | 'settings'
  | 'npc'
  | 'dealer'
  | 'spbu'
  | 'workshop'
  | 'samsat_sim'
  | 'vehicles_garage';

export interface WorldPoint2D {
  x: number;
  z: number;
}

export interface InteractionDestination {
  /** ID unik tujuan (id lot, atm, properti, atau npc) */
  id: string;
  /** Nama tempat dalam bahasa Indonesia untuk UI & toast */
  label: string;
  /** Keterangan singkat tambahan (misal nama pekerjaan / status) */
  subtitle?: string;
  /** Kategori ikon tujuan */
  iconKind:
    | 'work'
    | 'clinic'
    | 'school'
    | 'train'
    | 'bank'
    | 'atm'
    | 'business'
    | 'wholesale'
    | 'auction'
    | 'law'
    | 'agent'
    | 'furniture'
    | 'warung'
    | 'sleep'
    | 'bath'
    | 'house'
    | 'land'
    | 'npc'
    | 'vehicle'
    | 'fuel'
    | 'workshop'
    | 'samsat';
  /** Zona tempat lokasi berada */
  zone: ZoneId;
  /** Titik tiba (di depan pintu / loket, bukan di tengah bangunan) */
  arrivalPoint: WorldPoint2D;
  /** Titik pusat bangunan (untuk paritas pengecekan radius server) */
  centerPoint: WorldPoint2D;
  /** Radius interaksi efektif (meter) — wajib sama dengan server */
  radius: number;
  /** Payload opsional saat tujuan dibuka (misal clinicId, jobId, propertyId, npcId) */
  payload?: Record<string, unknown>;
}

export interface MenuLocationPolicy {
  menuId: InteractionMenuId;
  /** Penamaan pendek pada badge menu */
  shortLabel: string;
  /** Golongan B: boleh dibuka dari mana saja (tanpa perlu tiba di lokasi) */
  allowRemote: boolean;
  /** Penjelasan alasan jika dibatasi saat jauh */
  remotePolicyNote?: string;
}

export interface InteractionContext {
  character: CharacterDoc;
  hasBankAccount?: boolean;
  requiresBankBranch?: boolean;
  isJailed?: boolean;
  jobs?: JobConfigItem[];
  businessJobPosts?: BusinessJobPostDoc[];
  businesses?: BusinessDoc[];
  properties?: PropertyDoc[];
  landPlots?: LandPlotDoc[];
  npcsConfig?: NpcsConfigBundle;
  serverNowMs?: number;
  /** Target spesifik jika membuka gerbang untuk objek dinamis tertentu */
  targetPropertyId?: string | null;
  targetBusinessId?: string | null;
  targetPlotId?: string | null;
  targetNpcId?: string | null;
  targetClinicId?: string | null;
  targetJobId?: string | null;
  targetSpotId?: string | null;
  targetDealerId?: string | null;
}

export interface DestinationLookupResult {
  menuId: InteractionMenuId;
  policy: MenuLocationPolicy;
  destinations: InteractionDestination[];
  nearest: InteractionDestination | null;
  distanceMeters: number | null;
  inRange: boolean;
  requiresTrain: boolean;
  targetZone: ZoneId;
}

const SHARED_LOCATIONS = interactionLocationsJson.locations as Record<
  string,
  { zone: ZoneId; label: string; x: number; z: number; doorX: number; doorZ: number }
>;

function resolveLotDestination(
  lotId: string,
  opts: {
    id?: string;
    label?: string;
    subtitle?: string;
    iconKind: InteractionDestination['iconKind'];
    radius?: number;
    payload?: Record<string, unknown>;
  }
): InteractionDestination {
  const placement = findLotPlacement(lotId);
  const shared = SHARED_LOCATIONS[lotId];
  const centerPoint = placement
    ? { x: placement.x, z: placement.z }
    : shared
      ? { x: shared.x, z: shared.z }
      : { x: 0, z: 0 };
  const arrivalPoint = placement
    ? { x: placement.door.x, z: placement.door.z }
    : shared
      ? { x: shared.doorX, z: shared.doorZ }
      : centerPoint;

  return {
    id: opts.id ?? lotId,
    label: opts.label ?? shared?.label ?? (placement?.lot.label || lotId),
    subtitle: opts.subtitle,
    iconKind: opts.iconKind,
    zone: shared?.zone ?? 'cicalengka',
    arrivalPoint,
    centerPoint,
    radius: opts.radius ?? INTERACT_RADIUS_METERS,
    payload: opts.payload,
  };
}

function resolveSharedDestination(
  sharedId: string,
  fallbackPos: WorldPoint2D,
  opts: {
    id?: string;
    label?: string;
    subtitle?: string;
    iconKind: InteractionDestination['iconKind'];
    zone?: ZoneId;
    radius?: number;
    payload?: Record<string, unknown>;
  }
): InteractionDestination {
  const shared = SHARED_LOCATIONS[sharedId];
  const centerPoint = shared ? { x: shared.x, z: shared.z } : { ...fallbackPos };
  const arrivalPoint = shared ? { x: shared.doorX, z: shared.doorZ } : { ...fallbackPos };
  return {
    id: opts.id ?? sharedId,
    label: opts.label ?? shared?.label ?? sharedId,
    subtitle: opts.subtitle,
    iconKind: opts.iconKind,
    zone: shared?.zone ?? opts.zone ?? 'cicalengka',
    arrivalPoint,
    centerPoint,
    radius: opts.radius ?? INTERACT_RADIUS_METERS,
    payload: opts.payload,
  };
}

function resolveDynamicPropertyDestination(
  prop: PropertyDoc,
  opts: {
    id?: string;
    label?: string;
    subtitle?: string;
    iconKind?: InteractionDestination['iconKind'];
    payload?: Record<string, unknown>;
  }
): InteractionDestination {
  const placement = findLotPlacement(prop.id);
  const centerPoint = { x: prop.position.x, z: prop.position.z };
  const arrivalPoint = placement
    ? { x: placement.door.x, z: placement.door.z }
    : {
        x: prop.position.x,
        z: prop.position.z + Math.max(2.5, (prop.size?.depth ?? 6) / 2 + 1.2),
      };
  const propRadius = Math.max(
    INTERACT_RADIUS_METERS,
    Math.max(prop.size?.width ?? 6, prop.size?.depth ?? 6) / 2 + 4.8
  );
  return {
    id: opts.id ?? prop.id,
    label: opts.label ?? prop.name,
    subtitle: opts.subtitle,
    iconKind: opts.iconKind ?? 'house',
    zone: (prop.zone || 'cicalengka') as ZoneId,
    arrivalPoint,
    centerPoint,
    radius: propRadius,
    payload: opts.payload,
  };
}

const JOB_ID_TO_DEST: Record<string, { lotId: string; zone: ZoneId; fallback: WorldPoint2D; label: string }> = {
  kasir_minimarket: {
    lotId: 'minimarket',
    zone: 'cicalengka',
    fallback: MINIMARKET_POS,
    label: 'Minimarket Cicalengka',
  },
  pedagang_pasar: {
    lotId: 'pasar',
    zone: 'cicalengka',
    fallback: PASAR_POS,
    label: 'Pasar Baru Cicalengka',
  },
  kurir: {
    lotId: 'pos_kurir',
    zone: 'cicalengka',
    fallback: COURIER_POS,
    label: 'Pos Kurir Cicalengka',
  },
  ojek_online: {
    lotId: 'pangkalan_ojek',
    zone: 'cicalengka',
    fallback: { x: 8, z: -40 },
    label: 'Pangkalan CikOjek Stasiun',
  },
  sopir_angkot: {
    lotId: 'terminal_angkot',
    zone: 'cicalengka',
    fallback: { x: 4, z: -40 },
    label: 'Terminal & Halte Stasiun',
  },
  sopir_logistik: {
    lotId: 'pasar_grosir',
    zone: 'cicalengka',
    fallback: PASAR_GROSIR_POS,
    label: 'Pasar Grosir Induk',
  },
  polisi: {
    lotId: 'polsek',
    zone: 'cicalengka',
    fallback: POLSEK_POS,
    label: 'Polsek Cicalengka',
  },
  agen_properti: {
    lotId: 'kantor_agen',
    zone: 'cicalengka',
    fallback: AGENT_OFFICE_POS,
    label: 'Kantor Agen Properti',
  },
  buruh_pabrik: {
    lotId: 'factory_rancaekek',
    zone: 'rancaekek',
    fallback: FACTORY_RANCAEKEK_POS,
    label: 'PT Tekstil Rancaekek',
  },
  guru_honorer: {
    lotId: 'school_bandung',
    zone: 'bandung',
    fallback: SCHOOL_BANDUNG_POS,
    label: 'SDN Harapan Bandung',
  },
};

export const MENU_POLICIES: Record<InteractionMenuId, MenuLocationPolicy> = {
  jobs: { menuId: 'jobs', shortLabel: 'Kerja', allowRemote: false },
  start_shift: { menuId: 'start_shift', shortLabel: 'Shift', allowRemote: false },
  clinic: { menuId: 'clinic', shortLabel: 'Klinik', allowRemote: false },
  courses: { menuId: 'courses', shortLabel: 'Kursus', allowRemote: false },
  train: { menuId: 'train', shortLabel: 'Kereta', allowRemote: false },
  bank: { menuId: 'bank', shortLabel: 'Bank', allowRemote: false },
  business: { menuId: 'business', shortLabel: 'Bisnis', allowRemote: false },
  business_create: { menuId: 'business_create', shortLabel: 'Izin Usaha', allowRemote: false },
  wholesale: { menuId: 'wholesale', shortLabel: 'Pasar Grosir', allowRemote: false },
  auction: { menuId: 'auction', shortLabel: 'Lelang', allowRemote: false },
  law: { menuId: 'law', shortLabel: 'Hukum', allowRemote: false },
  police: { menuId: 'police', shortLabel: 'Polisi', allowRemote: true },
  agent_developer: { menuId: 'agent_developer', shortLabel: 'Agen', allowRemote: false },
  furniture_shop: { menuId: 'furniture_shop', shortLabel: 'Toko Mebel', allowRemote: false },
  furniture_inventory: { menuId: 'furniture_inventory', shortLabel: 'Gudang Mebel', allowRemote: true },
  warung: { menuId: 'warung', shortLabel: 'Warung', allowRemote: false },
  penampungan: { menuId: 'penampungan', shortLabel: 'Penampungan', allowRemote: false },
  emperan: { menuId: 'emperan', shortLabel: 'Emperan', allowRemote: false },
  bath_mck: { menuId: 'bath_mck', shortLabel: 'MCK', allowRemote: false },
  kontrakan: { menuId: 'kontrakan', shortLabel: 'Kontrakan', allowRemote: false },
  land_construction: {
    menuId: 'land_construction',
    shortLabel: 'Kavling',
    allowRemote: true,
    remotePolicyNote: 'Boleh melihat peta & progres konstruksi; beli kavling atau ajukan IMB harus di lokasi.',
  },
  buy_land: { menuId: 'buy_land', shortLabel: 'Beli Kavling', allowRemote: false },
  apply_imb: { menuId: 'apply_imb', shortLabel: 'Ajukan IMB', allowRemote: false },
  mortgage_security: {
    menuId: 'mortgage_security',
    shortLabel: 'KPR & Aman',
    allowRemote: true,
    remotePolicyNote: 'Boleh cek cicilan & asuransi; pengajuan KPR baru harus di Bank atau Kantor Agen.',
  },
  apply_mortgage: { menuId: 'apply_mortgage', shortLabel: 'Ajukan KPR', allowRemote: false },
  house_search: {
    menuId: 'house_search',
    shortLabel: 'Cari Rumah',
    allowRemote: true,
    remotePolicyNote: 'Katalog bisa dilihat dari mana saja; survei dan masuk properti harus di depan pintu.',
  },
  property_survey: { menuId: 'property_survey', shortLabel: 'Survei Properti', allowRemote: false },
  property_enter: { menuId: 'property_enter', shortLabel: 'Masuk Properti', allowRemote: false },
  business_shop: { menuId: 'business_shop', shortLabel: 'Belanja Toko', allowRemote: false },
  marketplace: { menuId: 'marketplace', shortLabel: 'Pasar P2P', allowRemote: true },
  economy: { menuId: 'economy', shortLabel: 'Ekonomi', allowRemote: true },
  my_property: { menuId: 'my_property', shortLabel: 'Hunian', allowRemote: true },
  offers: { menuId: 'offers', shortLabel: 'Tawaran', allowRemote: true },
  profile: { menuId: 'profile', shortLabel: 'Tagihan & Profil', allowRemote: true },
  quests: { menuId: 'quests', shortLabel: 'Quest', allowRemote: true },
  settings: { menuId: 'settings', shortLabel: 'Pengaturan', allowRemote: true },
  npc: { menuId: 'npc', shortLabel: 'Warga', allowRemote: false },
  dealer: { menuId: 'dealer', shortLabel: 'Dealer & Showroom', allowRemote: false },
  spbu: { menuId: 'spbu', shortLabel: 'SPBU & Cas EV', allowRemote: false },
  workshop: { menuId: 'workshop', shortLabel: 'Bengkel Servis', allowRemote: false },
  samsat_sim: { menuId: 'samsat_sim', shortLabel: 'Samsat & SIM', allowRemote: false },
  vehicles_garage: { menuId: 'vehicles_garage', shortLabel: 'Garasi & STNK', allowRemote: true },
};

export function getMenuLocationMeta(menuId: InteractionMenuId): MenuLocationPolicy {
  return MENU_POLICIES[menuId];
}

export function isWithinDestination(
  pos: WorldPoint2D,
  dest: InteractionDestination,
  hysteresis = 0
): boolean {
  const distArrival = distance2D(pos.x, pos.z, dest.arrivalPoint.x, dest.arrivalPoint.z);
  const distCenter = distance2D(pos.x, pos.z, dest.centerPoint.x, dest.centerPoint.z);
  const effectiveDist = Math.min(distArrival, distCenter);
  return effectiveDist <= dest.radius + hysteresis;
}

export function getDistanceToDestination(pos: WorldPoint2D, dest: InteractionDestination): number {
  const distArrival = distance2D(pos.x, pos.z, dest.arrivalPoint.x, dest.arrivalPoint.z);
  const distCenter = distance2D(pos.x, pos.z, dest.centerPoint.x, dest.centerPoint.z);
  return Math.min(distArrival, distCenter);
}

export function getDestinationsForMenu(
  menuId: InteractionMenuId,
  context: InteractionContext
): InteractionDestination[] {
  const props = context.properties && context.properties.length > 0 ? context.properties : INITIAL_PROPERTIES_DATA;
  const plots = context.landPlots && context.landPlots.length > 0 ? context.landPlots : INITIAL_LAND_PLOTS_DATA;
  const currentZone = (context.character.currentZone || 'cicalengka') as ZoneId;
  const myBusinesses = (context.businesses || []).filter(
    (b) => b.ownerId === context.character.uid && b.status !== 'closed'
  );

  switch (menuId) {
    case 'warung':
      return [
        resolveLotDestination('warung', {
          label: 'Warung Nasi Teh Neng',
          subtitle: 'Makan & Minum Segera',
          iconKind: 'warung',
        }),
      ];

    case 'clinic': {
      const list = [
        resolveLotDestination('puskesmas', {
          id: 'puskesmas',
          label: 'Puskesmas Cicalengka',
          subtitle: 'Layanan Kesehatan Subsidi',
          iconKind: 'clinic',
          payload: { clinicId: 'puskesmas' },
        }),
        resolveLotDestination('klinik_swasta', {
          id: 'klinik_swasta',
          label: 'Klinik Sehat Pratama',
          subtitle: 'Layanan Dokter Cepat',
          iconKind: 'clinic',
          payload: { clinicId: 'klinik_swasta' },
        }),
      ];
      if (context.targetClinicId) {
        return list.filter((c) => c.id === context.targetClinicId);
      }
      return list;
    }

    case 'courses':
      return [
        resolveLotDestination('sekolah', {
          label: 'Balai Kursus & Sekolah Cicalengka',
          subtitle: 'Pelatihan Skill & Sertifikasi',
          iconKind: 'school',
        }),
      ];

    case 'train': {
      if (currentZone === 'cicalengka') {
        return [
          resolveLotDestination('stasiun', {
            label: 'Stasiun Cicalengka',
            subtitle: 'Peron & Loket Kereta Api',
            iconKind: 'train',
          }),
          resolveSharedDestination('loket_tiket', TICKET_BOOTH_POS.cicalengka, {
            label: 'Loket Stasiun Cicalengka',
            subtitle: 'Pembelian Tiket Lintas Kota',
            iconKind: 'train',
          }),
        ];
      }
      const zoneSharedKey = `station_${currentZone}`;
      const zoneBooth = TICKET_BOOTH_POS[currentZone] || STATION_SPAWN;
      const zoneNames: Record<ZoneId, string> = {
        cicalengka: 'Stasiun Cicalengka',
        rancaekek: 'Stasiun Rancaekek',
        bandung: 'Stasiun Bandung',
        nagreg: 'Stasiun Nagreg',
      };
      return [
        resolveSharedDestination(zoneSharedKey, zoneBooth, {
          label: zoneNames[currentZone],
          subtitle: 'Loket Kereta Kembali ke Cicalengka',
          iconKind: 'train',
          zone: currentZone,
        }),
      ];
    }

    case 'bank': {
      const bankDest = resolveLotDestination('bank', {
        id: 'bank',
        label: BANK_POS.label || 'Bank Priangan Cicalengka',
        subtitle: 'Teller, Buka Rekening & Pinjaman',
        iconKind: 'bank',
        payload: { mode: 'bank' },
      });
      if (!context.hasBankAccount || context.requiresBankBranch) {
        return [bankDest];
      }
      const atmDests = ATM_LOCATIONS.map((atm) =>
        resolveSharedDestination(atm.id, { x: atm.x, z: atm.z }, {
          id: atm.id,
          label: atm.label,
          subtitle: 'ATM 24 Jam (Setor / Tarik / Transfer)',
          iconKind: 'atm',
          payload: { mode: 'atm' },
        })
      );
      return [bankDest, ...atmDests];
    }

    case 'wholesale':
      return [
        resolveLotDestination('pasar_grosir', {
          label: PASAR_GROSIR_POS.label || 'Pasar Grosir Induk',
          subtitle: 'Stok Barang Dagangan & Material',
          iconKind: 'wholesale',
        }),
      ];

    case 'auction':
      return [
        resolveLotDestination('balai_lelang', {
          label: BALAI_LELANG_POS.label || 'Balai Lelang Kota',
          subtitle: 'Lelang Aset, Properti & Barang',
          iconKind: 'auction',
        }),
      ];

    case 'law':
    case 'police':
      return [
        resolveLotDestination('polsek', {
          label: 'Polsek Cicalengka',
          subtitle: 'Layanan Hukum, Denda & Tahanan',
          iconKind: 'law',
        }),
      ];

    case 'agent_developer':
      return [
        resolveLotDestination('kantor_agen', {
          label: 'Kantor Agen Properti',
          subtitle: 'Lisensi Agen, Developer & Renovasi',
          iconKind: 'agent',
        }),
      ];

    case 'furniture_shop':
      return [
        resolveLotDestination('toko_mebel', {
          label: TOKO_MEBEL_POS.label || 'Toko Mebel Jaya',
          subtitle: 'Belanja Furnitur & Paket Perabot',
          iconKind: 'furniture',
        }),
      ];

    case 'penampungan':
      return [
        resolveLotDestination('penampungan', {
          label: PENAMPUNGAN_POS.label || 'Balai Penampungan Warga',
          subtitle: 'Tidur Gratis (Pukul 20:00 – 06:00)',
          iconKind: 'sleep',
        }),
      ];

    case 'emperan': {
      const spots = EMPERAN_SPOTS.map((e) =>
        resolveLotDestination(e.id, {
          label: e.label,
          subtitle: 'Tempat Istirahat Darurat',
          iconKind: 'sleep',
          payload: { spotId: e.id },
        })
      );
      if (context.targetSpotId) {
        return spots.filter((s) => s.id === context.targetSpotId);
      }
      return spots;
    }

    case 'bath_mck':
      return [
        resolveLotDestination('bath_mck', {
          label: 'MCK Umum Alun-Alun',
          subtitle: 'Mandi & Kebersihan Diri',
          iconKind: 'bath',
        }),
      ];

    case 'kontrakan':
      return KONTRAKAN_POSITIONS.map((k) =>
        resolveLotDestination(k.id, {
          label: k.label,
          subtitle: 'Istirahat Kontrakan',
          iconKind: 'house',
        })
      );

    case 'business_create': {
      const destinations: InteractionDestination[] = [
        resolveLotDestination('kantor_desa', {
          label: KANTOR_DESA_POS.label || 'Kantor Desa Cicalengka',
          subtitle: 'Pengesahan Izin Usaha Baru',
          iconKind: 'business',
        }),
      ];
      return destinations;
    }

    case 'business': {
      if (context.targetBusinessId) {
        const targetBiz = (context.businesses || []).find((b) => b.id === context.targetBusinessId);
        if (targetBiz) {
          const prop = props.find((p) => p.id === targetBiz.propertyId);
          if (prop) {
            return [
              resolveDynamicPropertyDestination(prop, {
                id: targetBiz.id,
                label: targetBiz.name,
                subtitle: 'Lokasi Toko / Usaha Anda',
                iconKind: 'business',
                payload: { businessId: targetBiz.id, propertyId: prop.id },
              }),
            ];
          }
        }
      }
      if (myBusinesses.length > 0) {
        const bizDests: InteractionDestination[] = [];
        for (const biz of myBusinesses) {
          const prop = props.find((p) => p.id === biz.propertyId);
          if (prop) {
            bizDests.push(
              resolveDynamicPropertyDestination(prop, {
                id: biz.id,
                label: biz.name,
                subtitle: `Kelola ${biz.isOpen ? 'Toko Buka' : 'Toko Tutup'}`,
                iconKind: 'business',
                payload: { businessId: biz.id, propertyId: prop.id },
              })
            );
          }
        }
        if (bizDests.length > 0) return bizDests;
      }
      return [
        resolveLotDestination('kantor_desa', {
          label: KANTOR_DESA_POS.label || 'Kantor Desa Cicalengka',
          subtitle: 'Ajukan Izin Usaha Pertama',
          iconKind: 'business',
        }),
      ];
    }

    case 'business_shop': {
      if (context.targetBusinessId) {
        const targetBiz = (context.businesses || []).find((b) => b.id === context.targetBusinessId);
        const prop = targetBiz ? props.find((p) => p.id === targetBiz.propertyId) : null;
        if (targetBiz && prop) {
          return [
            resolveDynamicPropertyDestination(prop, {
              id: targetBiz.id,
              label: targetBiz.name,
              subtitle: 'Kasir & Etalase Toko',
              iconKind: 'business',
              payload: { businessId: targetBiz.id },
            }),
          ];
        }
      }
      return [];
    }

    case 'start_shift':
    case 'jobs': {
      const currentJob = context.character.currentJob;
      const targetJobId = context.targetJobId ?? (menuId === 'start_shift' ? currentJob?.jobId : null);

      const resolveJobDest = (jobId: string, subtitle?: string): InteractionDestination | null => {
        if (jobId.startsWith('biz_')) {
          const bizId = jobId.slice(4);
          const biz = (context.businesses || []).find((b) => b.id === bizId);
          const prop = biz ? props.find((p) => p.id === biz.propertyId) : null;
          if (biz && prop) {
            return resolveDynamicPropertyDestination(prop, {
              id: jobId,
              label: biz.name,
              subtitle: subtitle || 'Tempat Kerja Bisnis Warga',
              iconKind: 'work',
              payload: { jobId, businessId: biz.id },
            });
          }
          return null;
        }
        const mapped = JOB_ID_TO_DEST[jobId];
        if (!mapped) return null;
        if (mapped.zone === 'cicalengka') {
          return resolveLotDestination(mapped.lotId, {
            id: jobId,
            label: mapped.label,
            subtitle: subtitle || 'Lokasi Kerja',
            iconKind: 'work',
            payload: { jobId },
          });
        }
        return resolveSharedDestination(mapped.lotId, mapped.fallback, {
          id: jobId,
          label: mapped.label,
          subtitle: subtitle || `Zona ${mapped.zone}`,
          iconKind: 'work',
          zone: mapped.zone,
          payload: { jobId },
        });
      };

      if (targetJobId) {
        const single = resolveJobDest(
          targetJobId,
          currentJob?.jobId === targetJobId ? `Shift ${currentJob.title}` : 'Lokasi Lowongan'
        );
        if (single) return [single];
      }

      if (currentJob && !context.targetJobId) {
        const activeDest = resolveJobDest(currentJob.jobId, `Tempat Kerja (${currentJob.title})`);
        if (activeDest) return [activeDest];
      }

      const out: InteractionDestination[] = [];
      const jobList = context.jobs || [];
      const allStaticIds =
        jobList.length > 0 ? jobList.map((j) => j.id) : Object.keys(JOB_ID_TO_DEST);
      for (const jid of allStaticIds) {
        const meta = jobList.find((j) => j.id === jid);
        const dest = resolveJobDest(jid, meta ? `${meta.title} (${meta.employer})` : undefined);
        if (dest) out.push(dest);
      }

      for (const post of context.businessJobPosts || []) {
        if (post.status !== 'open') continue;
        const postBiz = (context.businesses || []).find((b) => b.id === post.businessId);
        const prop = postBiz ? props.find((p) => p.id === postBiz.propertyId) : null;
        if (prop) {
          out.push(
            resolveDynamicPropertyDestination(prop, {
              id: `biz_${post.businessId}`,
              label: post.businessName,
              subtitle: `Lowongan: ${post.roleTitle}`,
              iconKind: 'work',
              payload: { jobId: `biz_${post.businessId}`, businessId: post.businessId },
            })
          );
        }
      }
      return out;
    }

    case 'property_survey':
    case 'property_enter': {
      const targetId = context.targetPropertyId;
      const prop = targetId ? props.find((p) => p.id === targetId) : null;
      if (!prop) return [];
      return [
        resolveDynamicPropertyDestination(prop, {
          label: prop.name,
          subtitle: menuId === 'property_survey' ? 'Survei Interior Properti' : 'Masuk Pintu Properti',
          iconKind: 'house',
          payload: { propertyId: prop.id },
        }),
      ];
    }

    case 'buy_land': {
      const targetPlotId = context.targetPlotId;
      const plot = targetPlotId ? plots.find((p) => p.id === targetPlotId) : null;
      if (plot) {
        const placement = findLotPlacement(plot.id);
        const radius = Math.max(
          INTERACT_RADIUS_METERS,
          Math.max(plot.size?.width ?? 8, plot.size?.depth ?? 8) / 2 + 4.5
        );
        return [
          {
            id: plot.id,
            label: plot.name,
            subtitle: 'Lokasi Kavling Tanah',
            iconKind: 'land',
            zone: (plot.zone || 'cicalengka') as ZoneId,
            arrivalPoint: placement ? placement.door : { x: plot.position.x, z: plot.position.z },
            centerPoint: { x: plot.position.x, z: plot.position.z },
            radius,
            payload: { plotId: plot.id },
          },
        ];
      }
      return [
        resolveLotDestination('kantor_desa', {
          label: KANTOR_DESA_POS.label || 'Kantor Desa Cicalengka',
          subtitle: 'Administrasi Kavling',
          iconKind: 'land',
        }),
      ];
    }

    case 'apply_imb':
      return [
        resolveLotDestination('kantor_desa', {
          label: KANTOR_DESA_POS.label || 'Kantor Desa Cicalengka',
          subtitle: 'Pengurusan Izin Mendirikan Bangunan (IMB)',
          iconKind: 'business',
          payload: context.targetPlotId ? { plotId: context.targetPlotId } : undefined,
        }),
      ];

    case 'apply_mortgage':
      return [
        resolveLotDestination('bank', {
          label: BANK_POS.label || 'Bank Priangan Cicalengka',
          subtitle: 'Akad Kredit Pemilikan Rumah (KPR)',
          iconKind: 'bank',
        }),
        resolveLotDestination('kantor_agen', {
          label: 'Kantor Agen Properti',
          subtitle: 'Konsultasi & Pengajuan KPR',
          iconKind: 'agent',
        }),
      ];

    case 'npc': {
      const npcId = context.targetNpcId;
      const npcsCfg = context.npcsConfig ?? DEFAULT_NPCS_CONFIG;
      const def = npcId ? npcsCfg.npcs.find((n) => n.id === npcId) : null;
      if (!def) return [];
      const playerPos = context.character.lastPosition ?? STATION_SPAWN;
      const pose = computeClientNpcPose(
        def,
        context.serverNowMs ?? Date.now(),
        { x: playerPos.x, z: playerPos.z },
        npcsCfg.lodActiveRadiusMeters
      );
      return [
        {
          id: def.id,
          label: def.name,
          subtitle: `${def.role} · Area ${pose.zoneTag}`,
          iconKind: 'npc',
          zone: 'cicalengka',
          arrivalPoint: { x: pose.x, z: pose.z },
          centerPoint: { x: pose.x, z: pose.z },
          radius: NPC_INTERACT_RADIUS_METERS + 3.0,
          payload: { npcId: def.id },
        },
      ];
    }

    case 'dealer': {
      const dealers = getDefaultVehicleConfig().dealer.dealers;
      const filtered = context.targetDealerId
        ? dealers.filter((d) => d.id === context.targetDealerId)
        : dealers;
      return filtered.map((d) =>
        resolveLotDestination(d.lotId, {
          id: d.id,
          label: d.name,
          subtitle: `${d.category === 'motor' ? 'Sepeda Motor' : 'Mobil'} · ${d.isUsed ? 'Bekas & Tukar Tambah' : 'Baru, Tunai & Leasing'}`,
          iconKind: 'vehicle',
          payload: { dealerId: d.id },
        })
      );
    }

    case 'spbu':
      return [
        resolveLotDestination('spbu_cicalengka', {
          label: 'SPBU & Stasiun Cas Cicalengka',
          subtitle: 'Isi BBM & Isi Daya Kendaraan Listrik',
          iconKind: 'fuel',
        }),
      ];

    case 'workshop': {
      const official = resolveLotDestination('bengkel_umum', {
        id: 'bengkel_umum',
        label: 'Bengkel Resmi Priangan',
        subtitle: 'Servis Mesin, Ganti Oli, Cat Ulang & Aksesori',
        iconKind: 'workshop',
      });
      const playerWorkshops: InteractionDestination[] = [];
      for (const biz of (context.businesses || []).filter(
        (b) => b.status === 'active' && b.type === 'bengkel'
      )) {
        const prop = props.find((p) => p.id === biz.propertyId);
        if (prop) {
          playerWorkshops.push(
            resolveDynamicPropertyDestination(prop, {
              id: biz.id,
              label: biz.name,
              subtitle: 'Bengkel Milik Warga',
              iconKind: 'workshop',
              payload: { businessId: biz.id },
            })
          );
        }
      }
      return [official, ...playerWorkshops];
    }

    case 'samsat_sim':
      return [
        resolveSharedDestination('samsat_sim', { x: -24.2, z: 8.6 }, {
          id: 'samsat_sim',
          label: 'Loket Samsat & Ujian SIM',
          subtitle: 'Pajak STNK, Balik Nama & Ujian SIM C / SIM A',
          iconKind: 'samsat',
          radius: 6.5,
        }),
      ];

    // Group B (remote allowed) — default empty or optional landmarks
    case 'land_construction':
    case 'mortgage_security':
    case 'house_search':
    case 'marketplace':
    case 'economy':
    case 'my_property':
    case 'offers':
    case 'profile':
    case 'quests':
    case 'settings':
    case 'furniture_inventory':
    case 'vehicles_garage':
      return [];
  }
}

export function getNearestValidDestination(
  menuId: InteractionMenuId,
  playerPos: WorldPoint2D,
  context: InteractionContext
): DestinationLookupResult {
  const policy = getMenuLocationMeta(menuId);
  const currentZone = (context.character.currentZone || 'cicalengka') as ZoneId;
  const destinations = getDestinationsForMenu(menuId, context);

  if (destinations.length === 0) {
    return {
      menuId,
      policy,
      destinations: [],
      nearest: null,
      distanceMeters: null,
      inRange: policy.allowRemote,
      requiresTrain: false,
      targetZone: currentZone,
    };
  }

  // Prioritaskan tujuan yang ada di zona pemain saat ini
  const sameZoneDests = destinations.filter((d) => d.zone === currentZone);
  const pool = sameZoneDests.length > 0 ? sameZoneDests : destinations;

  let nearest = pool[0];
  let minDist = getDistanceToDestination(playerPos, nearest);
  for (let i = 1; i < pool.length; i++) {
    const d = getDistanceToDestination(playerPos, pool[i]);
    if (d < minDist) {
      minDist = d;
      nearest = pool[i];
    }
  }

  const sameZone = nearest.zone === currentZone;
  const inRange = sameZone && isWithinDestination(playerPos, nearest, 0);

  return {
    menuId,
    policy,
    destinations,
    nearest,
    distanceMeters: sameZone ? Math.round(minDist) : null,
    inRange,
    requiresTrain: !sameZone,
    targetZone: nearest.zone,
  };
}

export function isInRange(
  menuId: InteractionMenuId,
  playerPos: WorldPoint2D,
  context: InteractionContext,
  hysteresis = 0
): boolean {
  const policy = getMenuLocationMeta(menuId);
  if (policy.allowRemote) return true;
  const currentZone = (context.character.currentZone || 'cicalengka') as ZoneId;
  const destinations = getDestinationsForMenu(menuId, context);
  return destinations.some(
    (dest) => dest.zone === currentZone && isWithinDestination(playerPos, dest, hysteresis)
  );
}

/**
 * Daftar landmark utama untuk ditampilkan pada Minimap & pencarian rute cepat.
 */
export function getMapLandmarkSummaries(): Array<{
  id: string;
  label: string;
  shortTag: string;
  x: number;
  z: number;
  color: string;
}> {
  const st = getLotById('stasiun');
  const pus = getLotById('puskesmas');
  const klin = getLotById('klinik_swasta');
  const bank = getLotById('bank');
  const pol = getLotById('polsek');
  const kd = getLotById('kantor_desa');
  const pg = getLotById('pasar_grosir');
  const psr = getLotById('pasar');
  const sek = getLotById('sekolah');
  const wrg = getLotById('warung');
  const bl = getLotById('balai_lelang');
  const agen = getLotById('kantor_agen');
  const spbu = getLotById('spbu_cicalengka');
  const bengkel = getLotById('bengkel_umum');
  const dMotor = getLotById('dealer_motor_baru');
  const dMobil = getLotById('showroom_mobil_baru');

  return [
    { id: 'alun', label: 'Alun-Alun', shortTag: 'AA', x: LAYOUT_DATA.anchors.alunAlunCenter.x, z: LAYOUT_DATA.anchors.alunAlunCenter.z, color: '#34d399' },
    { id: 'stasiun', label: 'Stasiun', shortTag: 'ST', x: st.door.x, z: st.door.z, color: '#38bdf8' },
    { id: 'bank', label: 'Bank', shortTag: 'BK', x: bank.door.x, z: bank.door.z, color: '#fbbf24' },
    { id: 'puskesmas', label: 'Puskesmas', shortTag: 'PK', x: pus.door.x, z: pus.door.z, color: '#f87171' },
    { id: 'klinik_swasta', label: 'Klinik', shortTag: 'KL', x: klin.door.x, z: klin.door.z, color: '#fb7185' },
    { id: 'polsek', label: 'Polsek', shortTag: 'PL', x: pol.door.x, z: pol.door.z, color: '#60a5fa' },
    { id: 'kantor_desa', label: 'Desa', shortTag: 'DS', x: kd.door.x, z: kd.door.z, color: '#a78bfa' },
    { id: 'pasar_grosir', label: 'Grosir', shortTag: 'GR', x: pg.door.x, z: pg.door.z, color: '#fb923c' },
    { id: 'pasar', label: 'Pasar', shortTag: 'PS', x: psr.door.x, z: psr.door.z, color: '#facc15' },
    { id: 'sekolah', label: 'Kursus', shortTag: 'KR', x: sek.door.x, z: sek.door.z, color: '#2dd4bf' },
    { id: 'warung', label: 'Warung', shortTag: 'WR', x: wrg.door.x, z: wrg.door.z, color: '#f472b6' },
    { id: 'balai_lelang', label: 'Lelang', shortTag: 'LL', x: bl.door.x, z: bl.door.z, color: '#e879f9' },
    { id: 'kantor_agen', label: 'Agen', shortTag: 'AG', x: agen.door.x, z: agen.door.z, color: '#5eead4' },
    { id: 'spbu_cicalengka', label: 'SPBU & Cas', shortTag: 'SP', x: spbu.door.x, z: spbu.door.z, color: '#ef4444' },
    { id: 'bengkel_umum', label: 'Bengkel', shortTag: 'BG', x: bengkel.door.x, z: bengkel.door.z, color: '#38bdf8' },
    { id: 'dealer_motor_baru', label: 'Dealer Motor', shortTag: 'DM', x: dMotor.door.x, z: dMotor.door.z, color: '#f97316' },
    { id: 'showroom_mobil_baru', label: 'Showroom Mobil', shortTag: 'SM', x: dMobil.door.x, z: dMobil.door.z, color: '#0ea5e9' },
  ];
}

export { INTERACT_HYSTERESIS_METERS, INTERACT_RADIUS_METERS, NPC_INTERACT_RADIUS_METERS };
