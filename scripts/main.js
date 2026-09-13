import { DeltaGreenChargenWizard } from "./wizard.js";
import { MODULE_ID, getSetting, registerSettings } from "./settings.js";
import { AgentCreatorSetupWizard, PlayerSetupWizard } from "./settings-menu.js";

let playerSetupLaunchTimer = null;

function isPlayerSetupComplete() {
  return game.user?.getFlag(MODULE_ID, "playerSetupComplete") === true;
}

function hasOpenUserConfiguration() {
  const instances = globalThis.foundry?.applications?.instances;
  if (!instances?.values) return false;
  return [...instances.values()].some(application => {
    if (!application?.rendered) return false;
    const className = String(application.constructor?.name ?? "").toLowerCase();
    const applicationId = String(application.id ?? application.options?.id ?? "").toLowerCase();
    return className === "userconfig"
      || className === "userconfiguration"
      || applicationId.includes("user-config");
  });
}

function hasOpenPlayerSetupWizard() {
  if (document.getElementById("dgac-player-setup-wizard")) return true;
  const instances = globalThis.foundry?.applications?.instances;
  if (!instances?.values) return false;
  return [...instances.values()].some(application =>
    application?.rendered && application instanceof PlayerSetupWizard
  );
}

function schedulePlayerSetupWizard() {
  if (playerSetupLaunchTimer) clearTimeout(playerSetupLaunchTimer);
  playerSetupLaunchTimer = setTimeout(() => {
    playerSetupLaunchTimer = null;
    if (game.user.isGM || isPlayerSetupComplete()) return;
    if (hasOpenPlayerSetupWizard()) return;
    if (hasOpenUserConfiguration()) {
      schedulePlayerSetupWizard();
      return;
    }
    new PlayerSetupWizard().render({ force: true });
  }, 500);
}

function setAgentSheetTheme(style) {
  const body = document.body;
  if (!body) return;
  body.classList.remove(
    "dgac-agent-sheet-theme",
    "dgac-sheet-midnight",
    "dgac-sheet-hacker",
    "dgac-sheet-old-timer",
    "dgac-sheet-impossible-landscapes",
    "dgac-sheet-occult-crimson"
  );
  if (style === "system") {
    document.querySelectorAll(".dgac-themed-agent-sheet-content").forEach(content => {
      content.style.removeProperty("background");
    });
    return;
  }
  const themeClasses = {
    midnight: "dgac-sheet-midnight",
    hacker: "dgac-sheet-hacker",
    oldTimer: "dgac-sheet-old-timer",
    impossibleLandscapes: "dgac-sheet-impossible-landscapes",
    occultCrimson: "dgac-sheet-occult-crimson",
  };
  body.classList.add("dgac-agent-sheet-theme", themeClasses[style] ?? themeClasses.midnight);
  document.querySelectorAll(".dgac-themed-agent-sheet-content").forEach(content => {
    content.style.setProperty(
      "background",
      "var(--dgac-sheet-shell-pattern), var(--dgac-sheet-shell-bg)",
      "important"
    );
  });
}

Hooks.once("init", () => {
  registerSettings(value => {
    setAgentSheetTheme(value);
    const instances = globalThis.foundry?.applications?.instances;
    if (!instances?.values) return;
    for (const application of instances.values()) {
      if (application instanceof PlayerSetupWizard) application.syncSavedTheme(value);
    }
  });

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("lt", (a, b) => a < b);
  Handlebars.registerHelper("multiply", (a, b) => Number(a) * Number(b));
  Handlebars.registerHelper("inc", value => Number(value) + 1);
  Handlebars.registerHelper("range", (start, end) => {
    const values = [];
    for (let index = start; index < end; index += 1) values.push(index);
    return values;
  });
});

function resolveRoot(element) {
  if (element instanceof HTMLElement) return element;
  if (element?.[0] instanceof HTMLElement) return element[0];
  return null;
}

