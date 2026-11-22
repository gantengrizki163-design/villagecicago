import { formatRupiah } from './gameTime';
import {
  computeLazyStnkStatusClient,
  getDefaultVehicleConfig,
  getVehicleModelById,
} from './vehicleConfigCache';
import type {
  BillDoc,
  VehicleDoc,
  VehicleLeaseDoc,
  VehicleParkedType,
  VehicleStatus,
  VehiclesConfigDoc,
} from '../types/game';

export type VehicleNotificationCategory = 'impound' | 'stnk' | 'fuel' | 'lease' | 'ticket';
export type VehicleNotificationAction = 'garage' | 'samsat_sim' | 'spbu' | 'bills';

export interface VehicleNotificationItem {
  id: string;
  vehicleId?: string;
  category: VehicleNotificationCategory;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  actionTarget: VehicleNotificationAction;
  actionLabel: string;
}

export function formatRemainingCompact(ms: number): string {
  if (ms <= 0) return '0d';
  if (ms < 60_000) return `${Math.max(1, Math.ceil(ms / 1000))}d`;
  if (ms < 3_600_000) return `${Math.ceil(ms / 60_000)}m`;
  if (ms < 86_400_000) {
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.floor((ms % 3_600_000) / 60_000);
    return mins > 0 ? `${hours}j ${mins}m` : `${hours}j`;
  }
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return hours > 0 ? `${days}h ${hours}j` : `${days}h`;
}

export function formatVehicleParkedLabel(parkedType?: VehicleParkedType | null): string {
  switch (parkedType) {
    case 'garage':
      return 'Garasi Rumah';
    case 'parking_lot':
      return 'Lahan Parkir Resmi';
    case 'roadside':
      return 'Pinggir Jalan (Rawan Derek)';
    case 'dealer':
      return 'Halaman Dealer';
    case 'workshop':
      return 'Bengkel';
    case 'impound':
      return 'Area Sitaan / Derek';
    default:
      return 'Terparkir';
  }
}

export function formatVehicleStatusLabel(status: VehicleStatus): string {
  switch (status) {
    case 'parked':
      return 'Terparkir';
    case 'driving':
      return 'Sedang Dikendarai';
    case 'impounded':
      return 'Diderek / Disita';
    case 'in_workshop':
      return 'Di Bengkel';
    case 'listed':
      return 'Diiklankan P2P';
    case 'auctioning':
      return 'Sedang Dilelang';
    case 'stolen':
      return 'Dilaporkan Hilang';
    default:
      return status;
  }
}

export interface ComputeVehicleNotificationsParams {
  vehicles: VehicleDoc[];
  vehicleLeases: VehicleLeaseDoc[];
  bills: BillDoc[];
  nowMs: number;
  cfg?: VehiclesConfigDoc;
}

