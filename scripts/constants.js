// @ts-nocheck
// ---------------------------------------------------------------------------
// Constants & utility functions extracted from wizard.js
// ---------------------------------------------------------------------------

// Base skill defaults (mirrors CONFIG.SKILLS in website scripts.js)
export const SKILL_DEFAULTS = {
    accounting: 10, alertness: 20, anthropology: 0, archeology: 0,
    athletics: 30, artillery: 0, bureaucracy: 10, computer_science: 0,
    criminology: 10, demolitions: 0, disguise: 10, dodge: 30, drive: 20,
    firearms: 20, first_aid: 10, forensics: 0, heavy_machiner: 10,
    heavy_weapons: 0, history: 10, humint: 10, law: 0, medicine: 0,
    melee_weapons: 30, navigate: 10, occult: 10, persuade: 20,
    pharmacy: 0, psychotherapy: 10, ride: 10, search: 20, sigint: 0,
    stealth: 10, surgery: 0, survival: 10, swim: 20, unarmed_combat: 40,
    unnatural: 0,
};

// All skill options for bonus picks. Specialty groups show as bare group name — a text input
// for the subspecialty appears beside the dropdown when a specialty group is selected.
export const BONUS_SKILL_OPTIONS = [
    { key: 'accounting', label: 'Accounting' },
    { key: 'alertness', label: 'Alertness' },
    { key: 'anthropology', label: 'Anthropology' },
    { key: 'archeology', label: 'Archeology' },
    { key: '_custom_Art', label: 'Art' },
    { key: 'artillery', label: 'Artillery' },
    { key: 'athletics', label: 'Athletics' },
    { key: 'bureaucracy', label: 'Bureaucracy' },
    { key: 'computer_science', label: 'Computer Science' },
    { key: '_custom_Craft', label: 'Craft' },
    { key: 'criminology', label: 'Criminology' },
    { key: 'demolitions', label: 'Demolitions' },
    { key: 'disguise', label: 'Disguise' },
    { key: 'dodge', label: 'Dodge' },
    { key: 'drive', label: 'Drive' },
    { key: 'firearms', label: 'Firearms' },
    { key: 'first_aid', label: 'First Aid' },
    { key: '_custom_ForeignLanguage', label: 'Foreign Language' },
    { key: 'forensics', label: 'Forensics' },
    { key: 'heavy_machiner', label: 'Heavy Machinery' },
    { key: 'heavy_weapons', label: 'Heavy Weapons' },
    { key: 'history', label: 'History' },
    { key: 'humint', label: 'HUMINT' },
    { key: 'law', label: 'Law' },
    { key: 'medicine', label: 'Medicine' },
    { key: 'melee_weapons', label: 'Melee Weapons' },
    { key: '_custom_MilitaryScience', label: 'Military Science' },
    { key: 'navigate', label: 'Navigate' },
    { key: 'occult', label: 'Occult' },
    { key: 'persuade', label: 'Persuade' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: '_custom_Pilot', label: 'Pilot' },
    { key: 'psychotherapy', label: 'Psychotherapy' },
    { key: 'ride', label: 'Ride' },
    { key: '_custom_Science', label: 'Science' },
    { key: 'search', label: 'Search' },
    { key: 'sigint', label: 'SIGINT' },
    { key: 'stealth', label: 'Stealth' },
    { key: 'surgery', label: 'Surgery' },
    { key: 'survival', label: 'Survival' },
    { key: 'swim', label: 'Swim' },
    { key: 'unarmed_combat', label: 'Unarmed Combat' },
    { key: 'unnatural', label: 'Unnatural' },
];

// Specialty skill bases and their Foundry DG.TypeSkills group key suffix.
export const SPECIALTY_PREFIXES = {
    'Art': 'Art',
    'Craft': 'Craft',
    'Foreign Language': 'ForeignLanguage',
    'Science': 'Science',
    'Pilot': 'Pilot',
    'Military Science': 'MilitaryScience',
};