function addCreatorControl(application, element) {
  const actor = application?.document ?? application?.actor;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "agent") return;

  const root = resolveRoot(element) ?? resolveRoot(application.element);
  root?.classList.add("dgac-themed-agent-sheet");
  const content = root?.querySelector("section.window-content, .window-content");
  content?.classList.add("dgac-themed-agent-sheet-content");
  if (content && getSetting("agentSheetStyle", "midnight") !== "system") {
    content.style.setProperty(
      "background",
      "var(--dgac-sheet-shell-pattern), var(--dgac-sheet-shell-bg)",
      "important"
    );
  }

  if (!getSetting("showCreatorButton", true)) return;

  const header = root?.querySelector(".window-header");
  if (!header || header.querySelector(".dgac-launch")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-control dgac-launch";
  button.dataset.tooltip = "Open the Delta Green Agent Creator";
  button.setAttribute("aria-label", "Open Agent Creator");
  button.innerHTML = '<i class="fa-solid fa-user-secret" aria-hidden="true"></i><span>Agent Creator</span>';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    new DeltaGreenChargenWizard(actor).openUsingPreference();
  });

  const closeControl = header.querySelector('[data-action="close"]');
  if (closeControl) header.insertBefore(button, closeControl);
  else header.append(button);
}

function enforceSettingsDependencies(application, element) {
  const root = resolveRoot(element) ?? resolveRoot(application?.element);
  const select = root?.querySelector('select[name="delta-green-agent-creator.defaultCreationRoute"]');
  if (!select) return;
  const randomOption = select.querySelector('option[value="random"]');
  const rawMode = getSetting("randomizationAccess", "both");
  const mode = rawMode === "full" ? "both" : (["sections", "disabled"].includes(rawMode) ? "guided" : rawMode);
  const completeRandomAllowed = ["both", "randomOnly"].includes(mode);
  if (randomOption) {
    randomOption.hidden = !completeRandomAllowed;
    randomOption.disabled = !completeRandomAllowed;
  }
  if (!completeRandomAllowed && select.value === "random") select.value = "guided";
  select.disabled = mode === "randomOnly";
  if (mode === "randomOnly") select.value = "random";
}

Hooks.on("renderDGAgentSheet", addCreatorControl);
Hooks.on("renderDGAgentSheetV2", addCreatorControl);
Hooks.on("renderApplicationV2", (application, element) => {
  addCreatorControl(application, element);
  enforceSettingsDependencies(application, element);
});

Hooks.once("ready", async () => {
  if (game.system.id !== "deltagreen") {
    ui.notifications.warn("Delta Green Agent Creator requires the Delta Green game system.");
    return;
  }
  if (game.user.isGM) {
    game.settings.menus?.delete?.(`${MODULE_ID}.playerSetupWizard`);
    const legacyMode = getSetting("randomizationAccess", "both");
    if (["full", "sections", "disabled"].includes(legacyMode)) {
      const migratedMode = legacyMode === "full" ? "both" : "guided";
      await game.settings.set(MODULE_ID, "randomizationAccess", migratedMode);
      if (legacyMode === "disabled") {
        for (const key of ["allowStatRandomizer", "randomizeProfession", "randomizeProfessionSkills", "randomizeBackgroundSkills", "randomizeVeteran", "randomizeBonds", "randomizeBiography", "randomizeMotivations"]) {
          await game.settings.set(MODULE_ID, key, false);
        }
      }
    }
  }
  setAgentSheetTheme(getSetting("agentSheetStyle", "midnight"));
  const handlerSetupNeeded = game.user.isGM && !getSetting("handlerSetupComplete", false);
  if (handlerSetupNeeded) {
    new AgentCreatorSetupWizard().render({ force: true });
  } else if (!game.user.isGM && !isPlayerSetupComplete()) {
    schedulePlayerSetupWizard();
  }
  console.log(`${MODULE_ID} | Ready for Foundry ${game.version} and Delta Green ${game.system.version}.`);
});
