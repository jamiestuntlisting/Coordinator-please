// ============================================================
// COORDINATOR PLEASE — Master Type Definitions
// ============================================================

// -- Enums & Literals --

export type HeadshotType = 'color_8x10' | 'atlanta_comp' | 'bw_8x10';
export type RiskLevel = 'high' | 'medium' | 'nd';
export type Gender = 'male' | 'female' | 'any';
export type SagStatus = 'current' | 'expired' | 'none' | 'claims_yes';
export type PersonalityType = 'confident' | 'nervous' | 'aggressive' | 'smooth' | 'desperate' | 'quiet';
export type ProductionNoteType = 'none' | 'non_union' | 'budget_cut' | 'stunt_change' | 'added_role' | 'locals_only';
export type TimeOfNight = 'evening' | 'midnight' | 'late_night';
export type EndingTier = 'fired' | 'd' | 'c' | 'b' | 'a' | 's';

export type HireOutcome =
  | 'correct_right_role'
  | 'correct_slight_mismatch'
  | 'wrong_gender'
  | 'size_mismatch'
  | 'wrong_hire_nd_no_injury'
  | 'wrong_hire_nd_minor_injury'
  | 'wrong_hire_medium_injury'
  | 'wrong_hire_high_serious_injury'
  | 'wrong_hire_upgraded_nd_injury'
  | 'non_sag_on_sag_night'
  | 'passed_legit'
  | 'passed_faker'
  | 'unfilled_role'
  | 'caught_duplicate_reel'
  | 'caught_returning_visitor';

// -- Core Interfaces --

export interface Headshot {
  type: HeadshotType;
  matchesFace: boolean;
  matchesBodyType: boolean;
}

export interface CoordRef {
  name: string;
  realCoordinator: boolean;
  city: string;
}

export interface Resume {
  skills: string[];
  credits: string[];
  coordinatorRefs: CoordRef[];
  sagStatus: SagStatus;
  listedHeight: string;
  listedWeight: string;
}

export interface SagCard {
  present: boolean;
  valid: boolean;
  name: string;
  location: string;  // city on the card — a tell if it doesn't match claimed city
}

export interface BodyType {
  height: number;   // inches
  weight: number;   // pounds
  build: 'slim' | 'average' | 'athletic' | 'heavy';
}

export interface SkillReel {
  animationId: string;
  titleCardName: string;
  bodyType: BodyType;
}

export interface BribeOffer {
  amount: number;
  dialogue: string;
}

export interface VisitorAppearance {
  skinTone: number;       // hex color for skin
  skinShadow: number;     // hex color for skin shadow
  hairColor: number;      // hex color for hair
  hairStyle: 'short' | 'medium' | 'long' | 'bald' | 'ponytail' | 'buzzcut';
  shirtColor: number;     // hex color for shirt/top
  pantsColor: number;     // hex color for pants
  hasBeard: boolean;
  hasGlasses: boolean;
}

export interface Visitor {
  id: string;
  name: string;
  appearance: VisitorAppearance;
  canDoTheJob: boolean;
  isStuntPerformer: boolean;
  claimedCity: string;
  actualCity: string;
  isLocal: boolean;
  howTheyHeard: string;
  howTheyHeardLegit: boolean;
  gender: Gender;
  bodyType: BodyType;
  headshot: Headshot;
  resume: Resume;
  sagCard: SagCard | null;
  bookListing: BookListing | null;
  skillReel: SkillReel | null;
  personality: PersonalityType;
  insuranceTalk: string | null;
  bribeOffer: BribeOffer | null;
  dialogueResponses: Record<string, string>;
  hasNewerHeadshot: boolean;
  isReturning: boolean;
  originalVisitorId: string | null;
  isSagRep: boolean;
  isWigGuy: boolean;
  isProductionOverride: boolean;
  assignedRoleId: string | null;
  isLegacy: boolean;
}

export interface Role {
  id: string;
  title: string;
  stuntType: string;
  riskLevel: RiskLevel;
  originalRiskLevel: RiskLevel;
  wasUpgraded: boolean;
  requiredGender: Gender;
  heightRange: [number, number];
  weightRange: [number, number];
  requiredSkills: string[];
  sagRequired: boolean;
  filledBy: string | null;  // visitor ID
}

export interface BookListing {
  name: string;
  city: string;
  height: string;
  weight: string;
  skills: string[];
  coordinatorCredits: string[];
  hasPhoto: boolean;
}

export interface CoordListing {
  name: string;
  city: string;
  isTraveler: boolean;
  credits: string[];
}

