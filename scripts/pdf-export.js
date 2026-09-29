/**
 * DD Form 315 PDF Export — Delta Green Agent Wizard module
 *
 * Adapted from DELTA-GREEN-STATS/pdf-export.js. Core field-mapping logic is
 * kept identical so both can be updated in tandem. The only differences are:
 *   • TEMPLATE_URL points to the module asset bundle
 *   • exportToPDF(state) accepts a pre-built state object instead of reading
 *     the DOM via window.dgSaveLoad.collectState()
 *   • Notifications use Foundry's ui.notifications
 *
 * State object shape — matches dgSaveLoad.collectState() from the web app:
 *   csStats:           { STR, CON, DEX, INT, POW, CHA }
 *   derived:           { hp, wp, san, bp }
 *   bio:               { name, profession, employer, nationality, sex, age,
 *                        education, physicalDesc, motivations, personalDetails }
 *   skills:            { [key]: value }  (effective values, bonuses pre-applied)
 *   skillSpecs:        { [key]: specialty string }  (legacy / fallback)
 *   customSkills:      [{ name, value }]
 *   specialtyInstances:[{ key, specialty, value }]  (art/craft/science/pilot/military_science/foreign_language)
 *   bonds:             [{ name, score, relationship?, description? }]
 *   sanity:            { violence: [bool,bool,bool], helplessness: [bool,bool,bool] }
 *   lpNotes:           { wounds, gear, remarks }
 *   lpFeat:            { [statKey]: string }
 *   lpWeapons:         [{ name, skillPct, range, damage, lethality, ammo }]
 *   equipment:         string[]  (item names — non-weapon gear)
 */

"use strict";

const TEMPLATE_URL = "modules/delta-green-agent-creator/assets/Delta-Green-RPG-Character-Sheet.pdf";
const PDF_LIB_URL  = "modules/delta-green-agent-creator/scripts/vendor/pdf-lib.min.js";

// ── Skill key → AcroForm field name ──────────────────────────────────────────
// Copied verbatim from DELTA-GREEN-STATS/pdf-export.js — keep in sync.
const SKILL_FIELD = {
    accounting:       "Accounting 10",
    alertness:        "Alertness 20",
    anthropology:     "Anthropology 0",
    archeology:       "Archeology 0",
    art:              "Art 0",
    artillery:        "Artillery 0",
    athletics:        "Athletics 30",
    bureaucracy:      "Bureaucracy 10",
    computer_science: "Computer Science 0",
    craft:            "Craft 0",
    criminology:      "Criminology 10",
    demolitions:      "Demolitions 0",
    disguise:         "Disguise 10",
    dodge:            "Dodge 30",
    drive:            "Drive 20",
    firearms:         "Firearms 20",
    first_aid:        "First Aid 10",
    forensics:        "Forensics 0",
    heavy_machiner:   "Heavy Machinery 10",
    heavy_weapons:    "Heavy Weapons 0",
    history:          "History 10",
    humint:           "HUMINT 10",
    law:              "Law 0",
    medicine:         "Medicine 0",
    melee_weapons:    "Melee Weapons 30",
    military_science: "Military Science 0",
    navigate:         "Navigate 10",
    occult:           "Occult 10",
    persuade:         "Persuade 20",
    pharmacy:         "Pharmacy 0",
    pilot:            "Pilot 0",
    psychotherapy:    "Psychotherapy 10",
    ride:             "Ride 10",
    science:          "Science 0",
    search:           "Search 20",
    sigint:           "SIGINT 0",
    stealth:          "Stealth 10",
    surgery:          "Surgery 0",
    survival:         "Survival 10",
    swim:             "Swim 20",
    unarmed_combat:   "Unarmed Combat 40",
    unnatural:        "Unnatural 0",
};

