// ============================================================
// DocumentChecker — High-level verification helpers
// ============================================================

import type {
  Visitor,
  Role,
  BookListing,
} from '../types/index';

export class DocumentChecker {
  /**
   * Check if the visitor's headshot matches them.
   */
  checkHeadshotMatch(visitor: Visitor): { suspicious: boolean; reason: string } {
    const issues: string[] = [];

    if (!visitor.headshot.matchesFace) {
      issues.push('Face in headshot doesn\'t match the person standing here');
    }

    if (!visitor.headshot.matchesBodyType) {
      issues.push('Body type in headshot is noticeably different');
    }

    if (visitor.headshot.type === 'bw_8x10') {
      issues.push('Black and white headshot — harder to verify, unusual for 1995');
    }

    if (visitor.headshot.type === 'atlanta_comp') {
      issues.push('Atlanta-style comp card — not the LA standard 8x10');
    }

    const suspicious = issues.length > 0;
    return {
      suspicious,
      reason: suspicious ? issues.join('; ') : 'Headshot looks fine',
    };
  }

  /**
   * Check the visitor's SAG status.
   */
  checkSagStatus(
    visitor: Visitor,
    sagRequired: boolean,
  ): { valid: boolean; reason: string } {
    if (!sagRequired) {
      return { valid: true, reason: 'SAG not required for this role' };
    }

    if (!visitor.sagCard) {
      return { valid: false, reason: 'No SAG card presented' };
    }

    if (!visitor.sagCard.present) {
      return { valid: false, reason: 'Claims SAG but can\'t produce the card' };
    }

    if (!visitor.sagCard.valid) {
      return { valid: false, reason: 'SAG card is expired or invalid' };
    }

    if (visitor.sagCard.name.toLowerCase() !== visitor.name.toLowerCase()) {
      return { valid: false, reason: `SAG card name "${visitor.sagCard.name}" doesn't match visitor name "${visitor.name}"` };
    }

    if (visitor.resume.sagStatus === 'expired') {
      return { valid: false, reason: 'Resume lists SAG status as expired' };
    }

    if (visitor.resume.sagStatus === 'claims_yes') {
      return { valid: false, reason: 'Claims SAG membership but status is unverified' };
    }

    return { valid: true, reason: 'SAG card is current and valid' };
  }

  /**
   * Check the visitor's listing in the stunt performer book.
   */
  checkBookListing(
    visitor: Visitor,
    book: BookListing[],
  ): { listed: boolean; matches: boolean; discrepancies: string[] } {
    const normalized = visitor.name.toLowerCase().trim();
    const listing = book.find(
      (entry) => entry.name.toLowerCase().trim() === normalized,
    );

    if (!listing) {
      return { listed: false, matches: false, discrepancies: ['Not found in the book'] };
    }

    const discrepancies: string[] = [];

    // Check city
    if (listing.city.toLowerCase() !== visitor.claimedCity.toLowerCase()) {
      discrepancies.push(
        `Book lists city as "${listing.city}" but visitor claims "${visitor.claimedCity}"`,
      );
    }

    // Check height (parse and compare)
    const bookHeight = listing.height;
    const visitorHeight = visitor.resume.listedHeight;
    if (bookHeight !== visitorHeight) {
      discrepancies.push(
        `Book lists height as ${bookHeight}, resume says ${visitorHeight}`,
      );
    }

    // Check weight
    const bookWeight = parseInt(listing.weight, 10);
    const resumeWeight = parseInt(visitor.resume.listedWeight, 10);
    if (!isNaN(bookWeight) && !isNaN(resumeWeight) && Math.abs(bookWeight - resumeWeight) > 10) {
      discrepancies.push(
        `Book lists weight as ${listing.weight}lbs, resume says ${visitor.resume.listedWeight}lbs`,
      );
    }

    // Check skills overlap
    const bookSkills = new Set(listing.skills.map((s) => s.toLowerCase()));
    const resumeSkills = visitor.resume.skills.map((s) => s.toLowerCase());
    const matchingSkills = resumeSkills.filter((s) => bookSkills.has(s));
    if (matchingSkills.length === 0 && listing.skills.length > 0) {
      discrepancies.push('None of the resume skills match the book listing');
    }

    return {
      listed: true,
      matches: discrepancies.length === 0,
      discrepancies,
    };
  }

