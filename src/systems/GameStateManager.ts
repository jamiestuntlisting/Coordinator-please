// ============================================================
// GameStateManager — Singleton managing the entire GameState
// ============================================================

import type {
  GameState,
  Role,
  ProductionNote,
  KidExpense,
} from '../types/index';
import { BALANCE } from '../config/balance';

class GameStateManager {
  private static instance: GameStateManager;
  private state: GameState;

  private constructor() {
    this.state = this.createInitialState();
  }

  static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  createInitialState(): GameState {
    const emptyNote: ProductionNote = {
      type: 'none',
      description: '',
      flavor: '',
    };

    return {
      night: 1,
      timeOfNight: 18.0,
      reputation: BALANCE.startingReputation,
      strikes: 0,
      money: BALANCE.startingMoney,
      totalBribes: 0,
      dayRate: BALANCE.dayRateBase,
      roles: [],
      currentVisitorIndex: 0,
      currentVisitor: null,
      visitors: [],
      stuntListingBook: [],
      coordinatorListings: [],
      reelPool: [],
      seenReels: new Map<string, string>(),
      rejectedVisitors: [],
      sagRepVisited: false,
      todaysNote: emptyNote,
      ndUpgradeTriggered: false,
      ndUpgradeTarget: null,
      injuryLog: [],
      history: [],
      coffeeLevel: 100,
      wigGuyAppearances: 0,

      // Family expenses (fixed from balance config)
      rent: BALANCE.rent,
      carPayment: BALANCE.carPayment,
      physicalTherapy: BALANCE.physicalTherapy,
      gym: BALANCE.gym,
      pager: BALANCE.pager,
      tonightKidExpense: null,

      // Meta
      gameOver: false,
      fired: false,
      currentPhase: 'evening',
    };
  }

  getCurrentState(): GameState {
    return this.state;
  }

  updateState(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial };
  }

  advanceTime(minutes: number): void {
    const hours = minutes / 60;
    this.state.timeOfNight = Math.min(30, this.state.timeOfNight + hours);
  }

  getTimeOfNightPhase(): 'evening' | 'midnight' | 'late_night' {
    const t = this.state.timeOfNight;
    if (t < 22) return 'evening';
    if (t < 26) return 'midnight';
    return 'late_night';
  }

  isGameOver(): boolean {
    if (this.state.strikes >= BALANCE.maxStrikes) {
      this.state.gameOver = true;
      this.state.fired = true;
      return true;
    }
    if (this.state.night > 7) {
      this.state.gameOver = true;
      return true;
    }
    return this.state.gameOver;
  }

  canAffordSagRep(): boolean {
    return this.state.money >= BALANCE.sagRepCost;
  }

  getUnfilledRoles(): Role[] {
    return this.state.roles.filter((r) => r.filledBy === null);
  }

  getFilledRoles(): Role[] {
    return this.state.roles.filter((r) => r.filledBy !== null);
  }

  reset(): void {
    this.state = this.createInitialState();
  }
}

export default GameStateManager;
