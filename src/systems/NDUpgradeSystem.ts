// ============================================================
// NDUpgradeSystem — Handles ND role upgrades mid-shift
// ============================================================

import type {
  NightConfig,
  Role,
} from '../types/index';

export class NDUpgradeSystem {
  /**
   * Roll against the night's ND upgrade chance to determine if an upgrade triggers.
   */
  shouldTriggerUpgrade(nightConfig: NightConfig): boolean {
    return Math.random() < nightConfig.ndUpgradeChance;
  }

  /**
   * Find an ND role that can be upgraded. Returns the first unfilled ND role,
   * or a filled one if no unfilled ones exist.
   */
  findNDRole(roles: Role[]): Role | null {
    // Prefer unfilled ND roles
    const unfilledND = roles.find(
      (r) => r.riskLevel === 'nd' && !r.wasUpgraded && r.filledBy === null,
    );
    if (unfilledND) return unfilledND;

    // Fall back to any ND role not yet upgraded
    const anyND = roles.find(
      (r) => r.riskLevel === 'nd' && !r.wasUpgraded,
    );
    return anyND ?? null;
  }

  /**
   * Upgrade an ND role to high or medium risk.
   * Returns the modified role with wasUpgraded=true.
   */
  upgradeRole(role: Role): Role {
    // 40% chance of upgrading to high, 60% to medium
    const newRisk = Math.random() < 0.4 ? 'high' : 'medium';

    return {
      ...role,
      riskLevel: newRisk,
      wasUpgraded: true,
    };
  }

  /**
   * Return a description of what happened with the upgrade for display.
   */
  assessUpgradeRisk(role: Role): string {
    if (!role.wasUpgraded) {
      return 'No upgrade occurred.';
    }

    const riskDescriptions: Record<string, string> = {
      high: `"${role.title}" just got upgraded from ND to HIGH risk. `
        + 'The director wants a real stunt now — whoever you put in that spot '
        + 'better know what they\'re doing or someone\'s getting hurt.',
      medium: `"${role.title}" just got bumped from ND to MEDIUM risk. `
        + 'They added some action to the scene. Your ND performer '
        + 'now needs to handle a real stunt.',
    };

    return riskDescriptions[role.riskLevel] ?? 'Role was upgraded.';
  }
}

export default NDUpgradeSystem;