  /**
   * Check the visitor's claimed city of origin.
   */
  checkCityOrigin(
    visitor: Visitor,
    localCity: string,
  ): { isLocal: boolean; suspicious: boolean; reason: string } {
    const claimsLocal = visitor.claimedCity.toLowerCase() === localCity.toLowerCase();
    const actuallyLocal = visitor.actualCity.toLowerCase() === localCity.toLowerCase();

    if (claimsLocal && actuallyLocal) {
      return { isLocal: true, suspicious: false, reason: 'Local performer' };
    }

    if (claimsLocal && !actuallyLocal) {
      return {
        isLocal: false,
        suspicious: true,
        reason: `Claims to be from ${localCity} but something seems off`,
      };
    }

    if (!claimsLocal) {
      return {
        isLocal: false,
        suspicious: true,
        reason: `From ${visitor.claimedCity} — not a local performer`,
      };
    }

    return { isLocal: actuallyLocal, suspicious: false, reason: '' };
  }

  /**
   * Check the authenticity of a visitor's stunt reel.
   */
  checkReelAuthenticity(
    visitor: Visitor,
    seenReels: Map<string, string>,
  ): { authentic: boolean; reason: string } {
    if (!visitor.skillReel) {
      return { authentic: true, reason: 'No reel presented' };
    }

    const reel = visitor.skillReel;

    // Check for duplicate
    const existingOwner = seenReels.get(reel.animationId);
    if (existingOwner && existingOwner !== visitor.name) {
      return {
        authentic: false,
        reason: `This reel footage was already shown by ${existingOwner} — likely stolen or shared`,
      };
    }

    // Check name on title card
    if (reel.titleCardName.toLowerCase() !== visitor.name.toLowerCase()) {
      return {
        authentic: false,
        reason: `Title card says "${reel.titleCardName}" but visitor is "${visitor.name}"`,
      };
    }

    // Check body type match
    const heightDiff = Math.abs(reel.bodyType.height - visitor.bodyType.height);
    const weightDiff = Math.abs(reel.bodyType.weight - visitor.bodyType.weight);

    if (heightDiff > 2 || weightDiff > 15) {
      return {
        authentic: false,
        reason: 'Person on the reel has a noticeably different build than the visitor',
      };
    }

    return { authentic: true, reason: 'Reel appears genuine' };
  }

  /**
   * Check if a visitor's height and weight fit a role's requirements.
   */
  checkHeightWeight(
    visitor: Visitor,
    role: Role,
  ): { fits: boolean; reason: string } {
    const h = visitor.bodyType.height;
    const w = visitor.bodyType.weight;
    const [minH, maxH] = role.heightRange;
    const [minW, maxW] = role.weightRange;

    const issues: string[] = [];

    if (h < minH || h > maxH) {
      const feet = Math.floor(h / 12);
      const inches = h % 12;
      issues.push(
        `Height ${feet}'${inches}" is outside the ${Math.floor(minH / 12)}'${minH % 12}" - ${Math.floor(maxH / 12)}'${maxH % 12}" range`,
      );
    }

    if (w < minW || w > maxW) {
      issues.push(`Weight ${w}lbs is outside the ${minW}-${maxW}lb range`);
    }

    if (role.requiredGender !== 'any' && visitor.gender !== role.requiredGender) {
      issues.push(`Role requires ${role.requiredGender}, visitor is ${visitor.gender}`);
    }

    return {
      fits: issues.length === 0,
      reason: issues.length > 0 ? issues.join('; ') : 'Height and weight are within range',
    };
  }

  /**
   * Aggregate all red flags for a visitor against a specific role.
   */
  getRedFlags(
    visitor: Visitor,
    role: Role,
    book: BookListing[],
    seenReels: Map<string, string>,
    localCity: string,
    sagRequired: boolean,
  ): string[] {
    const flags: string[] = [];

    const headshot = this.checkHeadshotMatch(visitor);
    if (headshot.suspicious) flags.push(headshot.reason);

    const sag = this.checkSagStatus(visitor, sagRequired);
    if (!sag.valid) flags.push(sag.reason);

    const bookCheck = this.checkBookListing(visitor, book);
    if (!bookCheck.listed) {
      flags.push('Not listed in the stunt performer book');
    } else if (!bookCheck.matches) {
      bookCheck.discrepancies.forEach((d) => flags.push(d));
    }

    const city = this.checkCityOrigin(visitor, localCity);
    if (city.suspicious) flags.push(city.reason);

    const reel = this.checkReelAuthenticity(visitor, seenReels);
    if (!reel.authentic) flags.push(reel.reason);

    const hw = this.checkHeightWeight(visitor, role);
    if (!hw.fits) flags.push(hw.reason);

    return flags;
  }
}

export default DocumentChecker;
