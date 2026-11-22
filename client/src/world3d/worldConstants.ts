import interactionLocationsJson from '../../../functions/src/config/interactionLocations.json';
import landConfigJson from '../../../functions/src/config/land.json';
import lawConfigJson from '../../../functions/src/config/law.json';
import constructionConfigJson from '../../../functions/src/config/construction.json';
import mortgageConfigJson from '../../../functions/src/config/mortgage.json';
import type {
  ConstructionConfigDoc,
  FurnitureCatalogItem,
  GameConfigDoc,
  LandConfigDoc,
  LandPlotDoc,
  LawConfigDoc,
  MortgageConfigDoc,
  PropertyDoc,
  PropertyListingDoc,
  WorldPosition,
  ZoneId,
} from '../types/game';

import { findLotPlacement, getLotById, LAYOUT_DATA } from './layout/layoutHelpers';

export const WORLD_HALF_SIZE = LAYOUT_DATA.rules.worldHalfSize;
export const GRID_ZONE_SIZE = 40;

const posOf = (id: string): { x: number; z: number } => {
  const lot = getLotById(id);
  return { x: lot.position.x, z: lot.position.z };
};

export const STATION_SPAWN: WorldPosition = {
  ...LAYOUT_DATA.anchors.stationSpawn,
};

export const WARUNG_POS = posOf('warung');
export const MINIMARKET_POS = posOf('minimarket');
export const PASAR_POS = posOf('pasar');
export const PUSKESMAS_POS = posOf('puskesmas');
export const KLINIK_SWASTA_POS = posOf('klinik_swasta');
export const SCHOOL_POS = posOf('sekolah');
export const BATH_POS = posOf('bath_mck');
export const COURIER_POS = posOf('pos_kurir');

// Landmark Fase 3
export const TOKO_MEBEL_POS = {
  ...posOf('toko_mebel'),
  label: getLotById('toko_mebel').label,
};
export const PENAMPUNGAN_POS = {
  ...posOf('penampungan'),
  label: getLotById('penampungan').label,
};
export const EMPERAN_SPOTS = [
  {
    id: 'emperan_pasar' as const,
    label: getLotById('emperan_pasar').label,
    ...posOf('emperan_pasar'),
  },
  {
    id: 'emperan_stasiun' as const,
    label: getLotById('emperan_stasiun').label,
    ...posOf('emperan_stasiun'),
  },
] as const;

// Landmark Fase 4 (Bank, ATM, Kantor Desa, Pasar Grosir, Balai Lelang)
export const BANK_POS = {
  ...posOf('bank'),
  label: getLotById('bank').label,
};
export const ATM_LOCATIONS = LAYOUT_DATA.anchors.atms.map((atm) => ({
  id: atm.id,
  x: atm.x,
  z: atm.z,
  label: atm.label,
}));
export const KANTOR_DESA_POS = {
  ...posOf('kantor_desa'),
  label: 'Kantor Desa Cicalengka (Izin Usaha)',
};
export const PASAR_GROSIR_POS = {
  ...posOf('pasar_grosir'),
  label: getLotById('pasar_grosir').label,
};
export const BALAI_LELANG_POS = {
  ...posOf('balai_lelang'),
  label: getLotById('balai_lelang').label,
};

// Landmark Fase 6 (Polsek, Tahanan, Kantor Agen Properti, CCTV, Kavling)
const rawLawConfig = lawConfigJson as LawConfigDoc;
const rawLandConfig = landConfigJson as LandConfigDoc;
const rawConstructionConfig = constructionConfigJson as ConstructionConfigDoc;

