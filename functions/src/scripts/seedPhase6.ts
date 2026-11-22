/**
 * Skrip Seed Fase 6 (Idempoten):
 * Mengisi config Fase 6 (law, npcs, quests, mortgage, land, construction, ai),
 * status awal npc_state, katalog quests, kavling tanah (land_plots), dan cache FAQ AI.
 *
 * Jalankan setelah config Fase 6 tersedia:
 *   npx tsx functions/src/scripts/seedPhase6.ts
 */
import aiConfig from '../config/ai.json';
import constructionConfig from '../config/construction.json';
import jobsConfig from '../config/jobs.json';
import landConfig from '../config/land.json';
import lawConfig from '../config/law.json';
import mortgageConfig from '../config/mortgage.json';
import npcsConfig from '../config/npcs.json';
import questsConfig from '../config/quests.json';
import { db } from '../helpers/firebase';

export async function seedPhase6Data() {
  const nowMs = Date.now();

  // 1. Seed & sinkron seluruh config Fase 6 (+ update jobs untuk Polisi & Agen Properti)
  const configEntries: Array<[string, Record<string, unknown>]> = [
    ['law', lawConfig as unknown as Record<string, unknown>],
    ['npcs', npcsConfig as unknown as Record<string, unknown>],
    ['quests', questsConfig as unknown as Record<string, unknown>],
    ['mortgage', mortgageConfig as unknown as Record<string, unknown>],
    ['land', landConfig as unknown as Record<string, unknown>],
    ['construction', constructionConfig as unknown as Record<string, unknown>],
    ['ai', aiConfig as unknown as Record<string, unknown>],
    ['jobs', { items: jobsConfig } as unknown as Record<string, unknown>],
  ];

  for (const [id, payload] of configEntries) {
    await db.collection('config').doc(id).set(payload, { merge: true });
  }

  // 2. Seed npc_state untuk setiap NPC yang belum ada
  let seededNpcs = 0;
  for (const npc of npcsConfig.npcs) {
    const ref = db.collection('npc_state').doc(npc.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        npcId: npc.id,
        mood: 'ramah',
        inventory: npc.defaultInventory || [],
        relationships: {},
        lastEventNote: 'Aktivitas normal di Cicalengka',
        updatedAtMs: nowMs,
      });
      seededNpcs += 1;
    }
  }

  // 3. Seed katalog quests
  let seededQuests = 0;
  for (const q of questsConfig.quests) {
    const ref = db.collection('quests').doc(q.id);
    await ref.set(
      {
        ...q,
        active: q.active !== false,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
    seededQuests += 1;
  }

  // 4. Seed kavling tanah (land_plots) secara idempoten agar tidak menimpa pemilik yang sudah membeli
  let seededPlots = 0;
  for (const plot of landConfig.plots) {
    const ref = db.collection('land_plots').doc(plot.id);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        id: plot.id,
        name: plot.name,
        zone: 'cicalengka',
        areaTag: plot.areaTag,
        position: plot.position,
        size: plot.size,
        roadAccess: plot.roadAccess,
        zoning: plot.zoning,
        basePrice: plot.price,
        price: plot.price,
        ownerId: 'npc_pemdes_cicalengka',
        ownerName: 'Pemerintah Desa Cicalengka',
        permitStatus: 'none',
        permitAppliedAtMs: 0,
        permitReadyAtMs: 0,
        constructionId: null,
        propertyId: null,
        priceUpdatedAtMs: nowMs,
        updatedAtMs: nowMs,
      });
      seededPlots += 1;
    }
  }

  // 5. Seed FAQ AI cache
  let seededFaq = 0;
  for (const faq of aiConfig.faqCache || []) {
    const ref = db.collection('ai_faq_cache').doc(faq.key);
    await ref.set(
      {
        cacheKey: faq.key,
        npcId: faq.npcId || '*',
        keywords: faq.keywords || [],
        reply: faq.reply,
        updatedAtMs: nowMs,
      },
      { merge: true }
    );
    seededFaq += 1;
  }

  // 6. Seed baseline rekap hukum harian (state/law_recap) bila belum ada
  const recapRef = db.collection('state').doc('law_recap');
  const recapSnap = await recapRef.get();
  if (!recapSnap.exists) {
    await recapRef.set({
      dayKey: new Date(nowMs).toISOString().slice(0, 10),
      totalRecentCrimes: 0,
      activeWantedCount: 0,
      activePrisonersCount: 0,
      totalFinesValue: 0,
      topOffense: 'none',
      offenseBreakdown: {},
      updatedAtMs: nowMs,
    });
  }

  console.log(
    `Seed Fase 6 selesai: ${seededNpcs} npc_state, ${seededQuests} quests, ${seededPlots} land_plots, ${seededFaq} FAQ AI.`
  );
}

if (require.main === module) {
  seedPhase6Data()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed Fase 6 gagal:', err);
      process.exit(1);
    });
}
