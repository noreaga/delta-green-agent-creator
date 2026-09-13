// @ts-nocheck

const MODULE_ID = 'delta-green-agent-creator';
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

async function openProfessionCatalogHelp() {
    const content = `
        <div class="dgac-profession-help">
            <p>This setting controls which published professions players can select. It does not replace the module's current statistics, skills, or creation rules.</p>
            <section><strong>Need to Know Free Quickstart</strong><span>The six professions presented in the free starter rulebook.</span></section>
            <section><strong>Agent's Handbook Only</strong><span>The complete core profession catalog.</span></section>
            <section><strong>Agent's Handbook and The Complex</strong><span>Both complete catalogs. Recommended for most campaigns.</span></section>
            <section><strong>The Complex Only</strong><span>Only the specialized agency and organization professions from The Complex.</span></section>
        </div>`;
    const DialogV2 = foundry.applications.api.DialogV2;
    if (DialogV2?.wait) {
        await DialogV2.wait({
            window: { title: 'Available Professions' },
            content,
            buttons: [{ action: 'close', label: 'Close', icon: 'fa-solid fa-check', default: true }],
        });
    }
}

class BaseCreatorSettingsMenu extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        classes: ['dgac-settings-menu'],
        window: { resizable: true },
        position: { width: 620, height: 600 },
        actions: {
            saveSettings: BaseCreatorSettingsMenu.#onSaveSettings,
            openVeteranBackgrounds: BaseCreatorSettingsMenu.#onOpenVeteranBackgrounds,
            professionCatalogHelp: openProfessionCatalogHelp,
        },
    };

    static PARTS = {
        main: { template: 'modules/delta-green-agent-creator/templates/settings-menu.hbs' },
    };

    static SETTINGS = [];

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return {
            ...context,
            menuType: this.constructor.MENU_TYPE,
            groups: resolveSettingsMenuContext(this.constructor.GROUPS),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const form = this.element?.querySelector('form.dgac-settings-form');
        if (!form) return;

        if (this.constructor.MENU_TYPE === 'player') {
            const route = form.elements.defaultCreationRoute;
            if (!route) return;
            const access = game.settings.get(MODULE_ID, 'randomizationAccess');
            const randomOption = route.querySelector('option[value="random"]');
            if (randomOption) {
                randomOption.hidden = !['both', 'randomOnly'].includes(access);
                randomOption.disabled = !['both', 'randomOnly'].includes(access);
            }
            if (access === 'randomOnly') {
                route.value = 'random';
                route.disabled = true;
            } else if (route.value === 'random' && randomOption?.disabled) {
                route.value = 'guided';
            }
            return;
        }

        if (this.constructor.MENU_TYPE !== 'handler') return;

        const updateDependencies = () => {
            const access = form.elements.randomizationAccess?.value ?? 'both';
            const veteranEnabled = Boolean(form.elements.allowDamagedVeteran?.checked);
            const rolledEnabled = Boolean(form.elements.allowStatRolled?.checked);
            const randomizedEnabled = Boolean(form.elements.allowStatRandomizer?.checked);

            const veteranBackgroundButton = form.querySelector('[data-action="openVeteranBackgrounds"]');
            if (veteranBackgroundButton) veteranBackgroundButton.disabled = !veteranEnabled;

            const importPolicy = form.elements.playerImportPolicy;
            if (importPolicy) {
                importPolicy.disabled = access === 'randomOnly';
                importPolicy.title = access === 'randomOnly' ? 'Player imports are unavailable in Complete Random Agent Only mode.' : '';
            }

            const veteranFrequencyRow = form.querySelector('#dgac-setting-randomVeteranFrequency')?.closest('.dgac-setting-row');
            if (veteranFrequencyRow) veteranFrequencyRow.hidden = !(veteranEnabled && ['both', 'randomOnly'].includes(access));

            const rollModeRow = form.querySelector('#dgac-setting-statRollMode')?.closest('.dgac-setting-row');
            if (rollModeRow) rollModeRow.hidden = !(rolledEnabled || randomizedEnabled);

            const defaultSelect = form.elements.defaultStatMethod;
            if (defaultSelect) {
                const methodControls = {
                    generalist: 'allowStatGeneralist', focused: 'allowStatFocused', highlyFocused: 'allowStatHighlyFocused',
                    rolled: 'allowStatRolled', pointBuy: 'allowStatPointBuy', randomized: 'allowStatRandomizer',
                };
                for (const option of defaultSelect.options) {
                    const control = form.elements[methodControls[option.value]];
                    option.disabled = !control?.checked;
                }
                if (defaultSelect.selectedOptions[0]?.disabled) {
                    const firstAllowed = [...defaultSelect.options].find(option => !option.disabled);
                    if (firstAllowed) defaultSelect.value = firstAllowed.value;
                }
            }
        };

        form.addEventListener('change', updateDependencies);
        updateDependencies();
    }

    static async #onSaveSettings(event, target) {
        const form = this.element?.querySelector('form.dgac-settings-form');
        if (!form) return;
        const data = new foundry.applications.ux.FormDataExtended(form).object;
        if (this.constructor.MENU_TYPE === 'veteranBackgrounds') {
            const enabled = this.constructor.SETTINGS.some(setting => Boolean(data[setting.key]));
            if (!enabled) {
                ui.notifications.warn('Enable at least one Damaged Veteran background, or disable Damaged Veteran entirely in Handler Rules.');
                return;
            }
        }
        if (this.constructor.MENU_TYPE === 'handler') {
            const methodKeys = {
                generalist: 'allowStatGeneralist', focused: 'allowStatFocused', highlyFocused: 'allowStatHighlyFocused',
                rolled: 'allowStatRolled', pointBuy: 'allowStatPointBuy', randomized: 'allowStatRandomizer',
            };
            const allowed = Object.entries(methodKeys)
                .filter(([, key]) => Boolean(data[key]))
                .map(([method]) => method);
            if (allowed.length === 0) {
                ui.notifications.warn('Allow at least one statistic method.');
                return;
            }
            if (Boolean(data.allowStatRandomizer) && allowed.every(method => method === 'randomized')) {
                ui.notifications.warn('Randomized Statistics requires at least one other permitted statistic method.');
                return;
            }
            if (!allowed.includes(data.defaultStatMethod)) data.defaultStatMethod = allowed[0];
        }
        for (const setting of this.constructor.SETTINGS) {
            if (form.elements[setting.key]?.disabled) continue;
            let value = data[setting.key];
            if (setting.type === Boolean) value = Boolean(value);
            if (setting.type === Number) value = Number(value);
            await game.settings.set(MODULE_ID, setting.key, value);
        }
        ui.notifications.info('Delta Green Agent Creator settings saved.');
        this.close();
    }

    static #onOpenVeteranBackgrounds() {
        new VeteranBackgroundsMenu().render({ force: true });
    }
}

