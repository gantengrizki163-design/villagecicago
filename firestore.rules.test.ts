/**
 * Emulator Security Rules Test Suite (Firestore & RTDB) - Fase 1, Fase 2 & Fase 3
 * Jalankan dengan:
 *   firebase emulators:exec --only firestore,database "npx tsx firestore.rules.test.ts"
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function run() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rulesUnitTesting: any;
  try {
    const pkg = '@firebase/rules-unit-testing';
    rulesUnitTesting = await import(/* @vite-ignore */ pkg);
  } catch {
    console.log('Install @firebase/rules-unit-testing untuk menjalankan test emulator:');
    console.log('npm i -D @firebase/rules-unit-testing');
    return;
  }

  const { initializeTestEnvironment, assertFails, assertSucceeds } = rulesUnitTesting;
  const testEnv = await initializeTestEnvironment({
    projectId: 'cicalengka-life-test',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
    database: { rules: fs.readFileSync('database.rules.json', 'utf8') },
  });

  try {
    const alice = testEnv.authenticatedContext('alice_uid', { email: 'alice@test.id' });
    const bob = testEnv.authenticatedContext('bob_uid', { email: 'bob@test.id' });
    const charlie = testEnv.authenticatedContext('charlie_uid', { email: 'charlie@test.id' });
    const aliceDb = alice.firestore();
    const bobDb = bob.firestore();
    const charlieDb = charlie.firestore();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const db = ctx.firestore();
      await db.collection('characters').doc('alice_uid').set({
        uid: 'alice_uid',
        name: 'Teh Alice',
        money: 100000,
        health: 100,
        hygiene: 100,
        mood: 80,
      });
      await db.doc('characters/alice_uid/bills/rent_1').set({
        uid: 'alice_uid',
        status: 'unpaid',
        baseAmount: 75000,
      });
      await db.doc('characters/alice_uid/shift_secrets/shift_1').set({
        uid: 'alice_uid',
        answers: [12500],
      });
      await db.doc('characters/alice_uid/inventory/tv_led').set({
        uid: 'alice_uid',
        itemId: 'tv_led',
        category: 'furniture',
        name: 'TV LED',
        quantity: 1,
        updatedAtMs: Date.now(),
      });
      await db.collection('config').doc('jobs').set({ jobs: [] });
      await db.collection('config').doc('housing').set({ propertyTypes: {} });
      await db.collection('shop_menu').doc('nasi_telur').set({
        id: 'nasi_telur',
        name: 'Nasi + Telur',
        price: 12000,
        available: true,
      });
      await db.collection('properties').doc('prop_rumah_1').set({
        id: 'prop_rumah_1',
        name: 'Rumah Alice',
        ownerId: 'alice_uid',
        furniture: [],
      });
      await db.doc('property_access/prop_rumah_1/members/bob_uid').set({
        uid: 'bob_uid',
        propertyId: 'prop_rumah_1',
        role: 'roommate',
        grantedAtMs: Date.now(),
      });
      await db.collection('property_listings').doc('list_1').set({
        id: 'list_1',
        propertyId: 'prop_rumah_1',
        ownerId: 'alice_uid',
        status: 'active',
        price: 150000,
      });
      await db.collection('offers').doc('offer_1').set({
        id: 'offer_1',
        propertyId: 'prop_rumah_1',
        buyerId: 'bob_uid',
        ownerId: 'alice_uid',
        amount: 140000,
        status: 'pending',
      });
      await db.collection('leases').doc('lease_1').set({
        id: 'lease_1',
        propertyId: 'prop_rumah_1',
        tenantId: 'bob_uid',
        ownerId: 'alice_uid',
        roommateIds: ['bob_uid'],
        pendingInviteUids: [],
        status: 'active',
      });
      // Phase 4 fixtures
      await db.collection('accounts').doc('alice_uid').set({
        uid: 'alice_uid',
        accountNumber: 'CLG-1001',
        balance: 250000,
        savings: 100000,
        lastInterestAtMs: Date.now(),
        creditScore: 70,
        createdAtMs: Date.now(),
      });
      await db.collection('loans').doc('loan_1').set({
        id: 'loan_1',
        borrowerId: 'alice_uid',
        principal: 150000,
        status: 'active',
      });
      await db.collection('businesses').doc('biz_1').set({
        id: 'biz_1',
        ownerId: 'alice_uid',
        type: 'warung',
        name: 'Warung Maju Alice',
        status: 'active',
        isOpen: true,
        cash: 120000,
      });
      await db.doc('businesses/biz_1/daily_reports/day_1').set({
        dayKey: 'day_1',
        businessId: 'biz_1',
        ownerId: 'alice_uid',
        revenue: 85000,
        netProfit: 24000,
        updatedAtMs: Date.now(),
      });
      await db.collection('market_listings').doc('ml_1').set({
        id: 'ml_1',
        sellerId: 'bob_uid',
        itemId: 'beras_5kg',
        qty: 3,
        price: 36000,
        status: 'active',
      });
      await db.collection('auctions').doc('auc_1').set({
        id: 'auc_1',
        sellerId: 'bob_uid',
        subjectType: 'item',
        startPrice: 40000,
        currentBid: 40000,
        status: 'active',
      });
      await db.collection('market_stats').doc('beras_5kg').set({
        itemId: 'beras_5kg',
        basePrice: 11500,
        currentPrice: 11500,
        supply: 100,
        demand: 100,
      });
      await db.doc('state/treasury').set({
        balance: 50000,
        totalTaxCollected: 50000,
        inflationIndex: 1.0,
        updatedAtMs: Date.now(),
      });

      // Phase 6 fixtures
      await db.collection('characters').doc('officer_uid').set({
        uid: 'officer_uid',
        name: 'Bripka Dedi',
        money: 150000,
        currentJob: { jobId: 'polisi', title: 'Polisi Patroli' },
      });
      await db.collection('crime_records').doc('crime_1').set({
        id: 'crime_1',
        characterId: 'bob_uid',
        offenseId: 'pencurian',
        severity: 2,
        atMs: Date.now(),
        status: 'wanted',
        fine: 25000,
        sentenceSec: 300,
      });
      await db.collection('sentences').doc('bob_uid').set({
        uid: 'bob_uid',
        startAtMs: Date.now(),
        endAtMs: Date.now() + 300000,
        reason: 'Pencurian',
        bailPaid: false,
        status: 'serving',
      });
      await db.collection('police_actions').doc('pa_1').set({
        id: 'pa_1',
        officerId: 'officer_uid',
        targetId: 'bob_uid',
        action: 'arrest',
        evidence: 'crime_1',
        atMs: Date.now(),
        reviewed: false,
      });
      await db.collection('security_installs').doc('prop_rumah_1').set({
        propertyId: 'prop_rumah_1',
        ownerId: 'alice_uid',
        modules: { alarm: true },
        monthlyCost: 25000,
        protectionScore: 30,
        updatedAtMs: Date.now(),
      });
      await db.collection('insurance').doc('ins_1').set({
        id: 'ins_1',
        ownerId: 'alice_uid',
        subjectType: 'property',
        subjectId: 'prop_rumah_1',
        planId: 'dasar',
        coverageAmount: 200000,
        premiumPerCycle: 12000,
        status: 'active',
        createdAtMs: Date.now(),
      });
      await db.collection('insurance_claims').doc('claim_1').set({
        id: 'claim_1',
        insuranceId: 'ins_1',
        ownerId: 'alice_uid',
        subjectType: 'property',
        subjectId: 'prop_rumah_1',
        claimedLoss: 50000,
        payoutAmount: 45000,
        status: 'approved',
        createdAtMs: Date.now(),
      });
      await db.collection('npc_state').doc('kang_asep').set({
        npcId: 'kang_asep',
        mood: 'ramah',
        updatedAtMs: Date.now(),
      });
      await db.collection('npc_memory').doc('kang_asep_alice_uid').set({
        id: 'kang_asep_alice_uid',
        npcId: 'kang_asep',
        uid: 'alice_uid',
        affinity: 65,
        summary: 'Sering beli nasi.',
        updatedAtMs: Date.now(),
        expiresAtMs: Date.now() + 86400000,
      });
      await db.collection('quests').doc('q_antar_1').set({
        id: 'q_antar_1',
        npcId: 'kang_asep',
        title: 'Antar Pesanan',
        type: 'deliver',
        active: true,
      });
      await db.doc('characters/alice_uid/quest_log/ql_1').set({
        id: 'ql_1',
        uid: 'alice_uid',
        questId: 'q_antar_1',
        npcId: 'kang_asep',
        status: 'active',
      });
      await db.collection('mortgages').doc('kpr_1').set({
        id: 'kpr_1',
        borrowerId: 'alice_uid',
        propertyId: 'prop_rumah_1',
        principal: 400000,
        remaining: 380000,
        status: 'active',
      });
      await db.collection('land_plots').doc('plot_1').set({
        id: 'plot_1',
        name: 'Kavling Perumahan A',
        price: 180000,
        zoning: 'residensial',
        permitStatus: 'none',
      });
      await db.collection('constructions').doc('con_active').set({
        id: 'con_active',
        ownerId: 'alice_uid',
        plotId: 'plot_1',
        status: 'active',
      });
      await db.collection('constructions').doc('con_done').set({
        id: 'con_done',
        ownerId: 'alice_uid',
        plotId: 'plot_1',
        status: 'completed',
      });
      await db.collection('renovations').doc('ren_1').set({
        id: 'ren_1',
        ownerId: 'alice_uid',
        propertyId: 'prop_rumah_1',
        status: 'active',
      });
      await db.collection('agent_clients').doc('ac_1').set({
        id: 'ac_1',
        agentId: 'alice_uid',
        clientName: 'Pak Budi',
        status: 'open',
      });
      await db.collection('dev_projects').doc('dev_1').set({
        id: 'dev_1',
        developerId: 'alice_uid',
        name: 'Cluster Cicalengka',
        status: 'building',
      });
      await db.doc('ai_usage/alice_uid/days/2026-11-21').set({
        uid: 'alice_uid',
        date: '2026-11-21',
        count: 3,
        tokens: 450,
        updatedAtMs: Date.now(),
      });
      await db.collection('ai_faq_cache').doc('faq_1').set({
        cacheKey: 'faq_1',
        npcId: 'kang_asep',
        reply: 'Warung buka pagi sampai malam.',
        expiresAtMs: Date.now() + 86400000,
      });
      await db.collection('ai_moderation_reports').doc('mod_1').set({
        id: 'mod_1',
        uid: 'bob_uid',
        npcId: 'kang_asep',
        reason: 'blocked',
        createdAtMs: Date.now(),
      });
      await db.doc('state/law_recap').set({
        dayKey: '2026-11-21',
        totalCrimesLast24h: 2,
        activeSentencesCount: 1,
        updatedAtMs: Date.now(),
      });
      await db.collection('crime_recaps').doc('2026-11-21').set({
        dayKey: '2026-11-21',
        totalCrimesLast24h: 2,
        activeSentencesCount: 1,
        updatedAtMs: Date.now(),
      });

      // Vehicle System fixtures
      await db.collection('config').doc('vehicles').set({ models: [] });
      await db.collection('config').doc('traffic').set({ trafficLights: [] });
      await db.collection('config').doc('dealer').set({ dealers: [] });
      await db.collection('vehicles').doc('veh_private').set({
        id: 'veh_private',
        ownerId: 'alice_uid',
        modelId: 'motor_bebek',
        category: 'motor',
        name: 'Siliwangi Supra 110',
        plateNumber: 'D 1234 CLG',
        color: '#B91C1C',
        condition: 95,
        odometerKm: 12,
        fuel: 4.0,
        registeredAtMs: Date.now(),
        stnkExpiresAtMs: Date.now() + 86400000,
        parkedPos: { x: 10, y: 0.5, z: -20, zone: 'cicalengka' },
        status: 'parked',
        isPublicActive: false,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await db.collection('vehicles').doc('veh_public').set({
        id: 'veh_public',
        ownerId: 'bob_uid',
        driverId: 'bob_uid',
        modelId: 'mobil_sedan',
        category: 'mobil',
        name: 'Siliwangi Eksekutif 1.8',
        plateNumber: 'D 5678 BD',
        color: '#0F172A',
        condition: 98,
        odometerKm: 5,
        fuel: 40,
        registeredAtMs: Date.now(),
        stnkExpiresAtMs: Date.now() + 86400000,
        parkedPos: { x: 0, y: 0.5, z: 0, zone: 'cicalengka' },
        status: 'driving',
        isPublicActive: true,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await db.doc('vehicles/veh_private/service_logs/log_1').set({
        id: 'log_1',
        vehicleId: 'veh_private',
        ownerId: 'alice_uid',
        serviceType: 'refuel',
        providerType: 'spbu',
        cost: 5400,
        createdAtMs: Date.now(),
      });
      await db.collection('vehicle_plates').doc('D1234CLG').set({
        plateKey: 'D1234CLG',
        plateNumber: 'D 1234 CLG',
        vehicleId: 'veh_private',
        ownerId: 'alice_uid',
        createdAtMs: Date.now(),
      });
      await db.collection('driver_licenses').doc('alice_uid').set({
        uid: 'alice_uid',
        simC: { active: true, licenseNumber: 'SIMC-001', issuedAtMs: Date.now(), expiresAtMs: Date.now() + 86400000 },
        simA: null,
        updatedAtMs: Date.now(),
      });
      await db.collection('vehicle_leases').doc('vlease_1').set({
        id: 'vlease_1',
        borrowerId: 'alice_uid',
        vehicleId: 'veh_private',
        modelId: 'motor_bebek',
        principal: 90000,
        rate: 0.12,
        installment: 25200,
        remaining: 75600,
        nextDueAtMs: Date.now() + 3600000,
        status: 'active',
        createdAtMs: Date.now(),
      });
      await db.collection('vehicle_listings').doc('vlist_active').set({
        id: 'vlist_active',
        vehicleId: 'veh_public',
        ownerId: 'bob_uid',
        modelId: 'mobil_sedan',
        vehicleName: 'Siliwangi Eksekutif 1.8',
        category: 'mobil',
        plateNumber: 'D 5678 BD',
        price: 700000,
        status: 'active',
        createdAtMs: Date.now(),
      });
      await db.collection('vehicle_listings').doc('vlist_cancelled').set({
        id: 'vlist_cancelled',
        vehicleId: 'veh_public',
        ownerId: 'bob_uid',
        modelId: 'mobil_sedan',
        vehicleName: 'Siliwangi Eksekutif 1.8',
        category: 'mobil',
        plateNumber: 'D 5678 BD',
        price: 700000,
        status: 'cancelled',
        createdAtMs: Date.now(),
      });
      await db.collection('vehicle_test_drives').doc('alice_uid').set({
        uid: 'alice_uid',
        dealerId: 'dealer_motor_baru',
        modelId: 'motor_sport',
        startedAtMs: Date.now(),
        expiresAtMs: Date.now() + 120000,
        status: 'active',
      });
    });

    const officerDb = testEnv.authenticatedContext('officer_uid', { email: 'officer@test.id' }).firestore();

    // 1. Dirty Dozen Phase 1, 2, 3 & 4: client cannot write protected docs
    await assertFails(aliceDb.collection('characters').doc('alice_uid').update({ money: 999999 }));
    await assertFails(aliceDb.collection('characters').doc('alice_uid').update({ currentHomeId: 'prop_rumah_1' }));
    await assertFails(aliceDb.collection('characters').doc('alice_uid').update({ health: 100 }));
    await assertFails(aliceDb.collection('character_stats').doc('alice_uid').set({ hunger: 100 }));
    await assertFails(aliceDb.doc('characters/alice_uid/bills/rent_1').update({ status: 'paid' }));
    await assertFails(
      aliceDb.doc('characters/alice_uid/transactions/tx_fake').set({ uid: 'alice_uid', amount: 500000 })
    );
    await assertFails(
      aliceDb.doc('characters/alice_uid/inventory/kursi_santai').set({ uid: 'alice_uid', itemId: 'kursi_santai', quantity: 99 })
    );
    await assertFails(
      aliceDb.doc('characters/alice_uid/shifts/shift_fake').set({ uid: 'alice_uid', score: 100, payEarned: 900000 })
    );
    await assertFails(aliceDb.doc('characters/alice_uid/shift_secrets/shift_1').get());
    await assertFails(aliceDb.collection('config').doc('housing').set({ hacked: true }));
    await assertFails(charlieDb.collection('properties').doc('prop_rumah_1').set({ ownerId: 'charlie_uid' }));
    await assertFails(charlieDb.collection('leases').doc('lease_fake').set({ tenantId: 'charlie_uid' }));
    await assertFails(charlieDb.collection('offers').doc('offer_fake').set({ buyerId: 'charlie_uid' }));
    await assertFails(
      charlieDb.doc('property_access/prop_rumah_1/members/charlie_uid').set({ uid: 'charlie_uid', role: 'owner' })
    );
    // Phase 4 writes denied
    await assertFails(aliceDb.collection('accounts').doc('alice_uid').update({ balance: 99999999 }));
    await assertFails(aliceDb.collection('loans').doc('loan_1').update({ remaining: 0, status: 'paid' }));
    await assertFails(aliceDb.collection('ledger').doc('led_fake').set({ from: 'system', to: 'alice_uid', amount: 999999 }));
    await assertFails(aliceDb.collection('businesses').doc('biz_1').update({ cash: 99999999 }));
    await assertFails(charlieDb.collection('market_listings').doc('ml_fake').set({ sellerId: 'charlie_uid', price: 1 }));
    await assertFails(charlieDb.collection('auctions').doc('auc_1').update({ currentBidderId: 'charlie_uid', currentBid: 1 }));
    await assertFails(charlieDb.doc('state/treasury').update({ balance: 0 }));

    // Phase 6 writes denied
    await assertFails(bobDb.collection('crime_records').doc('crime_1').update({ status: 'paid' }));
    await assertFails(bobDb.collection('sentences').doc('bob_uid').update({ status: 'released', bailPaid: true }));
    await assertFails(officerDb.collection('police_actions').doc('pa_fake').set({ officerId: 'officer_uid', action: 'arrest' }));
    await assertFails(aliceDb.collection('security_installs').doc('prop_rumah_1').update({ protectionScore: 100 }));
    await assertFails(aliceDb.collection('insurance').doc('ins_1').update({ coverageAmount: 99999999 }));
    await assertFails(aliceDb.collection('insurance_claims').doc('claim_fake').set({ ownerId: 'alice_uid', payoutAmount: 999999 }));
    await assertFails(aliceDb.collection('npc_state').doc('kang_asep').update({ mood: 'kaya' }));
    await assertFails(aliceDb.collection('npc_memory').doc('kang_asep_alice_uid').update({ affinity: 100 }));
    await assertFails(aliceDb.collection('quests').doc('q_antar_1').update({ rewardMoney: 999999 }));
    await assertFails(aliceDb.doc('characters/alice_uid/quest_log/ql_1').update({ status: 'completed' }));
    await assertFails(aliceDb.collection('mortgages').doc('kpr_1').update({ remaining: 0, status: 'paid' }));
    await assertFails(aliceDb.collection('land_plots').doc('plot_1').update({ ownerId: 'alice_uid', price: 1 }));
    await assertFails(aliceDb.collection('constructions').doc('con_active').update({ phase: 'selesai' }));
    await assertFails(aliceDb.collection('renovations').doc('ren_1').update({ status: 'completed' }));
    await assertFails(aliceDb.collection('agent_clients').doc('ac_1').update({ maxBudget: 999999999 }));
    await assertFails(aliceDb.collection('dev_projects').doc('dev_1').update({ totalRevenue: 999999999 }));
    await assertFails(aliceDb.doc('ai_usage/alice_uid/days/2026-11-21').update({ count: 0 }));
    await assertFails(charlieDb.doc('state/law_recap').update({ totalCrimesLast24h: 0 }));
    await assertFails(charlieDb.collection('crime_recaps').doc('2026-11-21').update({ totalCrimesLast24h: 0 }));

    // Vehicle System client writes strictly denied
    await assertFails(aliceDb.collection('vehicles').doc('veh_private').update({ condition: 100, fuel: 99 }));
    await assertFails(aliceDb.collection('vehicles').doc('veh_hack').set({ ownerId: 'alice_uid', modelId: 'motor_sport' }));
    await assertFails(aliceDb.doc('vehicles/veh_private/service_logs/log_fake').set({ vehicleId: 'veh_private', ownerId: 'alice_uid' }));
    await assertFails(aliceDb.collection('vehicle_plates').doc('D1234CLG').get());
    await assertFails(aliceDb.collection('vehicle_plates').doc('D9999XX').set({ plateKey: 'D9999XX' }));
    await assertFails(aliceDb.collection('driver_licenses').doc('alice_uid').set({ uid: 'alice_uid' }));
    await assertFails(aliceDb.collection('vehicle_leases').doc('vlease_1').update({ remaining: 0, status: 'paid' }));
    await assertFails(bobDb.collection('vehicle_listings').doc('vlist_active').update({ price: 1 }));
    await assertFails(aliceDb.collection('vehicle_test_drives').doc('alice_uid').update({ expiresAtMs: 9999999999999 }));

    // 2. Owner, Housing & Phase 4 Read Isolation Verification
    await assertSucceeds(aliceDb.collection('characters').doc('alice_uid').get());
    await assertFails(bobDb.collection('characters').doc('alice_uid').get());
    await assertSucceeds(
      aliceDb.collection('characters/alice_uid/bills').where('uid', '==', 'alice_uid').get()
    );
    await assertSucceeds(
      aliceDb.collection('characters/alice_uid/inventory').where('uid', '==', 'alice_uid').get()
    );
    await assertFails(
      bobDb.collection('characters/alice_uid/inventory').where('uid', '==', 'alice_uid').get()
    );
    await assertSucceeds(aliceDb.collection('config').doc('housing').get());
    await assertSucceeds(aliceDb.collection('config').doc('bank').get());
    await assertSucceeds(aliceDb.collection('config').doc('law').get());
    await assertSucceeds(aliceDb.collection('config').doc('mortgage').get());
    await assertSucceeds(aliceDb.collection('config').doc('vehicles').get());
    await assertSucceeds(aliceDb.collection('config').doc('traffic').get());
    await assertSucceeds(aliceDb.collection('config').doc('dealer').get());

    // Property Interior Access: owner (Alice) & roommate (Bob) allowed; unauthorized Charlie denied!
    await assertSucceeds(aliceDb.collection('properties').doc('prop_rumah_1').get());
    await assertSucceeds(bobDb.collection('properties').doc('prop_rumah_1').get());
    await assertFails(charlieDb.collection('properties').doc('prop_rumah_1').get());
    await assertFails(charlieDb.collection('properties').get());

    // Active listing browsing allowed; participant-scoped offers/leases allowed; Charlie blocked
    await assertSucceeds(charlieDb.collection('property_listings').where('status', '==', 'active').get());
    await assertSucceeds(bobDb.collection('offers').where('buyerId', '==', 'bob_uid').get());
    await assertFails(charlieDb.collection('offers').doc('offer_1').get());
    await assertSucceeds(bobDb.collection('leases').where('tenantId', '==', 'bob_uid').get());
    await assertFails(charlieDb.collection('leases').doc('lease_1').get());

    // Phase 4 read checks: owner-only accounts/loans/daily_reports vs public active market/auctions/stats
    await assertSucceeds(aliceDb.collection('accounts').doc('alice_uid').get());
    await assertFails(bobDb.collection('accounts').doc('alice_uid').get());
    await assertSucceeds(aliceDb.collection('loans').doc('loan_1').get());
    await assertFails(bobDb.collection('loans').doc('loan_1').get());
    await assertSucceeds(aliceDb.doc('businesses/biz_1/daily_reports/day_1').get());
    await assertFails(bobDb.doc('businesses/biz_1/daily_reports/day_1').get());
    await assertSucceeds(charlieDb.collection('market_listings').where('status', '==', 'active').get());
    await assertSucceeds(charlieDb.collection('auctions').where('status', '==', 'active').get());
    await assertSucceeds(charlieDb.collection('market_stats').doc('beras_5kg').get());
    await assertSucceeds(charlieDb.doc('state/treasury').get());

    // Phase 6 read checks: law, police, security, insurance, NPC memory, quests, KPR, land, construction, AI privacy
    await assertSucceeds(bobDb.collection('crime_records').where('characterId', '==', 'bob_uid').get());
    await assertSucceeds(officerDb.collection('crime_records').get());
    await assertFails(charlieDb.collection('crime_records').doc('crime_1').get());
    await assertSucceeds(bobDb.collection('sentences').doc('bob_uid').get());
    await assertSucceeds(officerDb.collection('sentences').where('status', '==', 'serving').get());
    await assertFails(charlieDb.collection('sentences').doc('bob_uid').get());
    await assertSucceeds(bobDb.collection('police_actions').where('targetId', '==', 'bob_uid').get());
    await assertSucceeds(officerDb.collection('police_actions').get());
    await assertFails(charlieDb.collection('police_actions').doc('pa_1').get());

    await assertSucceeds(aliceDb.collection('security_installs').where('ownerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('security_installs').doc('prop_rumah_1').get());
    await assertSucceeds(aliceDb.collection('insurance').where('ownerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('insurance').doc('ins_1').get());
    await assertSucceeds(aliceDb.collection('insurance_claims').where('ownerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('insurance_claims').doc('claim_1').get());

    await assertSucceeds(charlieDb.collection('npc_state').doc('kang_asep').get());
    await assertSucceeds(aliceDb.collection('npc_memory').doc('kang_asep_alice_uid').get());
    await assertFails(bobDb.collection('npc_memory').doc('kang_asep_alice_uid').get());
    await assertSucceeds(charlieDb.collection('quests').where('active', '==', true).get());
    await assertSucceeds(aliceDb.collection('characters/alice_uid/quest_log').where('uid', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('characters/alice_uid/quest_log').where('uid', '==', 'alice_uid').get());

    await assertSucceeds(aliceDb.collection('mortgages').where('borrowerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('mortgages').doc('kpr_1').get());
    await assertSucceeds(charlieDb.collection('land_plots').doc('plot_1').get());
    await assertSucceeds(charlieDb.collection('constructions').where('status', '==', 'active').get());
    await assertSucceeds(aliceDb.collection('constructions').where('ownerId', '==', 'alice_uid').get());
    await assertFails(charlieDb.collection('constructions').doc('con_done').get());
    await assertSucceeds(aliceDb.collection('renovations').where('ownerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('renovations').doc('ren_1').get());
    await assertSucceeds(aliceDb.collection('agent_clients').where('agentId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('agent_clients').doc('ac_1').get());
    await assertSucceeds(aliceDb.collection('dev_projects').where('developerId', '==', 'alice_uid').get());
    await assertFails(bobDb.collection('dev_projects').doc('dev_1').get());

    await assertSucceeds(aliceDb.doc('ai_usage/alice_uid/days/2026-11-21').get());
    await assertFails(bobDb.doc('ai_usage/alice_uid/days/2026-11-21').get());
    await assertFails(aliceDb.collection('ai_faq_cache').doc('faq_1').get());
    await assertFails(aliceDb.collection('ai_moderation_reports').doc('mod_1').get());
    await assertSucceeds(charlieDb.doc('state/law_recap').get());
    await assertSucceeds(charlieDb.collection('crime_recaps').doc('2026-11-21').get());
    await assertFails(charlieDb.collection('crime_recaps').get());

    // Vehicle System read checks
    await assertSucceeds(aliceDb.collection('vehicles').doc('veh_private').get());
    await assertFails(charlieDb.collection('vehicles').doc('veh_private').get());
    await assertSucceeds(charlieDb.collection('vehicles').doc('veh_public').get());
    await assertSucceeds(officerDb.collection('vehicles').doc('veh_private').get());
    await assertSucceeds(aliceDb.doc('vehicles/veh_private/service_logs/log_1').get());
    await assertFails(bobDb.doc('vehicles/veh_private/service_logs/log_1').get());
    await assertSucceeds(aliceDb.collection('driver_licenses').doc('alice_uid').get());
    await assertSucceeds(officerDb.collection('driver_licenses').doc('alice_uid').get());
    await assertFails(bobDb.collection('driver_licenses').doc('alice_uid').get());
    await assertFails(officerDb.collection('driver_licenses').get());
    await assertSucceeds(aliceDb.collection('vehicle_leases').doc('vlease_1').get());
    await assertFails(bobDb.collection('vehicle_leases').doc('vlease_1').get());
    await assertSucceeds(charlieDb.collection('vehicle_listings').where('status', '==', 'active').get());
    await assertFails(charlieDb.collection('vehicle_listings').doc('vlist_cancelled').get());
    await assertSucceeds(aliceDb.collection('vehicle_test_drives').doc('alice_uid').get());
    await assertFails(bobDb.collection('vehicle_test_drives').doc('alice_uid').get());

    // 3. RTDB Presence inTrain, inHomeId, inBusinessId, isHomeless & Vehicle Telemetry Speed Validation
    const aliceRtdb = alice.database();
    const bobRtdb = bob.database();
    await assertSucceeds(
      aliceRtdb.ref('presence/alice_uid').set({
        online: true,
        lastSeen: Date.now(),
        inTrain: false,
        currentZone: 'cicalengka',
        inHomeId: 'prop_rumah_1',
        inBusinessId: 'biz_1',
        isHomeless: false,
        drivingVehicleId: 'veh_private',
      })
    );
    await assertFails(aliceRtdb.ref('localChat/msg1').set({ senderUid: 'alice_uid', message: 'bypass' }));

    // Seed /vehicles/veh_private as server Admin SDK would during mountVehicle
    const t0 = Date.now() - 500;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.database().ref('vehicles/veh_private').set({
        vehicleId: 'veh_private',
        ownerId: 'alice_uid',
        driverId: 'alice_uid',
        modelId: 'motor_bebek',
        category: 'motor',
        color: '#B91C1C',
        plateNumber: 'D 1234 CLG',
        zone: 'cicalengka',
        x: 10,
        y: 0.5,
        z: -20,
        rotY: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        steerAngle: 0,
        headlights: false,
        hornAtMs: 0,
        maxSpeed: 15,
        seatCapacity: 2,
        updatedAt: t0,
      });
    });

    // Valid telemetry within motor_bebek maxSpeed (15 m/s) over ~500ms (~7.5m step)
    await assertSucceeds(
      aliceRtdb.ref('vehicles/veh_private').update({
        x: 15,
        z: -18,
        vx: 10,
        vz: 4,
        speed: 10.8,
        steerAngle: 0.2,
        headlights: true,
        updatedAt: Date.now(),
      })
    );
    // Reject speed exceeding model maxSpeed (15 + 1.5 = 16.5 m/s)
    await assertFails(
      aliceRtdb.ref('vehicles/veh_private').update({
        speed: 28,
        vx: 28,
        updatedAt: Date.now() + 100,
      })
    );
    // Reject tampering server-pinned maxSpeed or driverId
    await assertFails(
      aliceRtdb.ref('vehicles/veh_private').update({
        maxSpeed: 30,
        updatedAt: Date.now() + 100,
      })
    );
    // Reject teleporting across map (> 32m)
    await assertFails(
      aliceRtdb.ref('vehicles/veh_private').update({
        x: -70,
        z: 70,
        updatedAt: Date.now() + 200,
      })
    );
    // Reject non-driver trying to move someone else's vehicle
    await assertFails(
      bobRtdb.ref('vehicles/veh_private').update({
        x: 16,
        updatedAt: Date.now() + 100,
      })
    );
    // Reject unprovisioned client-created RTDB vehicle node
    await assertFails(
      aliceRtdb.ref('vehicles/veh_forged').set({
        vehicleId: 'veh_forged',
        ownerId: 'alice_uid',
        driverId: 'alice_uid',
        modelId: 'motor_sport',
        category: 'motor',
        color: '#DC2626',
        plateNumber: 'D 9999 XX',
        zone: 'cicalengka',
        x: 0,
        y: 0.5,
        z: 0,
        rotY: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        steerAngle: 0,
        headlights: false,
        hornAtMs: 0,
        maxSpeed: 24,
        seatCapacity: 2,
        updatedAt: Date.now(),
      })
    );

    assert.ok(true);
    console.log('Semua pengujian Security Rules Fase 1–6 + Sistem Kendaraan LULUS!');
  } finally {
    await testEnv.cleanup();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
