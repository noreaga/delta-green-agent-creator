/**
 * Delta Green Bio Data + Generator
 * Ported from DELTA-GREEN-STATS bio.js + scripts.js generateRandomBio()
 */

const BIO_DATA = {
    firstNames: {
        male: [
            'Aaron', 'Adam', 'Alex', 'Andrew', 'Anthony', 'Benjamin', 'Brandon', 'Brian',
            'Carlos', 'Charles', 'Christopher', 'Daniel', 'David', 'Derek', 'Dominic',
            'Edward', 'Eric', 'Ethan', 'Frank', 'George', 'Gregory', 'Henry', 'Jack',
            'Jacob', 'James', 'Jason', 'Jeffrey', 'John', 'Jonathan', 'Joseph', 'Joshua',
            'Kevin', 'Kyle', 'Mark', 'Matthew', 'Michael', 'Nathan', 'Nicholas', 'Patrick',
            'Paul', 'Peter', 'Raymond', 'Richard', 'Robert', 'Ryan', 'Samuel', 'Scott',
            'Sean', 'Stephen', 'Steven', 'Thomas', 'Timothy', 'Tyler', 'Victor', 'William',
        ],
        female: [
            'Alexandra', 'Alicia', 'Amanda', 'Amy', 'Andrea', 'Angela', 'Ashley', 'Barbara',
            'Beth', 'Brenda', 'Carol', 'Catherine', 'Christine', 'Danielle', 'Deborah',
            'Diana', 'Elizabeth', 'Emily', 'Emma', 'Grace', 'Hannah', 'Heather', 'Jennifer',
            'Jessica', 'Karen', 'Katherine', 'Kelly', 'Laura', 'Lauren', 'Linda', 'Lisa',
            'Maria', 'Mary', 'Megan', 'Melissa', 'Michelle', 'Morgan', 'Nancy', 'Nicole',
            'Patricia', 'Rachel', 'Rebecca', 'Sandra', 'Sarah', 'Sharon', 'Stephanie',
            'Susan', 'Tamara', 'Teresa', 'Tracy',
        ],
        'non-binary': [
            'Alex', 'Avery', 'Bailey', 'Blake', 'Cameron', 'Casey', 'Dakota', 'Drew',
            'Elliott', 'Emerson', 'Finley', 'Gray', 'Harper', 'Hunter', 'Indigo', 'Jamie',
            'Jordan', 'Jules', 'Kendall', 'Lane', 'Logan', 'Marlowe', 'Morgan', 'Parker',
            'Peyton', 'Quinn', 'Reese', 'Riley', 'Robin', 'Rowan', 'Ryan', 'Sage',
            'Sam', 'Sawyer', 'Scout', 'Shea', 'Skylar', 'Storm', 'Taylor', 'Tegan',
        ],
    },
    lastNames: [
        'Adams', 'Allen', 'Anderson', 'Bailey', 'Baker', 'Barnes', 'Bell', 'Bennett',
        'Brooks', 'Brown', 'Campbell', 'Carter', 'Clark', 'Collins', 'Cook', 'Cooper',
        'Davis', 'Edwards', 'Evans', 'Fisher', 'Foster', 'Garcia', 'Gonzalez', 'Gray',
        'Green', 'Hall', 'Harris', 'Harrison', 'Hayes', 'Henderson', 'Hill', 'Howard',
        'Hughes', 'Jackson', 'Jenkins', 'Johnson', 'Jones', 'Kelly', 'King', 'Lee',
        'Lewis', 'Long', 'Martin', 'Martinez', 'Miller', 'Mitchell', 'Moore', 'Morgan',
        'Murphy', 'Nelson', 'Parker', 'Phillips', 'Porter', 'Powell', 'Price', 'Reed',
        'Richardson', 'Rivera', 'Roberts', 'Robinson', 'Rodriguez', 'Rogers', 'Ross',
        'Russell', 'Sanchez', 'Scott', 'Smith', 'Stewart', 'Sullivan', 'Taylor', 'Thomas',
        'Thompson', 'Torres', 'Turner', 'Walker', 'Ward', 'Watson', 'White', 'Williams',
        'Wilson', 'Wood', 'Wright', 'Young',
    ],
    nationalities: [
        'American', 'American', 'American', 'American', 'American', 'American',
        'American', 'American', 'American', 'American', 'American', 'American',
        'British', 'British', 'British', 'Canadian', 'Canadian', 'Australian',
        'Australian', 'Irish', 'New Zealander', 'South African', 'German', 'French',
        'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Italian', 'Spanish', 'Polish',
        'Japanese', 'South Korean', 'Israeli', 'Brazilian',
    ],
    hairColors: [
        'dark brown', 'medium brown', 'light brown', 'dirty blonde', 'blonde',
        'dark blonde', 'light blonde', 'auburn', 'red', 'black', 'salt-and-pepper',
        'gray', 'white', 'platinum blonde', 'chestnut', 'raven black',
    ],
    hairStyles: [
        'short', 'closely cropped', 'crew-cut', 'buzzed', 'shoulder-length',
        'long', 'wavy', 'curly', 'straight', 'tightly coiled', 'slicked-back',
        'undercut', 'faded', 'military-cut', 'pulled back', 'braided',
        'shaved-head style',
    ],
    eyeColors: [
        'brown', 'dark brown', 'hazel', 'green', 'blue', 'gray', 'blue-green',
        'amber', 'light green', 'dark hazel', 'steel gray', 'ice blue',
        'warm brown', 'olive green',
    ],
    skinTones: [
        'fair', 'light', 'light-medium', 'medium', 'medium-tan', 'tan',
        'olive', 'warm brown', 'brown', 'dark brown', 'deep brown',
    ],
    buildDescriptors: {
        high: ['powerfully built', 'solidly muscular', 'stocky and strong', 'broad-shouldered', 'thickly built', 'imposingly large', 'heavily muscled'],
        athletic: ['athletically built', 'lean and muscular', 'fit and toned', 'wiry and strong', 'well-conditioned', 'physically capable-looking'],
        average: ['average build', 'unremarkable build', 'ordinary physique', 'neither muscular nor slight', 'middling build', 'serviceable frame'],
        low: ['slight of frame', 'lean', 'wiry', 'rangy', 'slender', 'thin', 'scrawny'],
    },
    heightDescriptors: {
        tall: ['tall', 'noticeably tall', 'above average height', 'on the taller side', 'a tall individual'],
        average: ['average height', 'medium height', 'unremarkable height', 'middling height', 'of average stature'],
        short: ['short', 'below average height', 'on the shorter side', 'compact in stature', 'noticeably short'],
    },
    notableFeatures: {
        high_str_con: [
            'Prominent jaw. Hard eyes.',
            'Scars on both hands.',
            'A long scar runs down one forearm.',
            'Broken nose, set crooked.',
            'Thick neck, former athlete.',
            'Calloused hands, grip like iron.',
            'A tattoo sleeve on one arm.',
            'Old burn scar on one hand.',
            'Military posture, never fully at ease.',
            'Jaw set hard, rarely smiles.',
            'Knuckles permanently enlarged.',
            'A deep scar across one cheek.',
            'Carries themselves like they expect trouble.',
            'Weathered skin from time outdoors.',
            'Heavy brow, watchful gaze.',
        ],
        low_str_con: [
            'Glasses, thick prescription.',
            'Fidgets constantly.',
            'Slender fingers, delicate hands.',
            'Pale from too much time indoors.',
            'Often stooped from reading.',
            'Quick, darting eyes.',
            'Ink stains on the fingers.',
            'Unremarkable, forgettable face.',
            'Perpetually tired-looking.',
            'Thin-shouldered, willowy.',
            'Long fingers, precise movements.',
            'Quiet voice, measured speech.',
            'Careful, deliberate movements.',
            'Observant eyes, misses little.',
            'An academic bearing, thoughtful posture.',
        ],
        neutral: [
            'A faded tattoo on one forearm.',
            'Three-day stubble, perpetual.',
            'Lines around the eyes.',
            'A small scar on the chin.',
            'Tends to keep hands in pockets.',
            'Slightly crooked nose.',
            'A watchful, alert bearing.',
            'Moves quietly out of habit.',
            'Steady, measuring gaze.',
            'Close-set eyes with deep lines.',
            'Unassuming, easy to overlook.',
            'Careful with words and posture.',
            'A slight accent, hard to place.',
            'Calm in a way that unsettles some people.',
            'Stands with an unconscious military bearing.',
        ],
    },
    professionProfiles: {
        anthropologist: {
            employers: ['University of Chicago', 'Yale University', 'Columbia University', 'Harvard University', 'Smithsonian Institution', 'National Geographic Society', 'freelance / grant-funded', 'American Museum of Natural History'],
            educations: ['Ph.D. in Anthropology', 'M.A. in Cultural Anthropology', 'Ph.D. in Archaeology', 'M.A. in Biological Anthropology', 'Ph.D. in Linguistic Anthropology', 'M.Sc. in Forensic Anthropology'],
        },
        federal_agent: {
            employers: ['Federal Bureau of Investigation', 'Drug Enforcement Administration', 'Bureau of Alcohol, Tobacco, Firearms and Explosives', 'U.S. Secret Service', 'Department of Homeland Security', 'U.S. Marshals Service', 'Naval Criminal Investigative Service'],
            educations: ['B.A. in Criminal Justice', 'B.S. in Criminology', 'J.D. (Juris Doctor)', 'M.S. in Forensic Science', 'B.S. in Computer Science', 'B.A. in Psychology'],
        },
        physician: {
            employers: ['Johns Hopkins Hospital', 'Mayo Clinic', 'Massachusetts General Hospital', 'CDC', 'WHO', 'private practice', 'Veterans Affairs Medical Center', 'military branch (uniformed service)'],
            educations: ['M.D. (Doctor of Medicine)', 'D.O. (Doctor of Osteopathic Medicine)', 'M.D. + Ph.D. (Physician-Scientist)', 'M.D. with residency in Emergency Medicine', 'M.D. with residency in Psychiatry', 'M.D. with residency in Pathology'],
        },
        engineer: {
            employers: ['Lockheed Martin', 'Raytheon Technologies', 'Booz Allen Hamilton', 'SAIC', 'Google', 'Microsoft', 'MITRE Corporation', 'NSA contractor', 'IBM', 'self-employed / freelance'],
            educations: ['B.S. in Computer Science', 'M.S. in Computer Science', 'B.S. in Software Engineering', 'M.S. in Cybersecurity', 'B.S. in Electrical Engineering', 'M.S. in Information Systems', 'B.S. in Computer Engineering'],
        },
        scientist: {
            employers: ['Lawrence Berkeley National Laboratory', 'Oak Ridge National Laboratory', 'DARPA', 'NIH', 'CDC', 'MIT Lincoln Laboratory', 'Battelle Memorial Institute', 'university research division', 'private sector R&D'],
            educations: ['Ph.D. in Physics', 'Ph.D. in Biology', 'Ph.D. in Chemistry', 'Ph.D. in Neuroscience', 'M.S. in Biochemistry', 'Ph.D. in Environmental Science', 'M.S. in Materials Science'],
        },
        special_operator: {
            employers: ['U.S. Army Special Forces', 'U.S. Navy SEALs', 'U.S. Marine Raiders', 'U.S. Air Force PJs', 'Delta Force', 'DEVGRU', '75th Ranger Regiment', 'British SAS', 'interagency task force'],
            educations: ['B.A. in History', 'B.S. in Criminal Justice', 'B.A. in Political Science', 'high school diploma + advanced military training', 'some college + Army ROTC', 'B.S. in Mechanical Engineering', 'B.A. in Intelligence Studies'],
        },
        criminal: {
            employers: ['organized crime family', 'independent contractor', 'street crew', 'international smuggling ring', 'freelance (no fixed employer)', 'cartel affiliate', 'state-sponsored actor (formerly)'],
            educations: ['high school diploma', 'some college, no degree', 'GED', 'vocational training', 'self-taught', 'military training (before going off the books)'],
        },
        firefighter: {
            employers: ['urban fire department', 'county fire department', 'wildland firefighting unit', 'federal wildfire agency', 'private fire brigade', 'airport fire & rescue'],
            educations: ['fire academy training', 'B.S. in Fire Science', 'EMT-Basic certification', 'Paramedic certification', 'associate degree in fire protection technology'],
        },
        police_officer: {
            employers: ['municipal police department', 'county sheriff\'s office', 'state police', 'transit authority police', 'campus police', 'tribal law enforcement'],
            educations: ['police academy training', 'B.A. in Criminal Justice', 'B.S. in Criminology', 'associate degree + academy', 'military service + academy transfer'],
        },
        soldier: {
            employers: ['U.S. Army', 'U.S. Marine Corps', 'U.S. Air Force', 'U.S. Navy', 'National Guard', 'Army Reserve', 'foreign military (seconded)', 'private military contractor'],
            educations: ['high school diploma + enlisted service', 'B.S. + officer commission', 'B.A. in History', 'B.S. in Engineering (ROTC)', 'West Point graduate', 'Naval Academy graduate'],
        },
        foreign_service_officer: {
            employers: ['U.S. Department of State', 'USAID', 'National Security Council', 'CIA (cover assignment)', 'U.S. Embassy (various postings)', 'Peace Corps (former)'],
            educations: ['B.A. in International Relations', 'M.A. in Diplomacy', 'B.A. in Political Science', 'M.A. in International Affairs', 'J.D. + foreign service exam', 'M.A. in Regional Studies'],
        },
        intelligence_analyst: {
            employers: ['CIA', 'DIA', 'NSA', 'State Department INR', 'NGA', 'private intelligence firm', 'defense contractor (cleared)', 'think tank (with IC ties)'],
            educations: ['B.A. in Political Science', 'M.A. in Intelligence Studies', 'B.S. in Data Science', 'M.A. in International Relations', 'B.A. in History', 'M.S. in Cybersecurity'],
        },
        intelligence_case_officer: {
            employers: ['CIA Directorate of Operations', 'DIA HUMINT', 'NSA', 'DoD JSOC element', 'State INR (cover)', 'FBI counterintelligence'],
            educations: ['B.A. in a foreign language', 'M.A. in Area Studies', 'B.A. in Political Science', 'M.A. in History', 'B.S. in Computer Science', 'J.D. (cover career)'],
        },
        lawyer: {
            employers: ['U.S. Department of Justice', 'private law firm', 'federal public defender', 'corporate counsel', 'FBI legal division', 'ACLU', 'state attorney general\'s office', 'JAG Corps'],
            educations: ['J.D. from a top-ten law school', 'J.D. from a regional law school', 'LL.M. in International Law', 'J.D. with specialization in national security', 'J.D. + Ph.D. (law & policy)'],
        },
        media_specialist: {
            employers: ['The New York Times', 'Associated Press', 'Reuters', 'Washington Post', 'independent news outlet', 'documentary production company', 'public broadcasting service', 'war correspondent (freelance)'],
            educations: ['B.A. in Journalism', 'M.A. in Journalism', 'B.A. in Communications', 'B.A. in English', 'M.A. in Political Communication', 'self-taught + experience'],
        },
        nurse_paramedic: {
            employers: ['urban trauma center', 'county emergency services', 'military field hospital (civilian support)', 'CDC', 'international medical NGO', 'flight paramedic service', 'rural hospital'],
            educations: ['B.S.N. in Nursing', 'A.S.N. + RN license', 'Paramedic certification', 'M.S.N. in Advanced Practice', 'EMT-Paramedic + specialty training', 'combat medic training + civilian bridge'],
        },
        pilot: {
            employers: ['U.S. Air Force', 'U.S. Navy (carrier aviation)', 'U.S. Army aviation', 'commercial airline', 'private charter company', 'medevac service', 'DEA aviation division', 'CIA air branch'],
            educations: ['B.S. in Aerospace Engineering', 'B.S. in Aviation Science', 'military pilot training (ATP-equivalent)', 'ATP certificate', 'commercial pilot license + instrument rating', 'Naval flight officer training'],
        },
        program_manager: {
            employers: ['DARPA', 'DoD Acquisition & Sustainment', 'Department of Energy', 'Booz Allen Hamilton', 'SAIC', 'aerospace prime contractor', 'NSA', 'DIA'],
            educations: ['M.B.A.', 'M.P.A. (Master of Public Administration)', 'B.S. in Engineering + PMP certification', 'M.S. in Systems Engineering', 'B.A. in Business Administration + master\'s'],
        },
        default: {
            employers: ['government agency', 'private sector', 'NGO', 'military branch', 'law enforcement', 'academic institution', 'independent contractor'],
            educations: ['B.A. (general studies)', 'B.S. (technical field)', 'trade certification', 'military training', 'vocational degree', 'some college, no formal degree'],
        },
    },
};

