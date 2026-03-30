// ============================================================
// ReelSystem — Manages stunt reel verification and tracking
// ============================================================

import type {
  ReelAnimation,
  SkillReel,
  Visitor,
} from '../types/index';

/**
 * The 8 shared animation types that all stunt reels draw from.
 */
export const REEL_ANIMATIONS: ReelAnimation[] = [
  {
    id: 'anim_1',
    stuntType: 'high fall',
    description: 'Three-story fall onto airbag, full body extension with quarter twist.',
    bodyType: { height: 70, weight: 175, build: 'athletic' },
  },
  {
    id: 'anim_2',
    stuntType: 'car hit',
    description: 'Pedestrian hit by sedan at 25mph, roll over hood into controlled landing.',
    bodyType: { height: 68, weight: 165, build: 'average' },
  },
  {
    id: 'anim_3',
    stuntType: 'fight combo',
    description: 'Eight-hit fight sequence with chair breakaway and table flip.',
    bodyType: { height: 72, weight: 185, build: 'athletic' },
  },
  {
    id: 'anim_4',
    stuntType: 'fire gag',
    description: 'Full body burn, fifteen-second duration, running exit through doorway.',
    bodyType: { height: 69, weight: 170, build: 'average' },
  },
  {
    id: 'anim_5',
    stuntType: 'ratchet pull',
    description: 'Shotgun-hit ratchet, backward launch six feet into breakaway shelving.',
    bodyType: { height: 71, weight: 180, build: 'athletic' },
  },
  {
    id: 'anim_6',
    stuntType: 'wire work',
    description: 'Dual-wire suspension, spinning kick sequence with controlled descent.',
    bodyType: { height: 67, weight: 155, build: 'slim' },
  },
  {
    id: 'anim_7',
    stuntType: 'stair fall',
    description: 'Twenty-step stair fall, alternating impacts, dead stop at landing.',
    bodyType: { height: 70, weight: 175, build: 'athletic' },
  },
  {
    id: 'anim_8',
    stuntType: 'explosion reaction',
    description: 'Pyro mortar launch, eight-foot air, face-first landing onto pads.',
    bodyType: { height: 69, weight: 170, build: 'average' },
  },
  {
    id: 'anim_9',
    stuntType: 'fire run',
    description: 'Full body burn running forty feet through alley, dive through window.',
    bodyType: { height: 70, weight: 175, build: 'athletic' },
  },
  {
    id: 'anim_10',
    stuntType: 'fight_and_fall',
    description: 'Rooftop fight sequence ending in three-story backward fall.',
    bodyType: { height: 71, weight: 180, build: 'athletic' },
  },
  {
    id: 'anim_11',
    stuntType: 'motorcycle',
    description: 'Motorcycle slide at 35mph into controlled low-side, roll to feet.',
    bodyType: { height: 69, weight: 170, build: 'average' },
  },
  {
    id: 'anim_12',
    stuntType: 'acting',
    description: 'Dramatic close-up reaction take, emotional range showcase.',
    bodyType: { height: 68, weight: 165, build: 'average' },
  },
];

export class ReelSystem {
  /**
   * Check if a reel's animation has been seen before (duplicate/stolen reel).
   * Returns whether it's a duplicate and who originally showed it.
   */
  checkForDuplicate(
    reel: SkillReel,
    seenReels: Map<string, string>,
    currentVisitorName: string,
  ): { isDuplicate: boolean; originalOwner: string | null } {
    const existing = seenReels.get(reel.animationId);
    if (existing && existing !== currentVisitorName) {
      // Only a duplicate if a DIFFERENT visitor showed this same reel
      return { isDuplicate: true, originalOwner: existing };
    }
    return { isDuplicate: false, originalOwner: null };
  }

  /**
   * Check if the body type on the reel mismatches the visitor standing in front of you.
   * Allows a tolerance of +/- 2 inches height and +/- 15 lbs weight.
   */
  checkBodyTypeMismatch(reel: SkillReel, visitor: Visitor): boolean {
    const heightDiff = Math.abs(reel.bodyType.height - visitor.bodyType.height);
    const weightDiff = Math.abs(reel.bodyType.weight - visitor.bodyType.weight);

    // Mismatch if the person on the reel is clearly a different size
    return heightDiff > 2 || weightDiff > 15;
  }

  /**
   * Record a reel as seen, associating its animation with the visitor who showed it.
   */
  recordReel(
    reel: SkillReel,
    visitorName: string,
    seenReels: Map<string, string>,
  ): void {
    seenReels.set(reel.animationId, visitorName);
  }
}

export default ReelSystem;
