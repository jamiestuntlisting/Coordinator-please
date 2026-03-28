export const STUNT_SKILLS: string[] = [
  'high_fall',
  'car_hit',
  'fight',
  'ratchet',
  'fire_gag',
  'wire_work',
  'stair_fall',
  'explosion_reaction',
  'sword_fight',
  'horse_riding',
  'martial_arts',
  'swimming',
  'driving',
];

export const STUNT_TYPES: Record<string, { requiredSkills: string[]; riskDescription: string }> = {
  high_fall: {
    requiredSkills: ['high_fall'],
    riskDescription: 'Multi-story fall onto airbag. Broken bones if missed.',
  },
  car_hit: {
    requiredSkills: ['car_hit'],
    riskDescription: 'Vehicle impact at speed. Timing is everything.',
  },
  fight: {
    requiredSkills: ['fight'],
    riskDescription: 'Choreographed fight sequence. Pulled punches, sold reactions.',
  },
  ratchet: {
    requiredSkills: ['ratchet'],
    riskDescription: 'Pneumatic yank on cable. Violent but controlled.',
  },
  fire_gag: {
    requiredSkills: ['fire_gag'],
    riskDescription: 'Full or partial burn. Gel, Nomex, and a very short window.',
  },
  wire_work: {
    requiredSkills: ['wire_work'],
    riskDescription: 'Suspended on wires for flying or jerking motion.',
  },
  stair_fall: {
    requiredSkills: ['stair_fall'],
    riskDescription: 'Tumble down a staircase. Every step is a bruise.',
  },
  explosion_reaction: {
    requiredSkills: ['explosion_reaction'],
    riskDescription: 'Reacting to pyro charges. Stay in your mark or else.',
  },
  sword_fight: {
    requiredSkills: ['sword_fight', 'fight'],
    riskDescription: 'Edged weapon choreography. Steel or aluminum.',
  },
  horse_riding: {
    requiredSkills: ['horse_riding'],
    riskDescription: 'Mounted stunt work. The horse has its own opinion.',
  },
  martial_arts: {
    requiredSkills: ['martial_arts', 'fight'],
    riskDescription: 'Kicks, throws, and acrobatics. Looks easy, is not.',
  },
  swimming: {
    requiredSkills: ['swimming'],
    riskDescription: 'Underwater or open-water work. Cold and dangerous.',
  },
  driving: {
    requiredSkills: ['driving'],
    riskDescription: 'Precision driving. Drifts, J-turns, near-misses.',
  },
};
