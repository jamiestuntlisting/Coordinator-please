import type { BalanceConfig } from '../types/index';

export const BALANCE: BalanceConfig = {
  // -- Starting values -- (low: always on the edge, needs bribes to survive)
  startingReputation: 5,
  startingMoney: 10,
  maxStrikes: 3,
  strikesForWarning: 1,
  strikesForFinalWarning: 2,

  // -- Day rate --
  dayRateBase: 150,
  dayRatePerRepTier: 10,

  // -- Monthly expenses --
  rent: 30,
  carPayment: 15,
  physicalTherapy: 20,
  gym: 5,
  pager: 3,

  // -- SAG --
  sagRepCost: 150,

  // -- Reputation gains (rep only goes UP for good work) --
  repGain: {
    correct_right_role: 2,
    correct_slight_mismatch: 1,
    passed_faker: 1,
    caught_duplicate_reel: 2,
    caught_returning_visitor: 2,
  },

  // -- Reputation losses (minimal — strikes and fines handle punishment) --
  repLoss: {
    wrong_hire_nd_minor_injury: 0,
    wrong_hire_medium_injury: 0,
    wrong_hire_high_serious_injury: -1,
    wrong_hire_upgraded_nd_injury: 0,
    non_sag_on_sag_night: 0,
    wrong_gender: 0,
    size_mismatch: 0,
    passed_legit: 0,
    unfilled_role: 0,
    not_local: 0,
  },

  // -- Fines deducted from paycheck (the real punishment) --
  fines: {
    wrong_hire_nd_minor_injury: 15,
    wrong_hire_nd_no_injury: 0,
    wrong_hire_medium_injury: 40,
    wrong_hire_high_serious_injury: 100,
    wrong_hire_upgraded_nd_injury: 75,
    non_sag_on_sag_night: 50,
    wrong_gender: 30,
    size_mismatch: 20,
    not_local: 35,
    unfilled_role: 25,
  } as Record<string, number>,

  // -- Injury chances (0-1, higher = more likely to be injured) --
  ndInjuryChance: 0.15,
  mediumInjuryChance: 0.7,
  highInjuryChance: 0.9,
  fakerInjuryChance: 0.95,

  // -- Coffee --
  coffeeDrainPerVisitor: 12,

  // -- Ending thresholds (scaled for low start) --
  endingThresholds: {
    s: { minRep: 40, maxStrikes: 0, minMoney: 200 },
    a: { minRep: 30, maxStrikes: 1 },
    b: { minRep: 20, maxStrikes: 2 },
    c: { minRep: 10 },
    d: { minRep: 0 },
  },
};