export const PHASE6_LAW_CONFIG: LawConfigDoc = {
  ...rawLawConfig,
  policeStation: { ...LAYOUT_DATA.anchors.policeStation },
  cctvZones: LAYOUT_DATA.anchors.cctvs.map((c) => ({ ...c })),
};
export const PHASE6_LAND_CONFIG: LandConfigDoc = {
  ...rawLandConfig,
  plots: rawLandConfig.plots.map((p) => {
    const placement = findLotPlacement(p.id);
    return placement
      ? { ...p, position: { x: placement.x, y: p.position.y ?? 0, z: placement.z } }
      : p;
  }),
};
export const PHASE6_CONSTRUCTION_CONFIG: ConstructionConfigDoc = {
  ...rawConstructionConfig,
  agentSettings: {
    ...rawConstructionConfig.agentSettings,
    officePos: { ...LAYOUT_DATA.anchors.agentOffice },
  },
};
export const PHASE6_MORTGAGE_CONFIG = mortgageConfigJson as MortgageConfigDoc;

export const POLSEK_POS = PHASE6_LAW_CONFIG.policeStation;
export const AGENT_OFFICE_POS = PHASE6_CONSTRUCTION_CONFIG.agentSettings.officePos;
export const CCTV_ZONES = PHASE6_LAW_CONFIG.cctvZones;

export const INITIAL_LAND_PLOTS_DATA: LandPlotDoc[] = PHASE6_LAND_CONFIG.plots.map((p) => ({
  id: p.id,
  name: p.name,
  areaTag: p.areaTag,
  zone: 'cicalengka',
  position: { ...p.position },
  size: { ...p.size },
  roadAccess: p.roadAccess,
  zoning: p.zoning,
  price: p.price,
  ownerId: 'npc_pemdes_cicalengka',
  ownerType: 'npc',
  ownerName: 'Pemerintah Desa Cicalengka',
  imbStatus: 'none',
  imbSubmittedAtMs: null,
  imbReadyAtMs: null,
  constructionId: null,
  builtPropertyId: null,
  status: 'available',
}));

export const TICKET_BOOTH_POS: Record<ZoneId, { x: number; z: number }> = {
  ...LAYOUT_DATA.anchors.ticketBooth,
};

export const KONTRAKAN_POSITIONS = (
  ['kontrakan_1', 'kontrakan_2', 'kontrakan_3', 'kontrakan_4', 'kontrakan_5'] as const
).map((id) => {
  const lot = getLotById(id);
  return {
    id: lot.id,
    label: lot.label,
    x: lot.position.x,
    z: lot.position.z,
  };
});

export const ALUN_ALUN_POS = { ...LAYOUT_DATA.anchors.alunAlunCenter };

// Lokasi kerja di zona tujuan kereta
export const FACTORY_RANCAEKEK_POS = { x: 18, z: -14 };
export const SCHOOL_BANDUNG_POS = { x: -18, z: -12 };

export const INTERACT_RADIUS_METERS = interactionLocationsJson.interactRadiusMeters;
export const INTERACT_HYSTERESIS_METERS = interactionLocationsJson.hysteresisMeters;
export const NPC_INTERACT_RADIUS_METERS = interactionLocationsJson.npcInteractRadiusMeters;
export const REMOTE_PLAYER_CULL_RADIUS = 50;

