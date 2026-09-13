// @ts-nocheck

import { AgentCreatorSetupWizard, HandlerRulesMenu, PlayerPreferencesMenu, PlayerSetupWizard, SectionRandomizersMenu } from './settings-menu.js';

export const MODULE_ID = 'delta-green-agent-creator';

export const STAT_METHOD_SETTING_KEYS = {
    generalist: 'allowStatGeneralist',
    focused: 'allowStatFocused',
    highlyFocused: 'allowStatHighlyFocused',
    rolled: 'allowStatRolled',
    pointBuy: 'allowStatPointBuy',
    randomized: 'allowStatRandomizer',
};

export function getSetting(key, fallback = null) {
    try {
        return game.settings.get(MODULE_ID, key);
    } catch (error) {
        return fallback;
    }
}

export function getAllowedStatMethods() {
    const allowed = Object.entries(STAT_METHOD_SETTING_KEYS)
        .filter(([, settingKey]) => getSetting(settingKey, true))
        .map(([method]) => method);
    return allowed.length > 0 ? allowed : ['generalist'];
}

export function registerSettings(onSheetThemeChange) {
    const register = (key, data) => game.settings.register(MODULE_ID, key, data);

    game.settings.registerMenu(MODULE_ID, 'playerPreferences', {
        name: 'Player Preferences',
        label: 'Open Player Preferences',
        hint: 'Theme, creator access, confirmations, tips, and layout for this user.',
        icon: 'fa-solid fa-user-gear',
        type: PlayerPreferencesMenu,
        restricted: false,
    });

    game.settings.registerMenu(MODULE_ID, 'playerSetupWizard', {
        name: 'Player Setup Wizard',
        label: 'Run Player Setup Wizard',
        hint: 'Choose this user\'s interface theme and Agent Creator preferences in a guided setup flow.',
        icon: 'fa-solid fa-wand-magic-sparkles',
        type: PlayerSetupWizard,
        restricted: false,
    });

    game.settings.registerMenu(MODULE_ID, 'handlerRules', {
        name: 'Handler Rules',
        label: 'Open Handler Rules',
        hint: 'Statistic methods, creation rules, content sources, and randomization for this world.',
        icon: 'fa-solid fa-user-shield',
        type: HandlerRulesMenu,
        restricted: true,
    });

    game.settings.registerMenu(MODULE_ID, 'handlerSetupWizard', {
        name: 'Handler Setup Wizard',
        label: 'Run Handler Setup Wizard',
        hint: 'Review the world rules used by Agent creation in a guided setup flow.',
        icon: 'fa-solid fa-list-check',
        type: AgentCreatorSetupWizard,
        restricted: true,
    });

    game.settings.registerMenu(MODULE_ID, 'sectionRandomizers', {
        name: 'Guided Creation Randomizers',
        label: 'Configure Section Randomizers',
        hint: 'Choose which individual randomizer controls players can use during guided creation.',
        icon: 'fa-solid fa-dice',
        type: SectionRandomizersMenu,
        restricted: true,
    });

    register('handlerSetupComplete', {
        name: 'Handler setup completed', scope: 'world', restricted: true,
        config: false, type: Boolean, default: false,
    });

    register('playerSetupComplete', {
        name: 'Legacy player setup completed', scope: 'client', restricted: false,
        config: false, type: Boolean, default: false,
    });

    register('agentSheetStyle', {
        name: 'Agent Interface Theme',
        hint: 'Choose the appearance of Agent sheets, the Agent Creator, and its settings windows for this user.',
        scope: 'client',
        config: false,
        type: String,
        choices: {
            system: 'System Default',
            midnight: 'Midnight Casework',
            hacker: 'Hacker Terminal',
            oldTimer: 'Old Timer',
            impossibleLandscapes: 'Impossible Landscapes',
            occultCrimson: 'Occult Crimson',
        },
        default: 'midnight',
        onChange: onSheetThemeChange,
    });

    register('agentSheetTheme', {
        name: 'Legacy redesigned sheet toggle', scope: 'client', config: false,
        type: Boolean, default: true,
    });

    register('defaultCreationRoute', {
        name: 'Agent Creator Opening Screen',
        hint: 'Stored separately for each user. Choose whether this account sees the opening choice, begins guided creation, or immediately generates a random Agent.',
        scope: 'client',
        config: false,
        type: String,
        choices: {
            ask: 'Ask Every Time',
            guided: 'Guided Creation',
            random: 'Random Agent',
        },
        default: 'ask',
    });

    register('confirmBeforeApply', {
        name: 'Player | Confirm before applying',
        hint: 'Ask for confirmation before the creator writes the finished Agent to the Actor.',
        scope: 'client',
        config: false,
        type: Boolean,
        default: true,
    });

    register('showCreatorButton', {
        name: 'Player | Show Agent Creator button',
        hint: 'Show the Agent Creator control in Agent sheet title bars for this user.',
        scope: 'client',
        config: false,
        type: Boolean,
        default: true,
    });

    register('showCreatorTips', {
        name: 'Player | Show creator tips',
        hint: 'Show expandable rules and guidance panels throughout the creator.',
        scope: 'client',
        config: false,
        type: Boolean,
        default: true,
    });

    register('compactCreatorLayout', {
        name: 'Player | Compact creator layout',
        hint: 'Reduce spacing and control heights to fit more information in the creator window.',
        scope: 'client',
        config: false,
        type: Boolean,
        default: false,
    });

    register('defaultStatMethod', {
        name: 'GM Rules | Default statistic method',
        hint: 'The statistic method initially selected for new guided Agents. Players may choose another method that the GM permits.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            generalist: 'Generalist',
            focused: 'Focused',
            highlyFocused: 'Highly Focused',
            rolled: 'Roll Statistics',
            pointBuy: 'Allocate 72 Points',
            randomized: 'Randomized Statistics',
        },
        default: 'generalist',
    });

    const methodSettings = [
        ['allowStatGeneralist', 'Generalist'],
        ['allowStatFocused', 'Focused'],
        ['allowStatHighlyFocused', 'Highly Focused'],
        ['allowStatRolled', 'Roll Statistics'],
        ['allowStatPointBuy', 'Allocate 72 Points'],
        ['allowStatRandomizer', 'Randomized Statistics'],
    ];
    for (const [key, label] of methodSettings) {
        register(key, {
            name: `GM Rules | Allow ${label}`,
            hint: `Allow players and the complete Agent generator to use ${label}.`,
            scope: 'world',
            restricted: true,
            config: false,
            type: Boolean,
            default: true,
        });
    }

    register('statRollMode', {
        name: 'GM Rules | Statistic roll visibility',
        hint: 'Controls who can see dice rolls made by Roll Statistics or complete Random Agent generation.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            publicroll: 'Public Roll',
            gmroll: 'GM Roll',
            blindroll: 'Blind GM Roll',
            selfroll: 'Private Roll',
        },
        default: 'publicroll',
    });

    register('professionSources', {
        name: 'GM Rules | Available professions',
        hint: 'Controls which profession books appear in guided creation and complete Random Agent generation.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            quickstart: 'Need to Know Free Quickstart',
            handbook: "Agent's Handbook Only",
            all: "Agent's Handbook and The Complex",
            complex: 'The Complex Only',
        },
        default: 'all',
    });

    register('fixedSpecialtyPolicy', {
        name: 'GM Rules | Fixed profession specialties',
        hint: 'Controls whether named profession specialties remain locked, may be unlocked individually, or begin editable.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            strict: 'Strict',
            allowUnlock: 'Allow Unlock',
            editable: 'Editable',
        },
        default: 'allowUnlock',
    });

    register('allowCustomProfessions', {
        name: 'GM Rules | Allow custom professions',
        hint: 'Allow players to build a profession instead of selecting a published profession.',
        scope: 'world', restricted: true, config: false, type: Boolean, default: false,
    });

    register('requiredMotivations', {
        name: 'GM Rules | Required Motivations',
        hint: 'Minimum Motivations required to finish Agent creation.',
        scope: 'world',
        restricted: true,
        config: false,
        type: Number,
        range: { min: 0, max: 5, step: 1 },
        default: 0,
    });

    register('allowDamagedVeteran', {
        name: 'GM Rules | Allow Damaged Veteran',
        hint: 'Include the optional Damaged Veteran section in Agent creation.',
        scope: 'world', restricted: true, config: false, type: Boolean, default: true,
    });

    const veteranBackgrounds = [
        ['allowVeteranExtremeViolence', 'Extreme Violence'],
        ['allowVeteranCaptivity', 'Captivity or Imprisonment'],
        ['allowVeteranHardExperience', 'Hard Experience'],
        ['allowVeteranThingsMan', 'Things Man Was Not Meant to Know'],
    ];
    for (const [key, label] of veteranBackgrounds) register(key, {
        name: `GM Rules | Allow ${label}`,
        hint: `Make ${label} available in the Damaged Veteran section.`,
        scope: 'world', restricted: true, config: false, type: Boolean, default: true,
    });

    register('defaultBondDataset', {
        name: 'GM Rules | Default Bond suggestion pool',
        hint: 'Choose the suggestion pool initially selected for new Agents. Players may select another pool.',
        scope: 'world', restricted: true, config: false, type: String,
        choices: {
            FRIENDS_FAMILY: 'Friends and Family',
            DELTA_GREEN: 'Delta Green',
            UNDERWORLD: 'Underworld or Criminal',
            LGBTQ: 'LGBTQ+',
            PISCES_UK: 'PISCES UK',
        },
        default: 'FRIENDS_FAMILY',
    });

    register('randomizationAccess', {
        name: 'GM Rules | Creation mode',
        hint: 'Choose whether players use guided creation, complete Random Agent generation, or both.',
        scope: 'world', restricted: true, config: false, type: String,
        choices: { guided: 'Guided Creation Only', both: 'Guided and Complete Random Agent', randomOnly: 'Complete Random Agent Only' },
        default: 'both',
    });

    register('playerImportPolicy', {
        name: 'GM Rules | Player Agent imports',
        hint: 'Choose whether players may import portable Agents that satisfy this world\'s creation rules.',
        scope: 'world', restricted: true, config: false, type: String,
        choices: {
            disabled: 'Disabled',
            compatible: 'Compatible Agents Only',
        },
        default: 'compatible',
    });

    const sectionRandomizers = [
        ['randomizeProfession', 'Random Profession'],
        ['randomizeProfessionSkills', 'Random Professional Skills and Specialties'],
        ['randomizeBackgroundSkills', 'Random Background Skills'],
        ['randomizeVeteran', 'Random Damaged Veteran Status'],
        ['randomizeBonds', 'Random Bonds'],
        ['randomizeBiography', 'Random Biography'],
        ['randomizeMotivations', 'Random Motivations'],
    ];
    for (const [key, label] of sectionRandomizers) register(key, {
        name: `GM Randomizer | ${label}`,
        hint: `Show the ${label} control during guided creation.`,
        scope: 'world', restricted: true, config: false, type: Boolean, default: true,
    });

    register('allowRandomAgent', {
        name: 'GM Randomizer | Allow complete Random Agent',
        hint: 'Allow players to generate an entire Agent from the opening screen.',
        scope: 'world',
        restricted: true,
        config: false,
        type: Boolean,
        default: true,
    });

    register('allowMechanicalRandomization', {
        name: 'GM Randomizer | Allow section randomizers',
        hint: 'Allow random profession, skill, background, veteran, Bond, and Motivation controls.',
        scope: 'world',
        restricted: true,
        config: false,
        type: Boolean,
        default: true,
    });

    register('allowBioRandomization', {
        name: 'GM Randomizer | Allow biography randomization',
        hint: 'Allow players to generate random identity and biographical details.',
        scope: 'world',
        restricted: true,
        config: false,
        type: Boolean,
        default: true,
    });

    register('randomVeteranFrequency', {
        name: 'GM Randomizer | Damaged Veteran frequency',
        hint: 'Controls how often complete random Agents receive a Damaged Veteran background.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            fresh: 'Always Fresh Recruit',
            mostlyFresh: 'Mostly Fresh Recruits',
            equal: 'Equal Chance',
            veteran: 'Always Damaged Veteran',
        },
        default: 'mostlyFresh',
    });

    register('existingActorProtection', {
        name: 'GM Rules | Existing Actor protection',
        hint: 'Warn before replacing Bonds, Motivations, statistics, or other creator managed data on an established Actor.',
        scope: 'world',
        restricted: true,
        config: false,
        type: String,
        choices: {
            warn: 'Warn Before Replacing',
            allow: 'Allow Replacement',
        },
        default: 'warn',
    });
}
