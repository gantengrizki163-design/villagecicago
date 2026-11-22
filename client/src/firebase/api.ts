import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type {
  AreaTag,
  AuctionDoc,
  AuctionSubjectType,
  BankAccountDoc,
  BusinessType,
  FurniturePlacement,
  Gender,
  LedgerEntryDoc,
  ListingKind,
  LoanDoc,
  MarketListingDoc,
  PropertyDoc,
  PropertyListingDoc,
  PropertyType,
  VehicleDoc,
  VehicleLeaseDoc,
  VehicleListingDoc,
  VehicleParkedType,
  WorldPosition,
  ZoneId,
} from '../types/game';
import { auth, db, functions, handleFirestoreError, OperationType } from './config';
import { localSimulation } from './localSimulation';

export class CloudFunctionsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudFunctionsUnavailableError';
  }
}

const FORCE_FUNCTIONS =
  import.meta.env.VITE_USE_EMULATOR === 'true' ||
  import.meta.env.VITE_USE_CLOUD_FUNCTIONS === 'true';

let functionsUnreachable = false;

function isUnavailableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  const msg = String((err as { message?: string })?.message || '').toLowerCase();
  return (
    code.includes('internal') ||
    code.includes('unavailable') ||
    code.includes('not-found') ||
    code.includes('unknown') ||
    code.includes('deadline-exceeded') ||
    msg.includes('internal') ||
    msg.includes('[0]') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('cors') ||
    msg.includes('err_failed')
  );
}

