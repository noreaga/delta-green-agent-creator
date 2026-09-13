// @ts-nocheck
import { PROFESSIONS } from './professions.js';
import { BONDS } from './bonds.js';
import { EQUIPMENT_CATALOG, EQUIPMENT_CATEGORIES } from './equipment.js';
import { generateBio } from './bio-data.js';
import { MOTIVATION_OPTIONS, VETERAN_DISORDERS } from './random-data.js';
import { getAllowedStatMethods, getSetting } from './settings.js';
import {
    createAgentExchange, downloadAgentExchange, encodeAgentCode, parseAgentExchange,
} from './agent-exchange.js';
import {
    SKILL_DEFAULTS, BONUS_SKILL_OPTIONS, SPECIALTY_PREFIXES, SPECIALTY_OPTIONS,
    parseSpecialtyFromName, parseSpecialtyFromKey,
    LOADOUTS, BOND_DATASETS, BONUS_PACKAGES,
    SKILL_TOOLTIPS, STAT_LABELS, STAT_TOOLTIPS, STAT_DESCRIPTOR_TIERS, getStatDescriptor, STEPS,
} from './constants.js';

// ---------------------------------------------------------------------------
// Wizard Application (ApplicationV2, Foundry v14)
// ---------------------------------------------------------------------------
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const QUICKSTART_PROFESSION_KEYS = new Set([
    'anthropologist',
    'computer_scientist',
    'federal_agent',
    'physician',
    'scientist',
    'special_operator',
]);

