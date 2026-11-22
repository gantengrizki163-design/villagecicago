import { describe, expect, it } from 'vitest';
import aiConfig from '../../../../functions/src/config/ai.json';
import constructionConfig from '../../../../functions/src/config/construction.json';
import landConfig from '../../../../functions/src/config/land.json';
import lawConfig from '../../../../functions/src/config/law.json';
import mortgageConfig from '../../../../functions/src/config/mortgage.json';
import npcsConfig from '../../../../functions/src/config/npcs.json';
import productsConfig from '../../../../functions/src/config/products.json';
import questsConfig from '../../../../functions/src/config/quests.json';
import { type LocalSimulationState, localSimulation } from '../localSimulation';
import {
  DEFAULT_NPCS_CONFIG,
  computeClientNpcPose,
  formatNpcActivityLabel,
  getClientNpcClockState,
  getVisibleDeterministicNpcs,
} from '../npcDeterminism';

function seedCleanTestCharacter(uid = 'test_phase6_user', money = 5_000_000): {
  getState: () => LocalSimulationState;
  unsub: () => void;
} {
  localSimulation.reset();
  let snapshot!: LocalSimulationState;
  const unsub = localSimulation.subscribe((s) => {
    snapshot = s;
  });

  const now = Date.now();
  localSimulation.seedFromFirestore(
    {
      uid,
      name: 'Kang Uji',
      nameLower: 'kang uji',
      gender: 'laki-laki',
      skinColor: '#e0ac69',
      hairColor: '#1e1b18',
      shirtColor: '#2563eb',
      pantsColor: '#1e293b',
      money,
      health: 100,
      hygiene: 100,
      mood: 90,
      currentZone: 'cicalengka',
      skills: { komunikasi: 12, fisik: 10, hitung: 10, teknis: 10 },
      currentJob: null,
      activeShift: null,
      activeTrip: null,
      activeClinic: null,
      activeCourse: null,
      faintedCount: 0,
      lastPosition: { x: 0, y: 0, z: 0, rotY: 0 },
      reputation: 70,
      homeless: false,
      currentHomeId: 'prop_kos_1',
      wantedLevel: 0,
      wantedUpdatedAtMs: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      uid,
      hunger: 100,
      thirst: 100,
      energy: 100,
      health: 100,
      hygiene: 100,
      mood: 90,
      lastCalculatedAt: now,
    }
  );
  return { getState: () => snapshot, unsub };
}

