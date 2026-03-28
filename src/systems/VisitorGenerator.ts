// ============================================================
// VisitorGenerator — Generates visitors for each night
// ============================================================

import type {
  Visitor,
  NightConfig,
  GameState,
  Gender,
  BodyType,
  PersonalityType,
  Headshot,
  HeadshotType,
  Resume,
  SagCard,
  SagStatus,
  SkillReel,
  BribeOffer,
  CoordRef,
  BookListing,
} from '../types/index';

// Placeholder data imports — these files will be created by another agent
// import { FIRST_NAMES_MALE, FIRST_NAMES_FEMALE, LAST_NAMES } from '../data/names';
// import { SKILLS_LIST } from '../data/skills';
// import { CREDITS_LIST } from '../data/credits';
// import { COORDINATOR_NAMES } from '../data/coordinators';
// import { DIALOGUE_TEMPLATES } from '../data/dialogues';

// ---- Inline placeholder data until data files are created ----

const FIRST_NAMES_MALE = [
  'Mike', 'Dave', 'Tony', 'Rick', 'Steve', 'Bobby', 'Frank', 'Jimmy',
  'Ray', 'Eddie', 'Gary', 'Tom', 'Phil', 'Danny', 'Joe', 'Vinnie',
  'Chuck', 'Hank', 'Al', 'Lou', 'Kurt', 'Bud', 'Mack', 'Cliff',
];

const FIRST_NAMES_FEMALE = [
  'Lisa', 'Donna', 'Karen', 'Susan', 'Brenda', 'Jackie', 'Maria', 'Terri',
  'Angela', 'Cindy', 'Pam', 'Debbie', 'Sandy', 'Vicki', 'Wendy', 'Jill',
  'Tina', 'Crystal', 'Heather', 'Stacy', 'Kim', 'Tracy', 'Lori', 'Beth',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Martinez', 'Thompson', 'Garcia', 'Rodriguez',
  'Lee', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Lopez', 'Hill',
  'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell',
  'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans',
];

const SKILLS_LIST = [
  'high fall', 'fire gag', 'ratchet pull', 'fight choreography',
  'car hit', 'wire work', 'stair fall', 'explosion reaction',
  'motorcycle', 'sword fight', 'martial arts', 'gymnastics',
  'trampolining', 'precision driving', 'rappelling', 'swimming',
];

const CREDITS_LIST = [
  'Die Hard 3 (1995)', 'Lethal Weapon 3 (1992)', 'Speed (1994)', 'Batman Forever (1995)',
  'Broken Arrow (1995)', 'The Rock (1995)', 'Twister (1994)', 'Mission: Impossible (1995)',
  'Waterworld (1995)', 'Heat (1995)', 'Crimson Tide (1994)', 'Braveheart (1993)',
  'GoldenEye (1995)', 'Apollo 13 (1994)', 'Desperado (1995)', 'Under Siege 2 (1995)',
  'Mortal Kombat (1993)', 'Judge Dredd (1993)', 'Cliffhanger (1993)', 'Outbreak (1994)',
  'Total Recall (1990)', 'Die Hard 2 (1990)', 'Terminator 2 (1991)', 'The Fugitive (1993)',
  'Point Break (1991)', 'Last Action Hero (1993)', 'Demolition Man (1993)', 'Hard Target (1993)',
];

const COORDINATOR_NAMES = [
  'Big Mike DeLuca', 'Sally Fontaine', 'Dutch Morrison', 'Ray Kaminski',
  'Pepper Washington', 'Lou Bracco', 'Vince Taglia', 'Margie Coolidge',
  'Hal Tremaine', 'Rick Stonewall',
];

const LOCAL_CITY = 'Localville';
const FAKER_CITIES = ['Atlanta', 'Vancouver', 'New York', 'Miami', 'Chicago'];

const HOW_HEARD_OPTIONS = [
  'Got the call from my coordinator',
  'Saw it on the board at the SAG office',
  'Heard about it at the gym',
  'Another performer told me about it',
  'My agent set it up',
  'Read about it in Back Stage West',
];