export interface ReelAnimation {
  id: string;
  stuntType: string;
  description: string;
  bodyType: BodyType;
}

export interface ProductionNote {
  type: ProductionNoteType;
  description: string;
  flavor: string;
}

export interface Injury {
  visitorId: string;
  visitorName: string;
  roleId: string;
  roleTitle: string;
  severity: 'minor' | 'serious';
  description: string;
}

export interface HireResult {
  visitorId: string;
  visitorName: string;
  roleId: string;
  roleTitle: string;
  outcome: HireOutcome;
  repChange: number;
  wasInjured: boolean;
  injury: Injury | null;
}

export interface KidExpense {
  description: string;
  cost: number;
}

export interface NightResult {
  night: number;
  hires: HireResult[];
  rejections: { visitorId: string; visitorName: string; wasFaker: boolean; wasReturning: boolean }[];
  injuries: Injury[];
  repChange: number;
  moneyEarned: number;
  moneySpent: number;
  bribesTaken: number;
  bribeMoney: number;
  sagRepVisit: boolean;
  sagRepCost: number;
  ndUpgraded: boolean;
  kidExpense: KidExpense | null;
}

export interface NightConfig {
  night: number;
  noteType: ProductionNoteType;
  noteDescription: string;
  roles: RoleTemplate[];
  visitorCount: number;
  bribeRange: [number, number];
  sagRepChance: number;
  ndUpgradeChance: number;
  wigGuyAppears: boolean;
  returningVisitorChance: number;
  kidExpenseChance: number;
  openingMonologue: string;
  closingMonologue: string;
  hiringDeadline: number;
}

export interface RoleTemplate {
  title: string;
  stuntType: string;
  riskLevel: RiskLevel;
  requiredGender: Gender;
  heightRange: [number, number];
  weightRange: [number, number];
  requiredSkills: string[];
  sagRequired: boolean;
}

// -- Game State --

export interface GameState {
  night: number;
  timeOfNight: number;          // 18.0 (6PM) to 30.0 (6AM)
  reputation: number;           // 0-100, start 50
  strikes: number;              // 0-5
  money: number;
  totalBribes: number;
  dayRate: number;
  roles: Role[];
  currentVisitorIndex: number;
  currentVisitor: Visitor | null;
  visitors: Visitor[];
  stuntListingBook: BookListing[];
  coordinatorListings: CoordListing[];
  reelPool: ReelAnimation[];
  seenReels: Map<string, string>;   // animationId → first visitor name
  rejectedVisitors: string[];       // visitor IDs rejected across all nights
  sagRepVisited: boolean;
  todaysNote: ProductionNote;
  ndUpgradeTriggered: boolean;
  ndUpgradeTarget: string | null;
  injuryLog: Injury[];
  history: NightResult[];
  coffeeLevel: number;             // 0-100
  wigGuyAppearances: number;

  // Family (fixed)
  rent: number;
  carPayment: number;
  physicalTherapy: number;
  gym: number;
  pager: number;
  tonightKidExpense: KidExpense | null;

  // Meta
  gameOver: boolean;
  fired: boolean;
  currentPhase: 'evening' | 'callsheet' | 'desk' | 'midshift_upgrade' | 'results' | 'money' | 'ending';
}

// -- Balance Config (all tunable numbers) --

export interface BalanceConfig {
  startingReputation: number;
  startingMoney: number;
  maxStrikes: number;
  strikesForWarning: number;
  strikesForFinalWarning: number;

  dayRateBase: number;
  dayRatePerRepTier: number;

  rent: number;
  carPayment: number;
  physicalTherapy: number;
  gym: number;
  pager: number;

  sagRepCost: number;

  repGain: Record<string, number>;
  repLoss: Record<string, number>;

  ndInjuryChance: number;
  mediumInjuryChance: number;
  highInjuryChance: number;
  fakerInjuryChance: number;

  coffeeDrainPerVisitor: number;

  endingThresholds: {
    s: { minRep: number; maxStrikes: number; minMoney: number };
    a: { minRep: number; maxStrikes: number };
    b: { minRep: number; maxStrikes: number };
    c: { minRep: number };
    d: { minRep: number };
  };
}

// -- Dialogue --

export interface DialogueOption {
  id: string;
  text: string;
  requiresContext?: string;   // e.g. 'bw_headshot', 'no_sag_card'
  responseKey: string;
}

export interface VisitorDialogue {
  greeting: string;
  responses: Record<string, string>;
  bribeDialogue?: string;
  insuranceDialogue?: string;
  callout?: string;  // what you say when catching them
}