async function callServer<Req, Res>(
  callable: ReturnType<typeof httpsCallable<Req, Res>>,
  payload: Req,
  localFallback: () => Res | Promise<Res>
): Promise<Res> {
  if (localSimulation.isActive() && !FORCE_FUNCTIONS) {
    return localFallback();
  }
  if (functionsUnreachable && !FORCE_FUNCTIONS) {
    localSimulation.activateFromContextIfNeeded();
    return localFallback();
  }

  try {
    const res = await callable(payload);
    return res.data;
  } catch (err) {
    if (isUnavailableError(err) && !FORCE_FUNCTIONS) {
      functionsUnreachable = true;
      localSimulation.activateFromContextIfNeeded();
      return localFallback();
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const provider =
    user.providerData.some((p) => p.providerId === 'google.com') ? 'google.com' : 'password';

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const cleanEmail = user.email?.trim().slice(0, 254);
  const cleanDisplayName = user.displayName?.trim().slice(0, 64);

  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        uid: user.uid,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
        provider,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    return;
  }

  try {
    await updateDoc(ref, {
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...(cleanDisplayName ? { displayName: cleanDisplayName } : {}),
      provider,
      lastLoginAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export interface CreateCharacterPayload {
  name: string;
  gender: Gender;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
}

const fnCreateCharacter = httpsCallable<CreateCharacterPayload, { ok: boolean }>(functions, 'createCharacter');
const fnBuyFood = httpsCallable<{ itemId: string }, { ok: boolean; money: number; itemName: string }>(functions, 'buyFood');
const fnRest = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'rest');
const fnSavePosition = httpsCallable<WorldPosition, { ok: boolean }>(functions, 'savePosition');
const fnSendChat = httpsCallable<{ channel: 'global' | 'local'; message: string }, { ok: boolean; cleanMessage?: string }>(functions, 'sendChat');

// Fase 2 Cloud Functions
const fnTakeBath = httpsCallable<Record<string, never>, { ok: boolean; hygiene?: number; mood?: number }>(functions, 'takeBath');
const fnVisitClinic = httpsCallable<{ clinicId: string; packageId: string }, { ok: boolean }>(functions, 'visitClinic');
const fnClaimClinic = httpsCallable<Record<string, never>, { ok: boolean; health?: number; mood?: number }>(functions, 'claimClinic');
const fnApplyJob = httpsCallable<{ jobId: string }, { ok: boolean }>(functions, 'applyJob');
const fnResignJob = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'resignJob');
const fnStartShift = httpsCallable<Record<string, never>, { ok: boolean; fired?: boolean }>(functions, 'startShift');
const fnEndShift = httpsCallable<
  Record<string, unknown>,
  {
    ok: boolean;
    payEarned?: number;
    score?: number;
    rankTitle?: string;
    vehicleBonusRate?: number;
    vehicleBonusPay?: number;
  }
>(functions, 'endShift');
const fnEnrollCourse = httpsCallable<{ courseId: string }, { ok: boolean }>(functions, 'enrollCourse');
const fnClaimCourse = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'claimCourse');
const fnGetBills = httpsCallable<Record<string, never>, { ok: boolean; bills: unknown[] }>(functions, 'getBills');
const fnPayBill = httpsCallable<{ billId: string }, { ok: boolean; title?: string; totalDue?: number }>(functions, 'payBill');
const fnBuyTicket = httpsCallable<{ destination: ZoneId }, { ok: boolean }>(functions, 'buyTicket');
const fnCompleteTrip = httpsCallable<Record<string, never>, { ok: boolean; currentZone?: ZoneId }>(functions, 'completeTrip');
const fnSyncPlayerState = httpsCallable<Record<string, never>, { ok: boolean; fainted?: boolean; fired?: boolean; evicted?: boolean }>(functions, 'syncPlayerState');

// Fase 3 Cloud Functions
const fnCreateListing = httpsCallable<
  { propertyId: string; kind: ListingKind; price: number; deposit?: number },
  { ok: boolean; listingId: string; price: number; deposit: number; kind: ListingKind }
>(functions, 'createListing');
const fnCancelListing = httpsCallable<{ listingId: string }, { ok: boolean; listingId: string }>(functions, 'cancelListing');
const fnRequestViewing = httpsCallable<
  { propertyId: string },
  { ok: boolean; property: PropertyDoc; role: string; viewingOnly: boolean }
>(functions, 'requestViewing');
const fnEnterProperty = httpsCallable<
  { propertyId: string },
  { ok: boolean; property: PropertyDoc; role: string }
>(functions, 'enterProperty');
const fnLeaveProperty = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'leaveProperty');
const fnRepairProperty = httpsCallable<
  { propertyId: string },
  { ok: boolean; money: number; condition: number; cost: number }
>(functions, 'repairProperty');
const fnGrantGuestAccess = httpsCallable<
  { propertyId: string; targetName: string; durationHours?: number },
  { ok: boolean; targetUid: string; guestName: string; hours: number }
>(functions, 'grantGuestAccess');
const fnSetViewingSchedule = httpsCallable<
  { propertyId: string; open24h: boolean; startHour: number; endHour: number },
  { ok: boolean }
>(functions, 'setViewingSchedule');
const fnMakeOffer = httpsCallable<
  { listingId: string; amount: number; note?: string },
  { ok: boolean; offerId: string; status: string; amount: number; counterAmount?: number | null; note?: string; expiresAtMs: number }
>(functions, 'makeOffer');
const fnRespondOffer = httpsCallable<
  { offerId: string; action: 'accept' | 'reject' | 'counter' | 'accept_counter'; counterAmount?: number },
  { ok: boolean; offerId: string; status: string }
>(functions, 'respondOffer');
const fnCreateLease = httpsCallable<
  { propertyId: string; period: 'weekly' | 'monthly'; offerId?: string; useStarterDiscount?: boolean },
  { ok: boolean; leaseId: string; propertyId: string; money: number; totalUpfront: number; rent: number; deposit: number }
>(functions, 'createLease');
const fnTerminateLease = httpsCallable<
  { leaseId: string },
  { ok: boolean; refund: number; damageDeduction: number }
>(functions, 'terminateLease');
const fnInviteRoommate = httpsCallable<
  { leaseId: string; targetName: string; sharePercent: number },
  { ok: boolean; targetUid: string; targetName: string; sharePercent: number }
>(functions, 'inviteRoommate');
const fnAcceptRoommate = httpsCallable<
  { leaseId: string },
  { ok: boolean; propertyId: string; leaseId: string; sharePercent: number }
>(functions, 'acceptRoommate');
const fnLeaveRoommate = httpsCallable<{ leaseId: string }, { ok: boolean; leaseId: string }>(functions, 'leaveRoommate');
const fnBuyProperty = httpsCallable<
  { propertyId: string; offerId?: string },
  { ok: boolean; propertyId: string; certificateId: string; money: number; totalCost: number; transferTax: number }
>(functions, 'buyProperty');
const fnSleepAtHome = httpsCallable<
  { action: 'start' | 'wake'; locationType?: 'home' | 'emperan' | 'shelter'; propertyId?: string; spotId?: string },
  { ok: boolean; activeSleep?: unknown; fainted?: boolean; money?: number; stats?: unknown }
>(functions, 'sleepAtHome');
const fnBatheAtHome = httpsCallable<{ propertyId?: string }, { ok: boolean; hygiene: number; mood: number }>(functions, 'batheAtHome');
const fnEatFromInventory = httpsCallable<{ itemId: string; propertyId?: string }, { ok: boolean; stats: unknown }>(functions, 'eatFromInventory');
const fnSetHomePreferences = httpsCallable<{ respawnAtHome: boolean }, { ok: boolean; respawnAtHome: boolean }>(functions, 'setHomePreferences');
const fnBuyFurniture = httpsCallable<
  { furnitureId: string; quantity?: number },
  { ok: boolean; money: number; furnitureId: string; newQuantity: number; totalCost: number }
>(functions, 'buyFurniture');
const fnPlaceFurniture = httpsCallable<
  { propertyId: string; placements: FurniturePlacement[] },
  { ok: boolean; furniture: FurniturePlacement[] }
>(functions, 'placeFurniture');

// Fase 4 Cloud Functions: Bank
const fnOpenAccount = httpsCallable<
  { initialDeposit?: number },
  { ok: boolean; accountNumber: string; balance: number; money: number; creditScore: number }
>(functions, 'openAccount');
const fnDeposit = httpsCallable<
  { amount: number; target?: 'balance' | 'savings' },
  { ok: boolean; money: number; balance: number; savings: number; interestCredited: number }
>(functions, 'deposit');
const fnWithdraw = httpsCallable<
  { amount: number; source?: 'balance' | 'savings' },
  { ok: boolean; money: number; balance: number; savings: number; interestCredited: number }
>(functions, 'withdraw');
const fnTransfer = httpsCallable<
  { targetName: string; amount: number; note?: string },
  { ok: boolean; balance: number; amount: number; adminFee: number; targetName: string }
>(functions, 'transfer');
const fnApplyLoan = httpsCallable<
  { amount: number },
  {
    ok: boolean;
    loanId: string;
    principal: number;
    totalRepayable: number;
    installment: number;
    termCycles: number;
    nextDueAtMs: number;
    balance: number;
  }
>(functions, 'applyLoan');
const fnRepayLoan = httpsCallable<
  { loanId: string; payFull?: boolean; source?: 'bank' | 'wallet' },
  { ok: boolean; paid: number; remaining: number; status: string; creditScore: number }
>(functions, 'repayLoan');
const fnGetAccountSummary = httpsCallable<
  Record<string, never>,
  {
    ok: boolean;
    hasAccount: boolean;
    account: (BankAccountDoc & { interestJustCredited?: number }) | null;
    creditScore: number;
    eligibleLoanTier: {
      minScore: number;
      maxScore: number;
      maxPrincipal: number;
      flatInterestRate: number;
      termCycles: number;
    } | null;
    loans: LoanDoc[];
    recentLedger: LedgerEntryDoc[];
  }
>(functions, 'getAccountSummary');

// Fase 4 Cloud Functions: Bisnis
const fnCreateBusiness = httpsCallable<
  { type: BusinessType; name: string; propertyId: string; capital: number },
  { ok: boolean; business?: unknown; money?: number }
>(functions, 'createBusiness');
const fnSetBusinessSettings = httpsCallable<
  { businessId: string; name?: string; isOpen?: boolean; openHour?: number; closeHour?: number },
  { ok: boolean }
>(functions, 'setBusinessSettings');
const fnWithdrawBusinessProfit = httpsCallable<
  { businessId: string; amount: number },
  { ok: boolean; withdrawn: number; tax: number; netReceived: number; money: number }
>(functions, 'withdrawBusinessProfit');
const fnCloseBusiness = httpsCallable<{ businessId: string }, { ok: boolean; refund?: number; money?: number }>(
  functions,
  'closeBusiness'
);
const fnSellBusiness = httpsCallable<{ businessId: string }, { ok: boolean; refund?: number; money?: number }>(
  functions,
  'sellBusiness'
);
const fnBuyStock = httpsCallable<
  { businessId: string; itemId: string; qty: number; payFrom?: 'business' | 'wallet' },
  { ok: boolean; itemId: string; qty: number; totalCost: number }
>(functions, 'buyStock');
const fnProduceItem = httpsCallable<
  { businessId: string; recipeId: string; batchCount?: number },
  { ok: boolean; producedQty: number; itemName: string }
>(functions, 'produceItem');
const fnSetPrice = httpsCallable<
  { businessId: string; itemId: string; sellPrice: number },
  { ok: boolean; sellPrice: number }
>(functions, 'setPrice');
const fnDiscardStock = httpsCallable<{ businessId: string; itemId: string }, { ok: boolean }>(
  functions,
  'discardStock'
);
const fnBuyFromBusiness = httpsCallable<
  { businessId: string; itemId: string; qty?: number; consumeNow?: boolean },
  { ok: boolean; money?: number; total?: number }
>(functions, 'buyFromBusiness');
const fnRunPromotion = httpsCallable<{ businessId: string; tierId: string }, { ok: boolean }>(
  functions,
  'runPromotion'
);
const fnSettleNpcSales = httpsCallable<
  { businessId: string },
  { ok: boolean; salesCount?: number; revenue?: number }
>(functions, 'settleNpcSales');
const fnPostBusinessJob = httpsCallable<
  { businessId: string; roleTitle?: string; wagePerShift?: number; slotsOpen?: number; closePostId?: string },
  { ok: boolean; postId?: string }
>(functions, 'postBusinessJob');
const fnHireEmployee = httpsCallable<
  {
    businessId?: string;
    mode?: 'npc' | 'player';
    targetName?: string;
    roleTitle?: string;
    wagePerShift?: number;
    postId?: string;
  },
  { ok: boolean; empId?: string; name?: string }
>(functions, 'hireEmployee');
const fnFireEmployee = httpsCallable<{ businessId: string; empId: string }, { ok: boolean }>(
  functions,
  'fireEmployee'
);
const fnPayWages = httpsCallable<{ businessId: string }, { ok: boolean; totalPaid?: number }>(
  functions,
  'payWages'
);

// Fase 4 Cloud Functions: Marketplace P2P, Lelang & Ekonomi Makro
const fnCreateMarketListing = httpsCallable<
  { itemId: string; qty: number; unitPrice: number; areaTag?: string },
  { ok: boolean; listingId: string }
>(functions, 'createMarketListing');
const fnBuyMarketListing = httpsCallable<
  { listingId: string; buyQty?: number },
  { ok: boolean; money: number; buyQty: number; gross: number }
>(functions, 'buyMarketListing');
const fnCancelMarketListing = httpsCallable<{ listingId: string }, { ok: boolean }>(
  functions,
  'cancelMarketListing'
);
const fnCreateAuction = httpsCallable<
  {
    subjectType: AuctionSubjectType;
    subjectId: string;
    qty?: number;
    startPrice: number;
    minIncrement?: number;
    durationMinutes?: number;
  },
  { ok: boolean; auctionId: string }
>(functions, 'createAuction');
const fnPlaceBid = httpsCallable<
  { auctionId: string; amount: number; payFrom?: 'wallet' | 'bank' },
  { ok: boolean; currentBid: number; antiSnipeExtended?: boolean }
>(functions, 'placeBid');
const fnSettleAuction = httpsCallable<
  { auctionId: string; cancel?: boolean },
  { ok: boolean; status: string }
>(functions, 'settleAuction');
const fnUpdateMarketStats = httpsCallable<Record<string, never>, Record<string, unknown>>(
  functions,
  'updateMarketStats'
);
const fnTriggerEconomicEvent = httpsCallable<{ eventId: string }, Record<string, unknown>>(
  functions,
  'triggerEconomicEvent'
);

// Fase 6 Cloud Functions: Hukum, Kriminalitas, Polisi & Penjara
const fnAttemptCrime = httpsCallable<
  { offenseId: string; targetType?: string; targetId?: string; x?: number; z?: number },
  {
    ok: boolean;
    caught: boolean;
    reward: number;
    money: number;
    wantedLevel: number;
    recordId: string;
    catchChance: number;
    witnesses: string[];
    cctvTriggered: boolean;
    isNight: boolean;
    offenseTitle: string;
    severity: number;
  }
>(functions, 'attemptCrime');
const fnReportCrime = httpsCallable<
  { targetUid?: string; recordId?: string; note?: string },
  { ok: boolean; message?: string }
>(functions, 'reportCrime');
const fnPayFine = httpsCallable<
  { recordId: string; paymentSource?: 'wallet' | 'bank' },
  { ok: boolean; fine: number; money: number }
>(functions, 'payFine');
const fnArrestPlayer = httpsCallable<{ targetUid: string }, { ok: boolean; reward?: number }>(
  functions,
  'arrestPlayer'
);
const fnIssueFine = httpsCallable<
  { targetUid: string; recordId?: string },
  { ok: boolean; fineAmount?: number }
>(functions, 'issueFine');
const fnReleasePlayer = httpsCallable<
  { targetUid: string; reason?: string },
  { ok: boolean }
>(functions, 'releasePlayer');
const fnReviewPoliceAction = httpsCallable<{ actionId: string }, { ok: boolean; status?: string }>(
  functions,
  'reviewPoliceAction'
);
const fnServeSentence = httpsCallable<
  { action: 'check' | 'work' },
  { ok: boolean; released?: boolean; remainingSec?: number; money?: number }
>(functions, 'serveSentence');
const fnPayBail = httpsCallable<
  { targetUid?: string; targetName?: string; paymentSource?: 'wallet' | 'bank' },
  { ok: boolean; bailAmount: number; payerMoney: number; releasedName: string }
>(functions, 'payBail');
const fnFileAppeal = httpsCallable<
  Record<string, never>,
  { ok: boolean; accepted: boolean; cutSec: number; remainingSec: number; money: number }
>(functions, 'fileAppeal');
const fnGetCriminalRecord = httpsCallable<
  { targetUid?: string },
  { ok: boolean; targetUid: string; wantedLevel: number; sentence: unknown; records: unknown[] }
>(functions, 'getCriminalRecord');

// Fase 6 Cloud Functions: Keamanan Properti & Asuransi
const fnInstallSecurity = httpsCallable<
  { propertyId: string; moduleId: 'lock' | 'alarm' | 'cctv' },
  { ok: boolean; protectionScore: number; monthlyCost: number; money: number }
>(functions, 'installSecurity');
const fnHireGuard = httpsCallable<
  { propertyId: string; guardName?: string; action: 'hire' | 'dismiss' },
  { ok: boolean; protectionScore: number; monthlyCost: number; money: number }
>(functions, 'hireGuard');
const fnBuyInsurance = httpsCallable<
  { subjectType: 'property' | 'business'; subjectId: string; planId: 'basic' | 'premium' },
  { ok: boolean; insuranceId: string; money: number }
>(functions, 'buyInsurance');
const fnFileClaim = httpsCallable<
  { insuranceId: string; crimeRecordId: string },
  { ok: boolean; payoutAmount: number; money: number }
>(functions, 'fileClaim');

// Fase 6 Cloud Functions: Dialog AI & Aksi NPC Terstruktur
export interface NpcOptionItem {
  actionId: string;
  label: string;
  category: 'social' | 'quest' | 'trade' | 'service' | 'moderation';
  uiHint?: string;
  questId?: string;
  itemId?: string;
  price?: number;
}
const fnTalkToNpc = httpsCallable<
  { npcId: string; message: string },
  {
    ok: boolean;
    blocked?: boolean;
    npcId: string;
    npcName: string;
    npcRole?: string;
    activity?: string;
    zoneTag?: string;
    reply: string;
    source: 'faq_cache' | 'gemini' | 'scripted_fallback' | 'moderation';
    affinity: number;
    remainingCalls: number;
    remainingTokens?: number;
  }
>(functions, 'talkToNpc');
const fnGetNpcOptions = httpsCallable<
  { npcId: string },
  {
    ok: boolean;
    npcId: string;
    name: string;
    role: string;
    personality: string;
    activity: string;
    zoneTag: string;
    isSleeping: boolean;
    affinity: number;
    summary: string;
    mood: string;
    options: NpcOptionItem[];
  }
>(functions, 'getNpcOptions');
const fnExecuteNpcAction = httpsCallable<
  { npcId: string; actionId: string; itemId?: string; reason?: string },
  {
    ok: boolean;
    actionId: string;
    uiHint?: string;
    message?: string;
    affinity?: number;
    itemId?: string;
    itemName?: string;
    pricePaid?: number;
    money?: number;
  }
>(functions, 'executeNpcAction');

// Fase 6 Cloud Functions: Quest
const fnAcceptQuest = httpsCallable<
  { questId: string },
  { ok: boolean; logId: string; questId: string; title: string }
>(functions, 'acceptQuest');
const fnCompleteQuest = httpsCallable<
  { logId?: string; questId?: string },
  { ok: boolean; rewardMoney: number; rewardRep: number; money: number }
>(functions, 'completeQuest');
const fnAbandonQuest = httpsCallable<
  { logId?: string; questId?: string },
  { ok: boolean }
>(functions, 'abandonQuest');

// Fase 6 Cloud Functions: KPR, Tanah & Konstruksi, Agen, Developer, Renovasi & Paket Mebel
const fnApplyMortgage = httpsCallable<
  {
    propertyId: string;
    offerId?: string;
    downPaymentRate: number;
    termCycles: number;
    payFrom: 'wallet' | 'bank';
  },
  { ok: boolean; mortgageId: string; installment: number }
>(functions, 'applyMortgage');
const fnPayMortgage = httpsCallable<
  { mortgageId: string; payFrom: 'wallet' | 'bank'; cycles?: number },
  { ok: boolean; paid: number; remaining: number; status: string }
>(functions, 'payMortgage');
const fnEarlyRepay = httpsCallable<
  { mortgageId: string; payFrom: 'wallet' | 'bank' },
  { ok: boolean; totalPaid: number }
>(functions, 'earlyRepay');
const fnForeclose = httpsCallable<{ mortgageId: string }, { ok: boolean }>(functions, 'foreclose');

const fnBuyLand = httpsCallable<
  { plotId: string; payFrom: 'wallet' | 'bank'; devProjectId?: string },
  { ok: boolean; plotId: string; totalCost: number }
>(functions, 'buyLand');
const fnApplyPermit = httpsCallable<
  { plotId: string; payFrom: 'wallet' | 'bank' },
  { ok: boolean; permitStatus: string; permitReadyAtMs?: number; plotId?: string }
>(functions, 'applyPermit');
const fnStartConstruction = httpsCallable<
  {
    plotId: string;
    blueprintId: 'kecil' | 'sedang' | 'besar';
    contractorType: 'npc' | 'player';
    payFrom: 'wallet' | 'bank';
    devProjectId?: string;
  },
  { ok: boolean; constructionId: string; phase: string; phaseEndsAtMs: number; laborCost: number }
>(functions, 'startConstruction');
const fnAdvanceConstruction = httpsCallable<
  { constructionId: string },
  { ok: boolean; constructionId: string; phase: string; phaseEndsAtMs: number; status: string; advanced: boolean; remainingSec: number }
>(functions, 'advanceConstruction');
const fnCompleteConstruction = httpsCallable<
  { constructionId: string; propertyName?: string },
  { ok: boolean; constructionId: string; propertyId: string; propertyName: string; certificateId: string }
>(functions, 'completeConstruction');

const fnBecomeAgent = httpsCallable<
  { payFrom: 'wallet' | 'bank' },
  { ok: boolean; isPropertyAgent: boolean; fee: number }
>(functions, 'becomeAgent');
const fnCreateClientRequest = httpsCallable<
  { desiredArea: AreaTag | 'any'; desiredType: PropertyType | 'any'; desiredKind: 'sale' | 'rent' },
  { ok: boolean; clientId: string; clientName: string }
>(functions, 'createClientRequest');
const fnCloseDeal = httpsCallable<
  { clientId: string; listingId: string },
  { ok: boolean; commissionEarned: number; money: number }
>(functions, 'closeDeal');
const fnCreateDevelopmentProject = httpsCallable<
  { name: string; plotIds?: string[] },
  { ok: boolean; projectId: string }
>(functions, 'createDevelopmentProject');
const fnStartRenovation = httpsCallable<
  { propertyId: string; renovationType: 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage'; payFrom: 'wallet' | 'bank' },
  { ok: boolean; renovationId: string; completesAtMs: number }
>(functions, 'startRenovation');
const fnCompleteRenovation = httpsCallable<
  { renovationId: string },
  { ok: boolean; propertyId: string; valueBoost: number }
>(functions, 'completeRenovation');
const fnBuyFurnitureSet = httpsCallable<
  { setId: string; payFrom: 'wallet' | 'bank' },
  { ok: boolean; setName: string; bundlePrice: number; money: number }
>(functions, 'buyFurnitureSet');

// Sistem Kendaraan Cloud Functions
const fnBuyVehicle = httpsCallable<
  { dealerId: string; modelId: string; color?: string; isUsed?: boolean; useBank?: boolean },
  { ok: boolean; vehicle: VehicleDoc; money: number }
>(functions, 'buyVehicle');
const fnBuyVehicleOnCredit = httpsCallable<
  { dealerId: string; modelId: string; color?: string; downPaymentRate?: number; termCycles?: number },
  { ok: boolean; vehicle: VehicleDoc; lease: VehicleLeaseDoc; money: number }
>(functions, 'buyVehicleOnCredit');
const fnSellVehicle = httpsCallable<
  { vehicleId: string },
  { ok: boolean; payout: number; leasePayoff: number; netCash: number; money: number }
>(functions, 'sellVehicle');
const fnTradeInVehicle = httpsCallable<
  { tradeInVehicleId: string; dealerId: string; targetModelId: string; color?: string },
  { ok: boolean; newVehicle: VehicleDoc; tradeInCredit: number; netCost: number; money: number }
>(functions, 'tradeInVehicle');
const fnListVehicleForSale = httpsCallable<
  { action?: 'create' | 'cancel'; vehicleId?: string; listingId?: string; price?: number; businessId?: string },
  { ok: boolean; listing?: VehicleListingDoc; listingId?: string; money?: number }
>(functions, 'listVehicleForSale');
const fnTransferVehicle = httpsCallable<
  { listingId: string },
  { ok: boolean; vehicleId: string; price: number; transferTax: number; money: number }
>(functions, 'transferVehicle');
const fnTestDriveStart = httpsCallable<
  { action?: 'start' | 'end'; dealerId?: string; modelId?: string; color?: string },
  {
    ok: boolean;
    ended?: boolean;
    vehicleId?: string;
    modelId?: string;
    color?: string;
    expiresAtMs?: number;
    spawnPos?: WorldPosition;
  }
>(functions, 'testDriveStart');
const fnRegisterVehicle = httpsCallable<
  { vehicleId: string },
  { ok: boolean; plateNumber: string; money: number }
>(functions, 'registerVehicle');
const fnRenewRegistration = httpsCallable<
  { vehicleId: string },
  { ok: boolean; stnkExpiresAtMs: number; totalDue: number; money: number }
>(functions, 'renewRegistration');
const fnTakeLicenseExam = httpsCallable<
  { category: 'C' | 'A'; answers: number[] },
  { ok: boolean; passed: boolean; score: number; license: unknown; money: number }
>(functions, 'takeLicenseExam');
const fnMountVehicle = httpsCallable<
  { vehicleId: string; asPassenger?: boolean; sessionId?: string },
  { ok: boolean; vehicleId: string; asPassenger: boolean; maxSpeedMps: number; seatIndex?: number }
>(functions, 'mountVehicle');
const fnParkVehicle = httpsCallable<
  {
    vehicleId: string;
    x: number;
    y: number;
    z: number;
    rotY?: number;
    parkedType?: VehicleParkedType;
    garagePropertyId?: string | null;
    distanceKm?: number;
    terrainType?: 'road' | 'offroad';
    crashDamage?: number;
  },
  { ok: boolean; nextFuel: number; nextCondition: number; nextOdometerKm: number; parkedPos: WorldPosition; parkedType: string }
>(functions, 'parkVehicle');
const fnDismountVehicle = httpsCallable<
  {
    vehicleId: string;
    x?: number;
    y?: number;
    z?: number;
    rotY?: number;
    distanceKm?: number;
    terrainType?: 'road' | 'offroad';
    crashDamage?: number;
  },
  { ok: boolean; isTestDrive?: boolean; isDriver?: boolean }
>(functions, 'dismountVehicle');
const fnRetrieveVehicle = httpsCallable<
  { vehicleId: string; spotId?: string },
  { ok: boolean; fee: number; money: number; parkedPos: WorldPosition }
>(functions, 'retrieveVehicle');
const fnRefuelVehicle = httpsCallable<
  { vehicleId: string; amount?: number },
  { ok: boolean; fuel: number; cost: number; money: number }
>(functions, 'refuelVehicle');
const fnServiceVehicle = httpsCallable<
  {
    vehicleId: string;
    serviceType: 'repair' | 'oil_change' | 'paint' | 'accessory';
    color?: string;
    accessoryId?: string;
    businessId?: string;
  },
  { ok: boolean; cost: number; condition: number; details: string; money: number; updates: Record<string, unknown> }
>(functions, 'serviceVehicle');
const fnReportPedestrianCollision = httpsCallable<
  {
    targetName?: string;
    targetType?: 'npc' | 'player';
    x?: number;
    z?: number;
    zone?: string;
  },
  { ok: boolean; skipped?: boolean; fineAmount?: number; finePaid?: number; remainingFine?: number; money: number; wantedLevel: number }
>(functions, 'reportPedestrianCollision');

// --- Fase 1 & 2 Wrappers ---

export async function callCreateCharacter(payload: CreateCharacterPayload) {
  return callServer(fnCreateCharacter, payload, () => {
    const uid = auth.currentUser?.uid || 'local_user';
    localSimulation.activateNewCharacter(uid, payload);
    return { ok: true };
  });
}

export async function callBuyFood(itemId: string) {
  return callServer(fnBuyFood, { itemId }, () => localSimulation.buyFood(itemId));
}

export async function callRest() {
  return callServer(fnRest, {}, () => localSimulation.rest());
}

export async function callSavePosition(pos: WorldPosition) {
  return callServer(fnSavePosition, pos, () => localSimulation.savePosition(pos));
}

export async function callSendChat(channel: 'global' | 'local', message: string) {
  const cleanMessage = message.trim().slice(0, 160);
  const res = await callServer(fnSendChat, { channel, message: cleanMessage }, () => ({
    ok: true,
    cleanMessage,
  }));
  return { ok: res.ok, cleanMessage: res.cleanMessage || cleanMessage };
}

export async function callTakeBath() {
  return callServer(fnTakeBath, {}, () => localSimulation.takeBath());
}

export async function callVisitClinic(clinicId: string, packageId: string) {
  return callServer(fnVisitClinic, { clinicId, packageId }, () =>
    localSimulation.visitClinic(clinicId, packageId)
  );
}

export async function callClaimClinic() {
  return callServer(fnClaimClinic, {}, () => localSimulation.claimClinic());
}

export async function callApplyJob(jobId: string) {
  return callServer(fnApplyJob, { jobId }, () => localSimulation.applyJob(jobId));
}

export async function callResignJob() {
  return callServer(fnResignJob, {}, () => localSimulation.resignJob());
}

export async function callStartShift() {
  return callServer(fnStartShift, {}, () => localSimulation.startShift());
}

export async function callEndShift(submission: Record<string, unknown>) {
  return callServer(fnEndShift, submission, () => localSimulation.endShift(submission));
}

export async function callEnrollCourse(courseId: string) {
  return callServer(fnEnrollCourse, { courseId }, () => localSimulation.enrollCourse(courseId));
}

export async function callClaimCourse() {
  return callServer(fnClaimCourse, {}, () => localSimulation.claimCourse());
}

export async function callGetBills() {
  return callServer(fnGetBills, {}, () => localSimulation.getBills());
}

export async function callPayBill(billId: string) {
  return callServer(fnPayBill, { billId }, () => localSimulation.payBill(billId));
}

export async function callBuyTicket(destination: ZoneId, serverOffsetMs = 0) {
  return callServer(fnBuyTicket, { destination }, () =>
    localSimulation.buyTicket(destination, serverOffsetMs)
  );
}

export async function callCompleteTrip() {
  return callServer(fnCompleteTrip, {}, () => localSimulation.completeTrip());
}

export async function callSyncPlayerState() {
  return callServer(fnSyncPlayerState, {}, () => localSimulation.syncPlayerState());
}

// --- Fase 3 Wrappers ---

export async function callCreateListing(
  propertyId: string,
  kind: ListingKind,
  price: number,
  deposit?: number
) {
  return callServer(fnCreateListing, { propertyId, kind, price, deposit }, () =>
    localSimulation.createListing(propertyId, kind, price, deposit)
  );
}

export async function callCancelListing(listingId: string) {
  return callServer(fnCancelListing, { listingId }, () => localSimulation.cancelListing(listingId));
}

export async function callRequestViewing(propertyId: string) {
  return callServer(fnRequestViewing, { propertyId }, () =>
    localSimulation.requestViewing(propertyId)
  );
}

export async function callEnterProperty(propertyId: string) {
  return callServer(fnEnterProperty, { propertyId }, () => localSimulation.enterProperty(propertyId));
}

export async function callLeaveProperty() {
  return callServer(fnLeaveProperty, {}, () => localSimulation.leaveProperty());
}

export async function callRepairProperty(propertyId: string) {
  return callServer(fnRepairProperty, { propertyId }, () =>
    localSimulation.repairProperty(propertyId)
  );
}

export async function callGrantGuestAccess(
  propertyId: string,
  targetName: string,
  durationHours = 4
) {
  return callServer(fnGrantGuestAccess, { propertyId, targetName, durationHours }, () =>
    localSimulation.grantGuestAccess(propertyId, targetName, durationHours)
  );
}

export async function callSetViewingSchedule(
  propertyId: string,
  open24h: boolean,
  startHour: number,
  endHour: number
) {
  return callServer(fnSetViewingSchedule, { propertyId, open24h, startHour, endHour }, () =>
    localSimulation.setViewingSchedule(propertyId, open24h, startHour, endHour)
  );
}

export async function callMakeOffer(listingId: string, amount: number, note?: string) {
  return callServer(fnMakeOffer, { listingId, amount, note }, () =>
    localSimulation.makeOffer(listingId, amount, note)
  );
}

export async function callRespondOffer(
  offerId: string,
  action: 'accept' | 'reject' | 'counter' | 'accept_counter',
  counterAmount?: number
) {
  return callServer(fnRespondOffer, { offerId, action, counterAmount }, () =>
    localSimulation.respondOffer(offerId, action, counterAmount)
  );
}

export async function callCreateLease(
  propertyId: string,
  period: 'weekly' | 'monthly',
  offerId?: string,
  useStarterDiscount = false
) {
  return callServer(
    fnCreateLease,
    { propertyId, period, offerId, useStarterDiscount },
    () => localSimulation.createLease(propertyId, period, offerId, useStarterDiscount)
  );
}

export async function callTerminateLease(leaseId: string) {
  return callServer(fnTerminateLease, { leaseId }, () => localSimulation.terminateLease(leaseId));
}

export async function callInviteRoommate(
  leaseId: string,
  targetName: string,
  sharePercent: number
) {
  return callServer(fnInviteRoommate, { leaseId, targetName, sharePercent }, () =>
    localSimulation.inviteRoommate(leaseId, targetName, sharePercent)
  );
}

export async function callAcceptRoommate(leaseId: string) {
  return callServer(fnAcceptRoommate, { leaseId }, () => localSimulation.acceptRoommate(leaseId));
}

export async function callLeaveRoommate(leaseId: string) {
  return callServer(fnLeaveRoommate, { leaseId }, () => localSimulation.leaveRoommate(leaseId));
}

export async function callBuyProperty(propertyId: string, offerId?: string) {
  return callServer(fnBuyProperty, { propertyId, offerId }, () =>
    localSimulation.buyProperty(propertyId, offerId)
  );
}

export async function callSleepAtHome(
  action: 'start' | 'wake',
  locationType: 'home' | 'emperan' | 'shelter' = 'home',
  propertyId?: string,
  spotId?: string
) {
  return callServer(fnSleepAtHome, { action, locationType, propertyId, spotId }, () =>
    localSimulation.sleepAtHome(action, locationType, propertyId, spotId)
  );
}

export async function callBatheAtHome(propertyId?: string) {
  return callServer(fnBatheAtHome, { propertyId }, () => localSimulation.batheAtHome(propertyId));
}

export async function callEatFromInventory(itemId: string, propertyId?: string) {
  return callServer(fnEatFromInventory, { itemId, propertyId }, () =>
    localSimulation.eatFromInventory(itemId, propertyId)
  );
}

export async function callSetHomePreferences(respawnAtHome: boolean) {
  return callServer(fnSetHomePreferences, { respawnAtHome }, () =>
    localSimulation.setHomePreferences(respawnAtHome)
  );
}

export async function callBuyFurniture(furnitureId: string, quantity = 1) {
  return callServer(fnBuyFurniture, { furnitureId, quantity }, () =>
    localSimulation.buyFurniture(furnitureId, quantity)
  );
}

export async function callPlaceFurniture(propertyId: string, placements: FurniturePlacement[]) {
  return callServer(fnPlaceFurniture, { propertyId, placements }, () =>
    localSimulation.placeFurniture(propertyId, placements)
  );
}

// --- Paginated Firestore Query untuk Listing Properti (Indeks Komposit + Paginasi) ---

export interface ListingFilterOptions {
  kind?: ListingKind | 'all';
  propertyType?: PropertyType | 'all';
  areaTag?: AreaTag | 'all';
  stationTier?: 'dekat' | 'sedang' | 'jauh' | 'all';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

export async function fetchListingsPaginated(
  opts: ListingFilterOptions
): Promise<{
  listings: PropertyListingDoc[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const pageSize = opts.pageSize ?? 8;
  const constraints: QueryConstraint[] = [where('status', '==', 'active')];

  // Memilih tepat satu filter equality utama sesuai composite index firestore.indexes.json
  if (opts.kind && opts.kind !== 'all') {
    constraints.push(where('kind', '==', opts.kind));
  } else if (opts.propertyType && opts.propertyType !== 'all') {
    constraints.push(where('propertyType', '==', opts.propertyType));
  } else if (opts.areaTag && opts.areaTag !== 'all') {
    constraints.push(where('areaTag', '==', opts.areaTag));
  } else if (opts.stationTier && opts.stationTier !== 'all') {
    constraints.push(where('stationDistanceTier', '==', opts.stationTier));
  }

  constraints.push(orderBy('price', 'asc'));
  if (opts.cursor) {
    constraints.push(startAfter(opts.cursor));
  }
  constraints.push(limit(pageSize + 1));

  const q = query(collection(db, 'property_listings'), ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  const listings = pageDocs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PropertyListingDoc, 'id'>),
  }));

  return {
    listings,
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

// --- Fase 4 Wrappers: Bank ---

export async function callOpenAccount(initialDeposit = 0) {
  return callServer(fnOpenAccount, { initialDeposit }, () => localSimulation.openAccount(initialDeposit));
}

export async function callDeposit(amount: number, target: 'balance' | 'savings' = 'balance') {
  return callServer(fnDeposit, { amount, target }, () => localSimulation.deposit(amount, target));
}

export async function callWithdraw(amount: number, source: 'balance' | 'savings' = 'balance') {
  return callServer(fnWithdraw, { amount, source }, () => localSimulation.withdraw(amount, source));
}

export async function callTransfer(targetName: string, amount: number, note?: string) {
  return callServer(fnTransfer, { targetName, amount, note }, () => localSimulation.transfer(targetName, amount));
}

export async function callApplyLoan(amount: number) {
  return callServer(fnApplyLoan, { amount }, () => localSimulation.applyLoan(amount));
}

export async function callRepayLoan(loanId: string, payFull = false, source: 'bank' | 'wallet' = 'bank') {
  return callServer(fnRepayLoan, { loanId, payFull, source }, () =>
    localSimulation.repayLoan(loanId, payFull, source)
  );
}

export async function callGetAccountSummary() {
  return callServer(fnGetAccountSummary, {}, () => localSimulation.getAccountSummary());
}

// --- Fase 4 Wrappers: Bisnis ---

export async function callCreateBusiness(
  type: BusinessType,
  name: string,
  propertyId: string,
  capital: number
) {
  return callServer(fnCreateBusiness, { type, name, propertyId, capital }, () =>
    localSimulation.createBusiness(type, name, propertyId, capital)
  );
}

export async function callSetBusinessSettings(
  businessId: string,
  patch: { name?: string; isOpen?: boolean; openHour?: number; closeHour?: number }
) {
  return callServer(fnSetBusinessSettings, { businessId, ...patch }, () =>
    localSimulation.setBusinessSettings(businessId, patch)
  );
}

export async function callWithdrawBusinessProfit(businessId: string, amount: number) {
  return callServer(fnWithdrawBusinessProfit, { businessId, amount }, () =>
    localSimulation.withdrawBusinessProfit(businessId, amount)
  );
}

export async function callCloseBusiness(businessId: string) {
  return callServer(fnCloseBusiness, { businessId }, () => localSimulation.closeBusiness(businessId));
}

export async function callSellBusiness(businessId: string) {
  return callServer(fnSellBusiness, { businessId }, () => localSimulation.sellBusiness(businessId));
}

export async function callBuyStock(
  businessId: string,
  itemId: string,
  qty: number,
  payFrom: 'business' | 'wallet' = 'business'
) {
  return callServer(fnBuyStock, { businessId, itemId, qty, payFrom }, () =>
    localSimulation.buyStock(businessId, itemId, qty, payFrom)
  );
}

export async function callProduceItem(businessId: string, recipeId: string, batchCount = 1) {
  return callServer(fnProduceItem, { businessId, recipeId, batchCount }, () =>
    localSimulation.produceItem(businessId, recipeId, batchCount)
  );
}

export async function callSetPrice(businessId: string, itemId: string, sellPrice: number) {
  return callServer(fnSetPrice, { businessId, itemId, sellPrice }, () =>
    localSimulation.setPrice(businessId, itemId, sellPrice)
  );
}

export async function callDiscardStock(businessId: string, itemId: string) {
  return callServer(fnDiscardStock, { businessId, itemId }, () =>
    localSimulation.discardStock(businessId, itemId)
  );
}

export async function callBuyFromBusiness(
  businessId: string,
  itemId: string,
  qty = 1,
  consumeNow = false
) {
  return callServer(fnBuyFromBusiness, { businessId, itemId, qty, consumeNow }, () =>
    localSimulation.buyFromBusiness(businessId, itemId, qty, consumeNow)
  );
}

export async function callRunPromotion(businessId: string, tierId: string) {
  return callServer(fnRunPromotion, { businessId, tierId }, () =>
    localSimulation.runPromotion(businessId, tierId)
  );
}

export async function callSettleNpcSales(businessId: string) {
  return callServer(fnSettleNpcSales, { businessId }, () => localSimulation.settleNpcSales(businessId));
}

export async function callPostBusinessJob(
  businessId: string,
  roleTitle: string,
  wagePerShift: number,
  slotsOpen = 1,
  closePostId?: string
) {
  return callServer(
    fnPostBusinessJob,
    { businessId, roleTitle, wagePerShift, slotsOpen, closePostId },
    () => localSimulation.postBusinessJob(businessId, roleTitle, wagePerShift, slotsOpen)
  );
}

export async function callHireEmployee(payload: {
  businessId?: string;
  mode?: 'npc' | 'player';
  targetName?: string;
  roleTitle?: string;
  wagePerShift?: number;
  postId?: string;
}) {
  return callServer(fnHireEmployee, payload, () =>
    localSimulation.hireEmployee(
      payload.businessId || '',
      payload.mode || 'npc',
      payload.targetName,
      payload.wagePerShift,
      { postId: payload.postId, roleTitle: payload.roleTitle }
    )
  );
}

export async function callFireEmployee(businessId: string, empId: string) {
  return callServer(fnFireEmployee, { businessId, empId }, () =>
    localSimulation.fireEmployee(businessId, empId)
  );
}

export async function callPayWages(businessId: string) {
  return callServer(fnPayWages, { businessId }, () => localSimulation.payWages(businessId));
}

// --- Fase 4 Wrappers: Marketplace P2P, Lelang & Ekonomi Makro ---

export async function callCreateMarketListing(
  itemId: string,
  qty: number,
  unitPrice: number,
  areaTag = 'pasar'
) {
  return callServer(fnCreateMarketListing, { itemId, qty, unitPrice, areaTag }, () =>
    localSimulation.createMarketListing(itemId, qty, unitPrice, areaTag)
  );
}

export async function callBuyMarketListing(listingId: string, buyQty?: number) {
  return callServer(fnBuyMarketListing, { listingId, buyQty }, () =>
    localSimulation.buyMarketListing(listingId, buyQty)
  );
}

export async function callCancelMarketListing(listingId: string) {
  return callServer(fnCancelMarketListing, { listingId }, () =>
    localSimulation.cancelMarketListing(listingId)
  );
}

export async function callCreateAuction(payload: {
  subjectType: AuctionSubjectType;
  subjectId: string;
  qty?: number;
  startPrice: number;
  minIncrement?: number;
  durationMinutes?: number;
}) {
  return callServer(fnCreateAuction, payload, () =>
    localSimulation.createAuction(
      payload.subjectType,
      payload.subjectId,
      payload.startPrice,
      payload.minIncrement,
      payload.durationMinutes,
      payload.qty
    )
  );
}

export async function callPlaceBid(
  auctionId: string,
  amount: number,
  payFrom: 'wallet' | 'bank' = 'wallet'
) {
  return callServer(fnPlaceBid, { auctionId, amount, payFrom }, () =>
    localSimulation.placeBid(auctionId, amount, payFrom)
  );
}

export async function callSettleAuction(auctionId: string, cancel = false) {
  return callServer(fnSettleAuction, { auctionId, cancel }, () =>
    localSimulation.settleAuction(auctionId, cancel)
  );
}

export async function callUpdateMarketStats() {
  return callServer(fnUpdateMarketStats, {}, () => localSimulation.updateMarketStats());
}

export async function callTriggerEconomicEvent(eventId: string) {
  return callServer(fnTriggerEconomicEvent, { eventId }, () => ({ ok: true, activeEventId: eventId }));
}

export async function fetchMarketListingsPaginated(opts: {
  category?: string;
  areaTag?: string;
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  const pageSize = opts.pageSize ?? 8;
  const constraints: QueryConstraint[] = [where('status', '==', 'active')];
  if (opts.category && opts.category !== 'all') {
    constraints.push(where('category', '==', opts.category));
  } else if (opts.areaTag && opts.areaTag !== 'all') {
    constraints.push(where('areaTag', '==', opts.areaTag));
  }
  constraints.push(orderBy('unitPrice', 'asc'));
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(collection(db, 'market_listings'), ...constraints));
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  return {
    listings: pageDocs.map((d) => ({ id: d.id, ...(d.data() as Omit<MarketListingDoc, 'id'>) })),
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

export async function fetchAuctionsPaginated(opts: {
  subjectType?: AuctionSubjectType | 'all';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}) {
  const pageSize = opts.pageSize ?? 8;
  const constraints: QueryConstraint[] = [where('status', '==', 'active')];
  if (opts.subjectType && opts.subjectType !== 'all') {
    constraints.push(where('subjectType', '==', opts.subjectType));
  }
  constraints.push(orderBy('endsAtMs', 'asc'));
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(collection(db, 'auctions'), ...constraints));
  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
  return {
    auctions: pageDocs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuctionDoc, 'id'>) })),
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}

// --- Fase 6 Wrappers: Hukum, Polisi, Keamanan, Asuransi, NPC, Quest, KPR, Tanah, Agen ---

export async function callAttemptCrime(payload: {
  offenseId: string;
  targetType?: string;
  targetId?: string;
  x?: number;
  z?: number;
}) {
  return callServer(fnAttemptCrime, payload, () =>
    localSimulation.attemptCrime(payload.offenseId, payload.targetType, payload.targetId, payload.x, payload.z)
  );
}

export async function callReportCrime(payload: {
  targetUid?: string;
  recordId?: string;
  note?: string;
}) {
  return callServer(fnReportCrime, payload, () =>
    localSimulation.reportCrime(payload.targetUid, payload.recordId, payload.note)
  );
}

export async function callPayFine(recordId: string, paymentSource: 'wallet' | 'bank' = 'wallet') {
  return callServer(fnPayFine, { recordId, paymentSource }, () =>
    localSimulation.payFine(recordId, paymentSource)
  );
}

export async function callArrestPlayer(targetUid: string) {
  return callServer(fnArrestPlayer, { targetUid }, () => localSimulation.arrestPlayer(targetUid));
}

export async function callIssueFine(targetUid: string, recordId?: string) {
  return callServer(fnIssueFine, { targetUid, recordId }, () =>
    localSimulation.issueFine(targetUid, recordId)
  );
}

export async function callReleasePlayer(targetUid: string, reason?: string) {
  return callServer(fnReleasePlayer, { targetUid, reason }, () =>
    localSimulation.releasePlayer(targetUid, reason)
  );
}

export async function callReviewPoliceAction(actionId: string) {
  return callServer(fnReviewPoliceAction, { actionId }, () =>
    localSimulation.reviewPoliceAction(actionId)
  );
}

export async function callServeSentence(action: 'check' | 'work') {
  return callServer(fnServeSentence, { action }, () => localSimulation.serveSentence(action));
}

export async function callPayBail(payload: {
  targetUid?: string;
  targetName?: string;
  paymentSource?: 'wallet' | 'bank';
}) {
  return callServer(fnPayBail, payload, () =>
    localSimulation.payBail(payload.targetUid, payload.targetName, payload.paymentSource)
  );
}

export async function callFileAppeal() {
  return callServer(fnFileAppeal, {}, () => localSimulation.fileAppeal());
}

export async function callGetCriminalRecord(targetUid?: string) {
  return callServer(fnGetCriminalRecord, { targetUid }, () => localSimulation.getCriminalRecord());
}

export async function callInstallSecurity(propertyId: string, moduleId: 'lock' | 'alarm' | 'cctv') {
  return callServer(fnInstallSecurity, { propertyId, moduleId }, () =>
    localSimulation.installSecurity(propertyId, moduleId)
  );
}

export async function callHireGuard(
  propertyId: string,
  action: 'hire' | 'dismiss',
  guardName?: string
) {
  return callServer(fnHireGuard, { propertyId, action, guardName }, () =>
    localSimulation.hireGuard(propertyId, guardName, action)
  );
}

export async function callBuyInsurance(
  subjectType: 'property' | 'business',
  subjectId: string,
  planId: 'basic' | 'premium'
) {
  return callServer(fnBuyInsurance, { subjectType, subjectId, planId }, () =>
    localSimulation.buyInsurance(subjectType, subjectId, planId)
  );
}

export async function callFileClaim(insuranceId: string, crimeRecordId: string) {
  return callServer(fnFileClaim, { insuranceId, crimeRecordId }, () =>
    localSimulation.fileClaim(insuranceId, crimeRecordId)
  );
}

export async function callTalkToNpc(npcId: string, message: string) {
  return callServer(fnTalkToNpc, { npcId, message }, () => localSimulation.talkToNpc(npcId, message));
}

export async function callGetNpcOptions(npcId: string) {
  return callServer(fnGetNpcOptions, { npcId }, () => localSimulation.getNpcOptions(npcId));
}

export async function callExecuteNpcAction(payload: {
  npcId: string;
  actionId: string;
  itemId?: string;
  reason?: string;
}) {
  return callServer(fnExecuteNpcAction, payload, () =>
    localSimulation.executeNpcAction(payload.npcId, payload.actionId, payload.itemId)
  );
}

export async function callAcceptQuest(questId: string) {
  return callServer(fnAcceptQuest, { questId }, () => localSimulation.acceptQuest(questId));
}

export async function callCompleteQuest(payload: { logId?: string; questId?: string }) {
  return callServer(fnCompleteQuest, payload, () =>
    localSimulation.completeQuest(payload.logId, payload.questId)
  );
}

export async function callAbandonQuest(payload: { logId?: string; questId?: string }) {
  return callServer(fnAbandonQuest, payload, () =>
    localSimulation.abandonQuest(payload.logId, payload.questId)
  );
}

export async function callApplyMortgage(payload: {
  propertyId: string;
  offerId?: string;
  downPaymentRate: number;
  termCycles: number;
  payFrom: 'wallet' | 'bank';
}) {
  return callServer(fnApplyMortgage, payload, () =>
    localSimulation.applyMortgage(
      payload.propertyId,
      payload.downPaymentRate,
      payload.termCycles,
      payload.payFrom
    )
  );
}

export async function callPayMortgage(
  mortgageId: string,
  payFrom: 'wallet' | 'bank' = 'wallet',
  cycles = 1
) {
  return callServer(fnPayMortgage, { mortgageId, payFrom, cycles }, () =>
    localSimulation.payMortgage(mortgageId, payFrom, cycles)
  );
}

export async function callEarlyRepay(mortgageId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
  return callServer(fnEarlyRepay, { mortgageId, payFrom }, () =>
    localSimulation.earlyRepay(mortgageId, payFrom)
  );
}

export async function callForeclose(mortgageId: string) {
  return callServer(fnForeclose, { mortgageId }, () => localSimulation.foreclose(mortgageId));
}

export async function callBuyLand(
  plotId: string,
  payFrom: 'wallet' | 'bank' = 'wallet',
  devProjectId?: string
) {
  return callServer(fnBuyLand, { plotId, payFrom, devProjectId }, () =>
    localSimulation.buyLand(plotId, payFrom, devProjectId)
  );
}

export async function callApplyPermit(plotId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
  return callServer(fnApplyPermit, { plotId, payFrom }, () =>
    localSimulation.applyPermit(plotId, payFrom)
  );
}

export async function callStartConstruction(payload: {
  plotId: string;
  blueprintId: 'kecil' | 'sedang' | 'besar';
  contractorType: 'npc' | 'player';
  payFrom: 'wallet' | 'bank';
  devProjectId?: string;
}) {
  return callServer(fnStartConstruction, payload, () =>
    localSimulation.startConstruction(
      payload.plotId,
      payload.blueprintId,
      payload.contractorType,
      payload.payFrom,
      payload.devProjectId
    )
  );
}

export async function callAdvanceConstruction(constructionId: string) {
  return callServer(fnAdvanceConstruction, { constructionId }, () =>
    localSimulation.advanceConstruction(constructionId)
  );
}

export async function callCompleteConstruction(constructionId: string, propertyName?: string) {
  return callServer(fnCompleteConstruction, { constructionId, propertyName }, () =>
    localSimulation.completeConstruction(constructionId, propertyName)
  );
}

export async function callBecomeAgent(payFrom: 'wallet' | 'bank' = 'wallet') {
  return callServer(fnBecomeAgent, { payFrom }, () => localSimulation.becomeAgent(payFrom));
}

export async function callCreateClientRequest(payload: {
  desiredArea: AreaTag | 'any';
  desiredType: PropertyType | 'any';
  desiredKind: 'sale' | 'rent';
}) {
  return callServer(fnCreateClientRequest, payload, () =>
    localSimulation.createClientRequest(
      payload.desiredArea,
      payload.desiredType,
      payload.desiredKind
    )
  );
}

export async function callCloseDeal(clientId: string, listingId: string) {
  return callServer(fnCloseDeal, { clientId, listingId }, () =>
    localSimulation.closeDeal(clientId, listingId)
  );
}

export async function callCreateDevelopmentProject(name: string, plotIds: string[] = []) {
  return callServer(fnCreateDevelopmentProject, { name, plotIds }, () =>
    localSimulation.createDevelopmentProject(name, plotIds)
  );
}

export async function callStartRenovation(payload: {
  propertyId: string;
  renovationType: 'add_room' | 'add_floor' | 'garden' | 'fence' | 'garage';
  payFrom: 'wallet' | 'bank';
}) {
  return callServer(fnStartRenovation, payload, () =>
    localSimulation.startRenovation(payload.propertyId, payload.renovationType, payload.payFrom)
  );
}

export async function callCompleteRenovation(renovationId: string) {
  return callServer(fnCompleteRenovation, { renovationId }, () =>
    localSimulation.completeRenovation(renovationId)
  );
}

export async function callBuyFurnitureSet(setId: string, payFrom: 'wallet' | 'bank' = 'wallet') {
  return callServer(fnBuyFurnitureSet, { setId, payFrom }, () =>
    localSimulation.buyFurnitureSet(setId, payFrom)
  );
}

// --- Sistem Kendaraan Wrappers ---

export async function callBuyVehicle(payload: {
  dealerId: string;
  modelId: string;
  color?: string;
  isUsed?: boolean;
  useBank?: boolean;
}) {
  return callServer(fnBuyVehicle, payload, () =>
    localSimulation.buyVehicle(
      payload.dealerId,
      payload.modelId,
      payload.color,
      payload.isUsed,
      Boolean(payload.useBank)
    )
  );
}

export async function callBuyVehicleOnCredit(payload: {
  dealerId: string;
  modelId: string;
  color?: string;
  downPaymentRate?: number;
  termCycles?: number;
}) {
  return callServer(fnBuyVehicleOnCredit, payload, () =>
    localSimulation.buyVehicleOnCredit(
      payload.dealerId,
      payload.modelId,
      payload.color,
      payload.downPaymentRate,
      payload.termCycles
    )
  );
}

export async function callSellVehicle(vehicleId: string) {
  return callServer(fnSellVehicle, { vehicleId }, () => localSimulation.sellVehicle(vehicleId));
}

export async function callTradeInVehicle(payload: {
  tradeInVehicleId: string;
  dealerId: string;
  targetModelId: string;
  color?: string;
}) {
  return callServer(fnTradeInVehicle, payload, () =>
    localSimulation.tradeInVehicle(
      payload.tradeInVehicleId,
      payload.dealerId,
      payload.targetModelId,
      payload.color
    )
  );
}

export async function callListVehicleForSale(payload: {
  action?: 'create' | 'cancel';
  vehicleId?: string;
  listingId?: string;
  price?: number;
  businessId?: string;
}) {
  return callServer(fnListVehicleForSale, payload, () => localSimulation.listVehicleForSale(payload));
}

export async function callTransferVehicle(listingId: string) {
  return callServer(fnTransferVehicle, { listingId }, () => localSimulation.transferVehicle(listingId));
}

export async function callTestDriveStart(payload: {
  action?: 'start' | 'end';
  dealerId?: string;
  modelId?: string;
  color?: string;
  sessionId?: string;
}) {
  return callServer(fnTestDriveStart, payload, () => localSimulation.testDriveStart(payload));
}

export async function callRegisterVehicle(vehicleId: string) {
  return callServer(fnRegisterVehicle, { vehicleId }, () => localSimulation.registerVehicle(vehicleId));
}

export async function callRenewRegistration(vehicleId: string) {
  return callServer(fnRenewRegistration, { vehicleId }, () => localSimulation.renewRegistration(vehicleId));
}

export async function callTakeLicenseExam(category: 'C' | 'A', answers: number[]) {
  return callServer(fnTakeLicenseExam, { category, answers }, () =>
    localSimulation.takeLicenseExam(category, answers)
  );
}

export async function callMountVehicle(vehicleId: string, asPassenger = false, sessionId?: string) {
  return callServer(fnMountVehicle, { vehicleId, asPassenger, sessionId }, () =>
    localSimulation.mountVehicle(vehicleId, asPassenger)
  );
}

export async function callParkVehicle(payload: {
  vehicleId: string;
  x: number;
  y: number;
  z: number;
  rotY?: number;
  parkedType?: VehicleParkedType;
  garagePropertyId?: string | null;
  distanceKm?: number;
  terrainType?: 'road' | 'offroad';
  crashDamage?: number;
}) {
  return callServer(fnParkVehicle, payload, () => localSimulation.parkVehicle(payload));
}

export async function callDismountVehicle(payload: {
  vehicleId: string;
  x?: number;
  y?: number;
  z?: number;
  rotY?: number;
  distanceKm?: number;
  terrainType?: 'road' | 'offroad';
  crashDamage?: number;
}) {
  return callServer(fnDismountVehicle, payload, () => localSimulation.dismountVehicle(payload));
}

export async function callRetrieveVehicle(vehicleId: string, spotId = 'alun_alun') {
  return callServer(fnRetrieveVehicle, { vehicleId, spotId }, () =>
    localSimulation.retrieveVehicle(vehicleId, spotId)
  );
}

export async function callRefuelVehicle(vehicleId: string, amount?: number) {
  return callServer(fnRefuelVehicle, { vehicleId, amount }, () =>
    localSimulation.refuelVehicle(vehicleId, amount)
  );
}

export async function callServiceVehicle(payload: {
  vehicleId: string;
  serviceType: 'repair' | 'oil_change' | 'paint' | 'accessory';
  color?: string;
  accessoryId?: string;
  businessId?: string;
}) {
  return callServer(fnServiceVehicle, payload, () => localSimulation.serviceVehicle(payload));
}

export async function callReportPedestrianCollision(payload: {
  targetName?: string;
  targetType?: 'npc' | 'player';
  x?: number;
  z?: number;
  zone?: string;
}) {
  return callServer(fnReportPedestrianCollision, payload, () =>
    localSimulation.reportPedestrianCollision(payload)
  );
}