// Specialty skills that have both a score field and a label field in the PDF
const SPECIALTY_LABEL_FIELD = {
    art:              "Art",
    craft:            "Craft",
    pilot:            "Pilot",
    science:          "Science",
    military_science: "Military Science",
};

const WEAPON_LETTERS = ["a", "b", "c", "d", "e", "f", "g"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadPdfLib() {
    return new Promise((resolve, reject) => {
        if (window.PDFLib) { resolve(); return; }
        const s = document.createElement("script");
        s.src = PDF_LIB_URL;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Could not load the bundled PDF library."));
        document.head.appendChild(s);
    });
}

function setField(form, fieldName, value, { fontSize = null } = {}) {
    if (value === null || value === undefined || value === "") return;
    const str = String(value).trim();
    if (!str) return;
    try {
        const field = form.getTextField(fieldName);
        if (fontSize) field.setFontSize(fontSize);
        field.setText(str);
    } catch (_) { }
}

function checkBox(form, fieldName, doCheck) {
    try {
        const field = form.getCheckBox(fieldName);
        field.uncheck();
        if (doCheck) field.check();
    } catch (_) { }
}

function plainText(value) {
    const text = String(value ?? "");
    if (!text.includes("<")) return text.trim();
    const node = document.createElement("div");
    node.innerHTML = text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(?:p|div|li|h[1-6]|blockquote)\s*>/gi, "\n");
    return (node.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function formatPersonalDetails(value) {
    const labels = ["Height", "Weight", "Build", "Hair", "Eyes", "Complexion", "Distinguishing Features", "Notes"];
    const pattern = new RegExp(`\\s*(?=(${labels.join("|")}):)`, "gi");
    return String(value ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(pattern, "\n")
        .replace(/^\n/, "")
        .replace(/\n{2,}/g, "\n")
        .trim();
}

function parseLabeledDetails(value) {
    const formatted = formatPersonalDetails(value);
    const details = {};
    for (const line of formatted.split("\n")) {
        const separator = line.indexOf(":");
        if (separator < 0) continue;
        details[line.slice(0, separator).trim().toLowerCase()] = line
            .slice(separator + 1)
            .trim()
            .replace(/;+\s*$/, "")
            .trim();
    }
    return { formatted, details };
}

function formatPhysicalDescription(value) {
    const { formatted, details } = parseLabeledDetails(value);
    const line = labels => labels
        .map(label => details[label.toLowerCase()] ? `${label}: ${details[label.toLowerCase()]}` : "")
        .filter(Boolean)
        .join("; ");
    const compact = [
        line(["Height", "Weight", "Build"]),
        line(["Hair", "Eyes", "Complexion"]),
        line(["Distinguishing Features"]),
    ].filter(Boolean);
    return compact.length ? compact.join("\n") : formatted;
}

function extractPersonalNotes(value) {
    return parseLabeledDetails(value).details.notes || "";
}

function normalizeSpecialtyGroup(value) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
    const aliases = {
        foreignlanguage: "foreign_language",
        militaryscience: "military_science",
    };
    return aliases[normalized] || normalized;
}

function bondFontSize(value) {
    const length = String(value ?? "").length;
    if (length > 52) return 4;
    if (length > 40) return 5;
    if (length > 30) return 6;
    return 7;
}

function shortIdentityFontSize(value) {
    const length = String(value ?? "").length;
    if (length > 12) return 5;
    if (length > 8) return 6;
    return null;
}

function longIdentityFontSize(value) {
    const length = String(value ?? "").length;
    if (length > 48) return 6;
    if (length > 36) return 7;
    if (length > 28) return 8;
    return null;
}

function overflowSkillFontSize(value) {
    const length = String(value ?? "").length;
    if (length > 36) return 5;
    if (length > 26) return 6;
    return 7;
}

function actorSkillTarget(actor, weapon) {
    const system = weapon.system || {};
    const modifier = numeric(system.skillModifier);
    const fixed = actor.system?.skills?.[system.skill]?.proficiency;
    if (Number.isFinite(Number(fixed))) return numeric(fixed) + modifier;
    const typed = Object.values(actor.system?.typedSkills || {}).find(skill =>
        skill?.id === system.skill || skill?.label === system.skill
    );
    if (typed) return numeric(typed.proficiency) + modifier;
    return numeric(system.customSkillTarget) + modifier;
}

/** Build export state from a live Delta Green Agent actor. */
export function buildActorPdfState(actor) {
    if (!actor || actor.type !== "agent") throw new Error("PDF export requires a Delta Green Agent.");
    const system = actor.system || {};
    const statKeys = ["str", "con", "dex", "int", "pow", "cha"];
    const csStats = Object.fromEntries(statKeys.map(key => [key.toUpperCase(), numeric(system.statistics?.[key]?.value)]));
    const lpFeat = Object.fromEntries(statKeys.map(key => [key.toUpperCase(), system.statistics?.[key]?.distinguishing_feature || ""]));
    const skills = Object.fromEntries(Object.entries(system.skills || {}).map(([key, skill]) => [key, numeric(skill?.proficiency)]));
    const specialtyInstances = [];
    const customSkills = [];
    for (const skill of Object.values(system.typedSkills || {})) {
        const label = skill?.label || skill?.name || "Other Skill";
        const group = normalizeSpecialtyGroup(skill?.group);
        if (["art", "craft", "foreign_language", "military_science", "pilot", "science"].includes(group)) {
            specialtyInstances.push({ key: group, specialty: label, value: numeric(skill?.proficiency) });
        } else {
            customSkills.push({ name: label, value: numeric(skill?.proficiency) });
        }
    }
    const items = Array.from(actor.items || []);
    const bonds = items.filter(item => item.type === "bond").map(item => ({
        name: item.name,
        relationship: item.system?.relationship || "",
        score: numeric(item.system?.score),
        description: plainText(item.system?.description),
    }));
    const motivations = items.filter(item => item.type === "motivation").map(item => {
        const disorder = item.system?.disorder ? ` (${item.system.disorder})` : "";
        return `${item.name}${disorder}`;
    });
    const weapons = items.filter(item => item.type === "weapon").map(item => ({
        name: item.name,
        skillPct: actorSkillTarget(actor, item),
        range: item.system?.range || "",
        damage: item.system?.damage || "",
        armorPiercing: item.system?.armorPiercing ?? "",
        lethality: numeric(item.system?.lethality) > 0 ? `${numeric(item.system.lethality)}%` : "",
        killRadius: item.system?.killRadius || "",
        ammo: item.system?.ammo || "",
    }));
    const equipment = items.filter(item => ["armor", "gear"].includes(item.type)).map(item => {
        if (item.type === "armor" && item.system?.protection !== undefined) return `${item.name} (Armor ${item.system.protection})`;
        return item.name;
    });
    const specialTraining = Array.from(system.specialTraining || []).map(training => {
        const attribute = training?.attribute || training?.id || "";
        let label = attribute;
        if (statKeys.includes(attribute)) label = `${attribute.toUpperCase()}x5`;
        else if (system.skills?.[attribute]?.label) label = system.skills[attribute].label;
        else if (system.typedSkills?.[attribute]?.label) label = system.typedSkills[attribute].label;
        return { name: training?.name || "", value: label };
    });
    const violence = system.sanity?.adaptations?.violence || {};
    const helplessness = system.sanity?.adaptations?.helplessness || {};
    const actorPhysicalDescription = plainText(system.physical?.description);
    return {
        csStats,
        derived: {
            hp: numeric(system.health?.max), hpCurrent: numeric(system.health?.value),
            wp: numeric(system.wp?.max), wpCurrent: numeric(system.wp?.value),
            san: numeric(system.sanity?.max), sanCurrent: numeric(system.sanity?.value),
            bp: numeric(system.sanity?.currentBreakingPoint),
        },
        bio: {
            name: actor.name,
            profession: system.biography?.profession,
            employer: system.biography?.employer,
            nationality: system.biography?.nationality,
            sex: system.biography?.sex,
            age: system.biography?.age,
            education: system.biography?.education,
            physicalDesc: formatPhysicalDescription(actorPhysicalDescription),
            motivations: motivations.join("\n"),
            personalDetails: extractPersonalNotes(actorPhysicalDescription),
        },
        skills, skillSpecs: {}, customSkills, specialtyInstances, bonds,
        sanity: {
            violence: [violence.incident1, violence.incident2, violence.incident3].map(Boolean),
            helplessness: [helplessness.incident1, helplessness.incident2, helplessness.incident3].map(Boolean),
        },
        lpNotes: { wounds: plainText(system.physical?.wounds), gear: "", remarks: "" },
        lpFeat, lpWeapons: weapons, equipment, specialTraining,
    };
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Populate and download a DD Form 315 PDF from character state.
 *
 * @param {object} state  Character state in collectState() shape (see file header).
 */
export async function exportToPDF(state) {
    const bio = state.bio || {};
    const safeName = (bio.name || "Agent").replace(/[^a-z0-9 \-_]/gi, "").trim() || "Agent";
    const filename = safeName + " - Delta Green Character Sheet.pdf";
    let fileHandle = null;
    if (typeof globalThis.showSaveFilePicker === "function") {
        try {
            fileHandle = await globalThis.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }],
            });
        } catch (error) {
            if (error?.name === "AbortError") return;
            console.warn("[DG PDF Export] Native save picker unavailable; using browser download.", error);
        }
    }
    ui.notifications?.info("Building PDF…");
    try {
        await loadPdfLib();
        const { PDFDocument } = window.PDFLib;

        const bytes = await fetch(TEMPLATE_URL).then(r => {
            if (!r.ok) throw new Error("Template not found (HTTP " + r.status + ").");
            return r.arrayBuffer();
        });

        const pdfDoc = await PDFDocument.load(bytes);
        const form  = pdfDoc.getForm();

        const stats             = state.csStats            || state.stats || {};
        const derived           = state.derived            || {};
        const skills            = state.skills             || {};
        const skillSpec         = state.skillSpecs         || {};
        const bonds             = state.bonds              || [];
        const custom            = state.customSkills       || [];
        const specialtyInstances= state.specialtyInstances || [];
        const sanity            = state.sanity             || {};
        const lpNotes           = state.lpNotes            || {};
        const lpFeat            = state.lpFeat             || {};
        const lpWeapons         = state.lpWeapons          || [];
        const equipment         = state.equipment          || [];

        // ── Personal data ────────────────────────────────────────────────────
        setField(form, "1 LAST NAME FIRST NAME MIDDLE INITIAL", bio.name);
        setField(form, "2 PROFESSION RANK IF APPLICABLE",       bio.profession, { fontSize: longIdentityFontSize(bio.profession) });
        setField(form, "3 EMPLOYER",                            bio.employer, { fontSize: longIdentityFontSize(bio.employer) });
        setField(form, "4 NATIONALITY",                         bio.nationality);
        setField(form, "SEX",                                   bio.sex, { fontSize: shortIdentityFontSize(bio.sex) });
        setField(form, "6 AGE AND DOB",                         bio.age);
        setField(form, "7 EDUCATION AND OCCUPATION",            bio.education, { fontSize: longIdentityFontSize(bio.education) });
        setField(form, "10 PHYSICAL DESCRIPTION",               formatPhysicalDescription(bio.physicalDesc), { fontSize: 7 });
        setField(form, "12 MOTIVATIONS AND MENTAL DISORDERSPSYCHOLOGICAL DATA", bio.motivations);

        // ── Statistics + distinguishing features ─────────────────────────────
        ["STR", "CON", "DEX", "INT", "POW", "CHA"].forEach(st => {
            const val = numeric(stats[st], 3);
            setField(form, st,          String(val));
            setField(form, st + "x5",   String(val * 5));
            const feat = lpFeat[st] || "";
            setField(form, st + " DISTINGUISHING FEATURES", feat);
        });

        // ── Derived attributes ───────────────────────────────────────────────
        setField(form, "MAXIMUMHit Points HP",         derived.hp);
        setField(form, "CURRENTHit Points HP",         derived.hpCurrent ?? derived.hp);
        setField(form, "MAXIMUMWillpower Points WP",   derived.wp);
        setField(form, "CURRENTWillpower Points WP",   derived.wpCurrent ?? derived.wp);
        setField(form, "MAXIMUMSanity Points SAN",     derived.san);
        setField(form, "CURRENTSanity Points SAN",     derived.sanCurrent ?? derived.san);
        setField(form, "CURRENTBreaking Point BP",     derived.bp);

        // ── Specialty skills ─────────────────────────────────────────────────
        const SPECIALTY_KEYS      = Object.keys(SPECIALTY_LABEL_FIELD); // art, craft, science, pilot, military_science
        const SPECIALTY_BASE_NAME = { art: "Art", craft: "Craft", science: "Science", pilot: "Pilot", military_science: "Military Science" };

        // Overflow queue: instances that don't fit the main row → Foreign Language slots
        const overflowSpecialties = [];

        // Foreign Language has no PDF main-row field — all instances go straight to overflow
        specialtyInstances
            .filter(i => i.key === "foreign_language" && i.value > 0)
            .sort((a, b) => b.value - a.value)
            .forEach(inst => {
                overflowSpecialties.push({
                    name:  inst.specialty || "Foreign Language",
                    value: inst.value,
                });
            });

        // Specialty skills: best instance fills main row; extras go to overflow
        SPECIALTY_KEYS.forEach(key => {
            const instances = specialtyInstances
                .filter(i => i.key === key && i.value > 0)
                .sort((a, b) => b.value - a.value);
            if (instances.length === 0) {
                // Fallback: plain skills[key] + skillSpec[key]
                const val = skills[key];
                if (val && val > 0) {
                    setField(form, SKILL_FIELD[key], String(val));
                    const spec = skillSpec[key];
                    if (spec) setField(form, SPECIALTY_LABEL_FIELD[key], spec);
                }
                return;
            }
            const best = instances[0];
            setField(form, SKILL_FIELD[key], String(best.value));
            setField(form, SPECIALTY_LABEL_FIELD[key], best.specialty || SPECIALTY_BASE_NAME[key]);
            // Remaining → overflow
            instances.slice(1).forEach(inst => {
                const label = inst.specialty
                    ? SPECIALTY_BASE_NAME[key] + " (" + inst.specialty + ")"
                    : SPECIALTY_BASE_NAME[key];
                overflowSpecialties.push({ name: label, value: inst.value });
            });
        });

        // ── Non-specialty skills ─────────────────────────────────────────────
        Object.entries(SKILL_FIELD).forEach(([key, fieldName]) => {
            if (SPECIALTY_KEYS.includes(key)) return;
            const val = skills[key];
            if (val && val > 0) setField(form, fieldName, String(val));
        });

        // ── Bonds (up to 6) ──────────────────────────────────────────────────
        bonds.slice(0, 6).forEach((b, i) => {
            const n        = i + 1;
            const name     = b.name || b.label || "";
            const rel      = b.relationship || "";
            const bondLabel= name && rel ? name + " (" + rel + ")" : name || rel;
            setField(form, "BOND " + n,       bondLabel, { fontSize: bondFontSize(bondLabel) });
            setField(form, "BOND " + n + " SCORE", b.score != null ? String(b.score) : "");
        });

        // ── Foreign Language / Other Skills overflow slots (up to 6) ─────────
        const overflowNames  = new Set(overflowSpecialties.map(s => s.name.toLowerCase()));
        const foreignSlots   = [
            ...overflowSpecialties,
            ...custom.filter(s => s.value > 0 && !overflowNames.has(s.name.toLowerCase())),
        ].slice(0, 6);
        foreignSlots.forEach((sk, i) => {
            const n = i + 1;
            setField(form, "Foreign Languages and Other Skills " + n,          sk.name  || "", { fontSize: overflowSkillFontSize(sk.name) });
            setField(form, "Foreign Languages and Other Skills " + n + " Score", String(sk.value));
        });

        // ── SAN incident checkboxes ───────────────────────────────────────────
        (sanity.violence    || []).forEach((v, i) => checkBox(form, "Check Box" + (i + 1), v));
        (sanity.helplessness|| []).forEach((v, i) => checkBox(form, "Check Box" + (i + 4), v));
        const sex = String(bio.sex || "").trim().toLowerCase();
        checkBox(form, "Check Box7", sex === "female" || sex === "f");
        checkBox(form, "Check Box8", sex === "male" || sex === "m");
        checkBox(form, "Check Box9", Boolean(sex) && !["female", "f", "male", "m"].includes(sex));

        // ── Page 2 ────────────────────────────────────────────────────────────
        setField(form, "14 WOUNDS AND AILMENTS_2", lpNotes.wounds);

        // Gear — equipment names (non-weapon items)
        const gearLines = [];
        if (lpNotes.gear) gearLines.push(lpNotes.gear);
        equipment.forEach(n => { if (n) gearLines.push(typeof n === "object" ? n.name : n); });
        setField(form, "15 ARMOR AND GEAR", gearLines.join("\n").trim());

        setField(form, "17 PERSONAL DETAILS AND NOTES", formatPersonalDetails(bio.personalDetails || lpNotes.remarks || ""));

        // ── Weapons table (from lpWeapons if present) ─────────────────────────
        lpWeapons.slice(0, 7).forEach((w, i) => {
            const lt = WEAPON_LETTERS[i];
            setField(form, "WEAPON"      + lt, w.name      || "");
            setField(form, "SKILL "      + lt, w.skillPct  || "");
            setField(form, "BASE RANGE"  + lt, w.range     || "");
            setField(form, "DAMAGE"      + lt, w.damage    || "");
            setField(form, "ARMOR PIERCING" + lt, w.armorPiercing ?? "");
            setField(form, "KILL DAMAGE" + lt, w.lethality || "");
            setField(form, "KILL RADIUS" + lt, w.killRadius|| "");
            setField(form, "AMMO "       + lt, w.ammo      || "");
        });

        // ── Special training — overflow custom skills beyond slot 6 ──────────
        const specialTraining = state.specialTraining || custom.filter(s => s.value > 0).slice(6);
        specialTraining.slice(0, 6).forEach((sk, i) => {
            const lt = WEAPON_LETTERS[i];
            setField(form, "SPECIAL TRAINING" + lt, sk.name  || "");
            setField(form, "SKILL OR STAT"    + lt, String(sk.value));
        });

        // ── Download ──────────────────────────────────────────────────────────
        form.updateFieldAppearances();
        const pdfBytes = await pdfDoc.save();
        if (fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(pdfBytes);
            await writable.close();
        } else {
            let binary = "";
            const chunkSize = 0x8000;
            for (let offset = 0; offset < pdfBytes.length; offset += chunkSize) {
                binary += String.fromCharCode(...pdfBytes.subarray(offset, offset + chunkSize));
            }
            const a = document.createElement("a");
            a.href = `data:application/octet-stream;base64,${btoa(binary)}`;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        ui.notifications?.info("PDF downloaded!");
    } catch (err) {
        console.error("[DG PDF Export]", err);
        ui.notifications?.error("PDF export failed — see console for details.");
    }
}
