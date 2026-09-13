const makeProfile = ({ title, agency, bonds, skills, suggested = [] }) => ({
  title: `${title} [The Complex]`,
  source: "The Complex",
  agency,
  suggestedBonusSkills: suggested,
  description: [
    title,
    agency,
    "",
    "PROFESSIONAL SKILLS:",
    ...skills.map(({ name, value }) => `» ${name} ${value}%`),
    "",
    `BONDS: ${bonds}`,
    suggested.length ? `SUGGESTED BONUS SKILLS: ${suggested.join(", ")}` : ""
  ].filter(line => line !== "").join("\n"),
  requiredSkills: skills,
  optionalSkills: []
});

const skills = entries => entries.map(([name, value]) => ({ name, value }));

export const COMPLEX_PROFESSIONS = {
  complex_cbp_marine_interdiction: makeProfile({
    title: "Marine Interdiction Agent", agency: "Customs and Border Protection, AMO/MI", bonds: 2,
    skills: skills([["Alertness",50],["Bureaucracy",30],["Criminology",50],["Drive",50],["Firearms",50],["Forensics",30],["Foreign Language (Spanish)",50],["Heavy Weapons",30],["HUMINT",60],["Law",30],["Persuade",40],["Pilot (Boat)",60],["Search",50],["Swim",50],["Unarmed Combat",60]]),
    suggested: ["Alertness","Athletics","Search","SIGINT"]
  }),
  complex_cbp_borstar: makeProfile({
    title: "BORSTAR Rescue Specialist", agency: "Customs and Border Protection, SOG/BORSTAR", bonds: 2,
    skills: skills([["Bureaucracy",50],["First Aid",60],["Forensics",50],["Medicine",60],["Navigate",40],["Persuade",40],["Pharmacy",50],["Science (Biology)",50],["Search",50],["Surgery",50],["Survival",30]]),
    suggested: ["Firearms","First Aid","Medicine","Survival"]
  }),
  complex_cbp_bortac: makeProfile({
    title: "BORTAC Operator", agency: "Customs and Border Protection, SOG/BORTAC", bonds: 2,
    skills: skills([["Alertness",50],["Bureaucracy",20],["Criminology",50],["Drive",50],["Firearms",50],["Forensics",30],["Foreign Language (Spanish)",40],["HUMINT",40],["Law",30],["Navigate",60],["Persuade",50],["Pharmacy",50],["Search",50],["Survival",60],["Unarmed Combat",60]]),
    suggested: ["Alertness","Firearms","Melee Weapons","Military Science (Land)"]
  }),
  complex_atf_criminal_analyst: makeProfile({
    title: "Criminal Investigative Analyst", agency: "Bureau of Alcohol, Tobacco, Firearms and Explosives", bonds: 3,
    skills: skills([["Bureaucracy",40],["Computer Science",40],["Criminology",50],["Foreign Language (Spanish)",40],["HUMINT",60],["Forensics",40],["Law",40],["Psychotherapy",30],["Science (Statistics)",50],["Science (Biology)",50]]),
    suggested: ["Criminology","Forensics","Law","Psychotherapy"]
  }),
  complex_atf_tactical_medic: makeProfile({
    title: "Tactical Medic", agency: "ATF Special Response Team", bonds: 1,
    skills: skills([["Alertness",50],["Bureaucracy",40],["Criminology",50],["Drive",50],["Firearms",50],["First Aid",50],["Forensics",30],["HUMINT",60],["Law",30],["Medicine",30],["Military Science (Land)",30],["Persuade",50],["Pharmacy",50],["Search",50],["Unarmed Combat",60]]),
    suggested: ["Firearms","First Aid","Science (Biology or Veterinary)","Surgery"]
  }),
  complex_atf_tactical_operator: makeProfile({
    title: "Tactical Operations Specialist", agency: "ATF Special Response Team", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",60],["Demolitions",50],["Dodge",60],["Firearms",60],["First Aid",40],["Heavy Weapons",50],["Melee Weapons",50],["Military Science (Land)",30],["Navigate",50],["Stealth",60],["Survival",50],["Swim",50],["Unarmed Combat",60]]),
    suggested: ["Athletics","Demolitions","Firearms","HUMINT"]
  }),
  complex_atf_explosives_specialist: makeProfile({
    title: "Explosives Specialist", agency: "Bureau of Alcohol, Tobacco, Firearms and Explosives", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",60],["Artillery",40],["Demolitions",60],["Dodge",60],["Firearms",50],["First Aid",40],["Heavy Machinery",60],["Heavy Weapons",50],["Military Science (Land)",20],["Stealth",50],["Survival",50],["Swim",50],["Unarmed Combat",50]]),
    suggested: ["Criminology","Demolitions","Forensics","Science (Chemistry or Physics)"]
  }),
  complex_usss_cat: makeProfile({
    title: "Counter Assault Team Operator", agency: "United States Secret Service", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",60],["Demolitions",40],["Drive",50],["Firearms",60],["First Aid",40],["Heavy Weapons",50],["Melee Weapons",50],["Military Science (Land)",60],["Navigate",50],["Stealth",50],["Survival",50],["Swim",50],["Unarmed Combat",60]]),
    suggested: ["Alertness","Criminology","Firearms","Law"]
  }),
  complex_usss_ppd: makeProfile({
    title: "Personal Protective Detail Agent", agency: "United States Secret Service", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",50],["Criminology",30],["Demolitions",40],["Drive",50],["Firearms",60],["Heavy Weapons",50],["HUMINT",60],["Law",20],["Melee Weapons",50],["Navigate",50],["Stealth",50],["Survival",50],["Swim",50],["Unarmed Combat",60]]),
    suggested: ["Athletics","First Aid","Military Science (Land)","Search"]
  }),
  complex_uscg_sar: makeProfile({
    title: "Search and Rescue Specialist", agency: "United States Coast Guard", bonds: 2,
    skills: skills([["Alertness",60],["Athletics",60],["Craft (Electrician)",40],["Craft (Mechanic)",40],["First Aid",50],["Foreign Language (Spanish)",20],["HUMINT",40],["Navigate",50],["Pilot (Small Boat)",50],["Pilot (Helicopter)",30],["Science (Meteorology)",50],["Swim",60]]),
    suggested: ["Alertness","First Aid","Navigate","Swim"]
  }),
  complex_uscg_taclet: makeProfile({
    title: "Tactical Law Enforcement Team Member", agency: "United States Coast Guard", bonds: 2,
    skills: skills([["Alertness",50],["Athletics",40],["Bureaucracy",40],["Criminology",50],["Drive",50],["Firearms",50],["Foreign Language (Spanish)",50],["Forensics",30],["Heavy Weapons",50],["HUMINT",60],["Law",30],["Persuade",50],["Search",50],["Swim",60],["Unarmed Combat",60]]),
    suggested: ["Alertness","Firearms","Military Science (Sea)","Pilot (Boat)"]
  }),
  complex_uscg_msst: makeProfile({
    title: "Maritime Safety and Security Team Member", agency: "United States Coast Guard", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",50],["Bureaucracy",30],["Craft (Mechanic)",40],["Criminology",40],["Firearms",40],["Heavy Weapons",50],["Law",40],["Military Science (Sea)",50],["Navigate",50],["Pilot (Small Boat)",60],["Science (Meteorology)",40],["Search",30],["Swim",60]]),
    suggested: ["Alertness","Forensics","HUMINT","Stealth"]
  }),
  complex_uscg_hitron: makeProfile({
    title: "HITRON Specialist", agency: "United States Coast Guard", bonds: 2,
    skills: skills([["Alertness",60],["Athletics",40],["Bureaucracy",30],["Craft (Electrician)",50],["Craft (Mechanic)",50],["Firearms",60],["Heavy Machinery",40],["Military Science (Sea)",50],["Navigate",50],["Pilot (Helicopter)",50],["Science (Meteorology)",40],["Swim",50]]),
    suggested: ["Alertness","Craft (Mechanic)","Firearms","Pilot (Helicopter)"]
  }),
  complex_uscg_msrt: makeProfile({
    title: "Maritime Security Response Team Operator", agency: "United States Coast Guard", bonds: 1,
    skills: skills([["Alertness",60],["Athletics",60],["Demolitions",40],["Dodge",60],["Firearms",60],["Heavy Weapons",50],["Melee Weapons",50],["Military Science (Sea)",60],["Navigate",50],["Search",40],["Stealth",50],["Survival",50],["Swim",50],["Unarmed Combat",60]]),
    suggested: ["Alertness","Athletics","Firearms","Law"]
  }),
  complex_nsa_cryptoanalysis: makeProfile({
    title: "Cryptoanalysis Unit Specialist", agency: "National Security Agency", bonds: 3,
    skills: skills([["Accounting",50],["Bureaucracy",40],["Computer Science",60],["Craft (Microelectronics)",60],["Criminology",50],["Foreign Language (choose one)",40],["Science (Engineering or Physics)",60],["Science (Mathematics or Predictive Analytics)",60],["SIGINT",60]]),
    suggested: ["Computer Science","Craft (Microelectronics)","Science (Mathematics)","SIGINT"]
  }),
  complex_nsa_tao: makeProfile({
    title: "Tailored Access Operations Specialist", agency: "National Security Agency", bonds: 2,
    skills: skills([["Accounting",50],["Bureaucracy",50],["Computer Science",60],["Craft (Electrician)",30],["Craft (Mechanic)",30],["Craft (Microelectronics)",50],["Criminology",60],["Foreign Language (choose one)",60],["HUMINT",50],["Science (Mathematics)",40],["SIGINT",60]]),
    suggested: ["Bureaucracy","Computer Science","Foreign Language","SIGINT"]
  }),
  complex_nsa_remote_device: makeProfile({
    title: "Remote Device Activities Specialist", agency: "National Security Agency", bonds: 2,
    skills: skills([["Alertness",50],["Craft (Electrician)",40],["Craft (Locksmithing)",60],["Criminology",50],["Disguise",50],["Dodge",40],["Drive",50],["Firearms",40],["Law",40],["Melee Weapons",40],["Persuade",50],["Search",60],["Stealth",60],["Unarmed Combat",50]]),
    suggested: ["Craft (Mechanic)","Craft (Microelectronics)","Science (Physics)","Search"]
  }),
  complex_nps_interpretive_ranger: makeProfile({
    title: "Interpretive Ranger", agency: "National Park Service", bonds: 2,
    skills: skills([["Bureaucracy",50],["First Aid",60],["Forensics",50],["History",60],["HUMINT",60],["Navigate",40],["Persuade",60],["Science (choose one)",60],["Search",50],["Survival",60]]),
    suggested: ["Firearms","First Aid","Medicine","Survival"]
  }),
  complex_nasa_astronaut_pilot: makeProfile({
    title: "Astronaut Corps Pilot", agency: "National Aeronautics and Space Administration", bonds: 2,
    skills: skills([["Alertness",60],["Athletics",50],["Bureaucracy",30],["Craft (Electrician)",40],["Craft (Mechanic)",40],["Military Science (Air)",30],["Navigate",50],["Pilot (Airplane)",60],["Pilot (Spacecraft, Space Suit, or Remotely Operated Vehicle)",60],["Science (Meteorology)",40],["Science (Physics)",40],["Swim",40]]),
    suggested: ["Heavy Machinery","Science (Biology)","Science (Mathematics)","Science (Meteorology)"]
  }),
  complex_private_targeting_officer: makeProfile({
    title: "Targeting Officer", agency: "Private intelligence contractor", bonds: 3,
    skills: skills([["Accounting",50],["Anthropology",60],["Bureaucracy",40],["Computer Science",40],["Criminology",50],["Foreign Language (choose one)",50],["Forensics",30],["HUMINT",60],["History",60],["SIGINT",60]]),
    suggested: ["Bureaucracy","History","Law","Search"]
  })
};