export const DEFAULT_GAME_CONFIG: GameConfigDoc = {
  dayDurationMs: 3_600_000,
  epochMs: 1_704_067_200_000,
  hungerDecayPerHour: 12,
  thirstDecayPerHour: 18,
  energyDecayPerHour: 10,
  startingMoney: 100_000,
};

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  {
    id: 'kasur_lipat',
    name: 'Kasur Lipat Busa',
    category: 'bed',
    price: 45000,
    size: { w: 1, d: 2 },
    recoveryBonus: 0.08,
    moodBonus: 2,
    valueBonus: 22500,
    description: 'Kasur praktis hemat ruang untuk tidur lebih nyaman.',
  },
  {
    id: 'tempat_tidur_single',
    name: 'Tempat Tidur Single Kayu',
    category: 'bed',
    price: 95000,
    size: { w: 1, d: 2 },
    recoveryBonus: 0.16,
    moodBonus: 4,
    valueBonus: 47500,
    description: 'Rangka kayu kokoh yang mempercepat pemulihan energi.',
  },
  {
    id: 'tempat_tidur_queen',
    name: 'Tempat Tidur Queen Jati',
    category: 'bed',
    price: 185000,
    size: { w: 2, d: 2 },
    recoveryBonus: 0.28,
    moodBonus: 8,
    valueBonus: 92500,
    description: 'Kasur empuk ukuran luas dengan kualitas tidur maksimal.',
  },
  {
    id: 'meja_kayu',
    name: 'Meja Kayu Minimalis',
    category: 'living',
    price: 55000,
    size: { w: 2, d: 1 },
    recoveryBonus: 0,
    moodBonus: 3,
    valueBonus: 27500,
    description: 'Meja serbaguna untuk makan maupun menata barang.',
  },
  {
    id: 'kursi_santai',
    name: 'Kursi Santai Rotan',
    category: 'living',
    price: 35000,
    size: { w: 1, d: 1 },
    recoveryBonus: 0.04,
    moodBonus: 6,
    valueBonus: 17500,
    description: 'Kursi anyaman nyaman untuk melepas penat sepulang kerja.',
  },
  {
    id: 'tv_led',
    name: 'TV LED 32 Inch',
    category: 'electronics',
    price: 140000,
    size: { w: 2, d: 1 },
    recoveryBonus: 0,
    moodBonus: 12,
    valueBonus: 70000,
    description: 'Hiburan malam di rumah yang mendongkrak mood drastis.',
  },
  {
    id: 'kulkas_mini',
    name: 'Kulkas 1 Pintu',
    category: 'kitchen',
    price: 160000,
    size: { w: 1, d: 1 },
    recoveryBonus: 0,
    moodBonus: 5,
    valueBonus: 80000,
    description: 'Menjaga stok makanan di rumah tetap segar (+10% efek makan).',
  },
  {
    id: 'kompor_gas',
    name: 'Kompor Gas 2 Tungku',
    category: 'kitchen',
    price: 85000,
    size: { w: 1, d: 1 },
    recoveryBonus: 0,
    moodBonus: 4,
    valueBonus: 42500,
    description: 'Memasak bekal di rumah agar lebih hemat dan sehat (+15% efek makan).',
  },
];