const HOW_HEARD_FAKER = [
  'A buddy of mine told me to come down',
  'Heard you guys were hiring',
  'Somebody at the bar said they needed people',
  'My cousin works in the production office',
];

const INSURANCE_TALK_LEGIT = [
  'I carry $1M coverage through Fireman\'s Fund, qualifier is current through June.',
  'Full coverage, $2M umbrella, qualifier up to date — did it last month.',
  'Insured through Lloyds, $1.5M — qualifier renewed in January.',
  'My qualifier was done at Rick Barker\'s place, coverage is $1M with Hartford.',
];

const BRIBE_DIALOGUES = [
  'Look, I really need this gig. Here\'s a little something for your trouble.',
  'How about I make it worth your while? Just between us.',
  'I got some cash — you don\'t have to look at my book listing so close.',
  'What if I slipped you something? Nobody has to know.',
  'Come on, help a guy out. I can make it worth your time.',
];

// ---- Utility functions ----

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

let visitorIdCounter = 0;
function nextId(): string {
  visitorIdCounter++;
  return `visitor_${visitorIdCounter}`;
}

// ---- Generator class ----

export class VisitorGenerator {
  /**
   * Generate all visitors for a given night.
   */
  generateVisitorsForNight(nightConfig: NightConfig, state: GameState): Visitor[] {
    const visitors: Visitor[] = [];
    const legitChance = this.getLegitChance(nightConfig.night);

    for (let i = 0; i < nightConfig.visitorCount; i++) {
      const isLegit = chance(legitChance);
      const gender: Gender = chance(0.5) ? 'male' : 'female';
      const visitor = isLegit
        ? this.generateLegitVisitor(gender, nightConfig, state)
        : this.generateFakerVisitor(gender, nightConfig, state);
      visitors.push(visitor);
    }

    // Possibly add wig guy
    if (nightConfig.wigGuyAppears) {
      visitors.splice(randomInt(1, Math.max(1, visitors.length - 1)), 0, this.generateWigGuy(nightConfig.night));
    }

    // Possibly add SAG rep
    if (chance(nightConfig.sagRepChance)) {
      visitors.push(this.generateSagRep());
    }

    // Possibly add returning visitor
    if (chance(nightConfig.returningVisitorChance) && state.rejectedVisitors.length > 0) {
      // Find a previous visitor from history to base it on — for now generate a fresh "returning" one
      const returningGender: Gender = chance(0.5) ? 'male' : 'female';
      const originalFaker = this.generateFakerVisitor(returningGender, nightConfig, state);
      const returning = this.generateReturningVisitor(originalFaker);
      visitors.splice(randomInt(0, visitors.length), 0, returning);
    }

    return visitors;
  }

  /**
   * Legit chance: ~60% Night 1, decreasing to ~40% by Night 7.
   */
  private getLegitChance(night: number): number {
    return 0.6 - ((night - 1) / 6) * 0.2;
  }

  /**
   * Generate a legitimate stunt performer.
   */
  private generateLegitVisitor(gender: Gender, nightConfig: NightConfig, _state: GameState): Visitor {
    const name = this.generateName(gender);
    const body = this.generateBodyType();
    const personality = this.pickPersonality();
    const skills = pickN(SKILLS_LIST, randomInt(3, 6));

    const headshotType: HeadshotType = chance(0.85) ? 'color_8x10' : 'bw_8x10';
    const headshot: Headshot = {
      type: headshotType,
      matchesFace: true,
      matchesBodyType: true,
    };

    const sagCard: SagCard = {
      present: true,
      valid: true,
      name: name,
    };

    const resume: Resume = {
      skills,
      credits: pickN(CREDITS_LIST, randomInt(3, 6)),
      coordinatorRefs: this.generateCoordRefs(true),
      sagStatus: 'current',
      listedHeight: this.heightToString(body.height),
      listedWeight: `${body.weight}`,
    };

    const reel: SkillReel | null = chance(0.7) ? {
      animationId: `anim_${randomInt(1, 8)}`,
      titleCardName: name,
      bodyType: { ...body },
    } : null;

    const bribeOffer = this.maybeBribe(nightConfig) ;

    const howHeard = pick(HOW_HEARD_OPTIONS);

    const bookListing: BookListing | null = chance(0.8) ? {
      name,
      city: LOCAL_CITY,
      height: resume.listedHeight,
      weight: resume.listedWeight,
      skills: skills.slice(0, randomInt(2, skills.length)),
      coordinatorCredits: resume.coordinatorRefs.filter(r => r.realCoordinator).map(r => r.name),
      hasPhoto: chance(0.6),
    } : null;

    const insuranceTalk = chance(0.5) ? pick(INSURANCE_TALK_LEGIT) : null;

    const dialogueResponses = this.generateDialogueResponses(true, personality, name);

    return {
      id: nextId(),
      name,
      canDoTheJob: true,
      isStuntPerformer: true,
      claimedCity: LOCAL_CITY,
      actualCity: LOCAL_CITY,
      isLocal: true,
      howTheyHeard: howHeard,
      howTheyHeardLegit: true,
      gender,
      bodyType: body,
      headshot,
      resume,
      sagCard,
      bookListing,
      skillReel: reel,
      personality,
      insuranceTalk,
      bribeOffer,
      dialogueResponses,
      hasNewerHeadshot: false,
      isReturning: false,
      originalVisitorId: null,
      isSagRep: false,
      isWigGuy: false,
      isProductionOverride: false,
      assignedRoleId: null,
    };
  }

