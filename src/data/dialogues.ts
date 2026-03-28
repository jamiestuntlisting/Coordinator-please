import type { DialogueOption } from '../types/index';

export const DIALOGUE_OPTIONS: DialogueOption[] = [
  {
    id: 'where_from',
    text: 'Where are you from?',
    responseKey: 'where_from',
  },
  {
    id: 'how_heard',
    text: 'How did you hear about this?',
    responseKey: 'how_heard',
  },
  {
    id: 'who_worked_with',
    text: 'Who have you worked with?',
    responseKey: 'who_worked_with',
  },
  {
    id: 'sag_status',
    text: 'You SAG?',
    responseKey: 'sag_status',
  },
  {
    id: 'can_do_skill',
    text: 'Can you do [skill]?',
    requiresContext: 'role_skill',
    responseKey: 'can_do_skill',
  },
  {
    id: 'not_in_book',
    text: "Why aren't you in the book?",
    requiresContext: 'no_book_listing',
    responseKey: 'not_in_book',
  },
  {
    id: 'newer_headshot',
    text: 'Do you have a more recent headshot?',
    requiresContext: 'bw_headshot',
    responseKey: 'newer_headshot',
  },
  {
    id: 'seen_reel',
    text: "I've seen this reel before.",
    requiresContext: 'duplicate_reel',
    responseKey: 'seen_reel',
  },
];

export const CALLOUT_LINES: Record<string, string> = {
  fake_headshot: "This headshot doesn't look like you. Get lost.",
  not_in_book: "You're not in the book and nobody I know sent you. Out.",
  bad_reel: "That reel's not you. I've got eyes. Get out.",
  duplicate_reel: "I already saw this reel tonight. From someone else. Move along.",
  not_sag: "You said you were SAG. You're not. Don't come back.",
  expired_sag: 'Your SAG card is expired. I can\'t use you.',
  wrong_body_type: "You don't match the specs. Sorry, not tonight.",
  no_skills: "You can't do what I need done. Next.",
  returning_visitor: "Didn't I already send you home? Yeah, I did. Goodbye.",
  faker_general: "Something's off and I don't have time to figure out what. Next.",
  wig_guy: "Nice wig. I said nice wig. Get out of here.",
  bribe_decline: "I don't take money like that. Leave before I remember your face.",
  not_local: "Locals only tonight. You're not local. Goodnight.",
};

export const GREETING_TEMPLATES: Record<string, string[]> = {
  confident: [
    "Hey. I'm here for the gig.",
    'I heard you need people tonight.',
    "What's up. I'm available.",
    "Let's get right to it. I've got what you need.",
  ],
  nervous: [
    'Hi... is this where I check in?',
    "I was told to come here? I hope that's right.",
    'Sorry, am I in the right place?',
    "I'm a little new to this. Is this the coordinator's table?",
  ],
  aggressive: [
    "I'm here. Let's go.",
    "You need me tonight. Trust me.",
    "Don't waste my time and I won't waste yours.",
    "I drove two hours for this. Let's make it worth it.",
  ],
  smooth: [
    "Evening. I believe you've got a spot for me.",
    'Hey there. Mutual friend said you might need someone with my skill set.',
    "Good to meet you. I think we can help each other out.",
    "Word on the set is you're the one to talk to.",
  ],
  desperate: [
    "Please, I really need this. I'll do anything you've got.",
    "Look, I know it's late, but I need the work.",
    "I'm between jobs. Anything. Please.",
    "I drove here on fumes. Just give me a shot.",
  ],
  quiet: [
    'Hey.',
    '...',
    '*slides resume across the table*',
    '*nods* I can work.',
  ],
};

export const BRIBE_DIALOGUES: string[] = [
  "Look, I know how it works. Here's a little something for your trouble.",
  "What if I made tonight easier for both of us?",
  "I got something in my pocket that says you could use a friend.",
  "Before you look at my resume — maybe this helps you decide.",
  "My buddy said you're a reasonable guy. Here. For the inconvenience.",
  "I'm not trying to insult you. Just trying to get on the sheet.",
  "Gas ain't cheap and neither am I. But I can be generous.",
  "Think of it as a consulting fee. Between professionals.",
];

export const INSURANCE_DIALOGUES: Record<string, string[]> = {
  legit: [
    'Yeah, I carry my own supplemental through AIG. Production covers the rest.',
    "Full coverage. Got banged up on a Joel Silver picture and learned the hard way.",
    "SAG pension and health. Plus I've got a rider for stunt work.",
    "I'm covered. You can call my agent if you want to verify.",
  ],
  vague: [
    "I'm... yeah, I'm covered. I think. Through the union, right?",
    "My buddy handles all that. I just show up and work.",
    "Insurance? Yeah, of course. I mean... whatever the standard thing is.",
    "I don't really get into all that paperwork stuff.",
    "Production covers that, right? That's how it works?",
  ],
};