export class DeltaGreenChargenWizard extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @type {Actor} */
    #actor;

    /** @type {number}  index into STEPS[] */
    #step = 0;

    /** Furthest section reached during the current creator session. */
    #furthestStep = 0;

    /** Section that Ask Every Time can resume after showing the opening screen. */
    #resumeStep = 0;

    /** Reserved by the deferred equipment interface. */
    #equipCategory = 'All';

    /** Reserved by the deferred equipment interface. */
    #equipSearch = '';

    /** Scroll position restored after an interactive Statistics rerender. */
    #statsScrollTop = null;

    /** Whether this Actor already had saved creator progress when opened. */
    #hasSavedState = false;

    /** Identifies whether the current completed draft was guided, randomized, or imported. */
    #workflowOrigin = 'guided';

    /** Suppresses repeat reroll confirmations for this open creator session only. */
    #skipRerollConfirmation = false;

    /** Prevents an intentional Apply or Start Over close from recreating cleared progress. */
    #suppressCloseSave = false;

    /** Serializes Actor flag writes so an older save cannot finish after a newer one. */
    #saveQueue = Promise.resolve();

    #veteranEnabled() { return getSetting('allowDamagedVeteran', true); }
    #allowedVeteranPaths() {
        if (!this.#veteranEnabled()) return ['freshRecruit'];
        const paths = ['freshRecruit'];
        if (getSetting('allowVeteranExtremeViolence', true)) paths.push('extremeViolence');
        if (getSetting('allowVeteranCaptivity', true)) paths.push('captivity');
        if (getSetting('allowVeteranHardExperience', true)) paths.push('hardExperience');
        if (getSetting('allowVeteranThingsMan', true)) paths.push('thingsMan');
        return paths;
    }
    #activeStepIndices() { return STEPS.map((_, index) => index).filter(index => this.#veteranEnabled() || STEPS[index] !== 'damaged_veteran'); }
    #creationMode() {
        const mode = getSetting('randomizationAccess', 'both');
        if (mode === 'full') return 'both';
        if (mode === 'sections' || mode === 'disabled') return 'guided';
        return mode;
    }
    #sectionRandomizerAllowed(key) {
        return this.#creationMode() !== 'randomOnly'
            && getSetting(key, true)
            && (key !== 'randomizeVeteran' || this.#veteranEnabled());
    }
    #stateFlagKey() { return `wizardState_${game.user.id}`; }

    /** Transient data collected across steps before writing to the Actor. */
    #data = {
        stats: { str: 0, con: 0, dex: 0, int: 0, pow: 0, cha: 0 },
        statMethod: 'generalist',
        statPool: [
            { id: 'generalist-0', value: 13 }, { id: 'generalist-1', value: 13 },
            { id: 'generalist-2', value: 12 }, { id: 'generalist-3', value: 12 },
            { id: 'generalist-4', value: 11 }, { id: 'generalist-5', value: 11 },
        ],
        statAssignments: {
            str: '', con: '', dex: '', int: '', pow: '', cha: '',
        },
        randomSource: '',
        rolledState: {
            pool: [],
            assignments: { str: '', con: '', dex: '', int: '', pow: '', cha: '' },
            stats: { str: 0, con: 0, dex: 0, int: 0, pow: 0, cha: 0 },
        },
        professionKey: '',
        requiredChoicePicks: [],
        customProfession: {
            name: '',
            bonds: 3,
            allocations: Array.from({ length: 10 }, () => ({ key: '', specialty: '', points: 0 })),
        },
        skills: {},          // key → value
        optionalPicks: [],   // indices of chosen optional skills
        bonusBoosts: ['', '', '', '', '', '', '', ''],  // 8 bonus-pick slots (each holds a skill key)
        bonusCustom: ['', '', '', '', '', '', '', ''],  // custom label text for '_custom_*' bonus slots
        bonusAmounts: [20, 20, 20, 20, 20, 20, 20, 20],
        bonusOverflow: [], // excess 10% allocations, each tied to its originating slot
        bondDataset: getSetting('defaultBondDataset', 'FRIENDS_FAMILY'), // active bond suggestion dataset
        selectedPackIdx: -1,                            // last applied background package index
        bonds: [],           // array of { name, score, relationship, description }
        specialtySlots: [],  // [{id, group, label, proficiency, required, optIndex}] typed/specialty skills
        fixedSpecialtyUnlocks: {}, // required specialty slot id → manually unlocked
        optSpecialtyLabels: {},  // optIndex → label string for checked optional specialty picks
        biography: { name: '', profession: '', employer: '', nationality: '', sex: '', age: '', education: '' },
        physical: { height: '', weight: '', build: '', hair: '', eyes: '', complexion: '', distinguishingFeatures: '', notes: '' },
        motivations: ['', '', '', '', ''],               // up to 5 motivation strings
        equipment: [],                                    // reserved for a later release
        veteran: { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' },
    };

    constructor(actor, options = {}) {
        super(options);
        this.#actor = actor;
        this.#hasSavedState = this.#loadState();
        this.#resumeStep = this.#step;
        if (!this.#hasSavedState) this.#applyDefaultStatSetting();
    }

    async openUsingPreference() {
        const preference = getSetting('defaultCreationRoute', 'ask');
        if (this.#creationMode() === 'randomOnly') {
            const permittedReview = this.#workflowOrigin === 'completeRandom' || (game.user.isGM && this.#workflowOrigin === 'imported');
            if (!this.#hasSavedState || STEPS[this.#step] !== 'review' || !permittedReview) await this.#generateCompleteRandomAgent();
            this.#step = STEPS.indexOf('review');
            this.#furthestStep = this.#step;
            this.#saveState();
            return this.render({ force: true });
        }
        if (this.#hasSavedState) {
            if (preference === 'ask') {
                this.#resumeStep = this.#step;
                this.#step = STEPS.indexOf('welcome');
            }
            return this.render({ force: true });
        }
        if (preference === 'guided' || (preference === 'random' && this.#creationMode() !== 'both')) {
            this.#step = STEPS.indexOf('profession');
        }
        if (preference === 'random' && this.#creationMode() === 'both') {
            await this.#generateCompleteRandomAgent();
        }
        this.#furthestStep = Math.max(this.#furthestStep, this.#step);
        this.#saveState();
        return this.render({ force: true });
    }

    // -----------------------------------------------------------------------
    // Persist wizard progress to actor flags so it survives disconnects
    // -----------------------------------------------------------------------
    #saveState() {
        const persistedStep = STEPS[this.#step] === 'welcome'
            && this.#resumeStep > STEPS.indexOf('welcome')
            ? this.#resumeStep
            : this.#step;
        const snapshot = foundry.utils.deepClone({
            step: persistedStep,
            furthestStep: this.#furthestStep,
            data: this.#data,
            workflowOrigin: this.#workflowOrigin,
        });
        this.#saveQueue = this.#saveQueue
            .catch(() => null)
            .then(() => this.#actor.setFlag('delta-green-agent-creator', this.#stateFlagKey(), snapshot))
            .then(result => {
                this.#hasSavedState = true;
                return result;
            })
            .catch(error => {
                console.error('Delta Green Agent Creator | Failed to save creator progress.', error);
                return null;
            });
        return this.#saveQueue;
    }

    #loadState() {
        const saved = this.#actor.getFlag('delta-green-agent-creator', this.#stateFlagKey());
        if (!saved) return false;
        if (typeof saved.step === 'number') this.#step = saved.step;
        this.#workflowOrigin = ['guided', 'completeRandom', 'imported'].includes(saved.workflowOrigin)
            ? saved.workflowOrigin
            : 'guided';
        this.#furthestStep = Number.isInteger(saved.furthestStep)
            ? saved.furthestStep
            : this.#step;
        if (saved.data) {
            this.#data = foundry.utils.mergeObject(this.#data, saved.data, { inplace: false });
            this.#data.requiredChoicePicks = Array.isArray(this.#data.requiredChoicePicks) ? this.#data.requiredChoicePicks : [];
            this.#data.veteran ??= { path: 'freshRecruit', hardSkills: [], disorder: '' };
            this.#data.veteran.hardSkills = Array.from({ length: 4 }, (_, index) => this.#data.veteran.hardSkills?.[index] ?? '');
            // Equipment is not part of the active creator workflow.
            // Discard loadouts left by older random Agent sessions.
            this.#data.equipment = [];
            // Migrate unfinished 0.1 sessions from editable values to assignable slots.
            if (!saved.data.statPool || !saved.data.statAssignments) {
                const keys = Object.keys(STAT_LABELS);
                this.#data.statPool = keys.map((key, index) => ({
                    id: `migrated-${index}`,
                    value: Number(this.#data.stats[key]) || 10,
                }));
                this.#data.statAssignments = Object.fromEntries(
                    keys.map((key, index) => [key, this.#data.statPool[index].id])
                );
                this.#data.statMethod = 'rolled';
            }
        }
        // Repair sessions saved by versions that allowed unrestricted section jumps.
        // Resume at the earliest incomplete prerequisite instead of opening a broken later section.
        const preserveGeneratedReview = STEPS[this.#step] === 'review'
            && ['completeRandom', 'imported'].includes(this.#workflowOrigin);
        if (!preserveGeneratedReview) {
            const firstIncomplete = this.#buildStepWarnings().findIndex(Boolean);
            if (firstIncomplete >= 0 && firstIncomplete < this.#step) {
                this.#step = firstIncomplete;
            }
        }
        return true;
    }

    #applyDefaultStatSetting() {
        const allowed = getAllowedStatMethods();
        let method = getSetting('defaultStatMethod', 'generalist');
        if (!allowed.includes(method)) method = allowed[0];
        const arrays = {
            generalist: [13, 13, 12, 12, 11, 11],
            focused: [15, 14, 12, 11, 10, 10],
            highlyFocused: [17, 14, 12, 10, 10, 9],
        };
        if (arrays[method]) {
            this.#data.statMethod = method;
            this.#data.statPool = arrays[method].map((value, index) => ({ id: `${method}-${index}`, value }));
            this.#data.statAssignments = { str: '', con: '', dex: '', int: '', pow: '', cha: '' };
            this.#syncStatsFromAssignments();
            return;
        }
        if (method === 'pointBuy') {
            this.#data.statMethod = 'pointBuy';
            this.#data.stats = { str: 10, con: 10, dex: 10, int: 10, pow: 10, cha: 10 };
            return;
        }
        this.#data.statMethod = method;
        this.#data.statPool = [];
        this.#data.statAssignments = { str: '', con: '', dex: '', int: '', pow: '', cha: '' };
        this.#syncStatsFromAssignments();
    }

    static DEFAULT_OPTIONS = {
        id: 'dg-chargen-wizard',
        classes: ['dg-chargen'],
        window: {
            title: 'Delta Green: Agent Creator',
            resizable: true,
        },
        position: { width: 900, height: 700 },
        actions: {
            nextStep: DeltaGreenChargenWizard.#onNextStep,
            prevStep: DeltaGreenChargenWizard.#onPrevStep,
            rollStatPool: DeltaGreenChargenWizard.#onRollStatPool,
            selectRollMethod: DeltaGreenChargenWizard.#onSelectRollMethod,
            useGeneralistArray: DeltaGreenChargenWizard.#onUseGeneralistArray,
            useFocusedArray: DeltaGreenChargenWizard.#onUseFocusedArray,
            useHighlyFocusedArray: DeltaGreenChargenWizard.#onUseHighlyFocusedArray,
            usePointBuy: DeltaGreenChargenWizard.#onUsePointBuy,
            randomizeStats: DeltaGreenChargenWizard.#onRandomizeStats,
            randomizeAgent: DeltaGreenChargenWizard.#onRandomizeAgent,
            rerollCompleteAgent: DeltaGreenChargenWizard.#onRerollCompleteAgent,
            randomizeProfession: DeltaGreenChargenWizard.#onRandomizeProfession,
            randomizeProfessionSkills: DeltaGreenChargenWizard.#onRandomizeProfessionSkills,
            toggleFixedSpecialty: DeltaGreenChargenWizard.#onToggleFixedSpecialty,
            resetFixedSpecialty: DeltaGreenChargenWizard.#onResetFixedSpecialty,
            randomizeBackground: DeltaGreenChargenWizard.#onRandomizeBackground,
            randomizeVeteran: DeltaGreenChargenWizard.#onRandomizeVeteran,
            randomizeBonds: DeltaGreenChargenWizard.#onRandomizeBonds,
            randomizeMotivations: DeltaGreenChargenWizard.#onRandomizeMotivations,
            adjustPointBuy: DeltaGreenChargenWizard.#onAdjustPointBuy,
            removeBond: DeltaGreenChargenWizard.#onRemoveBond,
            suggestBond: DeltaGreenChargenWizard.#onSuggestBond,
            randomBio: DeltaGreenChargenWizard.#onRandomBio,
            clearEquipment: DeltaGreenChargenWizard.#onClearEquipment,
            finish: DeltaGreenChargenWizard.#onFinish,
            applyAndKeep: DeltaGreenChargenWizard.#onApplyAndKeep,
            loadLoadout: DeltaGreenChargenWizard.#onLoadLoadout,
            fillPack: DeltaGreenChargenWizard.#onFillPack,
            adjustBackgroundSkill: DeltaGreenChargenWizard.#onAdjustBackgroundSkill,
            addBackgroundSpecialty: DeltaGreenChargenWizard.#onAddBackgroundSpecialty,
            clearBackgroundSkills: DeltaGreenChargenWizard.#onClearBackgroundSkills,
            jumpToStep: DeltaGreenChargenWizard.#onJumpToStep,
            resumeCreation: DeltaGreenChargenWizard.#onResumeCreation,
            startOver: DeltaGreenChargenWizard.#onStartOver,
            pickPortrait: DeltaGreenChargenWizard.#onPickPortrait,
            importAgentFile: DeltaGreenChargenWizard.#onImportAgentFile,
            pasteAgentCode: DeltaGreenChargenWizard.#onPasteAgentCode,
            exportAgentJson: DeltaGreenChargenWizard.#onExportAgentJson,
            copyAgentCode: DeltaGreenChargenWizard.#onCopyAgentCode,
            loadStoredAgent: DeltaGreenChargenWizard.#onLoadStoredAgent,
        },
    };

    static PARTS = {
        main: { template: 'modules/delta-green-agent-creator/templates/creator.hbs' },
    };

    // -----------------------------------------------------------------------
    // Context passed to the Handlebars template
    // -----------------------------------------------------------------------
    async _prepareContext(options) {
        if (!this.#veteranEnabled() && STEPS[this.#step] === 'damaged_veteran') this.#step = STEPS.indexOf('bonds');
        if (!this.#allowedVeteranPaths().includes(this.#data.veteran?.path)) {
            this.#data.veteran = { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' };
        }
        const step = STEPS[this.#step];
        const profKey = this.#data.professionKey;
        const prof = profKey ? PROFESSIONS[profKey] : null;
        const isCustomProfession = profKey === 'new_profession';
        const bondLimit = prof ? this.#getStartingBondCount(prof) : 0;

        const statValues = this.#data.stats;
        const statDescriptors = Object.fromEntries(
            Object.entries(statValues).map(([k, v]) => [k, getStatDescriptor(k, v)])
        );
        const rawPointsRemaining = 72 - Object.values(statValues).reduce((sum, value) => sum + value, 0);
        const pointsRemaining = Math.max(0, rawPointsRemaining);
        const assignedIds = new Set(Object.values(this.#data.statAssignments).filter(Boolean));
        const statAssignmentRows = Object.keys(STAT_LABELS).map(key => {
            const assignedId = this.#data.statAssignments[key];
            const assigned = Boolean(assignedId);
            return {
                key,
                label: STAT_LABELS[key],
                tooltip: STAT_TOOLTIPS[key],
                value: assigned ? statValues[key] : '',
                x5: assigned ? statValues[key] * 5 : '',
                descriptor: assigned ? statDescriptors[key] : 'Unassigned',
                options: [
                    { id: '', label: 'Select a value', selected: !assigned },
                    ...this.#data.statPool
                        .filter(slot => !assignedIds.has(slot.id) || slot.id === assignedId)
                        .map(slot => ({
                            id: slot.id,
                            label: String(slot.value),
                            selected: assignedId === slot.id,
                        })),
                ],
            };
        });
        const availableStatPool = this.#data.statPool
            .filter(slot => !assignedIds.has(slot.id))
            .map(slot => ({ id: slot.id, value: slot.value, label: String(slot.value) }));
        const statsComplete = this.#data.statMethod === 'pointBuy' || assignedIds.size === 6;

        const bonusSkills = step === 'bonus_skills' ? this.#buildBonusSkillContext() : null;
        const optLimit = prof ? (prof.optionalSkills?.[0]?.limit ?? 0) : 0;
        const optPicksUsed = this.#data.optionalPicks.length;
        const specialtyContext = step === 'skills' ? this.#buildSpecialtyContext(prof) : null;
        const optionalSkillItems = step === 'skills' ? this.#buildOptionalSkillItems(prof) : [];
        const requiredSkillChoices = step === 'skills' ? (prof?.requiredSkillChoices ?? []).map((choice, choiceIndex) => ({
            choiceIndex,
            label: choice.label ?? 'Choose one required skill',
            options: choice.options.map(option => {
                const key = this.#findSkillKey(option.name);
                return { ...option, key, selected: this.#data.requiredChoicePicks?.[choiceIndex] === key };
            }),
        })) : [];
        const hasOptionalSkills = optionalSkillItems.length > 0;
        const hasRequiredSkillChoices = requiredSkillChoices.length > 0;
        const hasFixedProfessionSpecialties = Boolean(
            specialtyContext?.required?.some(slot => slot.fixed)
        );
        const hasUnlockedFixedSpecialties = Boolean(
            specialtyContext?.required?.some(slot => slot.fixed && !slot.locked)
        );
        const hasRandomizableProfessionSkills = Boolean(
            !isCustomProfession && (hasOptionalSkills || hasRequiredSkillChoices
            || specialtyContext?.required?.some(slot => !slot.fixed)
            || hasUnlockedFixedSpecialties)
        );
        const showProfessionSkillRandomizer = Boolean(
            !isCustomProfession && (hasOptionalSkills || hasRequiredSkillChoices || specialtyContext?.required?.length || hasFixedProfessionSpecialties)
        );
        const allowedStatMethods = new Set(getAllowedStatMethods());
        const requiredMotivations = this.#getRequiredMotivationCount();

        // Pre-fill all bond slots when entering the bonds step
        if (step === 'bonds' && prof) {
            const limit = this.#getStartingBondCount(prof);
            if (this.#data.bonds.length > limit) this.#data.bonds = this.#data.bonds.slice(0, limit);
            while (this.#data.bonds.length < limit) {
                this.#data.bonds.push({ name: '', score: this.#data.stats.cha, relationship: '', description: '' });
            }
        }

        const derived = statsComplete ? {
            hp: Math.ceil((statValues.str + statValues.con) / 2),
            wp: statValues.pow,
            san: statValues.pow * 5,
            bp: statValues.pow * 5 - statValues.pow,
        } : { hp: '', wp: '', san: '', bp: '' };

        const veteranSkillOptions = BONUS_SKILL_OPTIONS
            .filter(option => !option.key.startsWith('_custom_') && option.key !== 'unnatural')
            .map(option => ({ ...option, value: this.#getEffectivePlainSkillValue(option.key) }));
        const veteranHardSkillRows = Array.from({ length: 4 }, (_, index) => ({
            index,
            selected: this.#data.veteran.hardSkills?.[index] ?? '',
        }));
        const startingSan = this.#data.stats.pow * 5;
        const startingOccult = this.#getEffectivePlainSkillValue('occult');
        const startingUnnatural = this.#getEffectivePlainSkillValue('unnatural');
        const startingBonds = prof ? this.#getBondLimit(prof) : 0;
        const veteranPreview = {
            san: startingSan,
            sanMinusFive: Math.max(0, startingSan - 5),
            sanMinusPow: Math.max(0, startingSan - this.#data.stats.pow),
            breakingPointAfterUnnatural: Math.max(0, startingSan - (this.#data.stats.pow * 2)),
            occult: startingOccult,
            occultPlusTen: Math.min(99, startingOccult + 10),
            occultPlusTwenty: Math.min(99, startingOccult + 20),
            unnatural: startingUnnatural,
            unnaturalPlusTen: Math.min(99, startingUnnatural + 10),
            cha: this.#data.stats.cha,
            chaMinusThree: Math.max(3, this.#data.stats.cha - 3),
            pow: this.#data.stats.pow,
            powMinusThree: Math.max(3, this.#data.stats.pow - 3),
            bonds: startingBonds,
            bondsMinusOne: Math.max(0, startingBonds - 1),
        };

        const stepWarnings = this.#buildStepWarnings();
        const progressSteps = this.#buildProgressSteps(stepWarnings);
        const reviewBlockingSections = progressSteps.filter(item => item.warning).map(item => item.title);
        const allowAgentImport = game.user.isGM || (this.#creationMode() !== 'randomOnly' && getSetting('playerImportPolicy', 'compatible') === 'compatible');
        const hasStoredAgent = Boolean(this.#actor.getFlag('delta-green-agent-creator', 'lastAgentExchange'));

        return {
            step,
            stepIndex: this.#step,
            totalSteps: this.#activeStepIndices().length,
            displayStepIndex: this.#activeStepIndices().indexOf(this.#step),
            isFirst: this.#step === 0,
            isLast: this.#step === STEPS.length - 1,
            actor: this.#actor,
            // step-specific
            stats: this.#data.stats,
            statLabels: STAT_LABELS,
            statTooltips: STAT_TOOLTIPS,
            statDescriptors,
            statMethod: this.#data.statMethod,
            isPointBuy: this.#data.statMethod === 'pointBuy',
            isRollMethod: this.#data.statMethod === 'rolled',
            isRandomMethod: this.#data.statMethod === 'randomized',
            hasStatPool: this.#data.statPool.length === 6,
            randomSource: this.#data.randomSource,
            statPool: this.#data.statPool,
            availableStatPool,
            statAssignmentRows,
            pointsRemaining,
            pointBuyAtLimit: rawPointsRemaining <= 0,
            derived,
            professionGroups: this.#buildProfessionGroups(),
            professionKey: profKey,
            profession: prof,
            isCustomProfession,
            customProfession: this.#buildCustomProfessionContext(),
            skills: this.#buildSkillContext(prof),
            requiredSkillChoices,
            hasRequiredSkillChoices,
            bonusSkills,
            optLimit,
            optPicksUsed,
            specialtyContext,
            optionalSkillItems,
            hasOptionalSkills,
            hasRandomizableProfessionSkills,
            showProfessionSkillRandomizer,
            bonds: this.#data.bonds,
            bondLimit,
            requiredBonds: prof ? this.#getRequiredBondCount(prof) : 1,
            bondsAtLimit: this.#data.bonds.length >= bondLimit,
            bondDataset: this.#data.bondDataset,
            bondDatasets: BOND_DATASETS,
            biography: this.#data.biography,
            physical: this.#data.physical,
            motivations: this.#data.motivations,
            motivationRows: this.#data.motivations.map((value, index) => ({
                index,
                value,
                required: index < requiredMotivations,
            })),
            requiredMotivations,
            veteran: this.#data.veteran,
            allowVeteranExtremeViolence: this.#allowedVeteranPaths().includes('extremeViolence'),
            allowVeteranCaptivity: this.#allowedVeteranPaths().includes('captivity'),
            allowVeteranHardExperience: this.#allowedVeteranPaths().includes('hardExperience'),
            allowVeteranThingsMan: this.#allowedVeteranPaths().includes('thingsMan'),
            hardExperienceAllowed: Boolean(prof),
            veteranSkillOptions,
            veteranHardSkillRows,
            veteranPreview,
            equipmentCount: this.#data.equipment.length,
            review: step === 'review' ? this.#buildReviewContext() : null,
            stepWarnings,
            stepTitles: ['Welcome', 'Profession', 'Statistics', 'Skills', 'Background Skills', 'Damaged Veteran', 'Bonds', 'Biography', 'Review'],
            progressSteps,
            canFinish: reviewBlockingSections.length === 0,
            reviewBlockingSections,
            canResumeCreation: this.#resumeStep > STEPS.indexOf('welcome'),
            allowRandomAgent: this.#creationMode() === 'both',
            randomOnly: this.#creationMode() === 'randomOnly',
            showCompleteRandomReroll: step === 'review'
                && this.#workflowOrigin === 'completeRandom'
                && ['both', 'randomOnly'].includes(this.#creationMode()),
            showRandomVeteranReviewNotice: step === 'review'
                && this.#workflowOrigin === 'completeRandom'
                && this.#data.veteran?.path !== 'freshRecruit',
            allowRandomProfession: this.#sectionRandomizerAllowed('randomizeProfession'),
            allowRandomProfessionSkills: this.#sectionRandomizerAllowed('randomizeProfessionSkills'),
            allowRandomBackgroundSkills: this.#sectionRandomizerAllowed('randomizeBackgroundSkills'),
            allowRandomVeteran: this.#sectionRandomizerAllowed('randomizeVeteran'),
            allowRandomBonds: this.#sectionRandomizerAllowed('randomizeBonds'),
            allowRandomBiography: this.#sectionRandomizerAllowed('randomizeBiography'),
            allowRandomMotivations: this.#sectionRandomizerAllowed('randomizeMotivations'),
            showDamagedVeteran: this.#veteranEnabled(),
            allowStatGeneralist: allowedStatMethods.has('generalist'),
            allowStatFocused: allowedStatMethods.has('focused'),
            allowStatHighlyFocused: allowedStatMethods.has('highlyFocused'),
            allowStatRolled: allowedStatMethods.has('rolled'),
            allowStatPointBuy: allowedStatMethods.has('pointBuy'),
            allowStatRandomizer: allowedStatMethods.has('randomized'),
            allowAgentImport,
            hasStoredAgent,
            showWelcomeAgentTransfer: allowAgentImport || hasStoredAgent,
        };
    }

    // -----------------------------------------------------------------------
    // Build sorted skill list for the skills step (REQUIRED only)
    // -----------------------------------------------------------------------
    #buildSkillContext(prof) {
        if (!prof) return [];
        const result = [];

        if (this.#data.professionKey === 'new_profession') {
            for (const [key, value] of Object.entries(this.#data.skills)) {
                result.push({
                    key,
                    label: BONUS_SKILL_OPTIONS.find(option => option.key === key)?.label
                        ?? key.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
                    base: SKILL_DEFAULTS[key] ?? 0,
                    profValue: value,
                    current: value,
                    required: true,
                    optional: false,
                    tooltip: SKILL_TOOLTIPS[key] ?? '',
                });
            }
            return result.sort((a, b) => a.label.localeCompare(b.label));
        }

        // Required skills — skip specialty types (shown in specialty section)
        for (const s of prof.requiredSkills ?? []) {
            if (parseSpecialtyFromName(s.name)) continue;
            const key = this.#findSkillKey(s.name);
            result.push({
                key,
                label: s.name,
                base: SKILL_DEFAULTS[key] ?? 0,
                profValue: s.value,
                current: this.#data.skills[key] ?? Math.max(SKILL_DEFAULTS[key] ?? 0, s.value),
                required: true,
                optional: false,
                tooltip: SKILL_TOOLTIPS[key] ?? '',
            });
        }
        return result;
    }

    // -----------------------------------------------------------------------
    // Build optional skill items for the skills step chooser section
    // -----------------------------------------------------------------------
    #buildOptionalSkillItems(prof) {
        if (!prof || !prof.optionalSkills?.length) return [];
        const items = [];
        for (let i = 0; i < prof.optionalSkills.length; i++) {
            const s = prof.optionalSkills[i];
            const sp = parseSpecialtyFromName(s.name);
            const picked = this.#data.optionalPicks.includes(i);
            if (sp) {
                const existingSlot = this.#data.specialtySlots.find(sl => sl.optIndex === i);
                items.push({
                    optIndex: i,
                    label: s.name,
                    profValue: s.value,
                    picked,
                    isSpecialty: true,
                    group: sp.group,
                    specialtyLabel: existingSlot?.label ?? this.#data.optSpecialtyLabels[i] ?? '',
                });
            } else {
                const key = this.#findSkillKey(s.name);
                items.push({
                    optIndex: i,
                    key,
                    label: s.name,
                    profValue: s.value,
                    picked,
                    isSpecialty: false,
                    group: '',
                    specialtyLabel: '',
                    tooltip: SKILL_TOOLTIPS[key] ?? '',
                });
            }
        }
        return items;
    }

    // -----------------------------------------------------------------------
    // Build specialty skill context for the skills step
    // -----------------------------------------------------------------------
    #buildSpecialtyContext(prof) {
        if (!prof) return null;
        const optLimit = prof.optionalSkills?.[0]?.limit ?? 2;

        const SPECIALTY_EXAMPLES = {
            Art: 'Painting',
            Craft: 'Electrician',
            ForeignLanguage: 'Spanish',
            Science: 'Biology',
            Pilot: 'Airplane',
            MilitaryScience: 'Land',
        };

        // Required specialty slots (populated during profession step)
        const professionSpecialties = (prof.requiredSkills ?? [])
            .map(skill => parseSpecialtyFromName(skill.name))
            .filter(Boolean);
        const fixedPolicy = getSetting('fixedSpecialtyPolicy', 'allowUnlock');
        const required = this.#data.specialtySlots
            .filter(sl => sl.required)
            .map((sl, index) => {
                const originalLabel = sl.fixedLabel ?? professionSpecialties[index]?.label ?? '';
                const fixed = Boolean(originalLabel);
                if (fixed && !sl.fixedLabel) sl.fixedLabel = originalLabel;
                const hasLockOverride = Object.prototype.hasOwnProperty.call(
                    this.#data.fixedSpecialtyUnlocks ?? {}, sl.id
                );
                const unlocked = fixed && (hasLockOverride
                    ? Boolean(this.#data.fixedSpecialtyUnlocks[sl.id])
                    : fixedPolicy === 'editable');
                return {
                    ...sl,
                    fixed,
                    fixedLabel: originalLabel,
                    locked: fixed && !unlocked,
                    canUnlock: fixed && fixedPolicy === 'allowUnlock',
                    strictLock: fixed && fixedPolicy === 'strict',
                    modified: fixed && sl.label !== originalLabel,
                    groupDisplay: Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === sl.group)?.[0] ?? sl.group,
                    options: SPECIALTY_OPTIONS[sl.group] ?? [],
                    example: SPECIALTY_EXAMPLES[sl.group] ?? sl.group,
                };
            });

        // Optional specialty picks from this profession
        const optional = [];
        for (let i = 0; i < (prof.optionalSkills?.length ?? 0); i++) {
            const s = prof.optionalSkills[i];
            const sp = parseSpecialtyFromName(s.name);
            if (!sp) continue;
            const existingSlot = this.#data.specialtySlots.find(sl => sl.optIndex === i);
            optional.push({
                optIndex: i,
                group: sp.group,
                groupDisplay: s.name,
                proficiency: s.value,
                picked: this.#data.optionalPicks.includes(i),
                label: existingSlot?.label ?? this.#data.optSpecialtyLabels[i] ?? '',
                options: SPECIALTY_OPTIONS[sp.group] ?? [],
                optLimit,
                example: SPECIALTY_EXAMPLES[sp.group] ?? sp.group,
            });
        }

        if (required.length === 0 && optional.length === 0) return null;

        // Deduplicated datalists (one per group used)
        const usedGroups = new Set([...required, ...optional].map(sl => sl.group));
        const dataLists = [...usedGroups].map(group => ({
            id: `dg-sp-${group}`,
            options: SPECIALTY_OPTIONS[group] ?? [],
        }));

        return {
            required: required.length > 0 ? required : null,
            optional: optional.length > 0 ? optional : null,
            dataLists,
        };
    }

    // -----------------------------------------------------------------------
    // Map a display name like "Computer Science" → system key "computer_science"
    // -----------------------------------------------------------------------
    #findSkillKey(name) {
        const normalized = name.toLowerCase()
            .replace(/[^a-z]/g, '_')
            .replace(/__+/g, '_')
            .replace(/^_+|_+$/g, '');  // strip leading/trailing underscores
        if (normalized in SKILL_DEFAULTS) return normalized;
        // fuzzy: find first key that appears in the normalized name
        return Object.keys(SKILL_DEFAULTS).find(k => normalized.includes(k)) ?? normalized;
    }

    #getEffectivePlainSkillValue(key) {
        const base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
        const bonus = this.#getBonusAllocations()
            .filter(allocation => allocation.key === key)
            .reduce((total, allocation) => total + allocation.amount, 0);
        return Math.min(80, base + bonus);
    }

    // -----------------------------------------------------------------------
    // Parse BONDS: N from profession description
    // -----------------------------------------------------------------------
    #getBondLimit(prof) {
        if (prof === PROFESSIONS.new_profession) {
            return Math.max(1, Math.min(4, Number(this.#data.customProfession?.bonds) || 3));
        }
        const m = prof.description?.match(/BONDS:\s*(\d+)/);
        return m ? parseInt(m[1], 10) : 4;
    }

    #getStartingBondCount(prof) {
        const professionBonds = this.#getBondLimit(prof);
        return Math.max(0, professionBonds - (this.#data.veteran?.path === 'hardExperience' ? 1 : 0));
    }

    #buildPhysicalDescriptionHtml() {
        const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        })[character]);
        const fields = [
            ['Height', this.#data.physical.height],
            ['Weight', this.#data.physical.weight],
            ['Build', this.#data.physical.build],
            ['Hair', this.#data.physical.hair],
            ['Eyes', this.#data.physical.eyes],
            ['Complexion', this.#data.physical.complexion],
            ['Distinguishing Features', this.#data.physical.distinguishingFeatures],
            ['Notes', this.#data.physical.notes],
        ];
        return fields
            .filter(([, value]) => String(value ?? '').trim())
            .map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`)
            .join('');
    }

    #getRequiredBondCount(prof) {
        return this.#getStartingBondCount(prof);
    }

    #getCustomProfessionBudget(bonds = this.#data.customProfession?.bonds) {
        return 550 - Math.max(1, Math.min(4, Number(bonds) || 3)) * 50;
    }

    #buildCustomProfessionContext() {
        const custom = this.#data.customProfession ?? {};
        const allocations = Array.from({ length: 10 }, (_, index) => {
            const row = custom.allocations?.[index] ?? { key: '', specialty: '', points: 0 };
            const base = row.key?.startsWith('_custom_') ? 0 : (SKILL_DEFAULTS[row.key] ?? 0);
            return {
                index,
                key: row.key ?? '',
                specialty: row.specialty ?? '',
                points: Number(row.points) || 0,
                base,
                total: base + (Number(row.points) || 0),
                isSpecialty: Boolean(row.key?.startsWith('_custom_')),
                group: row.key?.startsWith('_custom_') ? row.key.slice('_custom_'.length) : '',
                options: BONUS_SKILL_OPTIONS
                    .filter(option => option.key !== 'unnatural')
                    .map(option => ({ ...option, selected: option.key === row.key })),
            };
        });
        const budget = this.#getCustomProfessionBudget(custom.bonds);
        const spent = allocations.reduce((sum, row) => sum + row.points, 0);
        const capacity = allocations.reduce((sum, row) => sum + (row.key ? 60 - row.base : 60), 0);
        return {
            name: custom.name ?? '',
            bonds: Math.max(1, Math.min(4, Number(custom.bonds) || 3)),
            budget,
            spent,
            remaining: budget - spent,
            capacity,
            allocations,
            dataLists: Object.entries(SPECIALTY_OPTIONS).map(([group, options]) => ({ group, options })),
        };
    }

    #getRequiredMotivationCount() {
        const configured = Number(getSetting('requiredMotivations', 0));
        return Math.max(0, Math.min(5, Number.isFinite(configured) ? configured : 0));
    }

    #getAvailableProfessionEntries() {
        const source = getSetting('professionSources', 'all');
        return Object.entries(PROFESSIONS).filter(([key]) => {
            if (key === 'new_profession') return game.user.isGM || getSetting('allowCustomProfessions', false);
            if (source === 'quickstart') return QUICKSTART_PROFESSION_KEYS.has(key);
            if (source === 'handbook') return !key.startsWith('complex_');
            if (source === 'complex') return key.startsWith('complex_');
            return true;
        });
    }

    #buildProfessionGroups() {
        const mapEntry = ([key, profession]) => ({
            key,
            title: profession.title,
            description: profession.description,
        });
        const entries = this.#getAvailableProfessionEntries();
        const sortByTitle = (a, b) => a[1].title.localeCompare(b[1].title);
        return {
            core: entries.filter(([key]) => key !== 'new_profession' && !key.startsWith('complex_')).sort(sortByTitle).map(mapEntry),
            custom: entries.some(([key]) => key === 'new_profession')
                ? { key: 'new_profession', title: '— Custom Profession —' }
                : null,
            complex: entries.filter(([key]) => key.startsWith('complex_')).sort(sortByTitle).map(mapEntry),
        };
    }

    #randomItem(items) {
        return items[Math.floor(Math.random() * items.length)];
    }

    #shuffle(items) {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
        }
        return result;
    }

    #randomSpecialty(group, used = new Set()) {
        const options = SPECIALTY_OPTIONS[group] ?? ['General'];
        const available = options.filter(option => !used.has(`${group}:${option.toLowerCase()}`));
        const label = this.#randomItem(available.length > 0 ? available : options);
        used.add(`${group}:${label.toLowerCase()}`);
        return label;
    }

    async #randomizeStatData() {
        this.#rememberRolledState();
        const allowed = new Set(getAllowedStatMethods());
        let sources = [
            { method: 'generalist', label: 'Generalist', values: [13, 13, 12, 12, 11, 11] },
            { method: 'focused', label: 'Focused', values: [15, 14, 12, 11, 10, 10] },
            { method: 'highlyFocused', label: 'Highly Focused', values: [17, 14, 12, 10, 10, 9] },
            { method: 'pointBuy', label: 'Allocate 72 Points', values: null },
            { method: 'rolled', label: 'Roll 4D6, Drop the Lowest', values: null, rolled: true },
        ].filter(source => allowed.has(source.method));
        if (sources.length === 0) {
            sources = [{ method: 'generalist', label: 'Generalist', values: [13, 13, 12, 12, 11, 11] }];
        }
        const source = this.#randomItem(sources);
        let values;

        if (source.rolled) {
            values = [];
            for (let index = 0; index < 6; index += 1) {
                const roll = await new Roll('4d6kh3').evaluate();
                await roll.toMessage({
                    speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
                    flavor: `Agent Creation Randomizer: Statistic Roll ${index + 1}`,
                }, { rollMode: getSetting('statRollMode', 'publicroll') });
                values.push(roll.total);
            }
        } else if (source.values) {
            values = [...source.values];
        } else {
            values = [3, 3, 3, 3, 3, 3];
            let remaining = 54;
            while (remaining > 0) {
                const available = values
                    .map((value, index) => ({ value, index }))
                    .filter(entry => entry.value < 18);
                const pick = this.#randomItem(available);
                values[pick.index] += 1;
                remaining -= 1;
            }
        }

        values = this.#shuffle(values);
        const stamp = Date.now();
        this.#data.statMethod = 'randomized';
        this.#data.randomSource = source.label;
        this.#data.statPool = values.map((value, index) => ({ id: `random-${stamp}-${index}`, value }));
        Object.keys(STAT_LABELS).forEach((stat, index) => {
            this.#data.statAssignments[stat] = this.#data.statPool[index].id;
        });
        this.#syncStatsFromAssignments();
    }

    #randomizeProfessionData(professionKey = null, { randomizeChoices = true } = {}) {
        const availableKeys = this.#getAvailableProfessionEntries().map(([key]) => key).filter(key => key !== 'new_profession');
        const key = professionKey && PROFESSIONS[professionKey]
            ? professionKey
            : this.#randomItem(availableKeys);
        const prof = PROFESSIONS[key];
        const usedSpecialties = new Set();

        const sameProfession = this.#data.professionKey === key;
        const previousRequired = new Map(
            this.#data.specialtySlots
                .filter(slot => slot.required)
                .map(slot => [String(slot.id), slot])
        );
        const fixedPolicy = getSetting('fixedSpecialtyPolicy', 'allowUnlock');
        const isFixedSlotUnlocked = (slotId) => {
            if (fixedPolicy === 'strict') return false;
            const unlocks = this.#data.fixedSpecialtyUnlocks ?? {};
            const hasOverride = Object.prototype.hasOwnProperty.call(unlocks, slotId);
            return hasOverride ? Boolean(unlocks[slotId]) : fixedPolicy === 'editable';
        };
        if (sameProfession) {
            const requiredSpecialties = (prof.requiredSkills ?? [])
                .map(skill => parseSpecialtyFromName(skill.name))
                .filter(Boolean);
            requiredSpecialties.forEach((specialty, index) => {
                if (!specialty.label || isFixedSlotUnlocked(index)) return;
                const label = previousRequired.get(String(index))?.label || specialty.label;
                usedSpecialties.add(`${specialty.group}:${label.toLowerCase()}`);
            });
        }
        this.#data.professionKey = key;
        this.#data.skills = {};
        this.#data.requiredChoicePicks = [];
        this.#data.specialtySlots = [];
        if (!sameProfession) this.#data.fixedSpecialtyUnlocks = {};
        this.#data.optSpecialtyLabels = {};
        this.#data.optionalPicks = [];

        let slotId = 0;
        for (const skill of prof.requiredSkills ?? []) {
            const specialty = parseSpecialtyFromName(skill.name);
            if (specialty) {
                const previous = previousRequired.get(String(slotId));
                const unlockedFixed = sameProfession && specialty.label && isFixedSlotUnlocked(slotId);
                const preserveFixed = sameProfession && specialty.label && !unlockedFixed && previous?.label;
                const label = unlockedFixed
                    ? (randomizeChoices ? this.#randomSpecialty(specialty.group, usedSpecialties) : '')
                    : (preserveFixed
                        ? previous.label
                        : (specialty.label || (randomizeChoices ? this.#randomSpecialty(specialty.group, usedSpecialties) : '')));
                if (label) usedSpecialties.add(`${specialty.group}:${label.toLowerCase()}`);
                this.#data.specialtySlots.push({
                    id: slotId++,
                    group: specialty.group,
                    label,
                    proficiency: skill.value,
                    required: true,
                    optIndex: null,
                    fixedLabel: specialty.label ?? '',
                });
            } else {
                const skillKey = this.#findSkillKey(skill.name);
                this.#data.skills[skillKey] = Math.max(SKILL_DEFAULTS[skillKey] ?? 0, skill.value);
            }
        }

        if (randomizeChoices) {
            for (const [choiceIndex, choice] of (prof.requiredSkillChoices ?? []).entries()) {
                const selected = this.#randomItem(choice.options);
                const selectedKey = this.#findSkillKey(selected.name);
                this.#data.requiredChoicePicks[choiceIndex] = selectedKey;
                this.#data.skills[selectedKey] = Math.max(SKILL_DEFAULTS[selectedKey] ?? 0, selected.value);
            }
        }

        const optLimit = prof.optionalSkills?.[0]?.limit ?? 0;
        const chosenRequiredKeys = new Set(this.#data.requiredChoicePicks);
        const eligibleOptionalIndices = (prof.optionalSkills ?? []).map((_, index) => index).filter(index => {
            const skill = prof.optionalSkills[index];
            return parseSpecialtyFromName(skill.name) || !chosenRequiredKeys.has(this.#findSkillKey(skill.name));
        });
        const optionalIndices = randomizeChoices
            ? this.#shuffle(eligibleOptionalIndices).slice(0, optLimit)
            : [];
        this.#data.optionalPicks = optionalIndices;
        for (const index of optionalIndices) {
            const skill = prof.optionalSkills[index];
            const specialty = parseSpecialtyFromName(skill.name);
            if (specialty) {
                const label = specialty.label || this.#randomSpecialty(specialty.group, usedSpecialties);
                this.#data.optSpecialtyLabels[index] = label;
                this.#data.specialtySlots.push({
                    id: `opt_${index}`,
                    group: specialty.group,
                    label,
                    proficiency: skill.value,
                    required: false,
                    optIndex: index,
                });
            } else {
                const skillKey = this.#findSkillKey(skill.name);
                this.#data.skills[skillKey] = Math.max(this.#data.skills[skillKey] ?? 0, skill.value);
            }
        }

        this.#data.biography.profession = prof.title;
        return prof;
    }

    #fillBackgroundPackage(packageIndex) {
        const pkg = BONUS_PACKAGES[packageIndex];
        if (!pkg) return false;
        const safeOptions = BONUS_SKILL_OPTIONS.filter(option => option.key !== 'unnatural');
        const specialtyNames = new Set();
        const boosts = pkg.skills.slice(0, 8);
        while (boosts.length < 8) boosts.push('');

        this.#data.bonusCustom = new Array(8).fill('');
        this.#data.bonusAmounts = new Array(8).fill(20);
        this.#data.bonusOverflow = [];
        this.#data.bonusBoosts = boosts.map((originalKey, index) => {
            const specialty = originalKey ? parseSpecialtyFromKey(originalKey) : null;
            if (specialty) {
                specialtyNames.add(`${specialty.group}:${specialty.label.toLowerCase()}`);
                this.#data.bonusCustom[index] = specialty.label;
                return `_custom_${specialty.group}`;
            }

            const key = originalKey || this.#randomItem(safeOptions).key;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                this.#data.bonusCustom[index] = this.#randomSpecialty(group, specialtyNames);
            }
            return key;
        });
        this.#data.selectedPackIdx = packageIndex;
        return true;
    }

    #randomizeBackgroundData() {
        const packageIndex = Math.floor(Math.random() * BONUS_PACKAGES.length);
        this.#fillBackgroundPackage(packageIndex);
    }

    #randomizeVeteranData(forCompleteAgent = false) {
        if (!this.#veteranEnabled()) {
            this.#data.veteran = { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' };
            return;
        }
        const allowed = this.#allowedVeteranPaths();
        const veterans = allowed.filter(path => path !== 'freshRecruit');
        let paths;
        if (!forCompleteAgent) paths = allowed;
        else {
            const frequency = getSetting('randomVeteranFrequency', 'mostlyFresh');
            if (frequency === 'fresh' || veterans.length === 0) paths = ['freshRecruit'];
            else if (frequency === 'equal') paths = ['freshRecruit', ...veterans];
            else if (frequency === 'veteran') paths = veterans;
            else paths = ['freshRecruit', 'freshRecruit', 'freshRecruit', 'freshRecruit', ...veterans];
        }
        const path = this.#randomItem(paths);
        const hardSkillOptions = BONUS_SKILL_OPTIONS
            .filter(option => !option.key.startsWith('_custom_') && option.key !== 'unnatural')
            .map(option => option.key);
        this.#data.veteran = {
            path,
            hardSkills: path === 'hardExperience' ? this.#shuffle(hardSkillOptions).slice(0, 4) : ['', '', '', ''],
            disorder: path === 'thingsMan' ? this.#randomItem(VETERAN_DISORDERS) : '',
        };
    }

    #randomizeBondsData() {
        const limit = this.#getStartingBondCount(PROFESSIONS[this.#data.professionKey]);
        const datasetKeys = Object.keys(BONDS).filter(key => BONDS[key]?.length);
        const datasetKey = this.#randomItem(datasetKeys);
        const suggestions = this.#shuffle(BONDS[datasetKey]).slice(0, limit);
        this.#data.bondDataset = datasetKey;
        this.#data.bonds = suggestions.map(suggestion => ({
            name: suggestion.name,
            score: this.#data.stats.cha,
            relationship: suggestion.relationship ?? '',
            description: suggestion.description ?? '',
        }));
    }

    #randomizeMotivationsData() {
        this.#data.motivations = this.#shuffle(MOTIVATION_OPTIONS).slice(0, 5);
    }

    async #generateCompleteRandomAgent() {
        await this.#randomizeStatData();
        const profession = this.#randomizeProfessionData();
        this.#randomizeBackgroundData();
        this.#randomizeVeteranData(true);
        this.#randomizeBondsData();
        this.#randomizeMotivationsData();
        const generated = generateBio(this.#data.stats, this.#data.professionKey);
        Object.assign(this.#data.biography, generated.biography);
        Object.assign(this.#data.physical, generated.physical);
        this.#data.biography.profession = profession.title;
        this.#data.equipment = [];
        this.#workflowOrigin = 'completeRandom';
        this.#step = STEPS.indexOf('review');
        this.#furthestStep = this.#step;
    }

    #captureBiographyDraft() {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return;
        const fd = new foundry.applications.ux.FormDataExtended(form);
        const raw = fd.object;
        const readField = (path, fallback = '') => {
            if (Object.prototype.hasOwnProperty.call(raw, path)) return raw[path];
            return path.split('.').reduce((value, key) => value?.[key], raw) ?? fallback;
        };
        for (const key of Object.keys(this.#data.biography)) {
            this.#data.biography[key] = readField(`biography.${key}`, this.#data.biography[key]).toString().trim();
        }
        for (const key of Object.keys(this.#data.physical)) {
            this.#data.physical[key] = readField(`physical.${key}`, this.#data.physical[key]).toString().trim();
        }
        for (let index = 0; index < 5; index += 1) {
            this.#data.motivations[index] = readField(`motivation.${index}`, this.#data.motivations[index]).toString().trim();
        }
    }

    #actorHasExistingCharacterData() {
        const hasCreatorItems = this.#actor.items?.some(item => ['bond', 'motivation'].includes(item.type));
        const biography = this.#actor.system?.biography ?? {};
        const hasBiography = ['profession', 'employer', 'nationality', 'sex', 'age', 'education']
            .some(key => String(biography[key] ?? '').trim());
        const hasPhysicalDescription = Boolean(String(this.#actor.system?.physical?.description ?? '').trim());
        const actorName = String(this.#actor.name ?? '').trim().toLowerCase();
        const hasPersonalName = actorName && !['agent', 'new agent', 'unnamed agent'].includes(actorName);
        return Boolean(hasCreatorItems || hasBiography || hasPhysicalDescription || hasPersonalName);
    }

    async #confirmApplyToActor() {
        const playerConfirmation = getSetting('confirmBeforeApply', true);
        const protectExisting = this.#actorHasExistingCharacterData();
        if (!playerConfirmation && !protectExisting) return true;

        const warning = protectExisting
            ? '<p><strong>This Actor already contains character data.</strong> Applying the creator will replace creator managed statistics, skills, Bonds, Motivations, and biography fields.</p>'
            : '<p>Apply this completed Agent to the Actor sheet?</p>';
        const DialogV2 = foundry.applications.api.DialogV2;
        if (DialogV2?.confirm) {
            return DialogV2.confirm({
                window: { title: 'Apply Agent to Sheet' },
                content: warning,
                yes: { label: 'Apply Agent', icon: 'fa-solid fa-check' },
                no: { label: 'Cancel', icon: 'fa-solid fa-xmark' },
            });
        }
        return globalThis.confirm?.(warning.replace(/<[^>]+>/g, '')) ?? true;
    }

    async #confirmCompleteAgentReroll() {
        if (this.#skipRerollConfirmation) return true;
        const DialogV2 = foundry.applications.api.DialogV2;
        const content = `
            <div class="dgac-reroll-confirmation">
                <p><strong>This will replace every generated choice with a completely new Agent.</strong></p>
                <p>Nothing will be applied to the sheet until you confirm.</p>
                <label>
                    <input type="checkbox" name="skipRerollConfirmation">
                    Do not ask again during this creator session
                </label>
            </div>`;
        if (DialogV2?.prompt) {
            const result = await DialogV2.prompt({
                window: { title: 'Reroll This Agent?' },
                content,
                ok: {
                    label: 'Reroll Agent',
                    icon: 'fa-solid fa-dice',
                    callback: (event, button, dialog) => ({
                        confirmed: true,
                        skip: Boolean(dialog.element.querySelector('[name="skipRerollConfirmation"]')?.checked),
                    }),
                },
            });
            if (!result?.confirmed) return false;
            this.#skipRerollConfirmation = result.skip;
            return true;
        }
        return globalThis.confirm?.('Reroll this Agent? This will replace every generated choice with a completely new Agent. Nothing will be applied to the sheet until you confirm.') ?? true;
    }

    // -----------------------------------------------------------------------
    // Build the interactive background improvement list.
    // -----------------------------------------------------------------------
    #getBonusAllocations() {
        this.#data.bonusAmounts ??= new Array(8).fill(20);
        this.#data.bonusOverflow ??= [];
        const primary = (this.#data.bonusBoosts ?? []).map((key, index) => ({
            key,
            customLabel: this.#data.bonusCustom?.[index] ?? '',
            amount: Number(this.#data.bonusAmounts[index] ?? 20),
            source: index,
        })).filter(entry => entry.key);
        return [...primary, ...this.#data.bonusOverflow];
    }

    #buildBonusSkillContext() {
        const rawSlots = this.#data.bonusBoosts;
        const customLabels = this.#data.bonusCustom ?? [];
        const slots = rawSlots.map((key, index) => ({ index, key, customLabel: customLabels[index] ?? '' }));
        const picksUsed = rawSlots.filter(k => k !== '').length;
        const allocations = this.#getBonusAllocations();
        const pointsAssigned = allocations.reduce((total, allocation) => total + allocation.amount, 0);
        const pendingOverflow = rawSlots.findIndex((key, index) => key && Number(this.#data.bonusAmounts[index] ?? 20) === 10
            && !this.#data.bonusOverflow.some(entry => entry.source === index));

        const packIdx = this.#data.selectedPackIdx ?? -1;
        const packDesc = packIdx >= 0 ? (BONUS_PACKAGES[packIdx]?.desc ?? '') : '';

        const usedSpecialties = new Map();
        const markSpecialtyUsed = (group, label) => {
            const normalized = label?.trim().toLowerCase();
            if (!normalized) return;
            if (!usedSpecialties.has(group)) usedSpecialties.set(group, new Set());
            usedSpecialties.get(group).add(normalized);
        };
        for (const slot of this.#data.specialtySlots) markSpecialtyUsed(slot.group, slot.label);
        for (const allocation of allocations) {
            if (allocation.key.startsWith('_custom_')) {
                markSpecialtyUsed(allocation.key.slice('_custom_'.length), allocation.customLabel);
            } else if (allocation.key.startsWith('profslot__')) {
                const [, group, label] = allocation.key.split('__');
                markSpecialtyUsed(group, label);
            }
        }
        const bonusDataLists = Object.entries(SPECIALTY_OPTIONS).map(([group, options]) => ({
            id: `dg-bonus-sp-${group}`,
            options: options.filter(option => !usedSpecialties.get(group)?.has(option.trim().toLowerCase())),
        }));

        const points = new Map();
        const addPoints = (identity, amount) => points.set(identity, (points.get(identity) ?? 0) + amount);
        for (const allocation of allocations) {
            const { key } = allocation;
            if (!key) continue;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                const label = allocation.customLabel?.trim();
                if (label) addPoints(`specialty|${group}|${label.toLowerCase()}`, allocation.amount);
            } else if (key.startsWith('profslot__')) {
                const [, group, label] = key.split('__');
                addPoints(`specialty|${group}|${label.toLowerCase()}`, allocation.amount);
            } else addPoints(`plain|${key}`, allocation.amount);
        }

        const makeRow = ({ identity, key = '', group = '', specialty = '', label, base, professional, tooltip }) => {
            const boostPoints = points.get(identity) ?? 0;
            const effective = Math.min(80, base + boostPoints);
            const addAmount = pendingOverflow >= 0 ? 10 : (effective === 70 ? 10 : 20);
            return {
                identity,
                actionId: encodeURIComponent(identity),
                key,
                group,
                specialty,
                label,
                base,
                professional,
                tooltip,
                boostCount: boostPoints / 20,
                boostPoints,
                effective,
                addAmount,
                canAdd: (pendingOverflow >= 0 || picksUsed < 8) && effective + addAmount <= 80,
                canRemove: boostPoints > 0,
            };
        };

        const professionalRows = [];
        const professionalPlainKeys = new Set(Object.keys(this.#data.skills));
        for (const key of professionalPlainKeys) {
            if (key === 'unnatural') continue;
            professionalRows.push(makeRow({
                identity: `plain|${key}`,
                key,
                label: BONUS_SKILL_OPTIONS.find(option => option.key === key)?.label
                    ?? key.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
                base: this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0,
                professional: true,
                tooltip: SKILL_TOOLTIPS[key] ?? '',
            }));
        }
        const professionalSpecialtyIds = new Set();
        for (const specialtySlot of this.#data.specialtySlots.filter(slot => slot.label.trim())) {
            const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, group]) => group === specialtySlot.group)?.[0] ?? specialtySlot.group;
            const identity = `specialty|${specialtySlot.group}|${specialtySlot.label.trim().toLowerCase()}`;
            professionalSpecialtyIds.add(identity);
            professionalRows.push(makeRow({
                identity,
                group: specialtySlot.group,
                specialty: specialtySlot.label,
                label: `${groupDisplay} (${specialtySlot.label})`,
                base: specialtySlot.proficiency ?? 0,
                professional: true,
                tooltip: SKILL_TOOLTIPS[groupDisplay.toLowerCase().replace(/ /g, '_')] ?? '',
            }));
        }
        professionalRows.sort((a, b) => a.label.localeCompare(b.label));

        const otherRows = BONUS_SKILL_OPTIONS
            .filter(option => !option.key.startsWith('_custom_') && option.key !== 'unnatural' && !professionalPlainKeys.has(option.key))
            .map(option => makeRow({
                identity: `plain|${option.key}`,
                key: option.key,
                label: option.label,
                base: SKILL_DEFAULTS[option.key] ?? 0,
                professional: false,
                tooltip: SKILL_TOOLTIPS[option.key] ?? '',
            }));
        const customSpecialties = new Map();
        for (const allocation of allocations) {
            const key = allocation.key;
            if (!key?.startsWith('_custom_')) continue;
            const group = key.slice('_custom_'.length);
            const specialty = allocation.customLabel?.trim();
            if (!specialty) continue;
            const identity = `specialty|${group}|${specialty.toLowerCase()}`;
            if (professionalSpecialtyIds.has(identity) || customSpecialties.has(identity)) continue;
            const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, value]) => value === group)?.[0] ?? group;
            customSpecialties.set(identity, makeRow({
                identity, group, specialty, label: `${groupDisplay} (${specialty})`, base: 0,
                professional: false,
                tooltip: SKILL_TOOLTIPS[groupDisplay.toLowerCase().replace(/ /g, '_')] ?? '',
            }));
        }
        otherRows.push(...customSpecialties.values());
        otherRows.sort((a, b) => a.label.localeCompare(b.label));

        const specialtyAdders = Object.entries(SPECIALTY_PREFIXES)
            .map(([label, group]) => ({
                label,
                group,
                sortLabel: label,
                isSpecialtyAdder: true,
                tooltip: SKILL_TOOLTIPS[label.toLowerCase().replace(/ /g, '_')] ?? '',
                canAdd: pendingOverflow >= 0 || picksUsed < 8,
                addAmount: pendingOverflow >= 0 ? 10 : 20,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        otherRows.push(...specialtyAdders);
        otherRows.sort((a, b) => (a.sortLabel ?? a.label).localeCompare(b.sortLabel ?? b.label));

        const profession = PROFESSIONS[this.#data.professionKey];
        const suggested = profession?.suggestedBonusSkills ?? [];
        return { packages: BONUS_PACKAGES, packIdx, packDesc, slots, picksUsed, pointsAssigned, pendingOverflow: pendingOverflow >= 0, bonusDataLists, professionalRows, otherRows, suggested };
    }

    // -----------------------------------------------------------------------
    // Build summary for the review step
    // -----------------------------------------------------------------------
    #buildReviewContext() {
        const boostCounts = {};
        const customLabels = {};
        for (const allocation of this.#getBonusAllocations()) {
            const key = allocation.key;
            if (!key) continue;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                const label = allocation.customLabel.trim();
                if (!label) continue;
                const displayKey = `${group} (${label})`;
                customLabels[displayKey] = (customLabels[displayKey] ?? 0) + allocation.amount;
            } else {
                boostCounts[key] = (boostCounts[key] ?? 0) + allocation.amount;
            }
        }
        const bonusAllocations = [
            ...Object.entries(boostCounts).map(([key, count]) => {
                let label;
                if (key.startsWith('profslot__')) {
                    const parts = key.split('__');
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === parts[1])?.[0] ?? parts[1];
                    label = `${groupDisplay} (${parts[2]})`;
                } else {
                    label = BONUS_SKILL_OPTIONS.find(s => s.key === key)?.label
                        ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                }
                return { label, count: count / 20, total: count };
            }),
            ...Object.entries(customLabels).map(([label, total]) => ({ label, count: total / 20, total })),
        ].sort((a, b) => a.label.localeCompare(b.label));

        const finalStats = { ...this.#data.stats };
        const finalSkills = Object.fromEntries(Object.entries(this.#data.skills).map(([key, value]) => [key, Math.min(80, value + (boostCounts[key] ?? 0))]));
        const baseSkillValue = key => finalSkills[key] ?? this.#getEffectivePlainSkillValue(key);
        const setFinalSkill = (key, value) => { finalSkills[key] = Math.min(99, value); };
        const startingSan = this.#data.stats.pow * 5;
        let finalSan = startingSan;
        let finalBp = startingSan - this.#data.stats.pow;
        let bondPenalty = 0;
        const veteranPath = this.#data.veteran?.path ?? 'freshRecruit';
        const veteran = { title: 'Fresh Recruit', effects: ['No traumatic background modifications.'], skillChanges: [] };

        if (veteranPath === 'extremeViolence') {
            veteran.title = 'Extreme Violence';
            finalSan = Math.max(0, startingSan - 5);
            finalStats.cha = Math.max(3, finalStats.cha - 3);
            bondPenalty = 3;
            const occultBefore = baseSkillValue('occult');
            setFinalSkill('occult', occultBefore + 10);
            veteran.effects = [`Occult ${occultBefore}% → ${finalSkills.occult}%`, `SAN ${startingSan} → ${finalSan}`, `CHA ${this.#data.stats.cha} → ${finalStats.cha}`, 'Each Bond −3', 'Adapted to Violence'];
        } else if (veteranPath === 'captivity') {
            veteran.title = 'Captivity or Imprisonment';
            finalSan = Math.max(0, startingSan - 5);
            finalStats.pow = Math.max(3, finalStats.pow - 3);
            const occultBefore = baseSkillValue('occult');
            setFinalSkill('occult', occultBefore + 10);
            veteran.effects = [`Occult ${occultBefore}% → ${finalSkills.occult}%`, `SAN ${startingSan} → ${finalSan}`, `POW ${this.#data.stats.pow} → ${finalStats.pow}`, 'Adapted to Helplessness'];
        } else if (veteranPath === 'hardExperience') {
            veteran.title = 'Hard Experience';
            finalSan = Math.max(0, startingSan - 5);
            const occultBefore = baseSkillValue('occult');
            setFinalSkill('occult', occultBefore + 10);
            veteran.effects = [`Occult ${occultBefore}% → ${finalSkills.occult}%`, `SAN ${startingSan} → ${finalSan}`, 'Remove one Bond'];
            for (const key of this.#data.veteran.hardSkills.filter(Boolean)) {
                const before = baseSkillValue(key);
                setFinalSkill(key, before + 10);
                const label = BONUS_SKILL_OPTIONS.find(option => option.key === key)?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
                veteran.skillChanges.push(`${label} ${before}% → ${finalSkills[key]}%`);
            }
        } else if (veteranPath === 'thingsMan') {
            veteran.title = 'Things Man Was Not Meant to Know';
            finalSan = Math.max(0, startingSan - this.#data.stats.pow);
            finalBp = Math.max(0, finalSan - this.#data.stats.pow);
            const occultBefore = baseSkillValue('occult');
            const unnaturalBefore = baseSkillValue('unnatural');
            setFinalSkill('occult', occultBefore + 20);
            setFinalSkill('unnatural', unnaturalBefore + 10);
            veteran.effects = [`Occult ${occultBefore}% → ${finalSkills.occult}%`, `Unnatural ${unnaturalBefore}% → ${finalSkills.unnatural}%`, `SAN ${startingSan} → ${finalSan}`, `Breaking Point → ${finalBp}`, `Disorder: ${this.#data.veteran.disorder}`];
        }

        return {
            stats: Object.entries(finalStats).map(([k, v]) => ({
                key: k, label: STAT_LABELS[k], value: v, x5: v * 5, tooltip: STAT_TOOLTIPS[k],
            })),
            profession: this.#data.professionKey === 'new_profession'
                ? (this.#data.customProfession?.name || 'Custom Profession')
                : (this.#data.professionKey
                    ? PROFESSIONS[this.#data.professionKey]?.title ?? this.#data.professionKey
                    : '—'),
            skills: Object.entries(this.#data.skills).map(([k, v]) => {
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return { key: k, label, value: finalSkills[k] ?? v, tooltip: SKILL_TOOLTIPS[k] ?? '' };
            }),
            specialtySkills: this.#data.specialtySlots
                .filter(sl => sl.label.trim())
                .map(sl => {
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === sl.group)?.[0] ?? sl.group;
                    const tooltipKey = groupDisplay.toLowerCase().replace(/ /g, '_');
                    return { label: `${groupDisplay} (${sl.label})`, value: sl.proficiency, tooltip: SKILL_TOOLTIPS[tooltipKey] ?? '' };
                }),
            bonds: this.#data.bonds.map(bond => ({ ...bond, score: Math.max(0, bond.score - bondPenalty) })),
            veteran,
            biography: Object.entries(this.#data.biography)
                .filter(([, v]) => v)
                .map(([k, v]) => ({
                    key: k,
                    label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    value: v,
                })),
            physical: Object.entries(this.#data.physical)
                .filter(([, value]) => value)
                .map(([key, value]) => ({
                    key,
                    label: {
                        height: 'Height',
                        weight: 'Weight',
                        build: 'Build',
                        hair: 'Hair',
                        eyes: 'Eyes',
                        complexion: 'Complexion',
                        distinguishingFeatures: 'Distinguishing Features',
                        notes: 'General Notes',
                    }[key] ?? key,
                    value,
                })),
            motivations: this.#data.motivations.filter(m => m.trim()),
            equipment: this.#data.equipment,
            bonusAllocations,
            derived: {
                hp: Math.ceil((finalStats.str + finalStats.con) / 2),
                wp: finalStats.pow,
                san: finalSan,
                bp: finalBp,
            },
            hasBioName: !!this.#data.biography.name,
        };
    }

    // -----------------------------------------------------------------------
    // Build step-warning indicators (one boolean per step index)
    // -----------------------------------------------------------------------
    #buildStepWarnings() {
        const w = new Array(STEPS.length).fill(false);
        if (!this.#data.professionKey) w[1] = true;
        if (this.#data.statMethod === 'pointBuy') {
            w[2] = Object.values(this.#data.stats).reduce((sum, value) => sum + value, 0) !== 72;
        } else {
            w[2] = Object.values(this.#data.statAssignments).filter(Boolean).length !== 6;
        }
        const profession = PROFESSIONS[this.#data.professionKey];
        if (this.#data.professionKey === 'new_profession') {
            const custom = this.#buildCustomProfessionContext();
            const identities = custom.allocations
                .filter(row => row.key)
                .map(row => row.isSpecialty ? `${row.key}:${row.specialty.trim().toLowerCase()}` : row.key);
            w[1] = !custom.name.trim()
                || custom.allocations.filter(row => row.key).length !== 10
                || custom.allocations.some(row => row.isSpecialty && !row.specialty.trim())
                || new Set(identities).size !== identities.length
                || custom.remaining !== 0
                || custom.capacity < custom.budget
                || custom.allocations.some(row => row.points % 5 !== 0)
                || custom.allocations.some(row => row.total > 60);
        }
        const optionLimit = profession?.optionalSkills?.[0]?.limit ?? 0;
        const hasBlankSpecialty = this.#data.specialtySlots.some(slot => !slot.label.trim());
        const requiredChoicesComplete = (profession?.requiredSkillChoices ?? []).every((choice, index) =>
            choice.options.some(option => this.#findSkillKey(option.name) === this.#data.requiredChoicePicks?.[index])
        );
        const chosenRequiredKeys = new Set(this.#data.requiredChoicePicks ?? []);
        const optionalDuplicatesRequired = (this.#data.optionalPicks ?? []).some(index => {
            const skill = profession?.optionalSkills?.[index];
            return skill && !parseSpecialtyFromName(skill.name) && chosenRequiredKeys.has(this.#findSkillKey(skill.name));
        });
        w[3] = this.#data.optionalPicks.length < optionLimit || hasBlankSpecialty || !requiredChoicesComplete || optionalDuplicatesRequired;
        w[4] = this.#data.bonusBoosts.some((key, index) =>
            !key || (key.startsWith('_custom_') && !this.#data.bonusCustom[index]?.trim())
        ) || this.#getBonusAllocations().reduce((sum, entry) => sum + entry.amount, 0) !== 160;
        if (!this.#veteranEnabled()) {
            this.#data.veteran = { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' };
        } else if (this.#data.veteran.path === 'hardExperience') {
            const selected = this.#data.veteran.hardSkills.filter(Boolean);
            w[5] = selected.length !== 4 || new Set(selected).size !== 4;
        } else if (this.#data.veteran.path === 'thingsMan') {
            w[5] = !this.#data.veteran.disorder;
        }
        const startedBonds = this.#data.bonds.filter(bond => bond.name || bond.relationship);
        const requiredBonds = profession ? this.#getRequiredBondCount(profession) : 1;
        w[6] = startedBonds.length < requiredBonds
            || startedBonds.some(bond => !bond.name || !bond.relationship
                || Number(bond.score) !== Number(this.#data.stats.cha));
        w[7] = !this.#data.biography.name.trim()
            || this.#data.motivations
                .slice(0, this.#getRequiredMotivationCount())
                .some(motivation => !motivation.trim());
        return w;
    }

    #buildProgressSteps(stepWarnings = this.#buildStepWarnings()) {
        const titles = ['Welcome', 'Profession', 'Statistics', 'Skills', 'Background Skills', 'Damaged Veteran', 'Bonds', 'Biography', 'Review'];
        return this.#activeStepIndices().map(index => {
            const title = titles[index];
            const prerequisiteIncomplete = stepWarnings.slice(1, index).some(Boolean);
            const canNavigate = this.#creationMode() === 'randomOnly'
                ? STEPS[index] === 'review'
                : index === this.#step || (index <= this.#furthestStep && !prerequisiteIncomplete);
            return {
                index,
                title,
                active: index === this.#step,
                done: index < this.#step,
                warning: Boolean(stepWarnings[index]),
                canNavigate,
                tooltip: canNavigate
                    ? `Go to ${title}`
                    : `Complete earlier sections to unlock ${title}`,
            };
        });
    }

    // -----------------------------------------------------------------------
    // Build state object in collectState() shape for exportToPDF
    // -----------------------------------------------------------------------
    #buildPdfState() {
        // Wizard group name → pdf-export.js skill key
        const GROUP_TO_KEY = {
            Art: 'art',
            Craft: 'craft',
            ForeignLanguage: 'foreign_language',
            Science: 'science',
            Pilot: 'pilot',
            MilitaryScience: 'military_science',
        };

        // Stats in uppercase-key format (matches csStats in collectState)
        const csStats = {
            STR: this.#data.stats.str,
            CON: this.#data.stats.con,
            DEX: this.#data.stats.dex,
            INT: this.#data.stats.int,
            POW: this.#data.stats.pow,
            CHA: this.#data.stats.cha,
        };

        const hp = Math.ceil((this.#data.stats.con + this.#data.stats.str) / 2);
        const wp = this.#data.stats.pow;
        const san = this.#data.stats.pow * 5;
        const bp = san - wp;
        const derived = { hp, wp, san, bp };

        // Compute effective plain-skill values (base + standard bonus boosts)
        const skills = { ...this.#data.skills };
        const boostCounts = {};
        for (const allocation of this.#getBonusAllocations()) {
            const key = allocation.key;
            if (!key || key.startsWith('_custom_') || key.startsWith('profslot__')) continue;
            boostCounts[key] = (boostCounts[key] ?? 0) + allocation.amount;
        }
        for (const [key, count] of Object.entries(boostCounts)) {
            // Only boost plain skills here; specialty keys handled via specialtyInstances below
            if (!(key in skills) && !(key in SKILL_DEFAULTS)) continue;
            skills[key] = Math.min(80, (skills[key] ?? SKILL_DEFAULTS[key] ?? 0) + count);
        }

        // Build specialtyInstances from profession specialty slots
        const specMap = new Map(); // `${key}||${specialty}` → instance object (for dedup/boost merging)
        for (const sl of this.#data.specialtySlots) {
            const label = sl.label.trim();
            if (!label) continue;
            const pdfKey = GROUP_TO_KEY[sl.group];
            if (!pdfKey) continue;
            const mapKey = `${pdfKey}||${label}`;
            if (specMap.has(mapKey)) {
                specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + sl.proficiency);
            } else {
                specMap.set(mapKey, { key: pdfKey, specialty: label, value: sl.proficiency });
            }
        }

        // Apply bonus boosts that target specialty slots (profslot__) or add new ones (_custom_)
        for (const allocation of this.#getBonusAllocations()) {
            const key = allocation.key;
            if (!key) continue;

            if (key.startsWith('profslot__')) {
                // profslot__{group}__{label} — boost or create matching specialty instance
                const parts = key.split('__');
                const group = parts[1];  // e.g. 'ForeignLanguage'
                const label = parts[2];  // e.g. 'Spanish'
                const pdfKey = GROUP_TO_KEY[group];
                if (!pdfKey || !label) continue;
                const mapKey = `${pdfKey}||${label}`;
                if (specMap.has(mapKey)) {
                    specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + allocation.amount);
                } else {
                    specMap.set(mapKey, { key: pdfKey, specialty: label, value: allocation.amount });
                }

            } else if (key.startsWith('_custom_')) {
                // _custom_{Group} — user typed a custom specialty label
                const group = key.slice('_custom_'.length);  // e.g. 'Art'
                const label = allocation.customLabel.trim();
                if (!label) continue;
                const pdfKey = GROUP_TO_KEY[group];
                if (!pdfKey) continue;
                const mapKey = `${pdfKey}||${label}`;
                if (specMap.has(mapKey)) {
                    specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + allocation.amount);
                } else {
                    specMap.set(mapKey, { key: pdfKey, specialty: label, value: allocation.amount });
                }
            }
        }

        const specialtyInstances = [...specMap.values()];

        const bio = {
            name: this.#data.biography.name,
            profession: this.#data.biography.profession,
            employer: this.#data.biography.employer,
            nationality: this.#data.biography.nationality,
            sex: this.#data.biography.sex,
            age: this.#data.biography.age,
            education: this.#data.biography.education,
            motivations: this.#data.motivations.filter(m => m.trim()).join('\n'),
            personalDetails: Object.entries({
                Height: this.#data.physical.height,
                Weight: this.#data.physical.weight,
                Build: this.#data.physical.build,
                Hair: this.#data.physical.hair,
                Eyes: this.#data.physical.eyes,
                Complexion: this.#data.physical.complexion,
                'Distinguishing Features': this.#data.physical.distinguishingFeatures,
                Notes: this.#data.physical.notes,
            }).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n'),
        };

        // Distinguishing features from stat descriptors
        const lpFeat = {};
        for (const k of ['str', 'con', 'dex', 'int', 'pow', 'cha']) {
            lpFeat[k.toUpperCase()] = getStatDescriptor(k, this.#data.stats[k]);
        }

        return {
            csStats, derived, bio, skills,
            skillSpecs: {},
            customSkills: [],
            specialtyInstances,
            bonds: this.#data.bonds,
            sanity: { violence: [false, false, false], helplessness: [false, false, false] },
            lpNotes: { wounds: '', gear: '', remarks: '' },
            lpFeat,
            lpWeapons: [],
            equipment: this.#data.equipment,
        };
    }

    // -----------------------------------------------------------------------
    // _onRender — called after every Handlebars re-render
    // -----------------------------------------------------------------------
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        const wrapper = this.element?.querySelector('.dg-wizard-wrapper');
        wrapper?.classList.toggle('dg-hide-tips', !getSetting('showCreatorTips', true));
        wrapper?.classList.toggle('dg-compact', getSetting('compactCreatorLayout', false));
        const importInput = this.element?.querySelector('#dgac-agent-import-file');
        importInput?.addEventListener('change', async event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            try {
                await this.#importAgentText(await file.text());
            } catch (error) {
                ui.notifications.error(error.message ?? 'The Agent could not be imported.');
            }
        });
        // Stop any previous pyramid loop when navigating away
        if (STEPS[this.#step] === 'profession') this.#setupProfessionUI();
        if (STEPS[this.#step] === 'stats') this.#setupStatsUI();
        if (this.#statsScrollTop !== null) {
            const form = this.element?.querySelector('.dg-wizard-form');
            if (form) form.scrollTop = this.#statsScrollTop;
            this.#statsScrollTop = null;
        }
        if (STEPS[this.#step] === 'equipment') this.#buildEquipmentUI();
        if (STEPS[this.#step] === 'skills') { this.#setupSkillsUI(); this.#setupSpecialtyUI(); }
        if (STEPS[this.#step] === 'damaged_veteran') this.#setupVeteranUI();
        // Enter key → Next/Finish button click (except equipment/bonus_skills which have their own inputs)
        const step = STEPS[this.#step];
        if (!['equipment', 'bonus_skills', 'welcome'].includes(step)) {
            this.element?.querySelector('form.dg-wizard-form')?.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                if (step === 'stats' && this.#data.statMethod === 'pointBuy' && e.target.matches('.dg-stat-input')) {
                    e.preventDefault();
                    e.target.blur();
                    return;
                }
                const tag = e.target.tagName;
                if (tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                const nav = this.element?.querySelector('.dg-wizard-nav');
                const btn = nav?.querySelector('[data-action="finish"]') ?? nav?.querySelector('[data-action="nextStep"]');
                btn?.click();
            });
        }
    }

    async _onClose(options) {
        if (!this.#suppressCloseSave) await this.#saveState();
        await super._onClose?.(options);
    }

    #setupStatsUI() {
        const selects = [...(this.element?.querySelectorAll('.dg-stat-assignment') ?? [])];
        for (const select of selects) {
            select.addEventListener('change', () => {
                const stat = select.dataset.stat;
                const nextSlot = select.value;
                this.#data.statAssignments[stat] = nextSlot;
                this.#syncStatsFromAssignments();
                this.#rememberRolledState();
                this.#saveState();
                this.#renderStatsPreservingScroll();
            });
        }
        if (this.#data.statMethod === 'pointBuy') {
            for (const input of this.element?.querySelectorAll('.dg-stat-input') ?? []) {
                input.addEventListener('change', () => {
                    const stat = input.name.replace('stats.', '');
                    const entered = Number(input.value);
                    const fallback = Number(this.#data.stats[stat]) || 10;
                    const value = Number.isFinite(entered) ? Math.round(entered) : fallback;
                    const otherTotal = Object.entries(this.#data.stats)
                        .filter(([key]) => key !== stat)
                        .reduce((sum, [, score]) => sum + Number(score), 0);
                    const budgetMaximum = Math.max(3, 72 - otherTotal);
                    this.#data.stats[stat] = Math.max(3, Math.min(18, budgetMaximum, value));
                    this.#data.statMethod = 'pointBuy';
                    this.#saveState();
                    this.#renderStatsPreservingScroll();
                });
            }
        }
    }

    #renderStatsPreservingScroll() {
        this.#statsScrollTop = this.element?.querySelector('.dg-wizard-form')?.scrollTop ?? 0;
        this.render({ force: true });
    }

    #setupVeteranUI() {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return;
        const syncDetails = () => {
            const path = form.querySelector('[name="veteran.path"]:checked')?.value ?? 'freshRecruit';
            form.querySelectorAll('.dg-veteran-detail[data-veteran-path]').forEach(panel => {
                panel.hidden = panel.dataset.veteranPath !== path;
            });
        };
        const syncHardSkills = () => {
            const selects = [...form.querySelectorAll('select[name^="veteran.hardSkill."]')];
            const selected = selects.map(select => select.value).filter(Boolean);
            for (const select of selects) {
                for (const option of select.options) {
                    option.disabled = Boolean(option.value && option.value !== select.value && selected.includes(option.value));
                }
                const option = select.selectedOptions[0];
                const current = Number(option?.dataset.value ?? 0);
                const output = select.closest('.dg-veteran-skill-row')?.querySelector('.dg-veteran-skill-change');
                if (output) output.textContent = option?.value ? `${current}% to ${Math.min(99, current + 10)}%` : 'Choose a skill';
            }
        };
        form.querySelectorAll('[name="veteran.path"]').forEach(input => input.addEventListener('change', syncDetails));
        form.querySelectorAll('select[name^="veteran.hardSkill."]').forEach(select => select.addEventListener('change', syncHardSkills));
        syncDetails();
        syncHardSkills();
    }

    #syncStatsFromAssignments() {
        const pool = new Map(this.#data.statPool.map(slot => [slot.id, slot.value]));
        for (const stat of Object.keys(STAT_LABELS)) {
            const value = pool.get(this.#data.statAssignments[stat]);
            this.#data.stats[stat] = Number.isFinite(value) ? value : 0;
        }
    }

    #rememberRolledState() {
        if (this.#data.statMethod !== 'rolled') return;
        this.#data.rolledState = {
            pool: foundry.utils.deepClone(this.#data.statPool),
            assignments: foundry.utils.deepClone(this.#data.statAssignments),
            stats: foundry.utils.deepClone(this.#data.stats),
        };
    }

    #setStatArray(values, method) {
        this.#rememberRolledState();
        this.#data.statMethod = method;
        this.#data.statPool = values.map((value, index) => ({ id: `${method}-${index}`, value }));
        Object.keys(STAT_LABELS).forEach(stat => { this.#data.statAssignments[stat] = ''; });
        this.#syncStatsFromAssignments();
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    // -----------------------------------------------------------------------
    // Skills step: mark duplicate specialty inputs within the same group
    // -----------------------------------------------------------------------
    #setupSpecialtyUI() {
        const el = this.element;
        if (!el) return;
        const inputs = [...el.querySelectorAll('.dg-specialty-section .dg-specialty-input[data-group]')];
        if (inputs.length === 0) return;

        const checkDupes = () => {
            const byGroup = {};
            inputs.forEach(inp => {
                const g = inp.dataset.group;
                (byGroup[g] ??= []).push(inp);
            });
            Object.values(byGroup).forEach(group => {
                const vals = group.map(i => i.value.trim().toLowerCase());
                group.forEach((inp, idx) => {
                    const val = vals[idx];
                    const isDupe = val !== '' && vals.some((v, j) => j !== idx && v === val);
                    inp.classList.toggle('dg-specialty-dupe', isDupe);
                });
            });
        };

        inputs.forEach(inp => {
            inp.addEventListener('input', checkDupes);
            inp.addEventListener('change', checkDupes);
        });
        checkDupes();
    }

    // -----------------------------------------------------------------------
    // Welcome step: spinning wireframe pyramid (ported from DELTA-GREEN-STATS)
    // -----------------------------------------------------------------------
    #initWelcomePyramid() {
        const canvas = this.element?.querySelector('#dg-welcome-pyramid');
        if (!canvas) return;

        const verts = [
            [0, -1.2, 0],
            [-1, 0.6, -1],
            [1, 0.6, -1],
            [1, 0.6, 1],
            [-1, 0.6, 1],
        ];
        const edges = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]];

        let ay = 0;
        const ax = 0.38;
        const ctx = canvas.getContext('2d');
        const FRAME_MS = 1000 / 24;
        let lastFrameTime = 0;
        let stopped = false;

        const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
        const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
        const project = (v, cx, cy, scale) => {
            const fov = 4.5;
            const s = (fov / (v[2] + fov)) * scale;
            return [cx + v[0] * s, cy + v[1] * s];
        };

        const draw = (now) => {
            if (stopped || document.hidden) { if (!stopped) requestAnimationFrame(draw); return; }
            if (now - lastFrameTime < FRAME_MS) { requestAnimationFrame(draw); return; }
            const elapsed = now - lastFrameTime;
            lastFrameTime = now;

            const W = canvas.offsetWidth || 260;
            const H = canvas.offsetHeight || 200;
            if (canvas.width !== W) canvas.width = W;
            if (canvas.height !== H) canvas.height = H;

            ctx.clearRect(0, 0, W, H);
            const scale = Math.min(W, H) * 0.32;
            const pts = verts.map(v => project(rotX(rotY(v, ay), ax), W / 2, H / 2, scale));

            ctx.strokeStyle = 'rgba(0, 180, 30, 0.10)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            edges.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
            ctx.stroke();

            ctx.strokeStyle = 'rgba(0, 130, 25, 0.70)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            edges.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
            ctx.stroke();

            ay += 0.00036 * elapsed;
            requestAnimationFrame(draw);
        };

        // Stop the loop when we navigate away from the welcome step
        canvas._stopPyramid = () => { stopped = true; };
        requestAnimationFrame(draw);
    }

    // -----------------------------------------------------------------------
    // Profession step: live description update on dropdown change
    // -----------------------------------------------------------------------
    #setupProfessionUI() {
        const el = this.element;
        if (!el) return;
        const select = el.querySelector('.dg-select-profession');
        const descEl = el.querySelector('.dg-profession-desc');
        const customEl = el.querySelector('.dg-custom-profession-builder');
        if (!select || !descEl) return;

        const update = ({ commit = false } = {}) => {
            const key = select.value;
            const prof = key ? PROFESSIONS[key] : null;
            if (prof && key !== 'new_profession') {
                descEl.style.display = '';
                descEl.querySelector('.dg-desc-text').textContent = prof.description;
            } else {
                descEl.style.display = 'none';
            }
            if (customEl) customEl.style.display = key === 'new_profession' ? '' : 'none';
            if (commit) {
                this.#collectCurrentStep({ validate: false });
                this.#saveState();
                this.render({ force: true });
            }
        };

        select.addEventListener('change', () => update({ commit: true }));
        update(); // run immediately in case a profession is already selected

        if (customEl) this.#setupCustomProfessionUI(customEl);
    }

    #setupCustomProfessionUI(container) {
        const bondSelect = container.querySelector('[name="customProfession.bonds"]');
        const budgetEl = container.querySelector('.dg-custom-budget');
        const spentEl = container.querySelector('.dg-custom-spent');
        const remainingEl = container.querySelector('.dg-custom-remaining');
        const capacityEl = container.querySelector('.dg-custom-capacity');
        const feasibilityEl = container.querySelector('.dg-custom-feasibility');
        const rows = [...container.querySelectorAll('.dg-custom-skill-row')];

        const update = () => {
            const bonds = Math.max(1, Math.min(4, Number(bondSelect?.value) || 3));
            const budget = this.#getCustomProfessionBudget(bonds);
            let spent = 0;
            const identities = [];

            for (const row of rows) {
                const select = row.querySelector('.dg-custom-skill-select');
                const specialty = row.querySelector('.dg-custom-specialty-input');
                const pointsInput = row.querySelector('.dg-custom-points-input');
                const addedOutput = row.querySelector('.dg-custom-added');
                const baseEl = row.querySelector('.dg-custom-base');
                const totalEl = row.querySelector('.dg-custom-total');
                const key = select?.value ?? '';
                const isSpecialty = key.startsWith('_custom_');
                const base = isSpecialty ? 0 : (SKILL_DEFAULTS[key] ?? 0);
                const maximumPoints = Math.max(0, 60 - base);
                let points = Math.round((Number(pointsInput?.value) || 0) / 5) * 5;
                points = Math.max(0, Math.min(maximumPoints, points));
                if (pointsInput) {
                    pointsInput.max = String(maximumPoints);
                    if (Number(pointsInput.value) !== points) pointsInput.value = String(points);
                    pointsInput.disabled = !key;
                }
                if (addedOutput) addedOutput.textContent = String(points);
                if (specialty) {
                    specialty.style.display = '';
                    specialty.style.visibility = isSpecialty ? 'visible' : 'hidden';
                    specialty.disabled = !isSpecialty;
                    specialty.required = isSpecialty;
                    const group = isSpecialty ? key.slice('_custom_'.length) : '';
                    if (isSpecialty) specialty.setAttribute('list', `dg-custom-sp-${group}`);
                }
                if (baseEl) baseEl.textContent = String(base);
                if (totalEl) totalEl.textContent = key ? `${base + points}%` : '—';
                spent += points;
                const specialtyName = specialty?.value.trim().toLowerCase() ?? '';
                identities.push(key ? (isSpecialty ? `${key}:${specialtyName}` : key) : '');
            }

            rows.forEach((row, index) => {
                const identity = identities[index];
                const duplicate = Boolean(identity && identities.some((other, otherIndex) => otherIndex !== index && other === identity));
                row.classList.toggle('dg-custom-duplicate', duplicate);
            });

            const remaining = budget - spent;
            if (remaining < 0 && changedInput) {
                changedInput.value = String(Math.max(0, (Number(changedInput.value) || 0) + remaining));
                update();
                return;
            }
            if (budgetEl) budgetEl.textContent = String(budget);
            if (spentEl) spentEl.textContent = String(spent);
            if (remainingEl) {
                remainingEl.textContent = String(remaining);
                remainingEl.classList.toggle('is-invalid', remaining !== 0);
            }

            const capacity = rows.reduce((sum, row) => {
                const key = row.querySelector('.dg-custom-skill-select')?.value ?? '';
                const base = key.startsWith('_custom_') ? 0 : (SKILL_DEFAULTS[key] ?? 0);
                return sum + (key ? 60 - base : 60);
            }, 0);
            if (capacityEl) {
                capacityEl.textContent = String(capacity);
                capacityEl.classList.toggle('is-invalid', capacity < budget);
            }
            if (feasibilityEl) {
                feasibilityEl.textContent = capacity < budget
                    ? `These skill choices can accept at most ${capacity} of the required ${budget} points. Replace a skill with a lower base rating.`
                    : '';
                feasibilityEl.classList.toggle('is-visible', capacity < budget);
            }

            for (const row of rows) {
                const input = row.querySelector('.dg-custom-points-input');
                const key = row.querySelector('.dg-custom-skill-select')?.value ?? '';
                const value = Number(input?.value) || 0;
                const maximum = Number(input?.max) || 0;
                row.querySelectorAll('.dg-custom-adjust').forEach(button => {
                    const delta = Number(button.dataset.delta) || 0;
                    button.disabled = !key
                        || (delta > 0 && (remaining <= 0 || value >= maximum))
                        || (delta < 0 && value <= 0);
                });
            }
        };

        bondSelect?.addEventListener('change', update);
        rows.forEach(row => {
            row.querySelector('.dg-custom-skill-select')?.addEventListener('change', update);
            row.querySelector('.dg-custom-specialty-input')?.addEventListener('input', update);
            row.querySelector('.dg-custom-points-input')?.addEventListener('input', event => update(event.currentTarget));
            row.querySelectorAll('.dg-custom-adjust').forEach(button => {
                button.addEventListener('click', () => {
                    const input = row.querySelector('.dg-custom-points-input');
                    if (!input || input.disabled) return;
                    input.value = String((Number(input.value) || 0) + Number(button.dataset.delta || 0));
                    update(input);
                });
            });
        });
        update();
    }

    // -----------------------------------------------------------------------
    // Bonus skills step: show/hide custom specialty input per slot
    // -----------------------------------------------------------------------
    #setupBonusSkillsUI() {
        const el = this.element;
        if (!el) return;
        const selects = [...el.querySelectorAll('.dg-bonus-slot-select')];

        const SPECIALTY_PLACEHOLDERS = {
            Art: 'e.g. Painting, Photography…',
            Craft: 'e.g. Electrician, Mechanic…',
            ForeignLanguage: 'e.g. Spanish, Arabic…',
            MilitaryScience: 'e.g. Land, Air…',
            Pilot: 'e.g. Airplane, Helicopter…',
            Science: 'e.g. Biology, Physics…',
        };

        const updateRow = (select) => {
            const row = select.closest('.dg-bonus-slot-row');
            const input = row?.querySelector('.dg-bonus-custom-input');
            if (!input) return;
            const isCustom = select.value.startsWith('_custom_');
            input.style.display = isCustom ? 'inline-block' : 'none';
            if (isCustom) {
                const group = select.value.slice('_custom_'.length);
                input.setAttribute('list', `dg-bonus-sp-${group}`);
                input.placeholder = SPECIALTY_PLACEHOLDERS[group] ?? 'Specialty name…';
            }
        };

        selects.forEach(select => {
            updateRow(select);
            select.addEventListener('change', () => updateRow(select));
        });

        // Live-update the skills reference table when a slot or text input changes
        const updateSkillsTable = () => {
            const counts = {};
            const specRows = {}; // ck -> { label, base, boosts }
            for (const select of selects) {
                const key = select.value;
                if (!key) continue;
                if (key.startsWith('_custom_')) {
                    const slotRow = select.closest('.dg-bonus-slot-row');
                    const input = slotRow?.querySelector('.dg-bonus-custom-input');
                    const label = input?.value?.trim() ?? '';
                    if (!label) continue;
                    const ck = `${key}__${label}`;
                    const group = key.slice('_custom_'.length);
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === group)?.[0] ?? group;
                    if (!specRows[ck]) specRows[ck] = { label: `${groupDisplay} (${label})`, base: 0, boosts: 0 };
                    specRows[ck].boosts++;
                } else if (key.startsWith('profslot__')) {
                    const parts = key.split('__');
                    const group = parts[1];
                    const slotLabel = parts[2];
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === group)?.[0] ?? group;
                    const sl = this.#data.specialtySlots.find(s => s.group === group && s.label === slotLabel);
                    if (!specRows[key]) specRows[key] = { label: `${groupDisplay} (${slotLabel})`, base: sl?.proficiency ?? 0, boosts: 0 };
                    specRows[key].boosts++;
                } else {
                    counts[key] = (counts[key] ?? 0) + 1;
                }
            }

            const picksUsed = selects.reduce((total, select) => total + (select.value ? 1 : 0), 0);
            const counter = el.querySelector('.dg-picks-counter strong');
            if (counter) counter.textContent = String(picksUsed);

            // Prevent picks that would exceed the 80% creation cap. A selected
            // option remains enabled so the player can always change it.
            const selectionIdentity = (select, value = select.value) => {
                if (!value) return '';
                if (value.startsWith('_custom_')) {
                    const label = select.closest('.dg-bonus-slot-row')
                        ?.querySelector('.dg-bonus-custom-input')?.value?.trim().toLowerCase() ?? '';
                    return label ? `${value}__${label}` : '';
                }
                return value;
            };
            const identityCounts = {};
            for (const select of selects) {
                const identity = selectionIdentity(select);
                if (identity) identityCounts[identity] = (identityCounts[identity] ?? 0) + 1;
            }
            for (const select of selects) {
                const currentIdentity = selectionIdentity(select);
                for (const option of select.options) {
                    if (!option.value || option.value === select.value) {
                        option.disabled = false;
                        continue;
                    }
                    const identity = selectionIdentity(select, option.value);
                    if (!identity) {
                        option.disabled = false;
                        continue;
                    }
                    const base = Number(option.dataset.base ?? 0);
                    const usedElsewhere = (identityCounts[identity] ?? 0)
                        - (identity === currentIdentity ? 1 : 0);
                    const capacity = Math.max(0, Math.floor((80 - base) / 20));
                    option.disabled = usedElsewhere >= capacity;
                }
            }

            // Update plain skill rows
            el.querySelectorAll('.dg-skills-ref-row:not(.dg-skill-custom)').forEach(row => {
                const key = row.dataset.key;
                const base = parseInt(row.dataset.base, 10) || 0;
                const boosts = counts[key] ?? 0;
                const boostAmount = boosts * 20;
                const effective = Math.min(80, base + boostAmount);
                const boostCell = row.querySelector('.dg-skill-ref-boost');
                const valueCell = row.querySelector('.dg-skill-ref-value');
                if (boostCell) boostCell.textContent = boostAmount > 0 ? `+${boostAmount}` : '';
                if (valueCell) valueCell.textContent = effective;
                row.classList.toggle('dg-skill-boosted', boosts > 0);
            });

            // Clear old specialty rows and rebuild from current DOM state
            el.querySelectorAll('.dg-skill-custom').forEach(r => r.remove());
            const tables = [...el.querySelectorAll('.dg-skills-ref-table')];
            const lastTbody = tables[tables.length - 1]?.querySelector('tbody');
            if (lastTbody) {
                for (const [ck, { label, base, boosts }] of Object.entries(specRows)) {
                    const boostAmount = boosts * 20;
                    const effective = Math.min(80, base + boostAmount);
                    const tr = document.createElement('tr');
                    tr.className = 'dg-skills-ref-row dg-skill-custom dg-skill-boosted';
                    tr.dataset.key = ck;
                    tr.dataset.base = String(base);
                    const labelCell = document.createElement('td');
                    labelCell.textContent = label;
                    const group = ck.startsWith('profslot__') ? ck.split('__')[1] : ck.split('__')[0].slice('_custom_'.length);
                    const tooltipKey = Object.entries(SPECIALTY_PREFIXES).find(([, value]) => value === group)?.[0]
                        ?.toLowerCase().replace(/ /g, '_');
                    const tooltip = SKILL_TOOLTIPS[tooltipKey] ?? '';
                    if (tooltip) labelCell.title = tooltip;
                    const baseCell = document.createElement('td');
                    baseCell.className = 'dg-num';
                    baseCell.textContent = String(base);
                    const boostCell = document.createElement('td');
                    boostCell.className = 'dg-num dg-skill-ref-boost';
                    boostCell.textContent = `+${boostAmount}`;
                    const valueCell = document.createElement('td');
                    valueCell.className = 'dg-num dg-skill-ref-value';
                    valueCell.textContent = String(effective);
                    tr.append(labelCell, baseCell, boostCell, valueCell);
                    lastTbody.appendChild(tr);
                }
            }
        };

        selects.forEach(select => select.addEventListener('change', updateSkillsTable));
        el.querySelectorAll('.dg-bonus-custom-input').forEach(input => input.addEventListener('input', updateSkillsTable));
        updateSkillsTable();
    }

    // -----------------------------------------------------------------------
    // Skills step: live optional-pick counter + checkbox locking
    // -----------------------------------------------------------------------
    #setupSkillsUI() {
        const el = this.element;
        if (!el) return;
        const counterEl = el.querySelector('.dg-opt-picks-counter');
        const optLimit = parseInt(counterEl?.dataset.limit, 10) || 0;

        const updateCounter = () => {
            const requiredKeys = new Set([...el.querySelectorAll('select[name^="requiredChoice."]')].map(select => select.value).filter(Boolean));
            el.querySelectorAll('input[name="optPick"][data-skill-key]').forEach(cb => {
                const conflicts = requiredKeys.has(cb.dataset.skillKey);
                if (conflicts) cb.checked = false;
                cb.dataset.requiredConflict = conflicts ? 'true' : 'false';
                cb.closest('.dg-opt-skill-row')?.classList.toggle('dg-option-conflict', conflicts);
            });
            const checked = el.querySelectorAll('input[name="optPick"]:checked').length;
            if (counterEl) counterEl.innerHTML = `Optional picks: <strong>${checked} / ${optLimit}</strong>${checked >= optLimit ? ' 🔒' : ''}`;
            counterEl?.classList.toggle('at-limit', checked >= optLimit);
            el.querySelectorAll('input[name="optPick"]:not(:checked)').forEach(cb => { cb.disabled = cb.dataset.requiredConflict === 'true' || checked >= optLimit; });
            el.querySelectorAll('input[name="optPick"]:checked').forEach(cb => { cb.disabled = false; });
            // Enable specialty text inputs only when their checkbox is checked
            el.querySelectorAll('.dg-opt-skill-row').forEach(row => {
                const cb = row.querySelector('input[name="optPick"]');
                const inp = row.querySelector('.dg-opt-spec-input');
                if (cb && inp) inp.disabled = !cb.checked;
            });
        };

        el.querySelectorAll('input[name="optPick"]').forEach(cb => cb.addEventListener('change', updateCounter));
        el.querySelectorAll('select[name^="requiredChoice."]').forEach(select => select.addEventListener('change', updateCounter));
        updateCounter();
    }

    // -----------------------------------------------------------------------
    // Equipment step: build interactive catalog + loadout panels
    // -----------------------------------------------------------------------
    #buildEquipmentUI() {
        const el = this.element;
        if (!el) return;

        const searchInput = el.querySelector('#dg-eq-search');
        const catTabsEl = el.querySelector('#dg-eq-cat-tabs');
        const catalogEl = el.querySelector('#dg-eq-catalog');
        const loadoutEl = el.querySelector('#dg-eq-loadout');
        if (!searchInput || !catTabsEl || !catalogEl || !loadoutEl) return;

        // Sync search input to stored state
        searchInput.value = this.#equipSearch;
        searchInput.addEventListener('input', (e) => {
            this.#equipSearch = e.target.value;
            this.#renderEquipmentCatalog(catalogEl);
        });

        // Catalog click delegation — add item to loadout
        catalogEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-item-name]');
            if (!btn) return;
            const name = btn.dataset.itemName;
            if (name && !this.#data.equipment.includes(name)) {
                this.#data.equipment.push(name);
                this.#renderEquipmentLoadout(loadoutEl);
                this.#renderEquipmentCatalog(catalogEl);
                this.#updateEquipCountBadge(el);
            }
        });

        // Loadout click delegation — remove item
        loadoutEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-item-idx]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.itemIdx, 10);
            if (!isNaN(idx)) {
                this.#data.equipment.splice(idx, 1);
                this.#renderEquipmentLoadout(loadoutEl);
                this.#renderEquipmentCatalog(catalogEl);
                this.#updateEquipCountBadge(el);
            }
        });

        // Custom item add
        const customInput = el.querySelector('#dg-eq-custom-input');
        const customAddBtn = el.querySelector('#dg-eq-custom-add');
        if (customInput && customAddBtn) {
            customAddBtn.addEventListener('click', () => {
                const name = customInput.value.trim();
                if (name && !this.#data.equipment.includes(name)) {
                    this.#data.equipment.push(name);
                    customInput.value = '';
                    this.#renderEquipmentLoadout(loadoutEl);
                    this.#renderEquipmentCatalog(catalogEl);
                    this.#updateEquipCountBadge(el);
                }
            });
            customInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); customAddBtn.click(); }
            });
        }

        this.#renderEquipmentTabs(catTabsEl, catalogEl);
        this.#renderEquipmentCatalog(catalogEl);
        this.#renderEquipmentLoadout(loadoutEl);
        this.#updateEquipCountBadge(el);
    }

    #renderEquipmentTabs(tabsEl, catalogEl) {
        tabsEl.innerHTML = '';
        for (const cat of EQUIPMENT_CATEGORIES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = cat;
            btn.className = 'dg-eq-cat-btn' + (cat === this.#equipCategory ? ' active' : '');
            btn.addEventListener('click', () => {
                this.#equipCategory = cat;
                tabsEl.querySelectorAll('.dg-eq-cat-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === cat));
                this.#renderEquipmentCatalog(catalogEl);
            });
            tabsEl.appendChild(btn);
        }
    }

    #renderEquipmentCatalog(catalogEl) {
        const query = this.#equipSearch.toLowerCase().trim();
        const filtered = EQUIPMENT_CATALOG.filter(item => {
            const catMatch = this.#equipCategory === 'All' || item.category === this.#equipCategory;
            const srchMatch = !query
                || item.name.toLowerCase().includes(query)
                || item.category.toLowerCase().includes(query);
            return catMatch && srchMatch;
        });

        if (filtered.length === 0) {
            catalogEl.innerHTML = '<div class="dg-eq-empty">No items match.</div>';
            return;
        }
        catalogEl.innerHTML = filtered.map(item => {
            const inLoadout = this.#data.equipment.includes(item.name);
            const exp = item.system?.expense ?? '';
            const expClass = `dg-exp-${exp.toLowerCase()}`;
            const safeName = item.name.replace(/"/g, '&quot;');
            return `<div class="dg-eq-item${inLoadout ? ' in-loadout' : ''}">
  <div class="dg-eq-item-info">
    <span class="dg-eq-item-name">${item.name}</span>
    <span class="dg-eq-expense ${expClass}">${exp}</span>
  </div>
  <button type="button" class="dg-eq-add-btn" data-item-name="${safeName}"${inLoadout ? ' disabled' : ''}>
    ${inLoadout ? '✓' : '+'}
  </button>
</div>`;
        }).join('');
    }

    #renderEquipmentLoadout(loadoutEl) {
        if (this.#data.equipment.length === 0) {
            loadoutEl.innerHTML = '<div class="dg-eq-empty">No items selected.</div>';
            return;
        }
        loadoutEl.innerHTML = this.#data.equipment.map((name, idx) => {
            const item = EQUIPMENT_CATALOG.find(i => i.name === name);
            const exp = item?.system?.expense ?? '';
            const expClass = `dg-exp-${exp.toLowerCase()}`;
            return `<div class="dg-eq-loadout-item">
  <span class="dg-eq-loadout-name">${name}</span>
  <span class="dg-eq-expense ${expClass}">${exp}</span>
  <button type="button" class="dg-eq-remove-btn" data-item-idx="${idx}" title="Remove">✕</button>
</div>`;
        }).join('');
    }

    #updateEquipCountBadge(el) {
        const badge = el.querySelector('.dg-eq-count');
        if (badge) badge.textContent = this.#data.equipment.length > 0 ? `${this.#data.equipment.length} selected` : '';
    }

    // -----------------------------------------------------------------------
    // Static action handlers (Foundry v14 ApplicationV2 pattern)
    // -----------------------------------------------------------------------
    static async #onNextStep(event, target) {
        if (this.#creationMode() === 'randomOnly') {
            await this.#generateCompleteRandomAgent();
            this.#saveState();
            this.render({ force: true });
            return;
        }
        if (!this.#collectCurrentStep()) return;
        if (this.#step < STEPS.length - 1) {
            this.#step++;
            if (!this.#veteranEnabled() && STEPS[this.#step] === 'damaged_veteran') this.#step++;
            this.#furthestStep = Math.max(this.#furthestStep, this.#step);
            if (STEPS[this.#step] === 'stats' && this.#data.statMethod === 'randomized' && this.#data.statPool.length !== 6) {
                await this.#randomizeStatData();
            }
            this.#saveState();
            this.render({ force: true });
        }
    }

    static async #onPrevStep(event, target) {
        if (this.#creationMode() === 'randomOnly') return;
        if (this.#step > 0) {
            this.#collectCurrentStep({ validate: false });
            const departingStep = this.#step;
            this.#step--;
            if (!this.#veteranEnabled() && STEPS[this.#step] === 'damaged_veteran') this.#step--;
            if (STEPS[this.#step] === 'welcome') this.#resumeStep = departingStep;
            this.#saveState();
            this.render({ force: true });
        }
    }

    static async #onRollStatPool(event, target) {
        const rolls = [];
        for (let index = 0; index < 6; index += 1) {
            const roll = await new Roll('4d6kh3').evaluate();
            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
                flavor: `Agent Creation: Statistic Roll ${index + 1}`,
            }, { rollMode: getSetting('statRollMode', 'publicroll') });
            rolls.push({ id: `rolled-${Date.now()}-${index}`, value: roll.total });
        }
        this.#data.statMethod = 'rolled';
        this.#data.statPool = rolls;
        Object.keys(STAT_LABELS).forEach(stat => { this.#data.statAssignments[stat] = ''; });
        this.#syncStatsFromAssignments();
        this.#rememberRolledState();
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onSelectRollMethod(event, target) {
        if (this.#data.statMethod === 'rolled') return;
        const saved = this.#data.rolledState;
        this.#data.statMethod = 'rolled';
        this.#data.statPool = foundry.utils.deepClone(saved?.pool ?? []);
        this.#data.statAssignments = foundry.utils.deepClone(saved?.assignments ?? {
            str: '', con: '', dex: '', int: '', pow: '', cha: '',
        });
        this.#data.stats = foundry.utils.deepClone(saved?.stats ?? {
            str: 0, con: 0, dex: 0, int: 0, pow: 0, cha: 0,
        });
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onUseGeneralistArray(event, target) {
        this.#setStatArray([13, 13, 12, 12, 11, 11], 'generalist');
    }

    static async #onUseFocusedArray(event, target) {
        this.#setStatArray([15, 14, 12, 11, 10, 10], 'focused');
    }

    static async #onUseHighlyFocusedArray(event, target) {
        this.#setStatArray([17, 14, 12, 10, 10, 9], 'highlyFocused');
    }

    static async #onUsePointBuy(event, target) {
        this.#rememberRolledState();
        this.#data.stats = { str: 10, con: 10, dex: 10, int: 10, pow: 10, cha: 10 };
        this.#data.statMethod = 'pointBuy';
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onAdjustPointBuy(event, target) {
        const stat = target.dataset.stat;
        const delta = Number(target.dataset.delta);
        const input = this.element?.querySelector(`input[name="stats.${stat}"]`);
        const current = Number(input?.value ?? this.#data.stats[stat]);
        const otherTotal = Object.entries(this.#data.stats)
            .filter(([key]) => key !== stat)
            .reduce((sum, [, score]) => sum + Number(score), 0);
        const budgetMaximum = Math.max(3, 72 - otherTotal);
        this.#data.stats[stat] = Math.max(3, Math.min(18, budgetMaximum, current + delta));
        this.#data.statMethod = 'pointBuy';
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onRandomizeStats(event, target) {
        if (!this.#sectionRandomizerAllowed('allowStatRandomizer')) return ui.notifications.warn('The Handler has disabled Randomized Statistics.');
        await this.#randomizeStatData();
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onRandomizeAgent(event, target) {
        if (!['both', 'randomOnly'].includes(this.#creationMode())) return ui.notifications.warn('The Handler has disabled complete Random Agent generation.');
        target.disabled = true;
        try {
            await this.#generateCompleteRandomAgent();
            this.#saveState();
            this.render({ force: true });
            ui.notifications.info('A complete random Agent is ready for review.');
        } finally {
            target.disabled = false;
        }
    }

    static async #onRerollCompleteAgent(event, target) {
        if (this.#workflowOrigin !== 'completeRandom') return;
        if (!['both', 'randomOnly'].includes(this.#creationMode())) return ui.notifications.warn('The Handler has disabled complete Random Agent generation.');
        if (!await this.#confirmCompleteAgentReroll()) return;
        target.disabled = true;
        try {
            await this.#generateCompleteRandomAgent();
            this.#saveState();
            this.render({ force: true });
            ui.notifications.info('A new complete random Agent is ready for review.');
        } finally {
            target.disabled = false;
        }
    }

    static async #onRandomizeProfessionSkills(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeProfessionSkills')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#collectCurrentStep({ validate: false });
        const form = this.element?.querySelector('form.dg-wizard-form');
        const selectedKey = form?.querySelector('.dg-select-profession')?.value || this.#data.professionKey;
        if (!selectedKey || !PROFESSIONS[selectedKey]) {
            ui.notifications.warn('Select a profession first.');
            return;
        }
        this.#randomizeProfessionData(selectedKey);
        this.#saveState();
        this.render({ force: true });
    }

    static async #onToggleFixedSpecialty(event, target) {
        await this.#collectCurrentStep({ validate: false });
        const slotId = target.dataset.slot;
        const slot = this.#data.specialtySlots.find(entry => entry.required && String(entry.id) === slotId);
        if (!slot?.fixedLabel) return;
        const policy = getSetting('fixedSpecialtyPolicy', 'allowUnlock');
        if (policy === 'strict') {
            ui.notifications.warn('The GM has locked fixed profession specialties.');
            return;
        }
        this.#data.fixedSpecialtyUnlocks ??= {};
        const hasOverride = Object.prototype.hasOwnProperty.call(this.#data.fixedSpecialtyUnlocks, slot.id);
        const currentlyUnlocked = hasOverride
            ? Boolean(this.#data.fixedSpecialtyUnlocks[slot.id])
            : policy === 'editable';
        this.#data.fixedSpecialtyUnlocks[slot.id] = !currentlyUnlocked;
        this.#saveState();
        this.render({ force: true });
    }

    static async #onResetFixedSpecialty(event, target) {
        await this.#collectCurrentStep({ validate: false });
        const slotId = target.dataset.slot;
        const slot = this.#data.specialtySlots.find(entry => entry.required && String(entry.id) === slotId);
        if (!slot?.fixedLabel) return;
        slot.label = slot.fixedLabel;
        this.#data.fixedSpecialtyUnlocks ??= {};
        this.#data.fixedSpecialtyUnlocks[slot.id] = false;
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRandomizeProfession(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeProfession')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#randomizeProfessionData(null, { randomizeChoices: false });
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRandomizeBackground(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeBackgroundSkills')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#randomizeBackgroundData();
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRandomizeVeteran(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeVeteran')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#randomizeVeteranData();
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRandomizeBonds(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeBonds')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        if (!this.#data.professionKey) {
            ui.notifications.warn('Select a profession first.');
            return;
        }
        this.#randomizeBondsData();
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRandomizeMotivations(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeMotivations')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#captureBiographyDraft();
        this.#randomizeMotivationsData();
        this.#saveState();
        this.render({ force: true });
    }

    static async #onRemoveBond(event, target) {
        this.#collectCurrentStep({ validate: false });
        const idx = Number(target.dataset.index);
        this.#data.bonds.splice(idx, 1);
        this.#saveState();
        this.render({ force: true });
    }

    static async #onSuggestBond(event, target) {
        const form = this.element?.querySelector('form.dg-wizard-form');
        const scrollTop = form?.scrollTop ?? 0;
        this.#collectCurrentStep({ validate: false });
        const pool = BONDS[this.#data.bondDataset] ?? Object.values(BONDS).flat();
        const suggestion = pool[Math.floor(Math.random() * pool.length)];
        const idx = Number(target.dataset.index);
        if (this.#data.bonds[idx]) {
            this.#data.bonds[idx].name = suggestion.name;
            this.#data.bonds[idx].relationship = suggestion.relationship ?? '';
            this.#data.bonds[idx].description = suggestion.description ?? '';
        }
        this.#saveState();
        this.#statsScrollTop = scrollTop;
        await this.render({ force: true });
    }

    static async #onRandomBio(event, target) {
        if (!this.#sectionRandomizerAllowed('randomizeBiography')) return ui.notifications.warn('The Handler has disabled this section randomizer.');
        this.#captureBiographyDraft();
        const generated = generateBio(this.#data.stats, this.#data.professionKey);
        Object.assign(this.#data.biography, generated.biography);
        Object.assign(this.#data.physical, generated.physical);
        this.#saveState();
        await this.render({ force: true });
        // Foundry's DOM diff preserves existing input values, so set them directly after render
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (form) {
            for (const [k, v] of Object.entries(this.#data.biography)) {
                const el = form.querySelector(`[name="biography.${k}"]`);
                if (el) el.value = v ?? '';
            }
            for (const [k, v] of Object.entries(this.#data.physical)) {
                const el = form.querySelector(`[name="physical.${k}"]`);
                if (el) el.value = v ?? '';
            }
        }
    }

    static async #onClearEquipment(event, target) {
        this.#data.equipment = [];
        this.render({ force: true });
    }

    static async #onFillPack(event, target) {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return;
        const sel = form.querySelector('#dg-bonus-pack-select');
        if (!sel || sel.value === '') return;
        const idx = parseInt(sel.value);
        if (!this.#fillBackgroundPackage(idx)) return;
        this.render({ force: true });
    }

    static async #onClearBackgroundSkills(event, target) {
        const hasAssignments = this.#data.bonusBoosts.some(Boolean);
        if (hasAssignments) {
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: 'Reset Background Skills' },
                content: '<p>Clear all eight Background Skill improvements?</p>',
                yes: { label: 'Reset', icon: 'fa-solid fa-rotate-left' },
                no: { label: 'Cancel', icon: 'fa-solid fa-xmark' },
            });
            if (!confirmed) return;
        }
        this.#data.bonusBoosts = new Array(8).fill('');
        this.#data.bonusCustom = new Array(8).fill('');
        this.#data.bonusAmounts = new Array(8).fill(20);
        this.#data.bonusOverflow = [];
        this.#data.selectedPackIdx = -1;
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onAdjustBackgroundSkill(event, target) {
        const identity = decodeURIComponent(target.dataset.skill ?? '');
        const delta = Number(target.dataset.delta ?? 0);
        if (!identity || !delta) return;
        this.#data.bonusBoosts ??= new Array(8).fill('');
        this.#data.bonusCustom ??= new Array(8).fill('');
        this.#data.bonusAmounts ??= new Array(8).fill(20);
        this.#data.bonusOverflow ??= [];

        const matchesIdentity = index => {
            const key = this.#data.bonusBoosts[index];
            if (identity.startsWith('plain|')) return key === identity.slice(6);
            const [, group, normalizedLabel] = identity.split('|');
            if (key === `profslot__${group}__${this.#data.specialtySlots.find(slot =>
                slot.group === group && slot.label.trim().toLowerCase() === normalizedLabel)?.label}`) return true;
            return key === `_custom_${group}`
                && this.#data.bonusCustom[index]?.trim().toLowerCase() === normalizedLabel;
        };

        if (delta < 0) {
            const overflowIndex = this.#data.bonusOverflow.findLastIndex(entry => {
                if (identity.startsWith('plain|')) return entry.key === identity.slice(6);
                const [, group, normalizedLabel] = identity.split('|');
                return (entry.key.startsWith('_custom_') && entry.key.slice(8) === group && entry.customLabel?.trim().toLowerCase() === normalizedLabel)
                    || entry.key.startsWith(`profslot__${group}__`) && entry.key.split('__')[2]?.toLowerCase() === normalizedLabel;
            });
            if (overflowIndex >= 0) {
                this.#data.bonusOverflow.splice(overflowIndex, 1);
            } else {
            for (let index = this.#data.bonusBoosts.length - 1; index >= 0; index--) {
                if (!matchesIdentity(index)) continue;
                const pairedIndex = this.#data.bonusOverflow.findIndex(entry => entry.source === index);
                if (Number(this.#data.bonusAmounts[index] ?? 20) === 10 && pairedIndex >= 0) {
                    const paired = this.#data.bonusOverflow.splice(pairedIndex, 1)[0];
                    this.#data.bonusBoosts[index] = paired.key;
                    this.#data.bonusCustom[index] = paired.customLabel ?? '';
                    this.#data.bonusAmounts[index] = 10;
                } else {
                    this.#data.bonusOverflow = this.#data.bonusOverflow.filter(entry => entry.source !== index);
                    this.#data.bonusBoosts[index] = '';
                    this.#data.bonusCustom[index] = '';
                    this.#data.bonusAmounts[index] = 20;
                }
                break;
            }
            }
        } else {
            const context = this.#buildBonusSkillContext();
            const row = [...context.professionalRows, ...context.otherRows].find(item => item.identity === identity);
            if (!row?.canAdd) return;
            const pendingSource = this.#data.bonusBoosts.findIndex((key, index) => key && this.#data.bonusAmounts[index] === 10
                && !this.#data.bonusOverflow.some(entry => entry.source === index));
            const index = pendingSource >= 0 ? pendingSource : this.#data.bonusBoosts.findIndex(key => !key);
            if (index < 0) return;
            let key;
            let customLabel = '';
            if (identity.startsWith('plain|')) {
                key = identity.slice(6);
            } else {
                const [, group, normalizedLabel] = identity.split('|');
                const professionalSlot = this.#data.specialtySlots.find(slot =>
                    slot.group === group && slot.label.trim().toLowerCase() === normalizedLabel);
                if (professionalSlot) {
                    key = `profslot__${group}__${professionalSlot.label}`;
                } else {
                    const displayLabel = row.specialty || normalizedLabel;
                    key = `_custom_${group}`;
                    customLabel = displayLabel;
                }
            }
            if (pendingSource >= 0) {
                this.#data.bonusOverflow.push({ key, customLabel, amount: 10, source: pendingSource });
            } else {
                this.#data.bonusBoosts[index] = key;
                this.#data.bonusCustom[index] = customLabel;
                this.#data.bonusAmounts[index] = row.addAmount;
            }
        }
        this.#data.selectedPackIdx = -1;
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onAddBackgroundSpecialty(event, target) {
        const group = target.dataset.group;
        const input = this.element?.querySelector(`[name="bonusSpecialty.${group}"]`);
        const label = input?.value?.trim() ?? '';
        if (!group || !label) {
            ui.notifications.warn('Enter a specialty name first.');
            return;
        }
        const professionalSlot = this.#data.specialtySlots.find(slot =>
            slot.group === group && slot.label.trim().toLowerCase() === label.toLowerCase());
        const identity = `specialty|${group}|${label.toLowerCase()}`;
        const context = this.#buildBonusSkillContext();
        const existing = [...context.professionalRows, ...context.otherRows].find(row => row.identity === identity);
        if (existing) {
            if (!existing.canAdd) {
                ui.notifications.warn(`${existing.label} cannot receive another improvement.`);
                return;
            }
            const pendingSource = this.#data.bonusBoosts.findIndex((key, index) => key && this.#data.bonusAmounts[index] === 10
                && !this.#data.bonusOverflow.some(entry => entry.source === index));
            const index = pendingSource >= 0 ? pendingSource : this.#data.bonusBoosts.findIndex(key => !key);
            if (index < 0) return;
            const key = professionalSlot ? `profslot__${group}__${professionalSlot.label}` : `_custom_${group}`;
            const customLabel = professionalSlot ? '' : (existing.specialty || label);
            if (pendingSource >= 0) {
                this.#data.bonusOverflow.push({ key, customLabel, amount: 10, source: pendingSource });
            } else {
            if (professionalSlot) {
                this.#data.bonusBoosts[index] = `profslot__${group}__${professionalSlot.label}`;
            } else {
                this.#data.bonusBoosts[index] = `_custom_${group}`;
                this.#data.bonusCustom[index] = existing.specialty || label;
            }
            this.#data.bonusAmounts[index] = existing.addAmount;
            }
            this.#data.selectedPackIdx = -1;
            this.#saveState();
            this.#renderStatsPreservingScroll();
            return;
        }
        const pendingSource = this.#data.bonusBoosts.findIndex((key, index) => key && this.#data.bonusAmounts[index] === 10
            && !this.#data.bonusOverflow.some(entry => entry.source === index));
        const index = pendingSource >= 0 ? pendingSource : this.#data.bonusBoosts.findIndex(key => !key);
        if (index < 0) {
            ui.notifications.warn('All eight background improvements are already assigned.');
            return;
        }
        const key = professionalSlot ? `profslot__${group}__${professionalSlot.label}` : `_custom_${group}`;
        const customLabel = professionalSlot ? '' : label;
        if (pendingSource >= 0) this.#data.bonusOverflow.push({ key, customLabel, amount: 10, source: pendingSource });
        else {
            this.#data.bonusBoosts[index] = key;
            this.#data.bonusCustom[index] = customLabel;
            this.#data.bonusAmounts[index] = 20;
        }
        this.#data.selectedPackIdx = -1;
        this.#saveState();
        this.#renderStatsPreservingScroll();
    }

    static async #onLoadLoadout(event, target) {
        const key = target.dataset.loadout;
        const items = LOADOUTS[key] ?? [];
        for (const name of items) {
            if (!this.#data.equipment.includes(name)) this.#data.equipment.push(name);
        }
        const el = this.element;
        if (el) {
            const loadoutEl = el.querySelector('#dg-eq-loadout');
            const catalogEl = el.querySelector('#dg-eq-catalog');
            if (loadoutEl) this.#renderEquipmentLoadout(loadoutEl);
            if (catalogEl) this.#renderEquipmentCatalog(catalogEl);
            this.#updateEquipCountBadge(el);
        }
    }

    static async #onFinish(event, target) {
        if (this.#creationMode() === 'randomOnly' && this.#workflowOrigin !== 'completeRandom' && !(game.user.isGM && this.#workflowOrigin === 'imported')) {
            await this.#generateCompleteRandomAgent();
            this.#saveState();
            this.render({ force: true });
            ui.notifications.warn('World rules changed. A complete random Agent was generated for review.');
            return;
        }
        if (!this.#collectCurrentStep()) return;
        const warnings = this.#buildStepWarnings();
        const firstIncomplete = warnings.findIndex(Boolean);
        if (firstIncomplete >= 0) {
            const title = this.#buildProgressSteps(warnings).find(item => item.index === firstIncomplete)?.title ?? 'the required section';
            ui.notifications.warn(`Complete ${title} before applying the Agent.`);
            this.#step = firstIncomplete;
            this.#saveState();
            this.render({ force: true });
            return;
        }
        if (!await this.#confirmApplyToActor()) return;
        await this.#applyToActor();
        await this.#actor.setFlag('delta-green-agent-creator', 'lastAgentExchange', this.#createExchange()).catch(() => { });
        // Clear saved wizard state now that it's been applied
        this.#suppressCloseSave = true;
        await this.#saveQueue.catch(() => null);
        await this.#actor.unsetFlag('delta-green-agent-creator', this.#stateFlagKey()).catch(() => { });
        this.close();
        ui.notifications.info(`${this.#actor.name} is ready for fieldwork.`);
    }

    static async #onApplyAndKeep(event, target) {
        if (!this.#collectCurrentStep()) return;
        const warnings = this.#buildStepWarnings();
        const firstIncomplete = warnings.findIndex(Boolean);
        if (firstIncomplete >= 0) {
            const title = this.#buildProgressSteps(warnings).find(item => item.index === firstIncomplete)?.title ?? 'the required section';
            ui.notifications.warn(`Complete ${title} before applying the Agent.`);
            this.#step = firstIncomplete;
            this.#saveState();
            this.render({ force: true });
            return;
        }
        if (!await this.#confirmApplyToActor()) return;
        await this.#applyToActor();
        this.render({ force: true });
        ui.notifications.info(`Changes applied — wizard still open.`);
    }

    static async #onJumpToStep(event, target) {
        if (this.#creationMode() === 'randomOnly') return ui.notifications.warn('The Handler has limited this creator to complete Random Agents.');
        this.#collectCurrentStep({ validate: false });
        const requestedStep = parseInt(target.dataset.step, 10);
        const progressStep = this.#buildProgressSteps().find(item => item.index === requestedStep);
        if (!progressStep?.canNavigate) {
            ui.notifications.warn(progressStep?.tooltip ?? 'Complete earlier sections first.');
            return;
        }
        if (STEPS[requestedStep] === 'welcome') this.#resumeStep = this.#step;
        this.#step = requestedStep;
        this.#saveState();
        this.render({ force: true });
    }

    static async #onResumeCreation(event, target) {
        this.#step = Math.max(STEPS.indexOf('profession'), this.#resumeStep);
        this.#furthestStep = Math.max(this.#furthestStep, this.#step);
        this.#saveState();
        this.render({ force: true });
    }

    static async #onStartOver(event, target) {
        const DialogV2 = foundry.applications.api.DialogV2;
        const confirmed = DialogV2?.confirm
            ? await DialogV2.confirm({
                window: { title: 'Start Agent Over?' },
                content: '<p><strong>This will discard all saved progress in the Agent Creator.</strong></p><p>Nothing already applied to the Actor sheet will be changed.</p>',
                yes: { label: 'Start Over', icon: 'fa-solid fa-rotate-left' },
                no: { label: 'Keep Progress', icon: 'fa-solid fa-xmark' },
            })
            : (globalThis.confirm?.('Start over? This will discard all saved progress in the Agent Creator. Nothing already applied to the Actor sheet will be changed.') ?? false);
        if (!confirmed) return;
        const actor = this.#actor;
        this.#suppressCloseSave = true;
        await this.#saveQueue.catch(() => null);
        await actor.unsetFlag('delta-green-agent-creator', this.#stateFlagKey()).catch(() => { });
        await this.close();
        const replacement = new DeltaGreenChargenWizard(actor);
        replacement.#step = STEPS.indexOf('welcome');
        replacement.#resumeStep = replacement.#step;
        replacement.#furthestStep = replacement.#step;
        replacement.#workflowOrigin = 'guided';
        replacement.#saveState();
        replacement.render({ force: true });
    }

    static async #onPickPortrait(event, target) {
        new (foundry.applications.apps.FilePicker.implementation)({
            type: 'image',
            current: this.#actor.img,
            callback: async (path) => {
                await this.#actor.update({ img: path });
                this.render({ force: true });
            },
        }).browse();
    }

    static async #onLoadStoredAgent(event, target) {
        const exchange = this.#actor.getFlag('delta-green-agent-creator', 'lastAgentExchange');
        if (!exchange) return ui.notifications.warn('No previously applied Agent Exchange data is available.');
        const previousData = this.#data;
        const previousOrigin = this.#workflowOrigin;
        try {
            this.#data = this.#validateImportedData(exchange.agent);
            this.#workflowOrigin = 'imported';
            this.#step = STEPS.indexOf('review');
            this.#furthestStep = this.#step;
            if (this.#buildStepWarnings().some(Boolean)) throw new Error('The stored Agent is no longer compatible with the current world rules.');
            this.#saveState();
            this.render({ force: true });
        } catch (error) {
            this.#data = previousData;
            this.#workflowOrigin = previousOrigin;
            ui.notifications.error(error.message ?? 'The stored Agent could not be loaded.');
        }
    }

    #createExchange() {
        return createAgentExchange(this.#data, {
            moduleVersion: game.modules.get('delta-green-agent-creator')?.version,
        });
    }

    #assertImportAllowed() {
        if (game.user.isGM) return;
        if (this.#creationMode() === 'randomOnly') throw new Error('The Handler has limited this creator to complete Random Agents.');
        if (getSetting('playerImportPolicy', 'compatible') !== 'compatible') throw new Error('The Handler has disabled player Agent imports.');
    }

    #validateImportedData(imported) {
        const data = foundry.utils.deepClone(imported);
        const statKeys = Object.keys(STAT_LABELS);
        if (!data.stats || statKeys.some(key => !Number.isInteger(Number(data.stats[key])) || Number(data.stats[key]) < 3 || Number(data.stats[key]) > 18)) {
            throw new Error('The imported Agent has invalid statistics.');
        }
        if (!data.professionKey || !PROFESSIONS[data.professionKey]) throw new Error('The imported Agent uses an unknown profession.');
        if (!game.user.isGM && !this.#getAvailableProfessionEntries().some(([key]) => key === data.professionKey)) {
            throw new Error('The imported Agent uses a profession source disabled by the Handler.');
        }
        if (!getAllowedStatMethods().includes(data.statMethod)) throw new Error('The imported Agent uses a statistic method disabled by the Handler.');
        const veteranPath = data.veteran?.path ?? 'freshRecruit';
        const veteranPaths = ['freshRecruit', 'extremeViolence', 'captivity', 'hardExperience', 'thingsMan'];
        if (!veteranPaths.includes(veteranPath)) throw new Error('The imported Agent has an unknown Damaged Veteran status.');
        if (!game.user.isGM && !this.#veteranEnabled() && veteranPath !== 'freshRecruit') {
            throw new Error('The imported Agent uses the Damaged Veteran rule, which the Handler disabled.');
        }
        if (!game.user.isGM && !this.#allowedVeteranPaths().includes(veteranPath)) {
            throw new Error('The imported Agent uses a Damaged Veteran background disabled by the Handler.');
        }
        if (!Array.isArray(data.bonds) || !Array.isArray(data.motivations) || !data.biography || !data.physical) {
            throw new Error('The imported Agent is missing required character data.');
        }
        if (data.bonds.some(bond => Number(bond.score) !== Number(data.stats.cha))) {
            throw new Error('Imported starting Bond scores must equal CHA.');
        }
        if (!data.skills || Object.entries(data.skills).some(([key, value]) => !(key in SKILL_DEFAULTS) || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 80)) {
            throw new Error('The imported Agent contains invalid professional skill values.');
        }
        if (!Array.isArray(data.specialtySlots) || data.specialtySlots.some(slot => !Object.values(SPECIALTY_PREFIXES).includes(slot.group) || !String(slot.label ?? '').trim() || !Number.isInteger(Number(slot.proficiency)) || Number(slot.proficiency) < 0 || Number(slot.proficiency) > 80)) {
            throw new Error('The imported Agent contains invalid typed skills or specialties.');
        }
        data.equipment = [];
        data.requiredChoicePicks = Array.isArray(data.requiredChoicePicks) ? data.requiredChoicePicks.map(String) : [];
        data.veteran ??= { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' };
        data.veteran.hardSkills = Array.from({ length: 4 }, (_, index) => String(data.veteran.hardSkills?.[index] ?? ''));
        return data;
    }

    async #importAgentText(text) {
        this.#assertImportAllowed();
        const exchange = parseAgentExchange(text);
        const previousData = this.#data;
        const previousStep = this.#step;
        const previousOrigin = this.#workflowOrigin;
        try {
            this.#data = this.#validateImportedData(exchange.agent);
            this.#workflowOrigin = 'imported';
            this.#step = STEPS.indexOf('review');
            this.#furthestStep = this.#step;
            const warnings = this.#buildStepWarnings();
            const firstIncomplete = warnings.findIndex(Boolean);
            if (firstIncomplete >= 0) {
                const section = this.#buildProgressSteps(warnings).find(item => item.index === firstIncomplete)?.title ?? 'required data';
                throw new Error(`The imported Agent is incomplete or incompatible in ${section}.`);
            }
        } catch (error) {
            this.#data = previousData;
            this.#step = previousStep;
            this.#workflowOrigin = previousOrigin;
            throw error;
        }
        this.#saveState();
        this.render({ force: true });
        ui.notifications.info('Agent imported and ready for review.');
    }

    static #onImportAgentFile(event, target) {
        try {
            this.#assertImportAllowed();
            this.element?.querySelector('#dgac-agent-import-file')?.click();
        } catch (error) {
            ui.notifications.warn(error.message);
        }
    }

    static async #onPasteAgentCode(event, target) {
        try {
            this.#assertImportAllowed();
            const result = await foundry.applications.api.DialogV2.prompt({
                window: { title: 'Paste Agent Code' },
                content: '<div class="dgac-import-prompt"><p>Paste a DGAC Agent Code or Agent Exchange JSON.</p><textarea name="agentExchange" rows="10" autocomplete="off"></textarea></div>',
                ok: {
                    label: 'Import Agent',
                    callback: (event, button, dialog) => dialog.element.querySelector('textarea[name="agentExchange"]')?.value ?? '',
                },
            });
            if (result) await this.#importAgentText(result);
        } catch (error) {
            ui.notifications.error(error.message ?? 'The Agent could not be imported.');
        }
    }

    static #onExportAgentJson(event, target) {
        const exchange = this.#createExchange();
        downloadAgentExchange(exchange, this.#data.biography?.name || this.#actor.name);
        ui.notifications.info('Agent JSON exported.');
    }

    static async #onCopyAgentCode(event, target) {
        const code = encodeAgentCode(this.#createExchange());
        try {
            await navigator.clipboard.writeText(code);
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = code;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.append(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        ui.notifications.info('Agent Code copied to the clipboard.');
    }

    // -----------------------------------------------------------------------
    // Collect form data from the current step before advancing
    // -----------------------------------------------------------------------
    #collectCurrentStep({ validate = true } = {}) {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return true;
        const fd = new foundry.applications.ux.FormDataExtended(form);
        const raw = fd.object;
        const readField = (path, fallback = '') => {
            if (Object.prototype.hasOwnProperty.call(raw, path)) return raw[path];
            const nested = path.split('.').reduce((value, key) => value?.[key], raw);
            return nested ?? fallback;
        };
        const reject = (message) => {
            if (validate) ui.notifications.warn(message);
            return false;
        };
        const step = STEPS[this.#step];

        if (step === 'stats') {
            if (this.#data.statMethod === 'pointBuy') {
                for (const stat of Object.keys(STAT_LABELS)) {
                    const value = Number(raw[`stats.${stat}`] ?? raw.stats?.[stat] ?? this.#data.stats[stat]);
                    if (!Number.isInteger(value) || value < 3 || value > 18) {
                        if (validate) return reject(`${STAT_LABELS[stat]} must be a whole number from 3 to 18.`);
                    }
                    this.#data.stats[stat] = value;
                }
                const total = Object.values(this.#data.stats).reduce((sum, value) => sum + value, 0);
                if (total !== 72) {
                    if (validate) return reject(`Point allocation must total 72. Current total: ${total}.`);
                }
                return true;
            }
            const assignments = {};
            for (const stat of Object.keys(STAT_LABELS)) {
                assignments[stat] = raw[`statAssignment.${stat}`]
                    ?? raw.statAssignment?.[stat]
                    ?? this.#data.statAssignments[stat];
            }
            if (Object.values(assignments).some(slot => !slot) || new Set(Object.values(assignments)).size !== 6) {
                if (validate) return reject('Assign each generated value exactly once.');
            }
            this.#data.statAssignments = assignments;
            this.#syncStatsFromAssignments();
        }

        if (step === 'profession') {
            const key = raw['professionKey'];
            if (!key) {
                this.#data.professionKey = '';
                this.#data.skills = {};
                this.#data.requiredChoicePicks = [];
                this.#data.specialtySlots = [];
                this.#data.optSpecialtyLabels = {};
                this.#data.optionalPicks = [];
                this.#data.fixedSpecialtyUnlocks = {};
                this.#data.biography.profession = '';
                if (validate) return reject('Please select a profession.');
                return true;
            }
            const profChanged = key !== this.#data.professionKey;
            this.#data.professionKey = key;
            const prof = PROFESSIONS[key];
            if (key === 'new_profession') {
                const customName = readField('customProfession.name', this.#data.customProfession?.name ?? '').toString().trim();
                const bonds = Math.max(1, Math.min(4, Number(readField('customProfession.bonds', 3)) || 3));
                const allocations = [];
                const identities = new Set();
                let spent = 0;

                for (let index = 0; index < 10; index += 1) {
                    const skillKey = readField(`customProfession.skill.${index}`, '').toString();
                    const specialty = readField(`customProfession.specialty.${index}`, '').toString().trim();
                    const points = Number(readField(`customProfession.points.${index}`, 0));
                    if (!skillKey) {
                        if (validate) return reject(`Choose professional skill ${index + 1}.`);
                        allocations.push({ key: '', specialty: '', points: 0 });
                        continue;
                    }
                    if (!Number.isInteger(points) || points < 0) {
                        if (validate) return reject(`Professional skill ${index + 1} requires a valid whole number of points.`);
                    }
                    if (points % 5 !== 0) {
                        if (validate) return reject(`Professional skill ${index + 1} must be allocated in 5 point increments.`);
                    }
                    const isSpecialty = skillKey.startsWith('_custom_');
                    if (isSpecialty && !specialty) {
                        if (validate) return reject(`Enter the specialty for professional skill ${index + 1}.`);
                    }
                    const base = isSpecialty ? 0 : (SKILL_DEFAULTS[skillKey] ?? 0);
                    if (base + points > 60) {
                        if (validate) return reject(`Professional skill ${index + 1} cannot exceed 60%.`);
                    }
                    const identity = isSpecialty ? `${skillKey}:${specialty.toLowerCase()}` : skillKey;
                    if (identities.has(identity)) {
                        if (validate) return reject(`Professional skill ${index + 1} duplicates another selection.`);
                    }
                    identities.add(identity);
                    allocations.push({ key: skillKey, specialty, points });
                    spent += points;
                }

                const budget = this.#getCustomProfessionBudget(bonds);
                const capacity = allocations.reduce((sum, allocation) => {
                    if (!allocation.key) return sum + 60;
                    const base = allocation.key.startsWith('_custom_') ? 0 : (SKILL_DEFAULTS[allocation.key] ?? 0);
                    return sum + 60 - base;
                }, 0);
                if (!customName && validate) return reject('Enter a name for the custom profession.');
                if (allocations.filter(allocation => allocation.key).length !== 10 && validate) {
                    return reject('Choose exactly 10 professional skills.');
                }
                if (capacity < budget && validate) {
                    return reject(`These professional skills can accept at most ${capacity} points. Replace a skill with a lower base rating to spend the required ${budget}.`);
                }
                if (spent !== budget && validate) {
                    return reject(`Allocate exactly ${budget} professional skill points. ${budget - spent} remaining.`);
                }

                this.#data.customProfession = { name: customName, bonds, allocations };
                this.#data.skills = {};
                this.#data.specialtySlots = [];
                allocations.forEach((allocation, index) => {
                    if (!allocation.key) return;
                    if (allocation.key.startsWith('_custom_')) {
                        this.#data.specialtySlots.push({
                            id: `custom_${index}`,
                            group: allocation.key.slice('_custom_'.length),
                            label: allocation.specialty,
                            proficiency: allocation.points,
                            required: true,
                            optIndex: null,
                            fixedLabel: '',
                        });
                    } else {
                        this.#data.skills[allocation.key] = (SKILL_DEFAULTS[allocation.key] ?? 0) + allocation.points;
                    }
                });
                this.#data.optionalPicks = [];
                this.#data.requiredChoicePicks = [];
                this.#data.optSpecialtyLabels = {};
                this.#data.fixedSpecialtyUnlocks = {};
                this.#data.biography.profession = customName || 'Custom Profession';
                return true;
            }
            // Auto-fill biography profession field from profession title
            if (profChanged || !this.#data.biography.profession) {
                this.#data.biography.profession = prof.title;
            }
            // Only reset skills + specialty slots when profession actually changes.
            // Preserves specialty labels and optional picks when re-traversing the same profession.
            if (profChanged) {
                this.#data.skills = {};
                this.#data.requiredChoicePicks = [];
                this.#data.specialtySlots = [];
                this.#data.optSpecialtyLabels = {};
                this.#data.optionalPicks = [];
                this.#data.fixedSpecialtyUnlocks = {};
                let slotId = 0;
                // Required skills: specialty types → specialtySlots; plain skills → skills dict
                for (const s of prof.requiredSkills ?? []) {
                    const sp = parseSpecialtyFromName(s.name);
                    if (sp) {
                        this.#data.specialtySlots.push({
                            id: slotId++, group: sp.group, label: sp.label,
                            proficiency: s.value, required: true, optIndex: null,
                            fixedLabel: sp.label ?? '',
                        });
                    } else {
                        const sk = this.#findSkillKey(s.name);
                        this.#data.skills[sk] = Math.max(SKILL_DEFAULTS[sk] ?? 0, s.value);
                    }
                }
            }
        }

        if (step === 'skills') {
            const prof = PROFESSIONS[this.#data.professionKey];
            this.#data.requiredChoicePicks = [];
            for (const [choiceIndex, choice] of (prof?.requiredSkillChoices ?? []).entries()) {
                const selectedKey = readField(`requiredChoice.${choiceIndex}`, '').toString();
                const selected = choice.options.find(option => this.#findSkillKey(option.name) === selectedKey);
                for (const option of choice.options) delete this.#data.skills[this.#findSkillKey(option.name)];
                if (!selected) {
                    if (validate) return reject(choice.label ?? 'Choose one required professional skill.');
                    continue;
                }
                this.#data.requiredChoicePicks[choiceIndex] = selectedKey;
                this.#data.skills[selectedKey] = Math.max(SKILL_DEFAULTS[selectedKey] ?? 0, selected.value);
            }

            // Read optional picks from checked checkboxes
            const picks = [];
            const checkboxes = this.element?.querySelectorAll('input[name="optPick"]:checked') ?? [];
            for (const cb of checkboxes) {
                const idx = parseInt(cb.value, 10);
                if (!isNaN(idx)) picks.push(idx);
            }
            const optLimit = prof?.optionalSkills?.[0]?.limit ?? 0;
            if (optLimit > 0 && picks.length < optLimit) {
                const remaining = optLimit - picks.length;
                if (validate) return reject(`Choose ${remaining} more optional skill${remaining > 1 ? 's' : ''} before continuing.`);
            }
            this.#data.optionalPicks = picks;
            const chosenRequiredKeys = new Set(this.#data.requiredChoicePicks);
            const duplicateOptional = picks.find(index => {
                const skill = prof.optionalSkills[index];
                return !parseSpecialtyFromName(skill.name) && chosenRequiredKeys.has(this.#findSkillKey(skill.name));
            });
            if (duplicateOptional !== undefined && validate) {
                return reject('Choose optional skills that are not already granted by the required skill choice.');
            }

            // Update required specialty slot labels
            for (const slot of this.#data.specialtySlots.filter(sl => sl.required)) {
                slot.label = readField(`specialty.req.${slot.id}`, slot.label).toString().trim();
                if (!slot.label) {
                    const display = Object.entries(SPECIALTY_PREFIXES).find(([, group]) => group === slot.group)?.[0] ?? slot.group;
                    if (validate) return reject(`Enter a specialty for ${display}.`);
                }
            }

            // Block duplicate required specialties within the same group
            {
                const reqByGroup = {};
                for (const slot of this.#data.specialtySlots.filter(sl => sl.required)) {
                    const val = slot.label.toLowerCase();
                    if (!val) continue;
                    (reqByGroup[slot.group] ??= []).push(val);
                }
                for (const [group, vals] of Object.entries(reqByGroup)) {
                    if (new Set(vals).size < vals.length) {
                        const display = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === group)?.[0] ?? group;
                        if (validate) return reject(`Each ${display} specialty must be unique.`);
                    }
                }
            }

            // Re-derive optional picks: specialty → specialty slots; plain → skills dict
            this.#data.specialtySlots = this.#data.specialtySlots.filter(sl => sl.required);
            this.#data.optSpecialtyLabels = {};
            for (const idx of picks) {
                const s = prof.optionalSkills[idx];
                const sp = parseSpecialtyFromName(s.name);
                if (sp) {
                    const label = readField(`specialty.opt.${idx}`).toString().trim();
                    if (!label) {
                        if (validate) return reject(`Enter a specialty for the selected ${s.name} skill.`);
                    }
                    this.#data.optSpecialtyLabels[idx] = label;
                    this.#data.specialtySlots.push({
                        id: `opt_${idx}`, group: sp.group, label,
                        proficiency: s.value, required: false, optIndex: idx,
                    });
                } else {
                    const sk = this.#findSkillKey(s.name);
                    this.#data.skills[sk] = Math.max(this.#data.skills[sk] ?? 0, s.value);
                }
            }
        }

        if (step === 'bonus_skills') {
            const slots = [];
            if (!this.#data.bonusCustom) this.#data.bonusCustom = ['', '', '', '', '', '', '', ''];
            for (let i = 0; i < 8; i++) {
                const key = readField(`bonusSlot.${i}`).toString();
                const customLabel = readField(`bonusCustom.${i}`).toString().trim();
                if (!key) {
                    if (validate) return reject(`Choose background skill pick ${i + 1}.`);
                }
                if (key.startsWith('_custom_') && !customLabel) {
                    if (validate) return reject(`Enter a specialty name for background skill pick ${i + 1}.`);
                }
                slots.push(key);
                this.#data.bonusCustom[i] = customLabel;
            }

            this.#data.bonusBoosts = slots;
            const boostGroups = new Map();
            for (const allocation of this.#getBonusAllocations()) {
                const key = allocation.key;
                let identity = key;
                let label = BONUS_SKILL_OPTIONS.find(option => option.key === key)?.label ?? key;
                let base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
                if (key.startsWith('_custom_')) {
                    const group = key.slice('_custom_'.length);
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, value]) => value === group)?.[0] ?? group;
                    const specialtyLabel = allocation.customLabel;
                    identity = `${key}__${specialtyLabel.toLowerCase()}`;
                    label = `${groupDisplay} (${specialtyLabel})`;
                    base = 0;
                } else if (key.startsWith('profslot__')) {
                    const [, group, specialtyLabel] = key.split('__');
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, value]) => value === group)?.[0] ?? group;
                    const slot = this.#data.specialtySlots.find(entry => entry.group === group && entry.label === specialtyLabel);
                    label = `${groupDisplay} (${specialtyLabel})`;
                    base = slot?.proficiency ?? 0;
                }
                const existing = boostGroups.get(identity) ?? { points: 0, base, label };
                existing.points += allocation.amount;
                boostGroups.set(identity, existing);
            }
            for (const { points, base, label } of boostGroups.values()) {
                if (base + points > 80 && validate) {
                    return reject(`${label} cannot exceed 80% during character creation.`);
                }
            }
            if (validate && this.#getBonusAllocations().reduce((sum, entry) => sum + entry.amount, 0) !== 160) {
                return reject('Assign all eight +20% improvements, including any excess 10%.');
            }
            return true;
        }

        if (step === 'damaged_veteran') {
            const path = (raw['veteran.path'] ?? 'freshRecruit').toString();
            if (!this.#allowedVeteranPaths().includes(path)) {
                if (validate) return reject('That Damaged Veteran background is disabled by the Handler.');
                this.#data.veteran = { path: 'freshRecruit', hardSkills: ['', '', '', ''], disorder: '' };
                return true;
            }
            this.#data.veteran.path = path;
            this.#data.veteran.disorder = (raw['veteran.disorder'] ?? '').toString().trim();
            this.#data.veteran.hardSkills = Array.from({ length: 4 }, (_, index) =>
                (raw[`veteran.hardSkill.${index}`] ?? '').toString()
            );
            if (path === 'hardExperience') {
                const chosen = this.#data.veteran.hardSkills.filter(Boolean);
                if (chosen.length !== 4) {
                    if (validate) return reject('Hard Experience requires four skill selections.');
                }
                if (new Set(chosen).size !== chosen.length) {
                    if (validate) return reject('Hard Experience requires four different skills.');
                }
            }
            if (path === 'thingsMan' && !this.#data.veteran.disorder) {
                if (validate) return reject('Choose a starting disorder.');
            }
        }

        if (step === 'bonds') {
            this.#data.bondDataset = readField('bondDataset', getSetting('defaultBondDataset', 'FRIENDS_FAMILY')).toString().trim();
            this.#data.bonds = this.#data.bonds.map((bond, i) => ({
                name: readField(`bonds.${i}.name`, bond.name).toString().trim(),
                score: this.#data.stats.cha,
                relationship: readField(`bonds.${i}.relationship`, bond.relationship ?? '').toString().trim(),
                description: readField(`bonds.${i}.description`, bond.description ?? '').toString().trim(),
            }));
            const startedBonds = this.#data.bonds.filter(bond => bond.name || bond.relationship);
            const requiredBonds = this.#getRequiredBondCount(PROFESSIONS[this.#data.professionKey]);
            if (startedBonds.length < requiredBonds) {
                if (validate) return reject(`Enter at least ${requiredBonds} completed Bond${requiredBonds === 1 ? '' : 's'} before continuing.`);
            }
            for (let index = 0; index < startedBonds.length; index += 1) {
                const bond = startedBonds[index];
                if (!bond?.name || !bond?.relationship) {
                    if (validate) return reject('Every started Bond requires both a name and relationship.');
                }
                if (bond.score !== this.#data.stats.cha) {
                    if (validate) return reject(`Bond "${bond.name}" must begin at CHA (${this.#data.stats.cha}).`);
                }
            }
        }

        if (step === 'biography') {
            for (const k of Object.keys(this.#data.biography)) {
                this.#data.biography[k] = readField(`biography.${k}`).toString().trim();
            }
            if (!this.#data.biography.name && validate) {
                return reject('Enter an Agent name before continuing.');
            }
            for (const k of Object.keys(this.#data.physical)) {
                this.#data.physical[k] = readField(`physical.${k}`).toString().trim();
            }
            for (let i = 0; i < 5; i++) {
                this.#data.motivations[i] = readField(`motivation.${i}`).toString().trim();
                if (i < this.#getRequiredMotivationCount() && !this.#data.motivations[i]) {
                    if (validate) return reject(`Enter Motivation ${i + 1}.`);
                }
            }
        }

        if (step === 'equipment') {
            // Equipment is managed via DOM actions — nothing to collect from form
            return true;
        }

        return true;
    }

    // -----------------------------------------------------------------------
    // Write all collected data to the Foundry Actor document
    // -----------------------------------------------------------------------
    async #applyToActor() {
        const updates = {};

        // Statistics + stat descriptors (distinguishing_feature)
        for (const [k, v] of Object.entries(this.#data.stats)) {
            updates[`system.statistics.${k}.value`] = v;
            updates[`system.statistics.${k}.distinguishing_feature`] = getStatDescriptor(k, v);
        }

        // HP = (CON + STR) / 2, rounded up; WP = POW
        const hp = Math.ceil((this.#data.stats.con + this.#data.stats.str) / 2);
        updates['system.health.max'] = hp;
        updates['system.health.value'] = hp;
        updates['system.wp.max'] = this.#data.stats.pow;
        updates['system.wp.value'] = this.#data.stats.pow;

        // Sanity = POW × 5
        updates['system.sanity.value'] = this.#data.stats.pow * 5;
        updates['system.sanity.currentBreakingPoint'] = this.#data.stats.pow * 5 - this.#data.stats.pow;

        // Reset every standard skill before writing the replacement Agent. This
        // prevents values from a previous character leaking into the new one.
        for (const [key, value] of Object.entries(SKILL_DEFAULTS)) {
            updates[`system.skills.${key}.proficiency`] = value;
        }

        // Skills — base profession values (plain skills only; specialty handled via specialtySlots)
        for (const [key, value] of Object.entries(this.#data.skills)) {
            if (key in SKILL_DEFAULTS) {
                updates[`system.skills.${key}.proficiency`] = value;
            }
        }

        // Bonus skill boosts — separate standard keys from custom specialty picks
        const boostCounts = {};
        const customBoostMap = {};  // '{group}__{label}' → {group, label, proficiency}
        for (const allocation of this.#getBonusAllocations()) {
            const key = allocation.key;
            if (!key) continue;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                const label = allocation.customLabel.trim();
                if (!label) continue;
                const mapKey = `${group}__${label}`;
                if (!customBoostMap[mapKey]) customBoostMap[mapKey] = { group, label, proficiency: 0 };
                customBoostMap[mapKey].proficiency = Math.min(80, customBoostMap[mapKey].proficiency + allocation.amount);
            } else {
                boostCounts[key] = (boostCounts[key] ?? 0) + allocation.amount;
            }
        }
        // Separate standard bonus boosts into plain skills and typed specialty skills
        const bonusTypedMap = {};  // tsKey → {group, label, proficiency}
        for (const [key, boostPoints] of Object.entries(boostCounts)) {
            if (boostPoints <= 0) continue;
            if (key.startsWith('profslot__')) {
                // Profession-typed specialty (e.g. Foreign Language (Swahili) from skills step)
                const parts = key.split('__');
                const group = parts[1];
                const label = parts[2];
                const tsKey = ('tskill_wiz_' + group + '_' + label)
                    .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
                if (!bonusTypedMap[tsKey]) bonusTypedMap[tsKey] = { group, label, proficiency: 0 };
                bonusTypedMap[tsKey].proficiency = Math.min(80, bonusTypedMap[tsKey].proficiency + boostPoints);
            } else if (key in SKILL_DEFAULTS) {
                const base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
                updates[`system.skills.${key}.proficiency`] = Math.min(80, base + boostPoints);
            } else {
                const sp = parseSpecialtyFromKey(key);
                if (sp) {
                    const tsKey = `tskill_wiz_${key}`;
                    bonusTypedMap[tsKey] = { group: sp.group, label: sp.label, proficiency: Math.min(80, boostPoints) };
                }
            }
        }

        // Creator application replaces typed skills along with standard skills.
        const typedSkillsToWrite = Object.fromEntries(
            Object.keys(this.#actor.system.typedSkills ?? {}).map(key => [`-=${key}`, null])
        );

        // Specialty slots from the profession (required) and optional picks
        for (const slot of this.#data.specialtySlots) {
            const label = slot.label.trim();
            if (!label) continue;  // skip slots where the user left the subspecialty blank
            const tsKey = ('tskill_wiz_' + slot.group + '_' + label)
                .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
            const boost = bonusTypedMap[tsKey];
            typedSkillsToWrite[tsKey] = {
                label: slot.label,
                group: slot.group,
                proficiency: boost ? Math.min(80, slot.proficiency + boost.proficiency) : slot.proficiency,
                failure: false,
            };
            if (boost) delete bonusTypedMap[tsKey];
        }

        // Remaining standard bonus typed skills (bonus-only picks not matching a specialty slot)
        for (const [tsKey, tsData] of Object.entries(bonusTypedMap)) {
            typedSkillsToWrite[tsKey] = { label: tsData.label, group: tsData.group, proficiency: tsData.proficiency, failure: false };
        }

        // Custom specialty picks from bonus slots
        for (const [, { group, label, proficiency }] of Object.entries(customBoostMap)) {
            const tsKey = ('tskill_wiz_c_' + group + '_' + label)
                .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
            typedSkillsToWrite[tsKey] = { label, group, proficiency, failure: false };
        }

        updates['system.typedSkills'] = typedSkillsToWrite;

        const pendingSkill = key => Number(updates[`system.skills.${key}.proficiency`] ?? SKILL_DEFAULTS[key] ?? 0);
        const setPendingSkill = (key, value, cap = 99) => {
            updates[`system.skills.${key}.proficiency`] = Math.min(cap, Math.max(0, value));
        };
        const veteranPath = this.#data.veteran?.path ?? 'freshRecruit';
        let bondPenalty = 0;
        let veteranMotivation = null;

        // Veteran status is creator managed. Clear both adaptation tracks first
        // so replacing an Agent with Fresh Recruit, or the opposite adaptation,
        // cannot leave checkboxes from the previously applied background.
        for (const adaptation of ['violence', 'helplessness']) {
            for (const incident of ['incident1', 'incident2', 'incident3']) {
                updates[`system.sanity.adaptations.${adaptation}.${incident}`] = false;
            }
        }

        if (veteranPath === 'extremeViolence') {
            setPendingSkill('occult', pendingSkill('occult') + 10);
            const finalSanity = Math.max(0, this.#data.stats.pow * 5 - 5);
            updates['system.sanity.value'] = finalSanity;
            updates['system.statistics.cha.value'] = Math.max(3, this.#data.stats.cha - 3);
            updates['system.sanity.adaptations.violence.incident1'] = true;
            updates['system.sanity.adaptations.violence.incident2'] = true;
            updates['system.sanity.adaptations.violence.incident3'] = true;
            bondPenalty = 3;
        } else if (veteranPath === 'captivity') {
            setPendingSkill('occult', pendingSkill('occult') + 10);
            const finalPow = Math.max(3, this.#data.stats.pow - 3);
            updates['system.statistics.pow.value'] = finalPow;
            updates['system.wp.max'] = finalPow;
            updates['system.wp.value'] = finalPow;
            updates['system.sanity.value'] = Math.max(0, this.#data.stats.pow * 5 - 5);
            updates['system.sanity.adaptations.helplessness.incident1'] = true;
            updates['system.sanity.adaptations.helplessness.incident2'] = true;
            updates['system.sanity.adaptations.helplessness.incident3'] = true;
        } else if (veteranPath === 'hardExperience') {
            setPendingSkill('occult', pendingSkill('occult') + 10);
            const finalSanity = Math.max(0, this.#data.stats.pow * 5 - 5);
            updates['system.sanity.value'] = finalSanity;
            for (const key of this.#data.veteran.hardSkills.filter(Boolean)) {
                setPendingSkill(key, pendingSkill(key) + 10, 90);
            }
        } else if (veteranPath === 'thingsMan') {
            setPendingSkill('unnatural', pendingSkill('unnatural') + 10);
            setPendingSkill('occult', pendingSkill('occult') + 20);
            const finalSanity = Math.max(0, this.#data.stats.pow * 4);
            updates['system.sanity.value'] = finalSanity;
            updates['system.sanity.currentBreakingPoint'] = Math.max(0, finalSanity - this.#data.stats.pow);
            veteranMotivation = {
                name: 'Describe Motivation',
                type: 'motivation',
                system: { crossedOut: true, disorder: this.#data.veteran.disorder, disorderCured: false, acuteEpisode: false }
            };
        }

        // Biography — actor name is top-level; standard fields → system.biography.*
        const bioName = this.#data.biography.name;
        if (bioName) updates['name'] = bioName;
        const dgBioFields = ['profession', 'employer', 'nationality', 'sex', 'age', 'education'];
        for (const k of dgBioFields) {
            if (this.#data.biography[k] !== undefined) updates[`system.biography.${k}`] = this.#data.biography[k];
        }
        updates['system.physical.description'] = this.#buildPhysicalDescriptionHtml();
        await this.#actor.update(updates);

        // Bonds — always remove existing Bonds, including when the new Agent has zero.
        const existingBonds = this.#actor.items.filter(i => i.type === 'bond');
        if (existingBonds.length > 0) {
            await this.#actor.deleteEmbeddedDocuments('Item', existingBonds.map(i => i.id));
        }
        if (this.#data.bonds.length > 0) {
            let bondsToCreate = this.#data.bonds.filter(b => b.name);
            const bondItems = bondsToCreate
                .map(b => ({
                    name: b.name,
                    type: 'bond',
                    system: {
                        score: Math.max(0, b.score - bondPenalty),
                        relationship: b.relationship ?? '',
                        description: b.description ?? '',
                    },
                }));
            if (bondItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', bondItems);
            }
        }

        // Motivations — delete existing first to avoid duplicates, then create fresh
        const existingMotivations = this.#actor.items.filter(i => i.type === 'motivation');
        if (existingMotivations.length > 0) {
            await this.#actor.deleteEmbeddedDocuments('Item', existingMotivations.map(i => i.id));
        }
        const motivationStrings = this.#data.motivations.filter(m => m.trim());
        if (motivationStrings.length > 0) {
            const motivationItems = motivationStrings.map(m => ({
                name: m,
                type: 'motivation',
                system: { disorder: '', crossedOut: false, disorderCured: false },
            }));
            await this.#actor.createEmbeddedDocuments('Item', motivationItems);
        }
        if (veteranMotivation) {
            await this.#actor.createEmbeddedDocuments('Item', [veteranMotivation]);
        }

        // Equipment — delete any items previously created by the wizard (flagged), then recreate
        const existingWizardItems = this.#actor.items.filter(i =>
            i.flags?.['delta-green-agent-creator']?.fromWizard === true
            || i.flags?.['delta-green-agent-wizard']?.fromWizard === true
        );
        if (existingWizardItems.length > 0) {
            await this.#actor.deleteEmbeddedDocuments('Item', existingWizardItems.map(i => i.id));
        }
        if (this.#data.equipment.length > 0) {
            const wizardFlag = { 'delta-green-agent-creator': { fromWizard: true } };
            const eqItems = this.#data.equipment
                .filter(name => name && name.trim())
                .map(name => {
                    const catalogItem = EQUIPMENT_CATALOG.find(i => i.name === name);
                    if (catalogItem) return { ...catalogItem, flags: { ...(catalogItem.flags ?? {}), ...wizardFlag } };
                    return {
                        name, type: 'gear', img: 'icons/svg/item-bag.svg',
                        flags: wizardFlag, effects: [],
                        system: { name: '', description: '', equipped: true, expense: '' }
                    };
                });
            if (eqItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', eqItems);
            }
        }
    }
}