  /**
   * Generate a faker visitor. Randomly picks a faker type.
   */
  private generateFakerVisitor(gender: Gender, nightConfig: NightConfig, _state: GameState): Visitor {
    const fakerType = pick([
      'wrong_city', 'stolen_reel', 'not_in_book', 'expired_sag', 'borrowed_headshot', 'close_faker',
    ]);

    const name = this.generateName(gender);
    const body = this.generateBodyType();
    const personality = this.pickPersonality();
    const skills = pickN(SKILLS_LIST, randomInt(1, 4));

    // Defaults that fakers adjust
    let claimedCity = LOCAL_CITY;
    let actualCity = LOCAL_CITY;
    let isLocal = true;
    let headshotType: HeadshotType = 'color_8x10';
    let matchesFace = true;
    let matchesBodyType = true;
    let sagStatus: SagStatus = 'current';
    let sagCardValid = true;
    let sagCardPresent = true;
    let sagCardName = name;
    let inBook = chance(0.1);
    let canDoJob = false;
    let isStuntPerformer = false;
    let howHeard = pick(HOW_HEARD_FAKER);
    let howHeardLegit = false;
    let reelBodyMatch = true;
    let reelName = name;

    switch (fakerType) {
      case 'wrong_city':
        actualCity = pick(FAKER_CITIES);
        claimedCity = LOCAL_CITY; // they claim local
        isLocal = false;
        headshotType = chance(0.5) ? 'atlanta_comp' : 'color_8x10';
        break;

      case 'stolen_reel':
        // Reel has different person's body type and name
        reelBodyMatch = false;
        reelName = this.generateName(gender);
        break;

      case 'not_in_book':
        inBook = false;
        // They can't explain why they aren't listed
        break;

      case 'expired_sag':
        sagStatus = 'expired';
        sagCardValid = false;
        break;

      case 'borrowed_headshot':
        headshotType = 'bw_8x10';
        matchesFace = false;
        matchesBodyType = chance(0.3);
        break;

      case 'close_faker':
        // Close fakers have SOME legit elements but key things don't match
        isStuntPerformer = true;
        canDoJob = false; // skill mismatch
        headshotType = chance(0.6) ? 'color_8x10' : 'bw_8x10';
        matchesFace = true;
        sagStatus = chance(0.5) ? 'current' : 'claims_yes';
        sagCardValid = sagStatus === 'current';
        howHeard = pick(HOW_HEARD_OPTIONS);
        howHeardLegit = chance(0.5);
        inBook = chance(0.3);
        break;
    }

    const headshot: Headshot = {
      type: headshotType,
      matchesFace,
      matchesBodyType,
    };

    const sagCard: SagCard | null = sagCardPresent ? {
      present: sagCardPresent,
      valid: sagCardValid,
      name: sagCardName,
    } : null;

    const resume: Resume = {
      skills,
      credits: pickN(CREDITS_LIST, randomInt(1, 4)),
      coordinatorRefs: this.generateCoordRefs(false),
      sagStatus,
      listedHeight: this.heightToString(body.height + (chance(0.3) ? randomInt(-2, 2) : 0)),
      listedWeight: `${body.weight + (chance(0.3) ? randomInt(-10, 10) : 0)}`,
    };

    const differentBody: BodyType = reelBodyMatch ? { ...body } : this.generateBodyType();
    const reel: SkillReel | null = chance(0.6) ? {
      animationId: `anim_${randomInt(1, 8)}`,
      titleCardName: reelName,
      bodyType: differentBody,
    } : null;

    const bribeOffer = this.maybeBribe(nightConfig);

    const bookListing: BookListing | null = inBook ? {
      name,
      city: actualCity, // book shows real city
      height: this.heightToString(body.height),
      weight: `${body.weight}`,
      skills: skills.slice(0, randomInt(1, skills.length)),
      coordinatorCredits: [],
      hasPhoto: chance(0.3),
    } : null;

    const dialogueResponses = this.generateDialogueResponses(false, personality, name);

    return {
      id: nextId(),
      name,
      canDoTheJob: canDoJob,
      isStuntPerformer,
      claimedCity,
      actualCity,
      isLocal,
      howTheyHeard: howHeard,
      howTheyHeardLegit: howHeardLegit,
      gender,
      bodyType: body,
      headshot,
      resume,
      sagCard,
      bookListing,
      skillReel: reel,
      personality,
      insuranceTalk: null,
      bribeOffer,
      dialogueResponses,
      hasNewerHeadshot: false,
      isReturning: false,
      originalVisitorId: null,
      isSagRep: false,
      isWigGuy: false,
      isProductionOverride: false,
      assignedRoleId: null,
    };
  }

