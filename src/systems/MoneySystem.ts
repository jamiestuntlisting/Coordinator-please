// ============================================================
// MoneySystem — Manages finances, expenses, and end-of-night
// ============================================================

import type {
  GameState,
  NightResult,
  KidExpense,
} from '../types/index';
import { BALANCE } from '../config/balance';

export class MoneySystem {
  /**
   * Calculate all nightly expenses with a detailed breakdown.
   */
  calculateNightlyExpenses(state: GameState): {
    breakdown: { name: string; cost: number }[];
    total: number;
  } {
    const breakdown: { name: string; cost: number }[] = [
      { name: 'Rent', cost: state.rent },
      { name: 'Car Payment', cost: state.carPayment },
      { name: 'Physical Therapy', cost: state.physicalTherapy },
      { name: 'Gym Membership', cost: state.gym },
      { name: 'Pager Service', cost: state.pager },
    ];

    if (state.tonightKidExpense) {
      breakdown.push({
        name: state.tonightKidExpense.description,
        cost: state.tonightKidExpense.cost,
      });
    }

    const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

    return { breakdown, total };
  }

  /**
   * Process end-of-night: tally hires, injuries, money in/out, and produce NightResult.
   */
  processEndOfNight(state: GameState): NightResult {
    const { breakdown, total: expenses } = this.calculateNightlyExpenses(state);

    // Day rate earned for the night
    const moneyEarned = state.dayRate;

    // SAG rep cost (if visited)
    const sagRepCost = state.sagRepVisited ? BALANCE.sagRepCost : 0;

    // Total spent = expenses + sag rep
    const totalSpent = expenses + sagRepCost;

    // Collect hire results and rejections from this night's visitors
    const hires = state.visitors
      .filter((v) => v.assignedRoleId !== null)
      .map((v) => {
        const role = state.roles.find((r) => r.id === v.assignedRoleId);
        return {
          visitorId: v.id,
          visitorName: v.name,
          roleId: v.assignedRoleId!,
          roleTitle: role?.title ?? 'Unknown',
          outcome: 'correct_right_role' as const, // placeholder — real outcome set by game logic
          repChange: 0,
          wasInjured: false,
          injury: null,
        };
      });

    const rejections = state.visitors
      .filter((v) => v.assignedRoleId === null && !v.isSagRep && !v.isWigGuy)
      .map((v) => ({
        visitorId: v.id,
        visitorName: v.name,
        wasFaker: !v.canDoTheJob || !v.isStuntPerformer,
        wasReturning: v.isReturning,
      }));

    const injuries = state.injuryLog.filter((inj) =>
      state.visitors.some((v) => v.id === inj.visitorId),
    );

    const repChange = hires.reduce((sum, h) => sum + h.repChange, 0);

    // Bribe totals for the night
    const bribesTaken = state.visitors.filter(
      (v) => v.bribeOffer !== null && v.assignedRoleId !== null,
    ).length;
    const bribeMoney = state.visitors
      .filter((v) => v.bribeOffer !== null && v.assignedRoleId !== null)
      .reduce((sum, v) => sum + (v.bribeOffer?.amount ?? 0), 0);

    // Apply money changes
    state.money = state.money + moneyEarned + bribeMoney - totalSpent;

    const result: NightResult = {
      night: state.night,
      hires,
      rejections,
      injuries,
      repChange,
      moneyEarned,
      moneySpent: totalSpent,
      bribesTaken,
      bribeMoney,
      sagRepVisit: state.sagRepVisited,
      sagRepCost,
      ndUpgraded: state.ndUpgradeTriggered,
      kidExpense: state.tonightKidExpense,
    };

    // Record in history
    state.history.push(result);

    return result;
  }

  /**
   * Check if the player can afford the SAG rep cost.
   */
  canAffordSagRep(state: GameState): boolean {
    return state.money >= BALANCE.sagRepCost;
  }

  /**
   * Pay the SAG representative. Returns new money total.
   */
  paySagRep(state: GameState): number {
    state.money -= BALANCE.sagRepCost;
    state.sagRepVisited = true;
    return state.money;
  }

  /**
   * Accept a bribe. Returns new money total.
   */
  acceptBribe(state: GameState, amount: number): number {
    state.money += amount;
    state.totalBribes += amount;
    return state.money;
  }
}

export default MoneySystem;
