"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedInitialProperties = seedInitialProperties;
/**
 * Skrip Seed 18 Properti Awal & Listing Aktif Fase 3 (Idempoten).
 * Jalankan secara lokal atau terhadap Firebase Emulator:
 *   npx tsx functions/src/scripts/seedProperties.ts
 */
const initialProperties_json_1 = __importDefault(require("../config/initialProperties.json"));
const firebase_1 = require("../helpers/firebase");
const STATION_X = 0;
const STATION_Z = -46;
function getStationDistance(x, z) {
    const meters = Math.round(Math.hypot(x - STATION_X, z - STATION_Z));
    const tier = meters <= 32 ? 'dekat' : meters <= 70 ? 'sedang' : 'jauh';
    return { meters, tier };
}
async function seedInitialProperties() {
    const nowMs = Date.now();
    const list = initialProperties_json_1.default.properties;
    let seededProps = 0;
    let seededListings = 0;
    for (const p of list) {
        const propRef = firebase_1.db.collection('properties').doc(p.id);
        const snap = await propRef.get();
        if (snap.exists)
            continue;
        const dist = getStationDistance(p.position.x, p.position.z);
        const listingId = `list_${p.id}`;
        const price = p.defaultListingKind === 'sale' ? p.baseValue : p.baseRent;
        const deposit = p.defaultListingKind === 'sale' ? 0 : p.baseDeposit;
        await propRef.set({
            id: p.id,
            name: p.name,
            type: p.type,
            zone: p.zone,
            areaTag: p.areaTag,
            ownerId: p.ownerId,
            ownerType: p.ownerType,
            ownerName: p.ownerName,
            position: p.position,
            stationDistanceMeters: dist.meters,
            stationDistanceTier: dist.tier,
            size: p.size,
            rooms: p.rooms,
            condition: p.condition,
            facilities: p.facilities,
            layout: p.layout,
            furniture: p.furniture,
            baseRent: p.baseRent,
            baseDeposit: p.baseDeposit,
            baseValue: p.baseValue,
            activeListingId: listingId,
            activeLeaseId: null,
            viewingSchedule: { open24h: true, startHour: 6, endHour: 22 },
            mortgageInfo: null,
            lastConditionDecayAtMs: nowMs,
            lastTaxAtMs: nowMs,
            createdAtMs: nowMs,
            updatedAtMs: nowMs,
        });
        seededProps += 1;
        await firebase_1.db.collection('property_listings').doc(listingId).set({
            id: listingId,
            propertyId: p.id,
            propertyName: p.name,
            propertyType: p.type,
            areaTag: p.areaTag,
            rooms: p.rooms,
            condition: p.condition,
            stationDistanceTier: dist.tier,
            ownerId: p.ownerId,
            ownerType: p.ownerType,
            ownerName: p.ownerName,
            kind: p.defaultListingKind,
            price,
            deposit,
            status: 'active',
            createdAtMs: nowMs,
            expiresAtMs: nowMs + 30 * 24 * 3_600_000,
        });
        seededListings += 1;
    }
    console.log(`Seed Fase 3 selesai: ${seededProps} properti & ${seededListings} listing dibuat.`);
}
if (require.main === module) {
    seedInitialProperties()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('Seed properti gagal:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=seedProperties.js.map