  /**
   * Generate the recurring wig guy character.
   */
  generateWigGuy(night: number): Visitor {
    const body = this.generateBodyType();

    const wigDialogue: Record<string, string> = {
      greeting: `Hey. *adjusts obviously crooked wig* I'm here for the gig. Night ${night}, baby!`,
      tell_me_about_experience: '*wig slides to one side* Oh yeah, tons of experience. Wigs, stunts, you name it.',
      what_do_you_want: 'I got wigs! You need wigs? Every stunt needs a good wig!',
      no_thanks: 'You sure? I got a beautiful piece — real horsehair. Stallone wore one just like it.',
      who_are_you: '*pushes wig back into place* I\'m the wig guy! Everybody knows the wig guy!',
      go_away: 'Alright, alright. *wig falls forward over eyes* But you know where to find me!',
      where_are_you_from: '*straightens wig nervously* I\'m from right here! Born and raised... probably.',
      are_you_sag: '*wig tilts sideways* SAG? I\'m in the... wig guild. Same thing.',
      about_your_reel: '*wig nearly falls off* My reel? It\'s... being remastered. Lots of wig work on there.',
    };

    return {
      id: nextId(),
      name: 'Wig Guy',
      canDoTheJob: false,
      isStuntPerformer: false,
      claimedCity: LOCAL_CITY,
      actualCity: LOCAL_CITY,
      isLocal: true,
      howTheyHeard: 'I\'m always here!',
      howTheyHeardLegit: false,
      gender: 'male',
      bodyType: body,
      headshot: { type: 'bw_8x10', matchesFace: false, matchesBodyType: false },
      resume: {
        skills: ['wig fitting', 'wig styling', 'wig maintenance'],
        credits: ['Wig Guy at various sets since 1983'],
        coordinatorRefs: [],
        sagStatus: 'none',
        listedHeight: '5\'9"',
        listedWeight: '165',
      },
      sagCard: null,
      bookListing: null,
      skillReel: null,
      personality: 'aggressive',
      insuranceTalk: null,
      bribeOffer: null,
      dialogueResponses: wigDialogue,
      hasNewerHeadshot: false,
      isReturning: false,
      originalVisitorId: null,
      isSagRep: false,
      isWigGuy: true,
      isProductionOverride: false,
      assignedRoleId: null,
    };
  }