describe('Fase 6 — Konfigurasi, Rutinitas NPC Deterministik & Integritas Simulasi', () => {
  it('validasi silang seluruh konfigurasi Fase 6 (NPC, Quest, Produk Material, Kavling, KPR)', () => {
    const npcIds = new Set(npcsConfig.npcs.map((n) => n.id));
    const productIds = new Set(productsConfig.products.map((p) => p.id));

    expect(npcsConfig.npcs.length).toBeGreaterThanOrEqual(8);
    for (const q of questsConfig.quests) {
      expect(npcIds.has(q.npcId)).toBe(true);
      if (q.rewardItemId) {
        expect(productIds.has(q.rewardItemId)).toBe(true);
      }
    }

    for (const bp of Object.values(constructionConfig.blueprints)) {
      for (const matId of Object.keys(bp.materials)) {
        expect(productIds.has(matId)).toBe(true);
      }
    }

    expect(landConfig.plots.length).toBeGreaterThanOrEqual(6);
    expect(mortgageConfig.tenors.length).toBeGreaterThanOrEqual(2);
    expect(lawConfig.offenses.length).toBeGreaterThanOrEqual(4);
    expect(aiConfig.faqCache.length).toBeGreaterThanOrEqual(3);
  });

  it('menghitung posisi, animasi, dan jadwal NPC secara 100% deterministik tanpa DB per frame', () => {
    const targetNpc = DEFAULT_NPCS_CONFIG.npcs.find((n) => n.id === 'npc_bripka_asep')!;
    const sampleTime = Date.UTC(2026, 10, 21, 9, 15, 0);

    const clockA = getClientNpcClockState(sampleTime);
    const clockB = getClientNpcClockState(sampleTime);
    expect(clockA).toEqual(clockB);

    const poseA = computeClientNpcPose(targetNpc, sampleTime, { x: 0, z: 0 }, 80);
    const poseB = computeClientNpcPose(targetNpc, sampleTime, { x: 0, z: 0 }, 80);
    expect(poseA).toEqual(poseB);
    expect(formatNpcActivityLabel(poseA.activity).length).toBeGreaterThan(3);

    const rancaekekView = getVisibleDeterministicNpcs({
      serverNowMs: sampleTime,
      playerPos: { x: 0, z: 0 },
      quality: 'high',
      zone: 'rancaekek',
    });
    expect(rancaekekView.visibleNpcs).toEqual([]);
    expect(rancaekekView.nearestTalkableNpc).toBeNull();

    const lowQualityView = getVisibleDeterministicNpcs({
      serverNowMs: sampleTime,
      playerPos: { x: 0, z: 0 },
      quality: 'low',
      zone: 'cicalengka',
    });
    expect(lowQualityView.visibleNpcs.length).toBeLessThanOrEqual(
      DEFAULT_NPCS_CONFIG.maxActiveRenderCount.low
    );
  });

  it('mengarahkan polisi patroli terdekat untuk merespons laporan kriminal aktif (lazy alert)', () => {
    const patrolNpc = DEFAULT_NPCS_CONFIG.npcs.find((n) => n.id === 'npc_bripka_asep')!;
    const nowMs = Date.UTC(2026, 10, 21, 10, 0, 0);
    const pose = computeClientNpcPose(patrolNpc, nowMs, { x: -6, z: 18 }, 90, [
      {
        id: 'alert_pencurian_1',
        kind: 'crime',
        message: 'Pencurian di dekat Alun-alun',
        x: -10,
        z: 14,
        createdAt: nowMs - 2000,
        expiresAt: nowMs + 60_000,
      },
    ]);

    expect(pose.respondingAlertId).toBe('alert_pencurian_1');
    expect(pose.activity).toBe('respons_laporan');
    expect(pose.isPatrolling).toBe(true);
    expect(pose.anim).toBe('walk');
  });

  it('menjalankan alur Hukum, Kepolisian, Keamanan Properti, & Asuransi di simulasi lokal', () => {
    const { getState, unsub } = seedCleanTestCharacter('test_law_uid', 2_000_000);
    try {
      // 1. Aksi kriminal & cooldown (severity 1 tidak langsung dipenjara sehingga selalu memicu cooldown pada percobaan ke-2)
      const crimeRes = localSimulation.attemptCrime('buat_keributan', 'public', 'public', -28, -16);
      expect(crimeRes.ok).toBe(true);
      expect(crimeRes.wantedLevel).toBeGreaterThan(0);

      expect(() => localSimulation.attemptCrime('copet_warga')).toThrow(/Tunggu/i);

      const payRes = localSimulation.payFine(crimeRes.recordId, 'wallet');
      expect(payRes.ok).toBe(true);
      expect(payRes.fine).toBeGreaterThan(0);

      // Jika kebetulan tertangkap (severity 2), bayar jaminan atau bebas agar tes lanjut bersih
      if (getState().character?.sentence?.active) {
        const bailRes = localSimulation.payBail(undefined, 'Kang Uji', 'wallet');
        expect(bailRes.ok).toBe(true);
      }

      // 2. Penindakan & audit Propam
      const arrestRes = localSimulation.arrestPlayer('tersangka_1');
      expect(arrestRes.ok).toBe(true);
      expect(arrestRes.reward).toBe(lawConfig.policeEnforcement.arrestReward);

      const fineAct = localSimulation.issueFine('tersangka_1');
      expect(fineAct.ok).toBe(true);

      const latestActions = getState().policeActions;
      expect(latestActions.length).toBeGreaterThanOrEqual(2);
      const reviewRes = localSimulation.reviewPoliceAction(latestActions[0].id);
      expect(reviewRes.status).toBe('valid');

      // 3. Keamanan properti & asuransi + klaim
      const secLock = localSimulation.installSecurity('prop_rumah_1', 'lock');
      expect(secLock.ok).toBe(true);
      expect(secLock.protectionScore).toBeGreaterThan(0);

      const guardRes = localSimulation.hireGuard('prop_rumah_1', 'Kang Ujang', 'hire');
      expect(guardRes.protectionScore).toBeGreaterThan(secLock.protectionScore);

      const insRes = localSimulation.buyInsurance('property', 'prop_rumah_1', 'basic');
      expect(insRes.ok).toBe(true);
      const claimRes = localSimulation.fileClaim(insRes.insuranceId, crimeRes.recordId);
      expect(claimRes.ok).toBe(true);
      expect(claimRes.payoutAmount).toBeGreaterThan(0);
    } finally {
      unsub();
      localSimulation.reset();
    }
  });

  it('menjalankan dialog AI FAQ/fallback, memori NPC, quest warga, KPR, kavling, & konstruksi', () => {
    const { getState, unsub } = seedCleanTestCharacter('test_prop_uid', 15_000_000);
    try {
      // 1. Dialog FAQ cache & fallback + affinity increment
      const faqDialog = localSimulation.talkToNpc('npc_teh_neng', 'jadwal kereta stasiun?');
      expect(faqDialog.ok).toBe(true);
      expect(faqDialog.source).toBe('faq_cache');
      expect(faqDialog.affinity).toBe(51);

      const fallbackDialog = localSimulation.talkToNpc('npc_teh_neng', 'Bagaimana cuaca kampung hari ini?');
      expect(fallbackDialog.ok).toBe(true);
      expect(fallbackDialog.source).toBe('scripted_fallback');
      expect(fallbackDialog.affinity).toBe(52);

      // 2. Quest warga (ambil & selesaikan)
      const firstQuest = questsConfig.quests[0];
      const qAcc = localSimulation.acceptQuest(firstQuest.id);
      expect(qAcc.ok).toBe(true);
      const qDone = localSimulation.completeQuest(qAcc.logId);
      expect(qDone.ok).toBe(true);
      expect(qDone.rewardMoney).toBe(firstQuest.rewardMoney);

      // 3. KPR Bank Priangan (Ajukan DP -> Bayar cicilan -> Lunasi)
      const saleListing = getState().listings.find((l) => l.kind === 'sale' && l.status === 'active')!;
      const mortRes = localSimulation.applyMortgage(saleListing.propertyId, 0.2, 12, 'wallet');
      expect(mortRes.ok).toBe(true);
      expect(mortRes.installment).toBeGreaterThan(0);

      const payMort = localSimulation.payMortgage(mortRes.mortgageId, 'wallet', 1);
      expect(payMort.ok).toBe(true);
      expect(payMort.status).toBe('active');

      const earlyRes = localSimulation.earlyRepay(mortRes.mortgageId, 'wallet');
      expect(earlyRes.ok).toBe(true);
      expect(getState().mortgages.find((m) => m.id === mortRes.mortgageId)?.status).toBe('paid');

      // 4. Beli Kavling, Ajukan IMB, Beli Material, & Bangun Rumah
      const plot = getState().landPlots[0];
      const buyLandRes = localSimulation.buyLand(plot.id, 'wallet');
      expect(buyLandRes.ok).toBe(true);

      const imbRes = localSimulation.applyPermit(plot.id, 'wallet');
      expect(imbRes.ok).toBe(true);

      // Simulasikan IMB selesai secara lazy lewat timestamp pada plot
      const updatedPlot = getState().landPlots.find((p) => p.id === plot.id)!;
      updatedPlot.permitStatus = 'approved';
      updatedPlot.imbStatus = 'approved';

      // Pastikan startConstruction gagal bila material bangunan kurang
      expect(() => localSimulation.startConstruction(plot.id, 'kecil', 'npc', 'wallet')).toThrow(
        /Material kurang/i
      );

      // Beli material blueprint kecil melalui NPC grosir (Mang Oding)
      const smallBp = constructionConfig.blueprints.kecil;
      for (const [matId, qtyNeeded] of Object.entries(smallBp.materials)) {
        for (let i = 0; i < qtyNeeded; i++) {
          localSimulation.executeNpcAction('npc_mang_oding', 'buy_npc_item', matId);
        }
      }

      const conRes = localSimulation.startConstruction(plot.id, 'kecil', 'npc', 'wallet');
      expect(conRes.ok).toBe(true);
      expect(conRes.phase).toBe('pondasi');

      // Majukan konstruksi hingga selesai berbasis timestamp mundur (lazy evaluation)
      const activeCon = getState().constructions.find((c) => c.id === conRes.constructionId)!;
      activeCon.phaseEndsAtMs = Date.now() - 10_000;
      activeCon.phaseDurationMs = 5_000;
      activeCon.phase = 'finishing';

      const compRes = localSimulation.completeConstruction(conRes.constructionId, 'Rumah Impian Uji');
      expect(compRes.ok).toBe(true);
      expect(compRes.propertyName).toBe('Rumah Impian Uji');
      expect(getState().properties.some((p) => p.id === compRes.propertyId)).toBe(true);

      // 5. Lisensi Agen Properti & Paket Mebel
      const agentRes = localSimulation.becomeAgent('wallet');
      expect(agentRes.isPropertyAgent).toBe(true);

      const setRes = localSimulation.buyFurnitureSet('set_minimalis', 'wallet');
      expect(setRes.ok).toBe(true);
    } finally {
      unsub();
      localSimulation.reset();
    }
  });
});