// Suggested subspecialties shown as datalist in the skills step.
export const SPECIALTY_OPTIONS = {
    Art: ['Acting', 'Drawing', 'Fine Art', 'Music', 'Painting', 'Photography', 'Sculpture', 'Writing'],
    Craft: ['Carpentry', 'Electrician', 'Locksmithing', 'Mechanic', 'Microelectronics', 'Plumbing', 'Welding'],
    ForeignLanguage: ['Arabic', 'Chinese (Mandarin)', 'Farsi/Persian', 'French', 'German', 'Hebrew', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian', 'Spanish', 'Swahili', 'Turkish'],
    Science: ['Astronomy', 'Biology', 'Chemistry', 'Geology', 'Mathematics', 'Meteorology', 'Oceanography', 'Pharmacology', 'Physics'],
    Pilot: ['Airplane', 'Drone', 'Helicopter', 'Jet Aircraft', 'Ship', 'Small Boat'],
    MilitaryScience: ['Air', 'Land', 'Sea', 'Special Operations'],
};

/**
 * Parse a skill display name like "Foreign Language (Spanish)" or bare "Science".
 * Returns {group, label} if it's a specialty skill, otherwise null.
 * `label` is '' when bare (subspecialty not yet chosen).
 */
export function parseSpecialtyFromName(name) {
    for (const [base, group] of Object.entries(SPECIALTY_PREFIXES)) {
        if (name === base) return { group, label: '' };
        if (name.startsWith(base + ' (') && name.endsWith(')')) {
            return { group, label: name.slice(base.length + 2, -1) };
        }
    }
    return null;
}

/**
 * Parse a normalised key like "craft_electrician" or "military_science_land".
 * Returns {group, label} for specialty bonus-pick keys, otherwise null.
 */
export function parseSpecialtyFromKey(key) {
    // Order matters — check longer prefixes first to avoid false matches.
    const prefixMap = [
        ['military_science_', 'MilitaryScience'],
        ['foreign_language_', 'ForeignLanguage'],
        ['science_', 'Science'],
        ['craft_', 'Craft'],
        ['pilot_', 'Pilot'],
        ['art_', 'Art'],
    ];
    for (const [prefix, group] of prefixMap) {
        if (key.startsWith(prefix)) {
            const rawLabel = key.slice(prefix.length);
            const label = rawLabel.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return { group, label };
        }
    }
    return null;
}

// Pre-built equipment loadouts — item names must match EQUIPMENT_CATALOG exactly.
export const LOADOUTS = {
    federal_agent: [
        'Medium pistol', 'Tactical light or weapon light', 'Handcuffs', 'Kevlar vest',
        'Tablet computer or smartphone', 'Earpiece communication set',
        'Light rifle or carbine', 'Individual first aid kit',
    ],
    swat: [
        'Light rifle or carbine', 'Medium pistol', 'Tactical body armor', 'Kevlar helmet',
        'CED pistol', 'Pepper spray can', 'Halligan forcible-entry tool',
        'Flash-bang grenade, thrown', 'Tear gas grenade', 'Earpiece communication set',
    ],
    special_operator: [
        'Light rifle or carbine', 'Medium pistol', 'Hand grenade', 'Flash-bang grenade, thrown',
        'Long knife or combat dagger', 'Flexible cuffs', 'Tactical body armor', 'Kevlar helmet',
        'Military-grade night vision goggles', 'Short-range walkie talkie',
        'Holographic sight', 'Targeting laser', 'Sound suppressor',
    ],
    police_officer: [
        'Medium pistol', 'Kevlar vest', 'CED pistol', 'Pepper spray can',
        'Club, nightstick, or collapsible baton', 'Knife', 'Handcuffs',
        'Tactical light or weapon light', 'Short-range walkie talkie', 'Earpiece communication set',
    ],
};

export const BOND_DATASETS = [
    { key: 'FRIENDS_FAMILY', label: 'Friends & Family' },
    { key: 'DELTA_GREEN', label: 'Delta Green' },
    { key: 'UNDERWORLD', label: 'Underworld / Criminal' },
    { key: 'LGBTQ', label: 'LGBTQ+' },
    { key: 'PISCES_UK', label: 'PISCES (British Intel)' },
];

// Background bonus packages from the Delta Green rulebook (p.20).
// Slot values use BONUS_SKILL_OPTIONS keys; '_custom_*' = type-your-own specialty; '' = free pick.
export const BONUS_PACKAGES = [
    {
        label: 'Artist, Actor, or Musician',
        desc: 'Alertness · Craft (choose) · Disguise · Persuade · Art (choose) ×3 · HUMINT',
        skills: ['alertness', '_custom_Craft', 'disguise', 'persuade', '_custom_Art', '_custom_Art', '_custom_Art', 'humint']
    },
    {
        label: 'Athlete',
        desc: 'Alertness · Athletics · Dodge · First Aid · HUMINT · Persuade · Swim · Unarmed Combat',
        skills: ['alertness', 'athletics', 'dodge', 'first_aid', 'humint', 'persuade', 'swim', 'unarmed_combat']
    },
    {
        label: 'Author, Editor, or Journalist',
        desc: 'Anthropology · Art (choose) · Bureaucracy · History · HUMINT · Law · Occult · Persuade',
        skills: ['anthropology', '_custom_Art', 'bureaucracy', 'history', 'humint', 'law', 'occult', 'persuade']
    },
    {
        label: '"Black Bag" Training',
        desc: 'Alertness · Athletics · Craft (Electrician) · Craft (Locksmithing) · Criminology · Disguise · Search · Stealth',
        skills: ['alertness', 'athletics', 'craft_electrician', 'craft_locksmithing', 'criminology', 'disguise', 'search', 'stealth']
    },
    {
        label: 'Blue-Collar Worker',
        desc: 'Alertness · Craft (choose) ×2 · Drive · First Aid · Heavy Machinery · Navigate · Search',
        skills: ['alertness', '_custom_Craft', '_custom_Craft', 'drive', 'first_aid', 'heavy_machiner', 'navigate', 'search']
    },
    {
        label: 'Bureaucrat',
        desc: 'Accounting · Bureaucracy · Computer Science · Criminology · HUMINT · Law · Persuade · personal specialty (choose)',
        skills: ['accounting', 'bureaucracy', 'computer_science', 'criminology', 'humint', 'law', 'persuade', '']
    },
    {
        label: 'Clergy',
        desc: 'Foreign Language (choose) ×3 · History · HUMINT · Occult · Persuade · Psychotherapy',
        skills: ['_custom_ForeignLanguage', '_custom_ForeignLanguage', '_custom_ForeignLanguage', 'history', 'humint', 'occult', 'persuade', 'psychotherapy']
    },
    {
        label: 'Combat Veteran',
        desc: 'Alertness · Dodge · Firearms · First Aid · Heavy Weapons · Melee Weapons · Stealth · Unarmed Combat',
        skills: ['alertness', 'dodge', 'firearms', 'first_aid', 'heavy_weapons', 'melee_weapons', 'stealth', 'unarmed_combat']
    },
    {
        label: 'Computer Enthusiast or Hacker',
        desc: 'Computer Science · Craft (Microelectronics) · Science (Mathematics) · SIGINT · personal specialties ×4 (choose freely)',
        skills: ['computer_science', 'craft_microelectronics', 'science_mathematics', 'sigint', '', '', '', '']
    },
    {
        label: 'Counselor',
        desc: 'Bureaucracy · First Aid · Foreign Language (choose) · HUMINT · Law · Persuade · Psychotherapy · Search',
        skills: ['bureaucracy', 'first_aid', '_custom_ForeignLanguage', 'humint', 'law', 'persuade', 'psychotherapy', 'search']
    },
    {
        label: 'Criminalist',
        desc: 'Accounting · Bureaucracy · Computer Science · Criminology · Forensics · Law · Pharmacy · Search',
        skills: ['accounting', 'bureaucracy', 'computer_science', 'criminology', 'forensics', 'law', 'pharmacy', 'search']
    },
    {
        label: 'Firefighter',
        desc: 'Alertness · Demolitions · Drive · First Aid · Forensics · Heavy Machinery · Navigate · Search',
        skills: ['alertness', 'demolitions', 'drive', 'first_aid', 'forensics', 'heavy_machiner', 'navigate', 'search']
    },
    {
        label: 'Gangster or Deep Cover',
        desc: 'Alertness · Criminology · Dodge · Drive · Persuade · Stealth · choose 2 freely',
        skills: ['alertness', 'criminology', 'dodge', 'drive', 'persuade', 'stealth', '', '']
    },
    {
        label: 'Interrogator',
        desc: 'Criminology · Foreign Language (choose) ×2 · HUMINT · Law · Persuade · Pharmacy · Search',
        skills: ['criminology', '_custom_ForeignLanguage', '_custom_ForeignLanguage', 'humint', 'law', 'persuade', 'pharmacy', 'search']
    },
    {
        label: 'Liberal Arts Degree',
        desc: 'Anthropology · Art (choose) · Foreign Language (choose) · History · Persuade · personal specialties ×3',
        skills: ['anthropology', '_custom_Art', '_custom_ForeignLanguage', 'history', 'persuade', '', '', '']
    },
    {
        label: 'Military Officer',
        desc: 'Bureaucracy · Firearms · History · Military Science (choose) · Navigate · Persuade · Unarmed Combat · choose 1 freely',
        skills: ['bureaucracy', 'firearms', 'history', '_custom_MilitaryScience', 'navigate', 'persuade', 'unarmed_combat', '']
    },
    {
        label: 'MBA',
        desc: 'Accounting · Bureaucracy · HUMINT · Law · Persuade · personal specialties ×3 (choose freely)',
        skills: ['accounting', 'bureaucracy', 'humint', 'law', 'persuade', '', '', '']
    },
    {
        label: 'Nurse, Paramedic, or Pre-Med',
        desc: 'Alertness · First Aid · Medicine · Persuade · Pharmacy · Psychotherapy · Science (Biology) · Search',
        skills: ['alertness', 'first_aid', 'medicine', 'persuade', 'pharmacy', 'psychotherapy', 'science_biology', 'search']
    },
    {
        label: 'Occult Investigator or Conspiracy Theorist',
        desc: 'Anthropology · Archeology · Computer Science · Criminology · History · Occult · Persuade · Search',
        skills: ['anthropology', 'archeology', 'computer_science', 'criminology', 'history', 'occult', 'persuade', 'search']
    },
    {
        label: 'Outdoorsman',
        desc: 'Alertness · Athletics · Firearms · Navigate · Ride · Search · Stealth · Survival',
        skills: ['alertness', 'athletics', 'firearms', 'navigate', 'ride', 'search', 'stealth', 'survival']
    },
    {
        label: 'Photographer',
        desc: 'Alertness · Art (Photography) · Computer Science · Persuade · Search · Stealth · personal specialties ×2',
        skills: ['alertness', 'art_photography', 'computer_science', 'persuade', 'search', 'stealth', '', '']
    },
];

// ---------------------------------------------------------------------------
// Skill tooltip descriptions — sourced verbatim from DELTA-GREEN-STATS website
// ---------------------------------------------------------------------------
export const SKILL_TOOLTIPS = {
    accounting: `Accounting — Base: 10%\nThe study of finance and business. Use it to sift through financial records for anomalies, such as a hidden bank account or money laundering.`,
    alertness: `Alertness — Base: 20%\nDetects danger. Use it to hear a safety being switched off, spot the bulge of a pistol under a jacket, or catch someone trying to escape notice.`,
    anthropology: `Anthropology — Base: 0%\nThe study of living human cultures. Use it to understand morals, religious beliefs, customs, and to identify (but not translate) obscure languages.`,
    archeology: `Archeology — Base: 0%\nThe study of physical remains of human cultures. Use it to analyse ruins, determine the age of an artifact, or tell a genuine artifact from a fake.`,
    artillery: `Artillery — Base: 0%\nSafe and accurate use of mortars, missiles, howitzers, tank cannons, and other heavy gunnery.`,
    athletics: `Athletics — Base: 30%\nLong practice doing things like running, jumping, climbing, and throwing. Use it to outrun someone, jump an intimidating gap, climb in a crisis, or hit a target with a thrown weapon.`,
    bureaucracy: `Bureaucracy — Base: 10%\nManipulating the rules and personalities that govern an organisation. Use it to locate supplies, convince an official to provide resources, or gain credentials for a restricted area.`,
    computer_science: `Computer Science — Base: 0%\nDeep knowledge of computers and the programs that run them. Use it to recover encrypted data, implant software to hijack a system, clone a phone's SIM card, or falsify data.`,
    criminology: `Criminology — Base: 10%\nKnowledge of criminal and conspiratorial behaviour. Use it to identify criminal behaviour, deduce relationships in a conspiracy, or know whom to talk to in the criminal underground.`,
    demolitions: `Demolitions — Base: 0%\nSafe handling of explosives in a crisis. Use it to disarm a bomb, set a charge to destroy a target, or jury-rig an explosive from hardware-store supplies.`,
    disguise: `Disguise — Base: 10%\nAlter your Agent's appearance, voice, posture, body language, and mannerisms to avoid recognition without drawing attention.`,
    dodge: `Dodge — Base: 30%\nEvading danger and attacks through instinct and reflexes. Against firearms and explosives, Dodge can get an Agent to cover before bullets and shrapnel fly.`,
    drive: `Drive — Base: 20%\nHandling an automobile or motorcycle safely in a crisis. Use this skill in a high-speed pursuit or on dangerous terrain.`,
    firearms: `Firearms — Base: 20%\nSafe and accurate shooting with small arms in combat. Use it to hit a target despite the adrenaline and panic of violence.`,
    first_aid: `First Aid — Base: 10%\nThe initial treatment and stabilisation of injuries. Use it to help a character recover lost Hit Points.`,
    forensics: `Forensics — Base: 0%\nGathering detailed evidence using forensic equipment. Use it to record biometric data, determine weapon details, or collect and compare fingerprints and DNA.`,
    heavy_machiner: `Heavy Machinery — Base: 10%\nSafe operation of a tractor, crane, bulldozer, tank, heavy truck, or other big machine in a crisis.`,
    heavy_weapons: `Heavy Weapons — Base: 0%\nSafe and accurate use of man-portable heavy ordnance such as machine guns and rocket launchers.`,
    history: `History — Base: 10%\nUncovering facts and theories about the human past. Use it to remember a key fact, recognise an obscure reference, or comb a library for information that needs deep education.`,
    humint: `HUMINT — Base: 10%\nHuman intelligence. Obtains information — especially information a subject would conceal — through observation, conversation, or examining patterns of behaviour.`,
    law: `Law — Base: 0%\nUsing laws and courts to your Agent's advantage. Use it to get your way in court, determine correct procedures for evidence, or minimise legal risks.`,
    medicine: `Medicine — Base: 0%\nThe study and treatment of injury and illness. Use it to diagnose injury, disease, or poisoning; identify abnormalities; or determine cause and time of death.`,
    melee_weapons: `Melee Weapons — Base: 30%\nLethal use of melee weapons in combat. Use it to hurt or kill an opponent with a knife, axe, club, or other weapon.`,
    navigate: `Navigate — Base: 10%\nFinding your way quickly with maps, charts, instruments, or dead reckoning.`,
    occult: `Occult — Base: 10%\nThe study of the supernatural as understood by human traditions, including conspiracy theories, fringe science, and cryptozoology. Can never reveal the genuinely unnatural.`,
    persuade: `Persuade — Base: 20%\nChanging another's deeply-held decision or desire. Use it when what your Agent wants is so valuable, or the deception so flagrant, that Charisma isn't enough.`,
    pharmacy: `Pharmacy — Base: 0%\nKnowledge of drugs: their ingredients, creation, effects, uses, and misuses. Use it to identify and produce medicines and antidotes — as well as poisons.`,
    psychotherapy: `Psychotherapy — Base: 10%\nThe diagnosis and treatment of mental illness. Use it to identify a disorder, help a patient recover, or talk someone down when a disorder begins to take over. Cannot be used on yourself.`,
    ride: `Ride — Base: 10%\nHandling, training, and riding horses, donkeys, camels, and other beasts. Use it to stay on a mount in a crisis and to keep animals calm.`,
    search: `Search — Base: 20%\nFinding things that are concealed or obscured. Use it to find an object hidden with Stealth, or so well hidden it needs an expert eye.`,
    sigint: `SIGINT — Base: 0%\nSignals intelligence. Encompasses encryption, communications intelligence, and surveillance of radio and digital communications. Use it to install bugs, operate surveillance equipment, and break codes.`,
    stealth: `Stealth — Base: 10%\nConcealing your presence or activities. Use it to hide a pistol, move silently, follow without being seen, or blend into a crowd. Detected only by opposing Alertness or Search.`,
    surgery: `Surgery — Base: 0%\nThe treatment of an injury by invasive means. First Aid keeps a patient alive until surgery is possible; Medicine ensures long-term recovery.`,
    survival: `Survival — Base: 10%\nKnowledge of the natural world. Use it to find tracks, predict weather, recognise unusual fauna or flora, or find food, water, and shelter.`,
    swim: `Swim — Base: 20%\nUse in a dangerous crisis: going a long distance in choppy water, keeping a friend from drowning, or getting to a boat before something below grabs you.`,
    unarmed_combat: `Unarmed Combat — Base: 40%\nSelf-defence. Use it to hurt or kill an opponent with your Agent's bare hands, feet, elbows, teeth, or head.`,
    unnatural: `Unnatural — Base: 0%\nKnowledge of the fundamental, mind-rending secrets of the universe. Your Agent's SAN can never be higher than 99 minus their Unnatural skill rating.`,
    art: `Art (Type) — Base: 0%\nExpertise at creating or performing a work that sways emotions. Each type is a separate skill: Acting, Creative Writing, Forgery, Painting, Photography, Scriptwriting, etc.`,
    craft: `Craft (Type) — Base: 0%\nMaking and repairing sophisticated tools and structures. Each type is separate: Electrician, Locksmith, Mechanic, Microelectronics, Gunsmith, etc.`,
    foreign_language: `Foreign Language (Type) — Base: 0%\nFluency in another language. Each language is a distinct skill. At 20% halting conversation; at 50% speak and read like a native.`,
    military_science: `Military Science (Type) — Base: 0%\nKnowledge of military culture and techniques. Use it to identify battlefield threats, recognise weaknesses in fortifications, or deploy forces advantageously.`,
    pilot: `Pilot (Type) — Base: 0%\nPiloting waterborne, airborne, or aerospace vehicles in a crisis. Each vessel type is separate: Airplane, Drone, Helicopter, Small Boat, Ship, etc.`,
    science: `Science (Type) — Base: 0%\nThe deep study of the processes of the world. Each science is separate: Astronomy, Biology, Chemistry, Geology, Mathematics, Physics, Zoology, etc.`,
};

export const STAT_LABELS = { str: 'STR', con: 'CON', dex: 'DEX', int: 'INT', pow: 'POW', cha: 'CHA' };

export const STAT_TOOLTIPS = {
    str: 'Strength measures raw physical power. It affects carrying, forcing objects, and Hit Points.',
    con: 'Constitution measures health and endurance. Together with STR, it determines Hit Points.',
    dex: 'Dexterity measures coordination, speed, and physical precision.',
    int: 'Intelligence measures reasoning, memory, analysis, and the ability to learn.',
    pow: 'Power measures force of will and mental resilience. It determines Willpower, starting Sanity, and Breaking Point.',
    cha: 'Charisma measures personal presence and emotional connection. It determines starting Bond scores.',
};

export const STAT_DESCRIPTOR_TIERS = {
    str: [[3, 'Feeble'], [5, 'Weak'], [9, 'Average'], [13, 'Muscular'], [17, 'Huge']],
    dex: [[3, 'Barely Mobile'], [5, 'Clumsy'], [9, 'Average'], [13, 'Nimble'], [17, 'Acrobatic']],
    con: [[3, 'Bedridden'], [5, 'Sickly'], [9, 'Average'], [13, 'Perfect health'], [17, 'Indefatigable']],
    int: [[3, 'Imbecilic'], [5, 'Slow'], [9, 'Average'], [13, 'Perceptive'], [17, 'Brilliant']],
    pow: [[3, 'Spineless'], [5, 'Nervous'], [9, 'Average'], [13, 'Strong willed'], [17, 'Indomitable']],
    cha: [[3, 'Unbearable'], [5, 'Awkward'], [9, 'Average'], [13, 'Charming'], [17, 'Magnetic']],
};

export function getStatDescriptor(key, value) {
    const tiers = STAT_DESCRIPTOR_TIERS[key];
    if (!tiers) return '';
    let desc = tiers[0][1];
    for (const [min, label] of tiers) { if (value >= min) desc = label; }
    return desc;
}

export const STEPS = ['welcome', 'profession', 'stats', 'skills', 'bonus_skills', 'damaged_veteran', 'bonds', 'biography', 'review'];