export class PlayerPreferencesMenu extends BaseCreatorSettingsMenu {
    static MENU_TYPE = 'player';

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: 'dgac-player-preferences',
        window: { title: 'Agent Creator Player Preferences' },
        position: { width: 620, height: 560 },
    }, { inplace: false });

    static SETTINGS = [
        { key: 'agentSheetStyle', type: String },
        { key: 'defaultCreationRoute', type: String },
        { key: 'confirmBeforeApply', type: Boolean },
        { key: 'showCreatorButton', type: Boolean },
        { key: 'showCreatorTips', type: Boolean },
        { key: 'compactCreatorLayout', type: Boolean },
    ];

    static GROUPS = [
        {
            title: 'Appearance',
            fields: [
                {
                    key: 'agentSheetStyle', label: 'Agent interface theme', hint: 'Applies to Agent sheets, the Agent Creator, and all Agent Creator settings windows for this account.', input: 'select',
                    options: [
                        { value: 'system', label: 'System Default' },
                        { value: 'midnight', label: 'Midnight Casework' },
                        { value: 'hacker', label: 'Hacker Terminal' },
                        { value: 'oldTimer', label: 'Old Timer' },
                        { value: 'impossibleLandscapes', label: 'Impossible Landscapes' },
                        { value: 'occultCrimson', label: 'Occult Crimson' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'agentSheetStyle'),
                },
            ],
        },
        {
            title: 'Access',
            fields: [
                { key: 'showCreatorButton', label: 'Show Agent Creator button', hint: 'Show the Agent Creator control in Agent sheet title bars for this user.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'showCreatorButton') },
            ],
        },
        {
            title: 'Creator Behavior',
            fields: [
                {
                    key: 'defaultCreationRoute', label: 'Agent Creator opening', hint: 'Choose whether the Creator asks what to do, begins guided creation, or starts a Random Agent.', input: 'select',
                    options: [
                        { value: 'ask', label: 'Ask Every Time' },
                        { value: 'guided', label: 'Guided Creation' },
                        { value: 'random', label: 'Random Agent' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'defaultCreationRoute'),
                },
                { key: 'confirmBeforeApply', label: 'Confirm before applying', hint: 'Ask before the creator writes the finished Agent to the Actor.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'confirmBeforeApply') },
                { key: 'showCreatorTips', label: 'Show creator tips', hint: 'Show expandable rules and guidance panels throughout the creator.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'showCreatorTips') },
                { key: 'compactCreatorLayout', label: 'Compact creator layout', hint: 'Reduce spacing and control heights to fit more information in the creator window.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'compactCreatorLayout') },
            ],
        },
    ];

    _onRender(context, options) {
        super._onRender(context, options);
        const form = this.element?.querySelector('form.dgac-settings-form');
        if (!form) return;
        const themeSelect = form.elements.agentSheetStyle;
        if (!themeSelect) return;
        const applyPreview = () => this.#applyThemePreview(themeSelect.value);
        themeSelect.addEventListener('change', applyPreview);
        applyPreview();
    }

    #applyThemePreview(style) {
        const root = this.element;
        if (!root) return;
        root.classList.remove(
            'dgac-player-live-preview',
            'dgac-preview-system',
            'dgac-preview-midnight',
            'dgac-preview-hacker',
            'dgac-preview-old-timer',
            'dgac-preview-impossible-landscapes',
            'dgac-preview-occult-crimson'
        );
        const themeClasses = {
            system: 'dgac-preview-system',
            midnight: 'dgac-preview-midnight',
            hacker: 'dgac-preview-hacker',
            oldTimer: 'dgac-preview-old-timer',
            impossibleLandscapes: 'dgac-preview-impossible-landscapes',
            occultCrimson: 'dgac-preview-occult-crimson',
        };
        root.classList.add('dgac-player-live-preview', themeClasses[style] ?? themeClasses.midnight);
    }
}

export class PlayerSetupWizard extends HandlebarsApplicationMixin(ApplicationV2) {
    #page = -1;
    #draft;

    constructor(options = {}) {
        super(options);
        this.#draft = {
            agentSheetStyle: game.settings.get(MODULE_ID, 'agentSheetStyle'),
            defaultCreationRoute: game.settings.get(MODULE_ID, 'defaultCreationRoute'),
            showCreatorButton: game.settings.get(MODULE_ID, 'showCreatorButton'),
            confirmBeforeApply: game.settings.get(MODULE_ID, 'confirmBeforeApply'),
            showCreatorTips: game.settings.get(MODULE_ID, 'showCreatorTips'),
            compactCreatorLayout: game.settings.get(MODULE_ID, 'compactCreatorLayout'),
        };
        this.#normalizeRoute();
    }

    #applyThemePreview(style) {
        const root = this.element;
        if (!root) return;
        root.classList.remove(
            'dgac-player-live-preview',
            'dgac-preview-system',
            'dgac-preview-midnight',
            'dgac-preview-hacker',
            'dgac-preview-old-timer',
            'dgac-preview-impossible-landscapes',
            'dgac-preview-occult-crimson'
        );
        const themeClasses = {
            system: 'dgac-preview-system',
            midnight: 'dgac-preview-midnight',
            hacker: 'dgac-preview-hacker',
            oldTimer: 'dgac-preview-old-timer',
            impossibleLandscapes: 'dgac-preview-impossible-landscapes',
            occultCrimson: 'dgac-preview-occult-crimson',
        };
        root.classList.add('dgac-player-live-preview', themeClasses[style] ?? themeClasses.midnight);
    }

    static DEFAULT_OPTIONS = {
        id: 'dgac-player-setup-wizard',
        classes: ['dgac-settings-menu', 'dgac-player-setup-wizard'],
        window: { title: 'Delta Green Agent Creator Player Setup', resizable: true },
        position: { width: 720, height: 720 },
        actions: {
            playerSetupStart: PlayerSetupWizard.#onStart,
            playerSetupPage: PlayerSetupWizard.#onPage,
            playerSetupBack: PlayerSetupWizard.#onBack,
            playerSetupNext: PlayerSetupWizard.#onNext,
            playerSetupRecommended: PlayerSetupWizard.#onRecommended,
            playerSetupFinish: PlayerSetupWizard.#onFinish,
        },
    };

    static PARTS = {
        main: { template: 'modules/delta-green-agent-creator/templates/player-setup-wizard.hbs' },
    };

    #creationAccess() {
        const mode = game.settings.get(MODULE_ID, 'randomizationAccess');
        if (mode === 'full') return 'both';
        if (mode === 'sections' || mode === 'disabled') return 'guided';
        return mode;
    }

    #normalizeRoute() {
        const access = this.#creationAccess();
        if (access === 'randomOnly') this.#draft.defaultCreationRoute = 'random';
        else if (access === 'guided' && this.#draft.defaultCreationRoute === 'random') this.#draft.defaultCreationRoute = 'guided';
    }

    syncSavedTheme(style) {
        this.#draft.agentSheetStyle = style;
        if (this.rendered) this.render({ force: true });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const themes = [
            { value: 'system', label: 'System Default', description: 'Use the standard Delta Green Agent sheet while the Creator retains its normal dark interface.', icon: 'fa-file-lines' },
            { value: 'midnight', label: 'Midnight Casework', description: 'Cool blue case files, restrained amber accents, and modern investigative styling.', icon: 'fa-user-secret' },
            { value: 'hacker', label: 'Hacker Terminal', description: 'Black terminal surfaces, green phosphor text, and electronic scan effects.', icon: 'fa-terminal' },
            { value: 'oldTimer', label: 'Old Timer', description: 'Aged brown dossiers, warm paper tones, and typewritten field office character.', icon: 'fa-folder-open' },
            { value: 'impossibleLandscapes', label: 'Impossible Landscapes', description: 'Sickly yellow, aged green, theatrical masks, and distorted records.', icon: 'fa-masks-theater' },
            { value: 'occultCrimson', label: 'Occult Crimson', description: 'Blackened burgundy, ritual red, muted gold, and occult imagery.', icon: 'fa-eye' },
        ].map(theme => ({ ...theme, selected: theme.value === this.#draft.agentSheetStyle }));
        const routeLabels = { ask: 'Ask Every Time', guided: 'Guided Creation', random: 'Random Agent' };
        const themeLabels = Object.fromEntries(themes.map(theme => [theme.value, theme.label]));
        const access = this.#creationAccess();
        return {
            ...context,
            page: this.#page,
            pageNumber: this.#page + 1,
            isSplash: this.#page === -1,
            isAppearance: this.#page === 0,
            isBehavior: this.#page === 1,
            isReview: this.#page === 2,
            isFirst: this.#page === 0,
            isLast: this.#page === 2,
            moduleVersion: game.modules.get(MODULE_ID)?.version ?? '',
            draft: this.#draft,
            themes,
            routeLabel: routeLabels[this.#draft.defaultCreationRoute] ?? routeLabels.ask,
            themeLabel: themeLabels[this.#draft.agentSheetStyle] ?? themeLabels.midnight,
            allowAskRoute: access !== 'randomOnly',
            allowGuidedRoute: access !== 'randomOnly',
            allowRandomRoute: ['both', 'randomOnly'].includes(access),
            routeLocked: access === 'randomOnly',
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.#applyThemePreview(this.#draft.agentSheetStyle);
        for (const input of this.element?.querySelectorAll('input[name="agentSheetStyle"]') ?? []) {
            input.addEventListener('change', event => {
                if (!event.currentTarget.checked) return;
                this.#draft.agentSheetStyle = event.currentTarget.value;
                this.render({ force: true });
            });
        }
    }

    #collect() {
        const form = this.element?.querySelector('form');
        if (!form || this.#page < 0) return true;
        const data = new foundry.applications.ux.FormDataExtended(form).object;
        if (this.#page === 0 && data.agentSheetStyle) this.#draft.agentSheetStyle = data.agentSheetStyle;
        if (this.#page === 1) {
            if (data.defaultCreationRoute) this.#draft.defaultCreationRoute = data.defaultCreationRoute;
            this.#draft.showCreatorButton = Boolean(data.showCreatorButton);
            this.#draft.confirmBeforeApply = Boolean(data.confirmBeforeApply);
            this.#draft.showCreatorTips = Boolean(data.showCreatorTips);
            this.#draft.compactCreatorLayout = Boolean(data.compactCreatorLayout);
            this.#normalizeRoute();
        }
        return true;
    }

    static #onStart() {
        this.#page = 0;
        this.render({ force: true });
    }

    static #onPage(event, target) {
        const page = Number(target.dataset.page);
        if (!Number.isInteger(page) || page < 0 || page > 2 || page === this.#page) return;
        this.#collect();
        this.#page = page;
        this.render({ force: true });
    }

    static #onBack() {
        this.#collect();
        this.#page = Math.max(0, this.#page - 1);
        this.render({ force: true });
    }

    static #onNext() {
        this.#collect();
        this.#page = Math.min(2, this.#page + 1);
        this.render({ force: true });
    }

    static #onRecommended() {
        Object.assign(this.#draft, {
            agentSheetStyle: 'midnight',
            defaultCreationRoute: 'ask',
            showCreatorButton: true,
            confirmBeforeApply: true,
            showCreatorTips: true,
            compactCreatorLayout: false,
        });
        this.#normalizeRoute();
        this.#page = 2;
        this.render({ force: true });
    }

    static async #onFinish() {
        this.#collect();
        for (const [key, value] of Object.entries(this.#draft)) {
            await game.settings.set(MODULE_ID, key, value);
        }
        await game.user.setFlag(MODULE_ID, 'playerSetupComplete', true);
        ui.notifications.info('Agent Creator player preferences saved.');
        this.close();
    }
}

export class HandlerRulesMenu extends BaseCreatorSettingsMenu {
    static MENU_TYPE = 'handler';

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: 'dgac-handler-rules',
        window: { title: 'Agent Creator Handler Rules' },
        position: { width: 680, height: 760 },
    }, { inplace: false });

    static SETTINGS = [
        { key: 'defaultStatMethod', type: String },
        { key: 'allowStatGeneralist', type: Boolean },
        { key: 'allowStatFocused', type: Boolean },
        { key: 'allowStatHighlyFocused', type: Boolean },
        { key: 'allowStatRolled', type: Boolean },
        { key: 'allowStatPointBuy', type: Boolean },
        { key: 'allowStatRandomizer', type: Boolean },
        { key: 'statRollMode', type: String },
        { key: 'professionSources', type: String },
        { key: 'fixedSpecialtyPolicy', type: String },
        { key: 'allowCustomProfessions', type: Boolean },
        { key: 'requiredMotivations', type: Number },
        { key: 'allowDamagedVeteran', type: Boolean },
        { key: 'defaultBondDataset', type: String },
        { key: 'randomizationAccess', type: String },
        { key: 'playerImportPolicy', type: String },
        { key: 'randomVeteranFrequency', type: String },
    ];

    static GROUPS = [
        {
            title: 'Statistic Methods',
            fields: [
                {
                    key: 'defaultStatMethod', label: 'Default statistic method', hint: 'The method initially selected for guided creation.', input: 'select',
                    options: [
                        { value: 'generalist', label: 'Generalist' }, { value: 'focused', label: 'Focused' },
                        { value: 'highlyFocused', label: 'Highly Focused' }, { value: 'rolled', label: 'Roll Statistics' },
                        { value: 'pointBuy', label: 'Allocate 72 Points' }, { value: 'randomized', label: 'Randomized Statistics' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'defaultStatMethod'),
                },
                { key: 'allowStatGeneralist', label: 'Allow Generalist', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatGeneralist') },
                { key: 'allowStatFocused', label: 'Allow Focused', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatFocused') },
                { key: 'allowStatHighlyFocused', label: 'Allow Highly Focused', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatHighlyFocused') },
                { key: 'allowStatRolled', label: 'Allow Roll Statistics', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatRolled') },
                { key: 'allowStatPointBuy', label: 'Allow Allocate 72 Points', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatPointBuy') },
                { key: 'allowStatRandomizer', label: 'Allow Randomized Statistics', hint: 'Allow the Statistics page to randomly choose a permitted generation method and assign its results.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatRandomizer') },
                {
                    key: 'statRollMode', label: 'Statistic roll visibility', hint: 'Controls who can see statistic rolls.', input: 'select',
                    options: [
                        { value: 'publicroll', label: 'Public Roll' }, { value: 'gmroll', label: 'GM Roll' },
                        { value: 'blindroll', label: 'Blind GM Roll' }, { value: 'selfroll', label: 'Private Roll' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'statRollMode'),
                },
            ],
        },
        {
            title: 'Creation Rules',
            fields: [
                {
                    key: 'professionSources', label: 'Available Professions', hint: 'Choose which published profession catalog players can use during Agent creation.', input: 'select', help: 'professionCatalog',
                    options: [
                        { value: 'quickstart', label: 'Need to Know Free Quickstart' },
                        { value: 'handbook', label: "Agent's Handbook Only" },
                        { value: 'all', label: "Agent's Handbook and The Complex" },
                        { value: 'complex', label: 'The Complex Only' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'professionSources'),
                },
                {
                    key: 'fixedSpecialtyPolicy', label: 'Fixed profession specialties', input: 'select',
                    options: [
                        { value: 'strict', label: 'Strict' }, { value: 'allowUnlock', label: 'Allow Unlock' },
                        { value: 'editable', label: 'Editable' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'fixedSpecialtyPolicy'),
                },
                { key: 'allowCustomProfessions', label: 'Allow custom professions', hint: 'Permit players to build a profession instead of choosing a published one.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowCustomProfessions') },
                { key: 'requiredMotivations', label: 'Required Motivations', hint: 'Choose from 0 through 5. At least one is encouraged, but the rules allow Motivations to emerge during play.', input: 'number', min: 0, max: 5, current: () => game.settings.get(MODULE_ID, 'requiredMotivations') },
                { key: 'allowDamagedVeteran', label: 'Allow Damaged Veteran', hint: 'Include this optional rule and its creator section. When disabled, Agents are Fresh Recruits.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowDamagedVeteran') },
                { key: 'veteranBackgrounds', label: 'Damaged Veteran backgrounds', hint: 'Choose which individual backgrounds players may select.', input: 'button', action: 'openVeteranBackgrounds', buttonLabel: 'Configure Backgrounds' },
                {
                    key: 'defaultBondDataset', label: 'Default Bond suggestion pool', hint: 'Sets the initially selected suggestion pool without restricting the other choices.', input: 'select',
                    options: [
                        { value: 'FRIENDS_FAMILY', label: 'Friends and Family' }, { value: 'DELTA_GREEN', label: 'Delta Green' },
                        { value: 'UNDERWORLD', label: 'Underworld or Criminal' }, { value: 'LGBTQ', label: 'LGBTQ+' },
                        { value: 'PISCES_UK', label: 'PISCES UK' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'defaultBondDataset'),
                },
            ],
        },
        {
            title: 'Creation Mode',
            fields: [
                { key: 'randomizationAccess', label: 'Creation mode', hint: 'Choose whether players can build Agents manually, generate complete Random Agents, or use both workflows.', input: 'select', options: [
                    { value: 'guided', label: 'Guided Creation Only' }, { value: 'both', label: 'Guided and Complete Random Agent' }, { value: 'randomOnly', label: 'Complete Random Agent Only' },
                ], current: () => game.settings.get(MODULE_ID, 'randomizationAccess') },
                { key: 'playerImportPolicy', label: 'Player Agent imports', hint: 'Compatible imports must satisfy this world\'s enabled sources, optional rules, and statistic methods. Player imports are unavailable in Complete Random Agent Only mode.', input: 'select', options: [
                    { value: 'disabled', label: 'Disabled' }, { value: 'compatible', label: 'Compatible Agents Only' },
                ], current: () => game.settings.get(MODULE_ID, 'playerImportPolicy') },
                {
                    key: 'randomVeteranFrequency', label: 'Damaged Veteran frequency for complete Random Agents', hint: 'Damaged Veterans may appear in complete Random Agents. This has no effect on guided creation or individual section randomizers.', input: 'select',
                    options: [
                        { value: 'fresh', label: 'Always Fresh Recruit' }, { value: 'mostlyFresh', label: 'Mostly Fresh Recruits' },
                        { value: 'equal', label: 'Equal Chance' }, { value: 'veteran', label: 'Always Damaged Veteran' },
                    ],
                    current: () => game.settings.get(MODULE_ID, 'randomVeteranFrequency'),
                },
            ],
        },
    ];
}

export class SectionRandomizersMenu extends BaseCreatorSettingsMenu {
    static MENU_TYPE = 'sectionRandomizers';

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: 'dgac-section-randomizers',
        window: { title: 'Guided Creation Randomizers' },
        position: { width: 650, height: 650 },
    }, { inplace: false });

    static SETTINGS = [
        { key: 'allowStatRandomizer', type: Boolean },
        { key: 'randomizeProfession', type: Boolean },
        { key: 'randomizeProfessionSkills', type: Boolean },
        { key: 'randomizeBackgroundSkills', type: Boolean },
        { key: 'randomizeVeteran', type: Boolean },
        { key: 'randomizeBonds', type: Boolean },
        { key: 'randomizeBiography', type: Boolean },
        { key: 'randomizeMotivations', type: Boolean },
    ];

    static GROUPS = [
        {
            title: 'Individual Guided Creation Controls',
            fields: [
                { key: 'allowStatRandomizer', label: 'Randomized Statistics', hint: 'Show Randomized Statistics as an allowed Statistics method. This must also remain permitted by the Handler statistic rules.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'allowStatRandomizer') },
                { key: 'randomizeProfession', label: 'Random Profession', hint: 'Show the Random Profession button.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeProfession') },
                { key: 'randomizeProfessionSkills', label: 'Random Professional Skills and Specialties', hint: 'Show the randomizer for optional professional choices and editable specialties.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeProfessionSkills') },
                { key: 'randomizeBackgroundSkills', label: 'Random Background Skills', hint: 'Show the Random Package button on Background Skills.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeBackgroundSkills') },
                { key: 'randomizeVeteran', label: 'Random Damaged Veteran Status', hint: 'Show the Veteran Status randomizer. This remains unavailable when Damaged Veteran is disabled.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeVeteran'), disabled: () => !game.settings.get(MODULE_ID, 'allowDamagedVeteran') },
                { key: 'randomizeBonds', label: 'Random Bonds', hint: 'Show the Randomize Bonds button. Individual light bulb suggestions remain available.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeBonds') },
                { key: 'randomizeBiography', label: 'Random Biography', hint: 'Show the Random Bio button for identity and physical details.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeBiography') },
                { key: 'randomizeMotivations', label: 'Random Motivations', hint: 'Show the Random Motivations button independently from biography randomization.', input: 'checkbox', checked: () => game.settings.get(MODULE_ID, 'randomizeMotivations') },
            ],
        },
    ];
}

export class VeteranBackgroundsMenu extends BaseCreatorSettingsMenu {
    static MENU_TYPE = 'veteranBackgrounds';

    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: 'dgac-veteran-backgrounds',
        window: { title: 'Damaged Veteran Backgrounds' },
        position: { width: 720, height: 520 },
    }, { inplace: false });

    static SETTINGS = [
        { key: 'allowVeteranExtremeViolence', type: Boolean },
        { key: 'allowVeteranCaptivity', type: Boolean },
        { key: 'allowVeteranHardExperience', type: Boolean },
        { key: 'allowVeteranThingsMan', type: Boolean },
    ];

    static GROUPS = [{
        title: 'Available Backgrounds',
        fields: [
            {
                key: 'allowVeteranExtremeViolence', label: 'Extreme Violence', hint: 'Past exposure to overwhelming violence has left permanent scars.', input: 'checkbox',
                effects: ['Occult +10%', 'SAN −5', 'CHA −3', 'Each Bond −3', 'Adapted to Violence'],
                checked: () => game.settings.get(MODULE_ID, 'allowVeteranExtremeViolence'),
            },
            {
                key: 'allowVeteranCaptivity', label: 'Captivity or Imprisonment', hint: 'Extended helplessness has changed how the Agent responds to confinement.', input: 'checkbox',
                effects: ['Occult +10%', 'SAN −5', 'POW −3', 'Breaking Point unchanged', 'Adapted to Helplessness'],
                checked: () => game.settings.get(MODULE_ID, 'allowVeteranCaptivity'),
            },
            {
                key: 'allowVeteranHardExperience', label: 'Hard Experience', hint: 'Survival came at the cost of stability and a human connection.', input: 'checkbox',
                effects: ['Occult +10%', 'Four skills +10%', 'SAN −5', 'Remove one Bond', 'Skills may exceed 80%'],
                checked: () => game.settings.get(MODULE_ID, 'allowVeteranHardExperience'),
            },
            {
                key: 'allowVeteranThingsMan', label: 'Things Man Was Not Meant to Know', hint: 'Direct contact with the Unnatural before play has permanently altered the Agent.', input: 'checkbox',
                effects: ['Unnatural +10%', 'Occult +20%', 'Lose SAN equal to POW', 'Reset Breaking Point', 'Gain a Disorder'],
                checked: () => game.settings.get(MODULE_ID, 'allowVeteranThingsMan'),
            },
        ],
    }];
}