  /**
   * Generate a SAG representative visitor.
   */
  generateSagRep(): Visitor {
    const body: BodyType = { height: 68, weight: 160, build: 'average' };

    const sagDialogue: Record<string, string> = {
      greeting: 'Good evening. I\'m from the Screen Actors Guild. We need to discuss some matters.',
      what_matters: 'There have been reports of non-union performers on SAG sets. We take this very seriously.',
      pay_fine: 'A contribution to the safety fund would go a long way toward resolving any... concerns.',
      refuse: 'That\'s your choice. But we\'ll be watching very closely from now on.',
      cooperate: 'Smart move. We appreciate coordinators who work with us.',
    };

    return {
      id: nextId(),
      name: 'SAG Representative',
      canDoTheJob: false,
      isStuntPerformer: false,
      claimedCity: LOCAL_CITY,
      actualCity: LOCAL_CITY,
      isLocal: true,
      howTheyHeard: 'Official SAG business',
      howTheyHeardLegit: true,
      gender: 'male',
      bodyType: body,
      headshot: { type: 'color_8x10', matchesFace: true, matchesBodyType: true },
      resume: {
        skills: [],
        credits: [],
        coordinatorRefs: [],
        sagStatus: 'current',
        listedHeight: '5\'8"',
        listedWeight: '160',
      },
      sagCard: { present: true, valid: true, name: 'SAG Representative' },
      bookListing: null,
      skillReel: null,
      personality: 'confident',
      insuranceTalk: null,
      bribeOffer: null,
      dialogueResponses: sagDialogue,
      hasNewerHeadshot: false,
      isReturning: false,
      originalVisitorId: null,
      isSagRep: true,
      isWigGuy: false,
      isProductionOverride: false,
      assignedRoleId: null,
    };
  }

  /**
   * Generate a returning visitor — changed appearance, similar details.
   */
  generateReturningVisitor(original: Visitor): Visitor {
    const newName = this.generateName(original.gender);
    const body: BodyType = {
      ...original.bodyType,
      weight: original.bodyType.weight + randomInt(-5, 5),
    };

    // Slightly modified headshot
    const headshot: Headshot = {
      type: chance(0.5) ? 'color_8x10' : 'bw_8x10',
      matchesFace: chance(0.4),
      matchesBodyType: chance(0.5),
    };

    // Similar skills and credits to the original
    const resume: Resume = {
      ...original.resume,
      listedHeight: this.heightToString(body.height),
      listedWeight: `${body.weight}`,
    };

    const dialogueResponses = this.generateDialogueResponses(false, original.personality, newName);
    // Add a tell — they reference the same coordinator or have similar phrasing
    dialogueResponses['how_did_you_hear'] = original.dialogueResponses['how_did_you_hear'] || pick(HOW_HEARD_FAKER);

    return {
      ...original,
      id: nextId(),
      name: newName,
      headshot,
      bodyType: body,
      resume,
      dialogueResponses,
      isReturning: true,
      originalVisitorId: original.id,
      hasNewerHeadshot: true,
    };
  }

  // ---- Helpers ----

  generateName(gender: Gender): string {
    const resolvedGender = gender === 'any' ? (chance(0.5) ? 'male' : 'female') : gender;
    const first = resolvedGender === 'male' ? pick(FIRST_NAMES_MALE) : pick(FIRST_NAMES_FEMALE);
    const last = pick(LAST_NAMES);
    return `${first} ${last}`;
  }

  generateBodyType(): BodyType {
    const builds: BodyType['build'][] = ['slim', 'average', 'athletic', 'heavy'];
    const build = pick(builds);

    let height: number;
    let weight: number;

    switch (build) {
      case 'slim':
        height = randomInt(64, 72);
        weight = randomInt(130, 160);
        break;
      case 'average':
        height = randomInt(66, 74);
        weight = randomInt(155, 185);
        break;
      case 'athletic':
        height = randomInt(67, 75);
        weight = randomInt(165, 200);
        break;
      case 'heavy':
        height = randomInt(66, 74);
        weight = randomInt(195, 240);
        break;
    }

    return { height, weight, build };
  }