const RAW_INITIAL_PROPERTIES_DATA: Array<PropertyDoc & { defaultListingKind: 'rent' | 'sale' }> = [
  {
    id: 'prop_kos_kampung_5',
    name: 'Kos Murah Babakan Warga',
    type: 'kos',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_agen_ujang',
    ownerType: 'npc',
    ownerName: 'Agen Properti Kang Ujang',
    position: { x: -60, y: 0, z: 42 },
    size: { width: 5, depth: 5 },
    rooms: 1,
    condition: 78,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'rent',
    baseRent: 25000,
    baseDeposit: 25000,
    baseValue: 350000,
    layout: { gridCols: 5, gridRows: 5, wallColor: '#fef3c7', floorColor: '#cbd5e1' },
    furniture: [{ instanceId: 'f_init_1', furnitureId: 'kasur_lipat', gx: 0, gz: 0, rot: 0 }],
  },
  {
    id: 'prop_kos_stasiun_1',
    name: 'Kos Melati Stasiun Barat',
    type: 'kos',
    zone: 'cicalengka',
    areaTag: 'stasiun',
    ownerId: 'npc_agen_ujang',
    ownerType: 'npc',
    ownerName: 'Agen Properti Kang Ujang',
    position: { x: -18, y: 0, z: -36 },
    size: { width: 5, depth: 5 },
    rooms: 1,
    condition: 85,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 35000,
    baseDeposit: 35000,
    baseValue: 480000,
    layout: { gridCols: 5, gridRows: 5, wallColor: '#e0f2fe', floorColor: '#d6d3d1' },
    furniture: [
      { instanceId: 'f_init_2', furnitureId: 'kasur_lipat', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_3', furnitureId: 'meja_kayu', gx: 3, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_kos_stasiun_2',
    name: 'Kos Kenanga Express',
    type: 'kos',
    zone: 'cicalengka',
    areaTag: 'stasiun',
    ownerId: 'npc_ibu_eti',
    ownerType: 'npc',
    ownerName: 'Ibu Haji Eti',
    position: { x: 18, y: 0, z: -36 },
    size: { width: 5, depth: 5 },
    rooms: 1,
    condition: 90,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 40000,
    baseDeposit: 40000,
    baseValue: 520000,
    layout: { gridCols: 5, gridRows: 5, wallColor: '#dcfce7', floorColor: '#cbd5e1' },
    furniture: [{ instanceId: 'f_init_4', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 }],
  },
  {
    id: 'prop_kos_stasiun_3',
    name: 'Kos Cendana Peron',
    type: 'kos',
    zone: 'cicalengka',
    areaTag: 'stasiun',
    ownerId: 'npc_ibu_eti',
    ownerType: 'npc',
    ownerName: 'Ibu Haji Eti',
    position: { x: 32, y: 0, z: -34 },
    size: { width: 5, depth: 5 },
    rooms: 1,
    condition: 72,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'sale',
    baseRent: 30000,
    baseDeposit: 30000,
    baseValue: 410000,
    layout: { gridCols: 5, gridRows: 5, wallColor: '#fde68a', floorColor: '#d6d3d1' },
    furniture: [],
  },
  {
    id: 'prop_kos_pasar_1',
    name: 'Kos Sederhana Dekat Pasar',
    type: 'kos',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_agen_ujang',
    ownerType: 'npc',
    ownerName: 'Agen Properti Kang Ujang',
    position: { x: 58, y: 0, z: -28 },
    size: { width: 5, depth: 5 },
    rooms: 1,
    condition: 76,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'rent',
    baseRent: 28000,
    baseDeposit: 28000,
    baseValue: 390000,
    layout: { gridCols: 5, gridRows: 5, wallColor: '#f1f5f9', floorColor: '#cbd5e1' },
    furniture: [{ instanceId: 'f_init_5', furnitureId: 'kasur_lipat', gx: 0, gz: 0, rot: 0 }],
  },
  {
    id: 'prop_kontrakan_kampung_1',
    name: 'Kontrakan Asri Kampung 1',
    type: 'kontrakan',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_pak_rt',
    ownerType: 'npc',
    ownerName: 'Pak RT Tatang',
    position: { x: -46, y: 0, z: 42 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 82,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 55000,
    baseDeposit: 55000,
    baseValue: 780000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#fef3c7', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_6', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_7', furnitureId: 'meja_kayu', gx: 3, gz: 1, rot: 0 },
      { instanceId: 'f_init_8', furnitureId: 'kursi_santai', gx: 3, gz: 2, rot: 0 },
    ],
  },
  {
    id: 'prop_kontrakan_kampung_2',
    name: 'Kontrakan Asri Kampung 2',
    type: 'kontrakan',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_pak_rt',
    ownerType: 'npc',
    ownerName: 'Pak RT Tatang',
    position: { x: -30, y: 0, z: 42 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 86,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 62000,
    baseDeposit: 62000,
    baseValue: 850000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#bae6fd', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_9', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_10', furnitureId: 'kompor_gas', gx: 4, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_kontrakan_kampung_3',
    name: 'Kontrakan Babakan 3',
    type: 'kontrakan',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_agen_ujang',
    ownerType: 'npc',
    ownerName: 'Agen Properti Kang Ujang',
    position: { x: -14, y: 0, z: 42 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 70,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'sale',
    baseRent: 52000,
    baseDeposit: 52000,
    baseValue: 740000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#fde68a', floorColor: '#d6d3d1' },
    furniture: [{ instanceId: 'f_init_11', furnitureId: 'kasur_lipat', gx: 0, gz: 0, rot: 0 }],
  },
  {
    id: 'prop_kontrakan_kampung_4',
    name: 'Kontrakan Kidul Harmoni',
    type: 'kontrakan',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_pak_rt',
    ownerType: 'npc',
    ownerName: 'Pak RT Tatang',
    position: { x: 4, y: 0, z: 42 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 88,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 68000,
    baseDeposit: 68000,
    baseValue: 910000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#e0e7ff', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_12', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_13', furnitureId: 'tv_led', gx: 4, gz: 2, rot: 0 },
    ],
  },
  {
    id: 'prop_kontrakan_kampung_5',
    name: 'Kontrakan Berkah Selatan',
    type: 'kontrakan',
    zone: 'cicalengka',
    areaTag: 'kampung',
    ownerId: 'npc_ibu_eti',
    ownerType: 'npc',
    ownerName: 'Ibu Haji Eti',
    position: { x: 20, y: 0, z: 42 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 92,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 72000,
    baseDeposit: 72000,
    baseValue: 960000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#d1fae5', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_14', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_15', furnitureId: 'kulkas_mini', gx: 4, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_apt_raya_1',
    name: 'Apartemen Mini Stasiun Suite',
    type: 'apartemen',
    zone: 'cicalengka',
    areaTag: 'stasiun',
    ownerId: 'npc_developer_pt',
    ownerType: 'npc',
    ownerName: 'PT Bandung Timur Residence',
    position: { x: -30, y: 0, z: -36 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 96,
    facilities: { electricity: true, water: true, internet: true, ac: true },
    defaultListingKind: 'rent',
    baseRent: 98000,
    baseDeposit: 100000,
    baseValue: 1450000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#f8fafc', floorColor: '#cbd5e1' },
    furniture: [
      { instanceId: 'f_init_16', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_17', furnitureId: 'tv_led', gx: 4, gz: 3, rot: 0 },
    ],
  },
  {
    id: 'prop_apt_timur_2',
    name: 'Apartemen Studio Alun-Alun',
    type: 'apartemen',
    zone: 'cicalengka',
    areaTag: 'alun_alun',
    ownerId: 'npc_developer_pt',
    ownerType: 'npc',
    ownerName: 'PT Bandung Timur Residence',
    position: { x: 24, y: 0, z: 6 },
    size: { width: 6, depth: 6 },
    rooms: 2,
    condition: 95,
    facilities: { electricity: true, water: true, internet: true, ac: true },
    defaultListingKind: 'sale',
    baseRent: 115000,
    baseDeposit: 115000,
    baseValue: 1620000,
    layout: { gridCols: 6, gridRows: 6, wallColor: '#f1f5f9', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_18', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_19', furnitureId: 'kulkas_mini', gx: 4, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_ruko_pasar_1',
    name: 'Ruko Pasar Blok A',
    type: 'ruko',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_haji_ahmad',
    ownerType: 'npc',
    ownerName: 'H. Ahmad Juragan Pasar',
    position: { x: 38, y: 0, z: 10 },
    size: { width: 7, depth: 7 },
    rooms: 2,
    condition: 88,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 130000,
    baseDeposit: 130000,
    baseValue: 1950000,
    layout: { gridCols: 7, gridRows: 7, wallColor: '#fef2f2', floorColor: '#cbd5e1' },
    furniture: [
      { instanceId: 'f_init_20', furnitureId: 'meja_kayu', gx: 1, gz: 4, rot: 0 },
      { instanceId: 'f_init_21', furnitureId: 'tempat_tidur_single', gx: 0, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_ruko_pasar_2',
    name: 'Ruko Niaga Cicalengka Timur',
    type: 'ruko',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_haji_ahmad',
    ownerType: 'npc',
    ownerName: 'H. Ahmad Juragan Pasar',
    position: { x: 54, y: 0, z: 10 },
    size: { width: 7, depth: 7 },
    rooms: 3,
    condition: 91,
    facilities: { electricity: true, water: true, internet: true, ac: true },
    defaultListingKind: 'sale',
    baseRent: 148000,
    baseDeposit: 150000,
    baseValue: 2250000,
    layout: { gridCols: 7, gridRows: 7, wallColor: '#fff7ed', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_22', furnitureId: 'meja_kayu', gx: 2, gz: 4, rot: 0 },
      { instanceId: 'f_init_23', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
    ],
  },
  {
    id: 'prop_rumah_griya_1',
    name: 'Rumah Tipe 36 Griya Asri',
    type: 'rumah',
    zone: 'cicalengka',
    areaTag: 'perumahan',
    ownerId: 'npc_developer_pt',
    ownerType: 'npc',
    ownerName: 'PT Bandung Timur Residence',
    position: { x: 38, y: 0, z: 34 },
    size: { width: 8, depth: 8 },
    rooms: 3,
    condition: 94,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'sale',
    baseRent: 160000,
    baseDeposit: 160000,
    baseValue: 2450000,
    layout: { gridCols: 8, gridRows: 8, wallColor: '#ecfdf5', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_24', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_25', furnitureId: 'meja_kayu', gx: 4, gz: 4, rot: 0 },
      { instanceId: 'f_init_26', furnitureId: 'kursi_santai', gx: 5, gz: 4, rot: 0 },
    ],
  },
  {
    id: 'prop_rumah_griya_2',
    name: 'Rumah Tipe 45 Cicalengka Hills',
    type: 'rumah',
    zone: 'cicalengka',
    areaTag: 'perumahan',
    ownerId: 'npc_developer_pt',
    ownerType: 'npc',
    ownerName: 'PT Bandung Timur Residence',
    position: { x: 56, y: 0, z: 34 },
    size: { width: 8, depth: 8 },
    rooms: 3,
    condition: 97,
    facilities: { electricity: true, water: true, internet: true, ac: true },
    defaultListingKind: 'rent',
    baseRent: 185000,
    baseDeposit: 185000,
    baseValue: 2950000,
    layout: { gridCols: 8, gridRows: 8, wallColor: '#f0fdf4', floorColor: '#f1f5f9' },
    furniture: [
      { instanceId: 'f_init_27', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_28', furnitureId: 'kulkas_mini', gx: 6, gz: 0, rot: 0 },
      { instanceId: 'f_init_29', furnitureId: 'kompor_gas', gx: 6, gz: 1, rot: 0 },
      { instanceId: 'f_init_30', furnitureId: 'tv_led', gx: 4, gz: 5, rot: 0 },
    ],
  },
  {
    id: 'prop_rumah_griya_3',
    name: 'Rumah Keluarga Kareumbi',
    type: 'rumah',
    zone: 'cicalengka',
    areaTag: 'perumahan',
    ownerId: 'npc_agen_ujang',
    ownerType: 'npc',
    ownerName: 'Agen Properti Kang Ujang',
    position: { x: 38, y: 0, z: 52 },
    size: { width: 8, depth: 8 },
    rooms: 4,
    condition: 84,
    facilities: { electricity: true, water: true, internet: true, ac: false },
    defaultListingKind: 'rent',
    baseRent: 175000,
    baseDeposit: 175000,
    baseValue: 2700000,
    layout: { gridCols: 8, gridRows: 8, wallColor: '#eff6ff', floorColor: '#e2e8f0' },
    furniture: [
      { instanceId: 'f_init_31', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_32', furnitureId: 'kursi_santai', gx: 3, gz: 4, rot: 0 },
    ],
  },
  {
    id: 'prop_rumah_griya_4',
    name: 'Rumah Paviliun Timur Elit',
    type: 'rumah',
    zone: 'cicalengka',
    areaTag: 'perumahan',
    ownerId: 'npc_haji_ahmad',
    ownerType: 'npc',
    ownerName: 'H. Ahmad Juragan Pasar',
    position: { x: 56, y: 0, z: 52 },
    size: { width: 9, depth: 9 },
    rooms: 4,
    condition: 98,
    facilities: { electricity: true, water: true, internet: true, ac: true },
    defaultListingKind: 'sale',
    baseRent: 240000,
    baseDeposit: 240000,
    baseValue: 3750000,
    layout: { gridCols: 9, gridRows: 9, wallColor: '#faf5ff', floorColor: '#f8fafc' },
    furniture: [
      { instanceId: 'f_init_33', furnitureId: 'tempat_tidur_queen', gx: 0, gz: 0, rot: 0 },
      { instanceId: 'f_init_34', furnitureId: 'tv_led', gx: 5, gz: 6, rot: 0 },
      { instanceId: 'f_init_35', furnitureId: 'kulkas_mini', gx: 7, gz: 0, rot: 0 },
      { instanceId: 'f_init_36', furnitureId: 'kompor_gas', gx: 7, gz: 1, rot: 0 },
    ],
  },
  // 3 Lapak Pasar Awal Fase 4
  {
    id: 'prop_lapak_pasar_1',
    name: 'Lapak Pasar Sayur Blok A1',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 38, y: 0, z: -20 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 86,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'rent',
    baseRent: 22000,
    baseDeposit: 15000,
    baseValue: 260000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#fef9c3', floorColor: '#cbd5e1' },
    furniture: [],
  },
  {
    id: 'prop_lapak_pasar_2',
    name: 'Lapak Pasar Kuliner Blok B2',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 46, y: 0, z: -20 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 88,
    facilities: { electricity: true, water: true, internet: false, ac: false },
    defaultListingKind: 'rent',
    baseRent: 26000,
    baseDeposit: 18000,
    baseValue: 295000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#ffedd5', floorColor: '#cbd5e1' },
    furniture: [],
  },
  {
    id: 'prop_lapak_pasar_3',
    name: 'Lapak Pasar Sembako Blok C1',
    type: 'lapak_pasar',
    zone: 'cicalengka',
    areaTag: 'pasar',
    ownerId: 'npc_pasar_pengurus',
    ownerType: 'npc',
    ownerName: 'Pengurus Pasar Sehat Cicalengka',
    position: { x: 38, y: 0, z: -28 },
    size: { width: 4, depth: 4 },
    rooms: 1,
    condition: 82,
    facilities: { electricity: true, water: false, internet: false, ac: false },
    defaultListingKind: 'rent',
    baseRent: 19000,
    baseDeposit: 15000,
    baseValue: 230000,
    layout: { gridCols: 4, gridRows: 4, wallColor: '#dcfce7', floorColor: '#d6d3d1' },
    furniture: [],
  },
];

export const INITIAL_PROPERTIES_DATA: Array<PropertyDoc & { defaultListingKind: 'rent' | 'sale' }> =
  RAW_INITIAL_PROPERTIES_DATA.map((p) => {
    const placement = findLotPlacement(p.id);
    return placement
      ? {
          ...p,
          position: { x: placement.x, y: p.position.y, z: placement.z },
        }
      : p;
  });

export const INITIAL_LISTINGS_DATA: PropertyListingDoc[] = INITIAL_PROPERTIES_DATA.map((p) => {
  const stationDist = Math.round(
    distance2D(p.position.x, p.position.z, STATION_SPAWN.x, STATION_SPAWN.z)
  );
  return {
    id: `lst_${p.id}`,
    propertyId: p.id,
    propertyName: p.name,
    propertyType: p.type,
    areaTag: p.areaTag,
    zone: p.zone,
    position: { x: p.position.x, z: p.position.z },
    rooms: p.rooms,
    condition: p.condition,
    stationDistanceMeters: stationDist,
    ownerId: p.ownerId,
    ownerType: p.ownerType,
    ownerName: p.ownerName,
    kind: p.defaultListingKind,
    price: p.defaultListingKind === 'rent' ? p.baseRent : p.baseValue,
    deposit: p.defaultListingKind === 'rent' ? p.baseDeposit : 0,
    status: 'active',
    createdAtMs: 1_704_067_200_000,
    expiresAtMs: 4_102_444_800_000,
  };
});

export function getZoneId(x: number, z: number): string {
  const gx = Math.floor(x / GRID_ZONE_SIZE);
  const gz = Math.floor(z / GRID_ZONE_SIZE);
  return `z_${gx}_${gz}`;
}

export function distance2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