export class AgentCreatorSetupWizard extends HandlebarsApplicationMixin(ApplicationV2) {
    #page = -1;
    #draft;
    #useRecommendedVeteranBackgrounds = false;

    constructor(options = {}) {
        super(options);
        this.#draft = {
            professionSources: game.settings.get(MODULE_ID, 'professionSources'),
            fixedSpecialtyPolicy: game.settings.get(MODULE_ID, 'fixedSpecialtyPolicy'),
            allowCustomProfessions: game.settings.get(MODULE_ID, 'allowCustomProfessions'),
            requiredMotivations: game.settings.get(MODULE_ID, 'requiredMotivations'),
            allowDamagedVeteran: game.settings.get(MODULE_ID, 'allowDamagedVeteran'),
            defaultBondDataset: game.settings.get(MODULE_ID, 'defaultBondDataset'),
            defaultStatMethod: game.settings.get(MODULE_ID, 'defaultStatMethod'),
            allowStatGeneralist: game.settings.get(MODULE_ID, 'allowStatGeneralist'),
            allowStatFocused: game.settings.get(MODULE_ID, 'allowStatFocused'),
            allowStatHighlyFocused: game.settings.get(MODULE_ID, 'allowStatHighlyFocused'),
            allowStatRolled: game.settings.get(MODULE_ID, 'allowStatRolled'),
            allowStatPointBuy: game.settings.get(MODULE_ID, 'allowStatPointBuy'),
            allowStatRandomizer: game.settings.get(MODULE_ID, 'allowStatRandomizer'),
            statRollMode: game.settings.get(MODULE_ID, 'statRollMode'),
            randomizationAccess: game.settings.get(MODULE_ID, 'randomizationAccess'),
            playerImportPolicy: game.settings.get(MODULE_ID, 'playerImportPolicy'),
            randomVeteranFrequency: game.settings.get(MODULE_ID, 'randomVeteranFrequency'),
            randomizeProfession: game.settings.get(MODULE_ID, 'randomizeProfession'),
            randomizeProfessionSkills: game.settings.get(MODULE_ID, 'randomizeProfessionSkills'),
            randomizeBackgroundSkills: game.settings.get(MODULE_ID, 'randomizeBackgroundSkills'),
            randomizeVeteran: game.settings.get(MODULE_ID, 'randomizeVeteran'),
            randomizeBonds: game.settings.get(MODULE_ID, 'randomizeBonds'),
            randomizeBiography: game.settings.get(MODULE_ID, 'randomizeBiography'),
            randomizeMotivations: game.settings.get(MODULE_ID, 'randomizeMotivations'),
            agentSheetStyle: game.settings.get(MODULE_ID, 'agentSheetStyle'),
            defaultCreationRoute: game.settings.get(MODULE_ID, 'defaultCreationRoute'),
            showCreatorButton: game.settings.get(MODULE_ID, 'showCreatorButton'),
            confirmBeforeApply: game.settings.get(MODULE_ID, 'confirmBeforeApply'),
            showCreatorTips: game.settings.get(MODULE_ID, 'showCreatorTips'),
            compactCreatorLayout: game.settings.get(MODULE_ID, 'compactCreatorLayout'),
        };
    }

    static DEFAULT_OPTIONS = {
        id: 'dgac-handler-setup-wizard',
        classes: ['dgac-settings-menu', 'dgac-setup-wizard'],
        window: { title: 'Delta Green Agent Creator Setup', resizable: true },
        position: { width: 720, height: 720 },
        actions: {
            setupStart: AgentCreatorSetupWizard.#onStart,
            setupPage: AgentCreatorSetupWizard.#onPage,
            setupBack: AgentCreatorSetupWizard.#onBack,
            setupNext: AgentCreatorSetupWizard.#onNext,
            setupFinish: AgentCreatorSetupWizard.#onFinish,
            setupRecommended: AgentCreatorSetupWizard.#onRecommended,
            setupVeteranBackgrounds: AgentCreatorSetupWizard.#onVeteranBackgrounds,
            professionCatalogHelp: openProfessionCatalogHelp,
        },
    };

    static PARTS = { main: { template: 'modules/delta-green-agent-creator/templates/setup-wizard.hbs' } };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const option = (value, label, current) => ({ value, label, selected: value === current });
        return {
            ...context,
            page: this.#page,
            pageNumber: this.#page + 1,
            isSplash: this.#page === -1,
            isContent: this.#page === 0,
            isStatistics: this.#page === 1,
            isRandomization: this.#page === 2,
            isAppearance: this.#page === 3,
            isPreferences: this.#page === 4,
            isFirst: this.#page === 0,
            isLast: this.#page === 4,
            moduleVersion: game.modules.get(MODULE_ID)?.version ?? '',
            draft: this.#draft,
            professionOptions: [option('quickstart', 'Need to Know Free Quickstart', this.#draft.professionSources), option('handbook', "Agent's Handbook Only", this.#draft.professionSources), option('all', "Agent's Handbook and The Complex", this.#draft.professionSources), option('complex', 'The Complex Only', this.#draft.professionSources)],
            specialtyOptions: [option('strict', 'Strict', this.#draft.fixedSpecialtyPolicy), option('allowUnlock', 'Allow Unlock', this.#draft.fixedSpecialtyPolicy), option('editable', 'Editable', this.#draft.fixedSpecialtyPolicy)],
            statOptions: [option('generalist', 'Generalist', this.#draft.defaultStatMethod), option('focused', 'Focused', this.#draft.defaultStatMethod), option('highlyFocused', 'Highly Focused', this.#draft.defaultStatMethod), option('rolled', 'Roll Statistics', this.#draft.defaultStatMethod), option('pointBuy', 'Allocate 72 Points', this.#draft.defaultStatMethod), option('randomized', 'Randomized Statistics', this.#draft.defaultStatMethod)],
            rollOptions: [option('publicroll', 'Public Roll', this.#draft.statRollMode), option('gmroll', 'GM Roll', this.#draft.statRollMode), option('blindroll', 'Blind GM Roll', this.#draft.statRollMode), option('selfroll', 'Private Roll', this.#draft.statRollMode)],
            randomOptions: [option('guided', 'Guided Creation Only', this.#draft.randomizationAccess), option('both', 'Guided and Complete Random Agent', this.#draft.randomizationAccess), option('randomOnly', 'Complete Random Agent Only', this.#draft.randomizationAccess)],
            importOptions: [option('disabled', 'Disabled', this.#draft.playerImportPolicy), option('compatible', 'Compatible Agents Only', this.#draft.playerImportPolicy)],
            veteranFrequencyOptions: [option('fresh', 'Always Fresh Recruit', this.#draft.randomVeteranFrequency), option('mostlyFresh', 'Mostly Fresh Recruits', this.#draft.randomVeteranFrequency), option('equal', 'Equal Chance', this.#draft.randomVeteranFrequency), option('veteran', 'Always Damaged Veteran', this.#draft.randomVeteranFrequency)],
            bondDatasetOptions: [option('FRIENDS_FAMILY', 'Friends and Family', this.#draft.defaultBondDataset), option('DELTA_GREEN', 'Delta Green', this.#draft.defaultBondDataset), option('UNDERWORLD', 'Underworld or Criminal', this.#draft.defaultBondDataset), option('LGBTQ', 'LGBTQ+', this.#draft.defaultBondDataset), option('PISCES_UK', 'PISCES UK', this.#draft.defaultBondDataset)],
            themes: [
                { value: 'system', label: 'System Default', description: 'Use the standard Delta Green Agent sheet while the Creator retains its normal dark interface.', icon: 'fa-file-lines' },
                { value: 'midnight', label: 'Midnight Casework', description: 'Cool blue case files, restrained amber accents, and modern investigative styling.', icon: 'fa-user-secret' },
                { value: 'hacker', label: 'Hacker Terminal', description: 'Black terminal surfaces, green phosphor text, and electronic scan effects.', icon: 'fa-terminal' },
                { value: 'oldTimer', label: 'Old Timer', description: 'Aged brown dossiers, warm paper tones, and typewritten field office character.', icon: 'fa-folder-open' },
                { value: 'impossibleLandscapes', label: 'Impossible Landscapes', description: 'Sickly yellow, aged green, theatrical masks, and distorted records.', icon: 'fa-masks-theater' },
                { value: 'occultCrimson', label: 'Occult Crimson', description: 'Blackened burgundy, ritual red, muted gold, and occult imagery.', icon: 'fa-eye' },
            ].map(theme => ({ ...theme, selected: theme.value === this.#draft.agentSheetStyle })),
            routeOptions: [option('ask', 'Ask Every Time', this.#draft.defaultCreationRoute), option('guided', 'Guided Creation', this.#draft.defaultCreationRoute), option('random', 'Random Agent', this.#draft.defaultCreationRoute)]
                .filter(item => this.#draft.randomizationAccess !== 'guided' || item.value !== 'random')
                .filter(item => this.#draft.randomizationAccess !== 'randomOnly' || item.value === 'random'),
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const form = this.element?.querySelector('form');
        if (!form) return;
        const update = () => {
            if (this.#page === 0) {
                const veteranButton = form.querySelector('[data-action="setupVeteranBackgrounds"]');
                if (veteranButton) veteranButton.disabled = !form.elements.allowDamagedVeteran?.checked;
            }
            if (this.#page === 1) {
                const select = form.elements.defaultStatMethod;
                const map = { generalist: 'allowStatGeneralist', focused: 'allowStatFocused', highlyFocused: 'allowStatHighlyFocused', rolled: 'allowStatRolled', pointBuy: 'allowStatPointBuy', randomized: 'allowStatRandomizer' };
                for (const option of select?.options ?? []) option.disabled = !form.elements[map[option.value]]?.checked;
                if (select?.selectedOptions[0]?.disabled) select.value = [...select.options].find(item => !item.disabled)?.value ?? '';
            }
            if (this.#page === 2) {
                const access = form.elements.randomizationAccess?.value ?? 'both';
                const row = form.querySelector('[data-setup-veteran-frequency]');
                if (row) row.hidden = !(this.#draft.allowDamagedVeteran && ['both', 'randomOnly'].includes(access));
                const sectionControls = form.querySelector('[data-setup-section-randomizers]');
                if (sectionControls) sectionControls.hidden = access === 'randomOnly';
                const importPolicy = form.elements.playerImportPolicy;
                if (importPolicy) importPolicy.disabled = access === 'randomOnly';
                const veteranControl = form.elements.randomizeVeteran;
                if (veteranControl) veteranControl.disabled = !this.#draft.allowDamagedVeteran;
            }
            if (this.#page === 3) {
                const selectedTheme = form.elements.agentSheetStyle?.value;
                if (selectedTheme) this.#applyThemePreview(selectedTheme);
            }
        };
        form.addEventListener('change', update);
        if (this.#page === 3) {
            for (const input of form.querySelectorAll('input[name="agentSheetStyle"]')) {
                input.addEventListener('change', () => {
                    if (!input.checked) return;
                    this.#collect();
                    this.#draft.agentSheetStyle = input.value;
                    this.render({ force: true });
                });
            }
            this.#applyThemePreview(this.#draft.agentSheetStyle);
        }
        update();
    }

    #applyThemePreview(style) {
        const root = this.element;
        if (!root) return;
        root.classList.remove('dgac-player-live-preview', 'dgac-preview-system', 'dgac-preview-midnight', 'dgac-preview-hacker', 'dgac-preview-old-timer', 'dgac-preview-impossible-landscapes', 'dgac-preview-occult-crimson');
        const themeClasses = { system: 'dgac-preview-system', midnight: 'dgac-preview-midnight', hacker: 'dgac-preview-hacker', oldTimer: 'dgac-preview-old-timer', impossibleLandscapes: 'dgac-preview-impossible-landscapes', occultCrimson: 'dgac-preview-occult-crimson' };
        root.classList.add('dgac-player-live-preview', themeClasses[style] ?? themeClasses.midnight);
    }

    #collect() {
        const form = this.element?.querySelector('form');
        if (!form) return true;
        const data = new foundry.applications.ux.FormDataExtended(form).object;
        const pageKeys = this.#page === 0
            ? ['professionSources', 'fixedSpecialtyPolicy', 'allowCustomProfessions', 'requiredMotivations', 'allowDamagedVeteran', 'defaultBondDataset']
            : this.#page === 1
                ? ['defaultStatMethod', 'allowStatGeneralist', 'allowStatFocused', 'allowStatHighlyFocused', 'allowStatRolled', 'allowStatPointBuy', 'allowStatRandomizer', 'statRollMode']
                : this.#page === 2
                    ? ['randomizationAccess', 'playerImportPolicy', 'randomVeteranFrequency', 'randomizeProfession', 'randomizeProfessionSkills', 'randomizeBackgroundSkills', 'randomizeVeteran', 'randomizeBonds', 'randomizeBiography', 'randomizeMotivations']
                    : this.#page === 3
                        ? ['agentSheetStyle']
                        : ['defaultCreationRoute', 'showCreatorButton', 'confirmBeforeApply', 'showCreatorTips', 'compactCreatorLayout'];
        for (const key of pageKeys) {
            if (typeof this.#draft[key] === 'boolean') this.#draft[key] = Boolean(data[key]);
            else if (key === 'requiredMotivations') this.#draft[key] = Math.max(0, Math.min(5, Number(data[key]) || 0));
            else if (data[key] !== undefined) this.#draft[key] = data[key];
        }
        if (this.#page === 1) {
            const methodKeys = { generalist: 'allowStatGeneralist', focused: 'allowStatFocused', highlyFocused: 'allowStatHighlyFocused', rolled: 'allowStatRolled', pointBuy: 'allowStatPointBuy', randomized: 'allowStatRandomizer' };
            const allowed = Object.entries(methodKeys).filter(([, key]) => this.#draft[key]).map(([method]) => method);
            if (allowed.length === 0) {
                ui.notifications.warn('Allow at least one statistic method.');
                return false;
            }
            if (this.#draft.allowStatRandomizer && allowed.every(method => method === 'randomized')) {
                ui.notifications.warn('Randomized Statistics requires at least one other permitted statistic method.');
                return false;
            }
            if (!allowed.includes(this.#draft.defaultStatMethod)) this.#draft.defaultStatMethod = allowed[0];
        }
        if (this.#page === 2) {
            if (this.#draft.randomizationAccess === 'randomOnly') this.#draft.defaultCreationRoute = 'random';
            else if (this.#draft.randomizationAccess === 'guided' && this.#draft.defaultCreationRoute === 'random') this.#draft.defaultCreationRoute = 'guided';
        }
        return true;
    }

    static #onBack() { if (!this.#collect()) return; this.#page = Math.max(0, this.#page - 1); this.render({ force: true }); }
    static #onStart() { this.#page = 0; this.render({ force: true }); }
    static #onPage(event, target) {
        const page = Number(target.dataset.page);
        if (!Number.isInteger(page) || page < 0 || page > 4 || page === this.#page) return;
        if (!this.#collect()) return;
        this.#page = page;
        this.render({ force: true });
    }
    static #onVeteranBackgrounds() { new VeteranBackgroundsMenu().render({ force: true }); }
    static #onNext() { if (!this.#collect()) return; this.#page = Math.min(4, this.#page + 1); this.render({ force: true }); }
    static async #onFinish() {
        if (!this.#collect()) return;
        const methodKeys = { generalist: 'allowStatGeneralist', focused: 'allowStatFocused', highlyFocused: 'allowStatHighlyFocused', rolled: 'allowStatRolled', pointBuy: 'allowStatPointBuy', randomized: 'allowStatRandomizer' };
        const effectiveAllowed = Object.entries(methodKeys)
            .filter(([, key]) => this.#draft[key])
            .map(([method]) => method);
        if (effectiveAllowed.length === 0) {
            ui.notifications.warn('Enable at least one statistic method before saving the world rules.');
            this.#page = 1;
            this.render({ force: true });
            return;
        }
        if (this.#draft.allowStatRandomizer && effectiveAllowed.every(method => method === 'randomized')) {
            ui.notifications.warn('Randomized Statistics requires at least one other permitted statistic method.');
            this.#page = 1;
            this.render({ force: true });
            return;
        }
        if (!effectiveAllowed.includes(this.#draft.defaultStatMethod)) this.#draft.defaultStatMethod = effectiveAllowed[0];
        for (const [key, value] of Object.entries(this.#draft)) await game.settings.set(MODULE_ID, key, value);
        if (this.#useRecommendedVeteranBackgrounds) {
            for (const key of ['allowVeteranExtremeViolence', 'allowVeteranCaptivity', 'allowVeteranHardExperience', 'allowVeteranThingsMan']) {
                await game.settings.set(MODULE_ID, key, true);
            }
        }
        await game.settings.set(MODULE_ID, 'handlerSetupComplete', true);
        ui.notifications.info('Agent Creator world rules saved.');
        await this.close();
    }
    static async #onRecommended() {
        Object.assign(this.#draft, {
            professionSources: 'all', fixedSpecialtyPolicy: 'allowUnlock', allowCustomProfessions: false, requiredMotivations: 0, allowDamagedVeteran: true, defaultBondDataset: 'FRIENDS_FAMILY',
            defaultStatMethod: 'generalist', allowStatGeneralist: true, allowStatFocused: true, allowStatHighlyFocused: true,
            allowStatRolled: true, allowStatPointBuy: true, allowStatRandomizer: true, statRollMode: 'publicroll',
            randomizationAccess: 'both', playerImportPolicy: 'compatible', randomVeteranFrequency: 'mostlyFresh',
            randomizeProfession: true, randomizeProfessionSkills: true, randomizeBackgroundSkills: true,
            randomizeVeteran: true, randomizeBonds: true, randomizeBiography: true, randomizeMotivations: true,
            agentSheetStyle: 'midnight', defaultCreationRoute: 'ask', showCreatorButton: true,
            confirmBeforeApply: true, showCreatorTips: true, compactCreatorLayout: false,
        });
        this.#useRecommendedVeteranBackgrounds = true;
        this.#page = 4;
        this.render({ force: true });
    }
}

export function resolveSettingsMenuContext(groups) {
    return groups.map(group => ({
        ...group,
        fields: group.fields.map(field => ({
            ...field,
            checked: field.checked?.() ?? false,
            disabled: field.disabled?.() ?? false,
            current: field.current?.() ?? '',
            options: field.options?.map(option => ({
                ...option,
                selected: option.value === (field.current?.() ?? ''),
            })) ?? [],
        })),
    }));
}
