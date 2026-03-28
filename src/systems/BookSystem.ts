// ============================================================
// BookSystem — Manages the stunt performer listing book
// ============================================================

import type {
  BookListing,
  CoordListing,
  Visitor,
  NightConfig,
} from '../types/index';

// Placeholder coordinator data
const EXTRA_COORDINATOR_NAMES = [
  'Big Mike DeLuca', 'Sally Fontaine', 'Dutch Morrison', 'Ray Kaminski',
  'Pepper Washington', 'Lou Bracco', 'Vince Taglia', 'Margie Coolidge',
  'Hal Tremaine', 'Rick Stonewall', 'Frankie Delano', 'Bev Hartwell',
];

const EXTRA_PERFORMER_NAMES = [
  'Mark Sullivan', 'Chris Walden', 'Tammy Rivers', 'Doug Franks',
  'Jesse Cortez', 'Linda Chung', 'Ray Pacheco', 'Angie Mosley',
  'Sam Barrows', 'Kelly Winters', 'Troy Lancaster', 'Diane Kowalski',
];

const CITIES = ['Localville', 'Localville', 'Localville', 'New York', 'Atlanta', 'Vancouver'];

const SKILLS_POOL = [
  'high fall', 'fire gag', 'ratchet pull', 'fight choreography',
  'car hit', 'wire work', 'stair fall', 'explosion reaction',
  'motorcycle', 'sword fight', 'martial arts', 'gymnastics',
];

const CREDIT_POOL = [
  'Die Hard 3', 'Lethal Weapon 4', 'Speed 2', 'Batman Forever',
  'The Rock', 'Twister', 'Mission: Impossible', 'Waterworld',
  'Heat', 'Braveheart', 'GoldenEye', 'Desperado',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function heightString(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

export class BookSystem {
  /**
   * Look up a performer by name in the book.
   */
  lookupPerformer(name: string, book: BookListing[]): BookListing | null {
    const normalized = name.toLowerCase().trim();
    return book.find((entry) => entry.name.toLowerCase().trim() === normalized) ?? null;
  }

  /**
   * Look up a coordinator by name.
   */
  lookupCoordinator(name: string, coordinators: CoordListing[]): CoordListing | null {
    const normalized = name.toLowerCase().trim();
    return coordinators.find((entry) => entry.name.toLowerCase().trim() === normalized) ?? null;
  }

  /**
   * Generate the book listings for a given night.
   * Ensures legit visitors are usually listed, fakers usually aren't.
   * Adds extra entries for flavor. Book is 6-12 months stale.
   */
  generateBookForNight(
    visitors: Visitor[],
    _nightConfig: NightConfig,
  ): { performers: BookListing[]; coordinators: CoordListing[] } {
    const performers: BookListing[] = [];
    const performerNames = new Set<string>();

    // Add visitor-derived listings
    for (const visitor of visitors) {
      if (visitor.isSagRep || visitor.isWigGuy) continue;

      // Legit visitors: ~80% chance of being in the book
      // Fakers: ~10% chance
      const shouldList = visitor.canDoTheJob && visitor.isStuntPerformer
        ? chance(0.8)
        : chance(0.1);

      if (shouldList && !performerNames.has(visitor.name)) {
        performerNames.add(visitor.name);

        // Book is 6-12 months stale — some info may be slightly outdated
        const staleWeight = visitor.bodyType.weight + (chance(0.3) ? randomInt(-5, 5) : 0);
        const staleHeight = visitor.bodyType.height + (chance(0.2) ? randomInt(-1, 1) : 0);

        performers.push({
          name: visitor.name,
          city: visitor.actualCity, // Book shows actual city, not claimed
          height: heightString(staleHeight),
          weight: `${staleWeight}`,
          skills: visitor.resume.skills.slice(0, randomInt(1, visitor.resume.skills.length)),
          coordinatorCredits: visitor.resume.coordinatorRefs
            .filter((r) => r.realCoordinator)
            .map((r) => r.name),
          hasPhoto: chance(0.5),
        });
      }
    }

    // Add flavor entries (extra performers not visiting tonight)
    const extraCount = randomInt(8, 15);
    for (let i = 0; i < extraCount; i++) {
      const name = pick(EXTRA_PERFORMER_NAMES) + (chance(0.3) ? ` ${String.fromCharCode(65 + randomInt(0, 25))}.` : '');
      if (performerNames.has(name)) continue;
      performerNames.add(name);

      performers.push({
        name,
        city: pick(CITIES),
        height: heightString(randomInt(64, 76)),
        weight: `${randomInt(135, 220)}`,
        skills: pickN(SKILLS_POOL, randomInt(2, 5)),
        coordinatorCredits: pickN(EXTRA_COORDINATOR_NAMES, randomInt(0, 2)),
        hasPhoto: chance(0.4),
      });
    }

    // Generate coordinator listings
    const coordinators: CoordListing[] = EXTRA_COORDINATOR_NAMES.map((name) => ({
      name,
      city: pick(CITIES),
      isTraveler: chance(0.2),
      credits: pickN(CREDIT_POOL, randomInt(2, 5)),
    }));

    return { performers, coordinators };
  }
}

export default BookSystem;