// Maps module profession keys to bio data profile keys where they differ
const PROFESSION_KEY_MAP = {
    computer_scientist: 'engineer',
    soldier_marine: 'soldier',
    police_officer: 'police_officer',
    foreign_service: 'foreign_service_officer',
    lawyer_executive: 'lawyer',
    pilot_sailor: 'pilot',
    // all others: use key as-is
};

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function titleCaseGeneratedValue(value) {
    return value.replace(/\b[a-z][a-z'-]*\b/g, word => capitalize(word));
}

/**
 * Generate a random biography object for a Delta Green agent.
 * @param {object} stats - { str, con, dex, int, pow, cha }
 * @param {string} professionKey - Profession key from wizard data
 * @returns {{ biography: object, physical: object }}
 */
export function generateBio(stats = {}, professionKey = '') {
    const { str = 10, con = 10 } = stats;

    // — Gender & Name —
    const genders = ['male', 'male', 'male', 'female', 'female', 'female', 'non-binary'];
    const gender = rand(genders);
    const firstName = rand(BIO_DATA.firstNames[gender]);
    const lastName = rand(BIO_DATA.lastNames);

    // — Sex field label —
    const sexLabels = { male: 'Male', female: 'Female', 'non-binary': 'Non-binary' };
    const sex = sexLabels[gender];

    // — Age —
    const age = String(Math.floor(Math.random() * 41) + 25); // 25–65

    // — Nationality —
    const nationality = rand(BIO_DATA.nationalities);

    // — Build & Height descriptors from stats —
    const combined = str + con;
    let buildTier;
    if (combined >= 36) buildTier = 'high';
    else if (combined >= 28) buildTier = 'athletic';
    else if (combined >= 20) buildTier = 'average';
    else buildTier = 'low';

    // — Feature pool based on strength/con combo —
    let featurePool;
    if (combined >= 32) featurePool = BIO_DATA.notableFeatures.high_str_con;
    else if (combined <= 18) featurePool = BIO_DATA.notableFeatures.low_str_con;
    else featurePool = BIO_DATA.notableFeatures.neutral;

    const build = rand(BIO_DATA.buildDescriptors[buildTier]);
    const baseHeight = gender === 'male' ? 69 : gender === 'female' ? 64 : 67;
    const heightInches = Math.max(58, Math.min(79,
        baseHeight + Math.round((str - 10) * 0.25) + Math.floor(Math.random() * 9) - 4
    ));
    const height = `${Math.floor(heightInches / 12)}'${heightInches % 12}"`;
    const buildWeight = { low: -18, average: 0, athletic: 14, high: 34 }[buildTier];
    const weight = Math.max(90, Math.min(320,
        Math.round(((heightInches - 60) * 5 + 120 + buildWeight + Math.floor(Math.random() * 21) - 10) / 5) * 5
    ));
    const hairColor = rand(BIO_DATA.hairColors);
    const hairStyle = rand(BIO_DATA.hairStyles);
    const eyes = rand(BIO_DATA.eyeColors);
    const complexion = rand(BIO_DATA.skinTones);
    const feature = rand(featurePool);

    const hairDesc = `${hairColor} ${hairStyle} hair`;
    // — Profession-linked employer & education —
    const profileKey = PROFESSION_KEY_MAP[professionKey] || professionKey || 'default';
    const profile = BIO_DATA.professionProfiles[profileKey] || BIO_DATA.professionProfiles.default;
    const employer = titleCaseGeneratedValue(rand(profile.employers));
    const education = rand(profile.educations);

    return {
        biography: { name: `${firstName} ${lastName}`, sex, age, nationality, employer, education },
        physical: {
            height,
            weight: `${weight} lb`,
            build: capitalize(build),
            hair: capitalize(hairDesc),
            eyes: capitalize(eyes),
            complexion: capitalize(complexion),
            distinguishingFeatures: feature,
            notes: '',
        },
    };
}