export function computeVehicleNotifications({
  vehicles,
  vehicleLeases,
  bills,
  nowMs,
  cfg = getDefaultVehicleConfig().vehicles,
}: ComputeVehicleNotificationsParams): VehicleNotificationItem[] {
  const items: VehicleNotificationItem[] = [];
  const stnkWarningWindowMs = Math.min(
    6 * 3_600_000,
    Math.max(10 * 60_000, Math.round(cfg.stnkPeriodMs * 0.25))
  );
  const leaseWarningWindowMs = 20 * 60_000;

  for (const v of vehicles) {
    // 1. Kendaraan diderek / disita / dicuri
    if (v.status === 'impounded' || v.status === 'stolen') {
      const fee = v.impoundFine ?? cfg.impoundRecoveryBaseFee;
      items.push({
        id: `impound_${v.id}_${v.status}`,
        vehicleId: v.id,
        category: 'impound',
        severity: 'critical',
        title:
          v.status === 'stolen'
            ? `${v.name} (${v.plateNumber}) hilang/dicuri!`
            : `${v.name} (${v.plateNumber}) diderek/disita`,
        detail: `${v.impoundReason ? `${v.impoundReason}. ` : ''}Segera tebus dari garasi (${formatRupiah(fee)}).`,
        actionTarget: 'garage',
        actionLabel: 'Tebus Unit',
      });
    }

    // 2. STNK akan habis atau sudah mati
    if (v.status !== 'listed' && v.status !== 'auctioning') {
      const stnk = computeLazyStnkStatusClient(v, nowMs, cfg);
      const remainMs = v.stnkExpiresAtMs - nowMs;
      if (stnk.isExpired) {
        items.push({
          id: `stnk_expired_${v.id}_${stnk.inGracePeriod ? 'grace' : 'dead'}`,
          vehicleId: v.id,
          category: 'stnk',
          severity: stnk.inGracePeriod ? 'warning' : 'critical',
          title: `STNK ${v.name} (${v.plateNumber}) ${
            stnk.inGracePeriod ? 'telat (masa tenggang)' : 'MATI'
          }`,
          detail: `Biaya perpanjang Samsat ${formatRupiah(stnk.totalDue)}. Berkendara tanpa STNK aktif berisiko ditilang.`,
          actionTarget: 'samsat_sim',
          actionLabel: 'Ke Samsat',
        });
      } else if (remainMs > 0 && remainMs <= stnkWarningWindowMs) {
        items.push({
          id: `stnk_soon_${v.id}`,
          vehicleId: v.id,
          category: 'stnk',
          severity: 'warning',
          title: `STNK ${v.name} (${v.plateNumber}) akan habis`,
          detail: `Masa berlaku tersisa ${formatRemainingCompact(remainMs)}. Perpanjang di Samsat Cicalengka.`,
          actionTarget: 'samsat_sim',
          actionLabel: 'Ke Samsat',
        });
      }
    }

    // 3. Bensin / baterai menipis
    if (v.status === 'parked' || v.status === 'driving') {
      const model = getVehicleModelById(v.modelId, cfg);
      const isEv = Boolean(v.isElectric ?? model?.isElectric);
      const cap = model?.tankCapacity ?? v.fuelCapacity ?? 10;
      const pct = Math.max(0, Math.min(100, (v.fuel / Math.max(0.1, cap)) * 100));
      if (pct <= 20) {
        const empty = pct <= 5;
        items.push({
          id: `fuel_${empty ? 'empty' : 'low'}_${v.id}`,
          vehicleId: v.id,
          category: 'fuel',
          severity: empty ? 'critical' : 'warning',
          title: `${isEv ? 'Baterai' : 'Bensin'} ${v.name} ${
            empty ? 'hampir habis' : `menipis (${Math.round(pct)}%)`
          }`,
          detail: `${v.plateNumber} — segera ${isEv ? 'isi daya EV' : 'isi BBM'} di SPBU Cicalengka.`,
          actionTarget: 'spbu',
          actionLabel: isEv ? 'Cas di SPBU' : 'Isi di SPBU',
        });
      }
    }
  }

  // 4. Tagihan kendaraan belum dibayar (cicilan leasing, pajak, tilang)
  let hasLeaseBillAlert = false;
  for (const bill of bills) {
    if (bill.status === 'paid') continue;
    const isOverdue = bill.status === 'defaulted' || nowMs > bill.dueAtMs;
    if (bill.billType === 'vehicle_lease_installment') {
      hasLeaseBillAlert = true;
      items.push({
        id: `bill_lease_${bill.id}_${isOverdue ? 'overdue' : 'unpaid'}`,
        category: 'lease',
        severity: isOverdue ? 'critical' : 'warning',
        title: isOverdue
          ? 'Cicilan kendaraan menunggak!'
          : 'Tagihan cicilan kendaraan jatuh tempo',
        detail: `${bill.title || 'Angsuran Leasing'} sebesar ${formatRupiah(bill.totalDue)} menunggu pembayaran.`,
        actionTarget: 'bills',
        actionLabel: 'Bayar Tagihan',
      });
    } else if (bill.billType === 'vehicle_ticket_fine') {
      items.push({
        id: `bill_ticket_${bill.id}_${isOverdue ? 'overdue' : 'unpaid'}`,
        category: 'ticket',
        severity: isOverdue ? 'critical' : 'warning',
        title: isOverdue ? 'Denda tilang menunggak!' : 'Tagihan tilang lalu lintas',
        detail: `${bill.title || 'Tilang Satlantas'} sebesar ${formatRupiah(bill.totalDue)} belum dibayar.`,
        actionTarget: 'bills',
        actionLabel: 'Bayar Tilang',
      });
    } else if (bill.billType === 'vehicle_tax') {
      items.push({
        id: `bill_tax_${bill.id}_${isOverdue ? 'overdue' : 'unpaid'}`,
        category: 'stnk',
        severity: isOverdue ? 'critical' : 'warning',
        title: 'Tagihan pajak kendaraan belum dibayar',
        detail: `${bill.title || 'Pajak Kendaraan'} sebesar ${formatRupiah(bill.totalDue)}.`,
        actionTarget: 'bills',
        actionLabel: 'Bayar Pajak',
      });
    }
  }

  // Kontrak leasing aktif yang mendekati atau melewati jatuh tempo
  for (const ls of vehicleLeases) {
    if (ls.status !== 'active') continue;
    const remainMs = ls.nextDueAtMs - nowMs;
    if (ls.missedCount > 0 || remainMs <= 0) {
      if (!hasLeaseBillAlert) {
        items.push({
          id: `lease_overdue_${ls.id}_${ls.missedCount}`,
          vehicleId: ls.vehicleId,
          category: 'lease',
          severity: 'critical',
          title: `Cicilan ${ls.vehicleName} jatuh tempo / menunggak`,
          detail: `Angsuran ${formatRupiah(ls.installment)} (tunggakan ${ls.missedCount}x). Cek Tagihan agar unit tidak ditarik leasing.`,
          actionTarget: 'bills',
          actionLabel: 'Buka Tagihan',
        });
      }
    } else if (remainMs <= leaseWarningWindowMs) {
      items.push({
        id: `lease_soon_${ls.id}`,
        vehicleId: ls.vehicleId,
        category: 'lease',
        severity: 'warning',
        title: `Cicilan ${ls.vehicleName} segera jatuh tempo`,
        detail: `Angsuran ${formatRupiah(ls.installment)} jatuh tempo dalam ${formatRemainingCompact(remainMs)}.`,
        actionTarget: 'bills',
        actionLabel: 'Cek Tagihan',
      });
    }
  }

  items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return items;
}
