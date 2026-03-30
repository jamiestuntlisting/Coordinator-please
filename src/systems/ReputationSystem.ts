// ============================================================
// ReputationSystem — Manages reputation and ending calculations
// ============================================================

import type {
  GameState,
  HireOutcome,
  EndingTier,
} from '../types/index';
import { BALANCE } from '../config/balance';

export class ReputationSystem {
  /**
   * Apply a hire result and return the rep change and whether a strike occurred.
   */
  applyHireResult(
    outcome: HireOutcome,
    state: GameState,
  ): { repChange: number; strike: boolean } {
    let repChange = 0;
    let strike = false;

    // Check gains
    if (outcome in BALANCE.repGain) {
      repChange = BALANCE.repGain[outcome];
    }

    // Check losses
    if (outcome in BALANCE.repLoss) {
      repChange = BALANCE.repLoss[outcome];
    }

    // Determine if this outcome triggers a strike
    const strikeOutcomes: HireOutcome[] = [
      'wrong_hire_medium_injury',
      'wrong_hire_high_serious_injury',
      'wrong_hire_upgraded_nd_injury',
      'non_sag_on_sag_night',
    ];

    if (strikeOutcomes.includes(outcome)) {
      strike = true;
    }

    // Apply rep change to state (strikes are now handled per-night in ResultsScene)
    state.reputation = Math.max(0, Math.min(100, state.reputation + repChange));

    return { repChange, strike };
  }

  /**
   * Calculate the ending tier based on final game state.
   */
  calculateEndingTier(state: GameState): EndingTier {
    const { reputation, strikes, money } = state;
    const t = BALANCE.endingThresholds;

    if (state.fired) {
      return 'fired';
    }

    if (
      reputation >= t.s.minRep &&
      strikes <= t.s.maxStrikes &&
      money >= t.s.minMoney
    ) {
      return 's';
    }

    if (reputation >= t.a.minRep && strikes <= t.a.maxStrikes) {
      return 'a';
    }

    if (reputation >= t.b.minRep && strikes <= t.b.maxStrikes) {
      return 'b';
    }

    if (reputation >= t.c.minRep) {
      return 'c';
    }

    if (reputation >= t.d.minRep) {
      return 'd';
    }

    return 'fired';
  }

  /**
   * Get the day rate for a given reputation level.
   * Base rate + bonus per reputation tier (every 10 rep points above 50).
   */
  getDayRate(reputation: number): number {
    const tiersAboveBase = Math.max(0, Math.floor((reputation - 50) / 10));
    return BALANCE.dayRateBase + tiersAboveBase * BALANCE.dayRatePerRepTier;
  }

  /**
   * Get a display name for the current reputation tier.
   */
  getRepTier(reputation: number): string {
    if (reputation >= 85) return 'Legendary';
    if (reputation >= 70) return 'Respected';
    if (reputation >= 55) return 'Solid';
    if (reputation >= 40) return 'Average';
    if (reputation >= 25) return 'Shaky';
    if (reputation >= 10) return 'Questionable';
    return 'Blacklisted';
  }
}

export default ReputationSystem;
