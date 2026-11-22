# Security Specification — Cicalengka Life 3D (Fase 1–6)

## 1. Data Invariants
1. **Strict Server-Authoritative Economy, Survival, Jobs, Bills, Law, NPC & Advanced Property**: Clients MUST NEVER write directly to `characters`, `character_names`, `character_stats`, `items`, `shop_menu`, `chat_logs`, `config/*`, `properties`, `property_listings`, `offers`, `leases`, `property_access`, `property_viewings`, `accounts`, `loans`, `ledger`, `businesses`, `business_job_posts`, `market_listings`, `auctions`, `market_stats`, `suppliers`, `state/*`, `crime_recaps`, `crime_records`, `sentences`, `police_actions`, `security_installs`, `insurance`, `insurance_claims`, `npc_state`, `npc_memory`, `quests`, `mortgages`, `land_plots`, `constructions`, `renovations`, `agent_clients`, `dev_projects`, `ai_usage`, `ai_faq_cache`, `ai_moderation_reports`, or any `characters/{uid}/*` subcollection (`transactions`, `bills`, `employments`, `shifts`, `shift_secrets`, `tickets`, `clinic_visits`, `course_enrollments`, `inventory`, `quest_log`). All mutations run inside Cloud Functions (`firebase-admin`) using Firestore Transactions.
2. **Zero-Leak Mini-Game & Server-Only Caches**: `characters/{uid}/shift_secrets/{shiftId}`, `ai_faq_cache/{cacheKey}`, and `ai_moderation_reports/{reportId}` have `allow read, write: if false;`.
3. **Owner-Only Profile, Inventory, Quest Log & Financial Isolation**: `users/{uid}`, `characters/{uid}`, `character_stats/{uid}`, `accounts/{uid}`, `loans/{loanId}`, `mortgages/{id}`, `renovations/{id}`, `security_installs/{propertyId}`, `insurance/{id}`, `insurance_claims/{claimId}`, `agent_clients/{clientId}`, `dev_projects/{projectId}`, `npc_memory/{memoryId}`, `ai_usage/{uid}/days/{date}`, and all `characters/{uid}/*` subcollections enforce owner-only reads (`request.auth.uid == uid` / `resource.data.ownerId == request.auth.uid`), with `allow list` validating `resource.data`.
4. **Property Interior Access Gate (Zero Unauthorized Entry)**: Reading `/properties/{propertyId}` is permitted ONLY when `existing().ownerId == request.auth.uid` OR `exists(/databases/$(database)/documents/property_access/$(propertyId)/members/$(request.auth.uid))`.
5. **Law & Police Role Isolation**: `crime_records`, `sentences`, and `police_actions` allow reads ONLY for the involved citizen (`characterId == uid`, `uid`, `officerId`/`targetId`), verified active police (`characters/{uid}.currentJob.jobId == 'polisi'`), or `isAdmin()`.
6. **Public Active Construction & Land Viewing**: `land_plots` & active `constructions` (`status == 'active'`) are readable by signed-in players for 3D rendering, while inactive constructions remain owner-only.
7. **Strict Path ID & RTDB Anti-Teleport**: Every document ID path variable enforces `isValidId()` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). RTDB `/players/{uid}` and `/presence/{uid}` restrict writes to `auth.uid === $uid` with coordinate bounds and step-delta limits.

## 2. The "Dirty Dozen+" Payloads (Expected: PERMISSION_DENIED)
1. Client updates `characters/{uid}` setting `{ money: 999999999 }`, `{ wantedLevel: 0 }`, `{ sentence: null }`, or `{ currentHomeId: "prop_rumah_1" }`.
2. Client writes `character_stats/{uid}` or `characters/{uid}/bills/{billId}` to fake survival or evade rent/KPR/tax bills.
3. Client reads `characters/{uid}/shift_secrets/{shiftId}`, `ai_faq_cache/{key}`, or `ai_moderation_reports/{id}`.
4. Client writes `config/law`, `config/npcs`, `config/mortgage`, or `config/housing` directly.
5. Client reads or scrapes `/properties/{propertyId}` without ownership or `property_access` membership.
6. Client writes `crime_records/{id}` to erase criminal history or frame another player.
7. Client writes `sentences/{uid}` setting `{ status: "released", bailPaid: true }` to escape jail.
8. Non-police User C reads User A's `crime_records` or `sentences` or `police_actions`.
9. Client writes `mortgages/{id}`, `land_plots/{plotId}`, `constructions/{id}`, or `renovations/{id}` directly to skip KPR payments, IMB permits, or construction costs.
10. Client writes `security_installs/{id}`, `insurance/{id}`, or `insurance_claims/{id}` to forge security or insurance payouts.
11. User B reads User A's `npc_memory/{id}`, `characters/{userA}/quest_log`, `mortgages/{id}`, `agent_clients/{id}`, `dev_projects/{id}`, or `ai_usage/{userA}/days/{date}`.
12. Client writes `npc_state/{npcId}`, `quests/{questId}`, `state/treasury`, or `state/law_recap` directly.