  pickPersonality(): PersonalityType {
    const types: PersonalityType[] = ['confident', 'nervous', 'aggressive', 'smooth', 'desperate', 'quiet'];
    return pick(types);
  }

  private generateCoordRefs(legit: boolean): CoordRef[] {
    const count = randomInt(1, 3);
    const refs: CoordRef[] = [];

    for (let i = 0; i < count; i++) {
      if (legit) {
        refs.push({
          name: pick(COORDINATOR_NAMES),
          realCoordinator: true,
          city: LOCAL_CITY,
        });
      } else {
        const isReal = chance(0.3);
        refs.push({
          name: isReal ? pick(COORDINATOR_NAMES) : this.generateName(chance(0.5) ? 'male' : 'female'),
          realCoordinator: isReal,
          city: isReal ? LOCAL_CITY : pick([...FAKER_CITIES, LOCAL_CITY]),
        });
      }
    }

    return refs;
  }

  private heightToString(inches: number): string {
    const feet = Math.floor(inches / 12);
    const remaining = inches % 12;
    return `${feet}'${remaining}"`;
  }

  private maybeBribe(nightConfig: NightConfig): BribeOffer | null {
    if (!chance(0.4)) return null;
    const [min, max] = nightConfig.bribeRange;
    if (max < 5) return null; // no bribes if range is too low
    const amount = randomInt(Math.max(5, min), max);
    return {
      amount,
      dialogue: pick(BRIBE_DIALOGUES),
    };
  }

  private generateDialogueResponses(
    isLegit: boolean,
    personality: PersonalityType,
    name: string,
  ): Record<string, string> {
    const responses: Record<string, string> = {};

    // Greeting
    const greetings: Record<PersonalityType, string[]> = {
      confident: [`Hey there. ${name}. I'm here for the gig.`, `Evening. Name's ${name}. Let's get to work.`],
      nervous: [`H-hi. I'm ${name}. Am I in the right place?`, `Um, ${name}. They told me to come here.`],
      aggressive: [`${name}. Look, I don't have all night.`, `Yeah, I'm ${name}. Let's move this along.`],
      smooth: [`Good evening. ${name}, at your service.`, `The name's ${name}. Pleasure to meet you.`],
      desperate: [`Please, I'm ${name}. I really need this.`, `${name}. Look, I'll do anything you need.`],
      quiet: [`${name}.`, `Hi. ${name}. ...`],
    };
    responses['greeting'] = pick(greetings[personality]);

    // How did you hear about this
    if (isLegit) {
      responses['how_did_you_hear'] = pick(HOW_HEARD_OPTIONS);
    } else {
      responses['how_did_you_hear'] = pick(HOW_HEARD_FAKER);
    }

    // Experience question
    if (isLegit) {
      responses['tell_me_about_experience'] = pick([
        'Been doing this fifteen years. Started as a utility, worked my way up.',
        'I\'ve doubled for a couple leads — nothing huge, but I know what I\'m doing.',
        'My coordinator can vouch for me. I work clean, no problems.',
        'Twenty years in the business. I started when falls paid fifty bucks and a handshake.',
        'I was Bobby Barton\'s regular double for three years. He\'ll tell you himself.',
        'I specialize in fire gags. Nobody does them cleaner.',
        'Last month I did a 60-foot fall off a building for a Paramount picture. No pads, just boxes.',
      ]);
      responses['tell_me_about_experience_2'] = pick([
        'I doubled for a lead on that one Universal picture. Three weeks, no complaints. The coordinator brought me back for the sequel.',
        'Did a whole season on a TV show — car hits, ratchet pulls, the works. Ask anyone on that crew, they\'ll tell you I\'m solid.',
        'Last year I did six features back to back. Every one wrapped without a single safety incident on my watch.',
      ]);
      responses['tell_me_about_experience_3'] = pick([
        `Look, call ${pick(COORDINATOR_NAMES)}. They'll tell you I show up on time, know my marks, and I don't complain. That's all you need to know.`,
        'I\'ve been at this since before half these kids were born. This isn\'t a hobby for me — it\'s my life. I take it seriously.',
        'You want references? I\'ve got a stack of coordinators who\'ll vouch for me. I don\'t need to prove anything, but I will.',
      ]);
    } else {
      responses['tell_me_about_experience'] = pick([
        'Oh yeah, I\'ve done tons of stuff. You know, the usual.',
        'I did some extra work on a few shows. Same thing, right?',
        'I\'m a quick learner. How hard can it be?',
        'I did some background work on a commercial. Stunt work is basically the same, right?',
        'My friend is a stunt guy and he showed me some stuff. I pick things up fast.',
        'I\'ve been training at the gym for this. I\'m in great shape.',
        'I watched every Jackie Chan movie twice. I know what I\'m doing.',
      ]);
      responses['tell_me_about_experience_2'] = pick([
        'Well, I mean... I\'ve watched a LOT of behind-the-scenes stuff. I know how it works. I\'ve studied every Jackie Chan movie twice.',
        'My roommate does stunts. He\'s shown me a bunch of stuff. I feel like I basically already know it all.',
        'I took a stage combat class once at a community college. The teacher said I was a natural.',
      ]);
      responses['tell_me_about_experience_3'] = pick([
        '*shifts nervously* Can we talk about something else? I\'m better in person than on paper, you know?',
        'Look, everyone starts somewhere, right? Just give me a shot. You won\'t regret it. Probably.',
        '*getting defensive* Why do you keep asking about experience? Some of the best people in this business started with nothing.',
      ]);
    }

    // SAG question
    if (isLegit) {
      responses['are_you_sag'] = pick([
        'Yeah, of course. Card\'s right here.',
        'Current. Joined in \'88. Never let it lapse.',
        'Yeah, SAG since before you were coordinating. Card\'s in my wallet.',
        'Full member. Pension and everything.',
      ]);
      responses['are_you_sag_2'] = pick([
        'Been current since \'89. Never lapsed. I take my membership seriously. It\'s the first bill I pay every month.',
        'Joined up right after my first feature. Haven\'t missed a payment in over a decade. This is my career.',
        'Full member, current dues, no issues. I can give you my membership number right now if you want to call it in.',
      ]);
      responses['are_you_sag_3'] = pick([
        'You can call the office right now if you want. I\'ve got nothing to hide. Everything\'s on the level.',
        'Look, I know there are people out there faking it. I\'m not one of them. My card is real, my dues are paid, end of story.',
        'I take this union seriously. It\'s the only thing standing between us and getting killed for minimum wage. Of course I\'m current.',
      ]);
    } else {
      responses['are_you_sag'] = pick([
        'I\'m... in the process. You know how it is.',
        'Yeah, sure. I think I left my card at home though.',
        'SAG? Uh, yeah. Definitely.',
        'My application is pending.',
        'I\'m must-join. This would be my Taft-Hartley.',
        'My agent is handling all that. He said it\'s fine.',
        'Do I need SAG for this? I thought it was non-union tonight.',
      ]);
      responses['are_you_sag_2'] = pick([
        'I said I\'m SAG. Why do you keep asking? It\'s not like I carry it everywhere. Who does that?',
        'My agent is handling all that paperwork. I\'m sure it\'s fine. It should be processed by now.',
        'I mean, I\'ve been meaning to get that sorted out. It\'s basically done though. Practically.',
      ]);
      responses['are_you_sag_3'] = pick([
        '*getting agitated* Look, do you want me to work or not? I can do the job. That\'s what matters, right?',
        '*voice rising* This is starting to feel like an interrogation. I told you my situation. Take it or leave it.',
        '*looks away* Fine, maybe it\'s not totally finalized. But I know people who work non-union all the time. It\'s not a big deal.',
      ]);
    }

    // City question
    if (isLegit) {
      responses['where_are_you_from'] = pick([
        'Born and raised here. Localville all the way.',
        'Right here. Grew up ten minutes from this lot.',
        'Localville born and raised. My dad worked grip on westerns.',
        'Been here my whole life. I know every coordinator in town.',
      ]);
      responses['where_are_you_from_2'] = pick([
        'Born right here in Localville. I know every lot in this town. Grew up watching them film on my block.',
        'Grew up right here, been working sets since I could drive. Never left.',
        'Third generation local. My dad was a grip on this very lot. This town is in my blood.',
      ]);
      responses['where_are_you_from_3'] = pick([
        'My family\'s been here since the \'60s. This is home. I\'m not going anywhere. This city made me who I am.',
        'I know every back road to every studio in this town. You can\'t fake that kind of local knowledge. I belong here.',
        'Localville born, Localville raised, Localville \'til they put me in the ground. Ask me about any neighborhood and I\'ll tell you which shows shot there.',
      ]);
    } else {
      responses['where_are_you_from'] = pick([
        'Here. Yeah. Totally. Love it here.',
        'I\'ve been here a while now. Originally from... around.',
        'Oh, I\'m local. For sure.',
        'I just moved here from... the next town over.',
        'I\'m staying with a buddy. He\'s local.',
        'Does it matter where I\'m from? I\'m here now.',
      ]);
      responses['where_are_you_from_2'] = pick([
        'I told you, I\'m from here. Why does it matter? I live here now, that\'s what counts.',
        'I\'ve been in Localville for... a while. Long enough. I know my way around, if that\'s what you\'re asking.',
        'Does it really matter where I grew up? I\'m here now and I want to work. That should be enough.',
      ]);
      responses['where_are_you_from_3'] = pick([
        '*defensive* What are you, immigration? I live here now. That\'s all that should matter. Can we move on?',
        '*getting uncomfortable* I moved around a lot as a kid. LA is where I ended up. Is that a problem?',
        '*crosses arms* I don\'t see why my whole life story matters. I\'m standing right here. I\'m available. What else do you need?',
      ]);
    }

    // Headshot question
    responses['about_your_headshot'] = isLegit
      ? 'Got it done last spring. Pretty recent.'
      : pick([
        'Oh that? My agent had those made up.',
        'Yeah it\'s a bit old. I look different now.',
        'A friend took it for me.',
      ]);

    // Book listing question
    if (isLegit) {
      responses['are_you_in_the_book'] = 'Should be. I update my listing every year.';
    } else {
      responses['are_you_in_the_book'] = pick([
        'I... think so? I\'m not sure when I last updated it.',
        'I just moved, so it might be under my old info.',
        'What book?',
        'Yeah, should be in there somewhere.',
      ]);
    }

    // Reel question
    responses['about_your_reel'] = isLegit
      ? 'Put it together myself. All my own work.'
      : pick([
        'My buddy helped me put it together.',
        'It\'s mostly me on there. Mostly.',
        'I borrowed some footage from a friend.',
      ]);

    if (isLegit) {
      responses['about_your_reel_2'] = pick([
        'Shot it on my buddy\'s Betacam. Every hit, every fall — that\'s me, no doubles. What you see is what you get.',
        'I edited it myself. Pulled the best stuff from the last five years. Every gag on there is something I\'m proud of.',
        'A buddy of mine at a post house helped me with the edit, but every stunt on that tape is mine. One hundred percent.',
      ]);
      responses['about_your_reel_3'] = pick([
        'You\'ll see a 40-foot fall in there. That\'s the real deal. No wires, no pads below frame. Just me and gravity.',
        'That reel is my resume in motion. I put my body on the line for every single one of those shots. It speaks for itself.',
        'I\'m proud of that tape. It took years to build up that kind of work. Every coordinator who\'s seen it has called me back.',
      ]);
    } else {
      responses['about_your_reel_2'] = pick([
        'I mean, the important thing is I can do the work, right? Not what\'s on tape. Tapes can be deceiving anyway.',
        'The camera doesn\'t always capture everything. Trust me, I\'m better in person than what\'s on that reel.',
        'I\'m planning to reshoot the whole thing soon. The quality isn\'t great but the skills are there. Mostly.',
      ]);
      responses['about_your_reel_3'] = pick([
        '*looks away* It\'s a good reel. That\'s all that matters. Can we talk about something else?',
        '*fidgeting* Look, not everyone has access to professional equipment. The content is what counts, right? Right?',
        '*defensive* Why are you scrutinizing my reel so hard? Just watch it and judge for yourself. Or don\'t. Whatever.',
      ]);
    }

    return responses;
  }
}

export default VisitorGenerator;
