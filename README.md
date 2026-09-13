# Delta Green Agent Creator

A guided and randomized Agent creation module for Foundry VTT v14 and the Delta Green system.

## Compatibility

Foundry VTT 14.367

Delta Green system 2.0.1

## Installation

Extract the `delta-green-agent-creator` folder into Foundry's `Data/modules` directory. Restart Foundry, enable the module in the world, and open an Agent Actor sheet.

Use the `Agent Creator` control in the sheet title bar to begin or resume creation.

## Version 0.4.51

* Removed the ineffective rendered row hiding approach
* Removed Player Setup Wizard directly from the finalized GM settings registry during ready
* Corrected the GM module settings count while preserving the wizard for regular players

## Version 0.4.50

* Restored Player Setup Wizard registration for regular players
* Hid the redundant Player Setup Wizard row only after confirming the current user is a GM
* Preserved all Handler settings and setup controls for GM accounts

## Version 0.4.49

* Removed the redundant Player Setup Wizard menu entry for GMs
* Kept Player Setup Wizard available to regular players
* Kept Player Preferences available to GMs for later personal changes

## Version 0.4.48

* Integrated the GM's personal preferences into Handler Setup
* Prevented GMs from automatically receiving the separate Player Setup Wizard
* Marked both setup flows complete when a GM finishes Handler Setup

## Version 0.4.47

* Removed duplicate native Theme and Opening Screen dropdowns from Game Settings
* Kept Player Preferences and the Player Setup Wizard as the authoritative controls
* Prevented a stale background settings form from overwriting newly saved player preferences

## Version 0.4.46

* Ensured Player Setup Wizard live previews always override the previously saved theme inside the wizard
* Kept preview styling isolated from Agent sheets and other open windows

## Version 0.4.45

* Prevented Allocate 72 Points from exceeding its total budget through buttons or manual entry
* Disabled increase buttons when all 72 points are allocated
* Prevented the remaining points display from showing negative values

## Version 0.4.44

* Synchronized manually entered point allocation values with descriptors, multiplied values, remaining points, and derived attributes
* Made Enter commit a manually entered statistic instead of advancing away from the Statistics page

## Version 0.4.43

* Isolated live theme previews to the Player Setup Wizard
* Prevented preview selections from changing open Agent sheets or other Creator windows
* Prevented System Default previews from leaving conflicting sheet backgrounds behind

## Version 0.4.42

* Changed Allocate 72 Points to begin with all six statistics at 10 and 12 points remaining

## Version 0.4.41

* Replaced the miniature theme mockup with live theming of the Player Setup Wizard
* Corrected System Default so the wizard retains the normal dark Creator interface
* Removed the theme page scrollbar introduced by the miniature preview

## Version 0.4.40

* Added a live miniature Agent interface preview to the Player Setup Wizard theme selection
* Made the selected theme unmistakable with a stronger outline and visible Selected badge

## Version 0.4.39

* Added a one time Player Setup Wizard for each user
* Added guided choices for theme, opening behavior, Creator access, confirmations, tips, and layout
* Added a permanent Run Player Setup Wizard option to module settings
* Delayed GM player setup until Handler Setup is complete
* Preserved current preferences when the wizard is closed without saving

## Version 0.4.38

* Prevented Delta Green's global program style parchment from overriding the Agent Creator under System Default
* Isolated Agent Creator, Handler setup, Handler rules, and Player Preferences surfaces from system sheet background rules
* Kept Delta Green's untouched default appearance on Agent sheets when System Default is selected

## Version 0.4.37

* Removed the forced parchment treatment from System Default Creator and settings windows
* Restored the clean module interface when Delta Green's default Agent sheet is selected
* Preserved the expanded recommendation layout fix and all theme specific splash artwork

## Version 0.4.36

* Fixed the expanded recommended settings list overlapping the splash footer and action buttons
* Allowed the expanded splash content to grow naturally inside one continuous scrolling page
* Added a true Delta Green parchment presentation for System Default module interfaces
* Kept custom Agent sheet styling disabled under System Default while preserving identical interface geometry

## Version 0.4.35

* Replaced the shared setup splash centerpiece with theme specific artwork
* Added a terminal display for Hacker Terminal, classified dossier for Old Timer, theatrical mask for Impossible Landscapes, and ritual eye for Occult Crimson
* Retained the operative targeting seal for Midnight Casework and System Default
* Fixed splash artwork shifting by using a fixed art height and reserving scrollbar space consistently

## Version 0.4.34

* Restored the Delta Green system's original Agent sheet padding and control positions while retaining the selected themed background
* Fully themed the Handler setup splash artwork, seal, targeting marks, dossier lines, panels, buttons, and footer
* Added distinct splash artwork treatments for Hacker Terminal, Old Timer, Impossible Landscapes, and Occult Crimson
* Replaced leftover Midnight colors on statistic method cards, roll controls, result pools, and assignment panels with the active interface theme

## Version 0.4.33

* Removed the Delta Green parchment padding frame from redesigned Agent sheets
* Applied the selected sheet background directly to the rendered content surface with inline priority over the system parchment rule
* Added explicit dark color scheme controls for module dropdowns, options, inputs, buttons, and checkboxes when Foundry uses its Light interface or application theme
* Restored System Default backgrounds cleanly when that interface theme is selected

## Version 0.4.32

* Marked the rendered Delta Green Agent sheet content surface directly so its system parchment cannot escape the selected theme
* Removed the remaining light frame from all five redesigned Agent sheet themes
* Restored the solid themed Agent Creator title bar button

## Version 0.4.31

* Removed the remaining light system frame around themed Agent sheets
* Covered both legacy and current Foundry sheet DOM arrangements
* Matched the outer sheet surface to all five redesigned themes

## Version 0.4.30

* Expanded Character Sheet Style into a unified Agent Interface Theme preference
* Removed the remaining white system background from every redesigned Agent sheet surface
* Applied full surface coverage to Midnight Casework, Hacker Terminal, and Old Timer
* Added an Impossible Landscapes theme with sickly yellow, aged green, and distorted dossier styling
* Added an Occult Crimson theme with blackened burgundy, ritual red, and muted gold styling
* Applied the selected theme to Agent sheets, the Agent Creator, Handler setup, Handler rules, section randomizers, Veteran background settings, and Player Preferences
* Added all five redesigned themes and System Default to Player Preferences and Foundry settings
* Matched the Agent Creator sheet button to the selected personal theme

## Version 0.4.29

* Recognized creator progress made during the currently open window
* Displayed Continue Agent and Start Over immediately after navigating back to the opening screen
* Preserved the section the player departed so Continue Agent returns to the correct place
* Removed the need to close and reopen the creator before current progress is recognized

## Version 0.4.28

* Returned confirmed Start Over actions to the Agent Creator opening screen
* Kept Continue Agent focused on resuming the exact section where the player stopped
* Restored the expected choice between Build an Agent, Random Agent, and importing after restarting

## Version 0.4.27

* Saved creator progress reliably when the Agent Creator window closes
* Preserved the actual resume destination when closing from the opening screen
* Restored Continue Agent and Start Over whenever resumable progress exists
* Prevented Apply to Sheet and confirmed Start Over from recreating intentionally cleared progress
* Added visible error reporting if Foundry cannot save creator progress to the Actor
* Serialized progress writes so an older pending save cannot overwrite the latest section

## Version 0.4.26

* Preserved the saved Review destination when reopening a complete Random Agent or validated imported Agent
* Prevented resume repair from silently redirecting generated Agents to Bonds
* Made Start Over easier to see in the opening screen Status box
* Added Start Over to the Review footer for both guided and Random Agent workflows
* Kept confirmation protection anywhere Start Over is used

## Version 0.4.25

* Made profession selection update creator state immediately
* Clearing the profession now clears active profession skills, specialties, choices, and biography profession data
* Disabled every later section as soon as no profession is selected
* Prevented section navigation from restoring or displaying the previous profession after the selection is cleared

## Version 0.4.24

* Removed the general Damaged Veteran warning from the opening screen
* Replaced "complete legal Agent" with clearer player facing language
* Moved Start Over into a quiet status action so resumed creation keeps a balanced two choice layout
* Added confirmation before Start Over discards saved creator progress
* Added a contextual Randomly Assigned label to the Review screen when a complete Random Agent receives a Damaged Veteran background
* Reduced the resumed opening screen height to prevent unnecessary scrolling

## Version 0.4.23

* Made guided creation the clear primary action on the opening screen
* Gave guided and random creation equal card sizing
* Moved the Damaged Veteran disclosure into a quiet shared note beneath both choices
* Reduced the visual weight of Agent importing
* Removed the detached workflow list from the bottom of the opening screen

## Version 0.4.22

* Corrected Random Profession so it chooses only a profession during guided creation
* Kept optional professional skill choices empty until the player selects them or uses the dedicated skills randomizer
* Preserved full profession and skill generation for Complete Random Agent
* Expanded the Random Agent choice card so its Damaged Veteran notice stays inside the card

## Version 0.4.21

* Integrated the Damaged Veteran notice into the Random Agent choice card
* Removed the visually disconnected warning box
* Reduced excess opening screen spacing to eliminate the remaining default size scrollbar

## Version 0.4.20

* Attached the Damaged Veteran notice directly beneath the Random Agent choice
* Restored compact interface typography and spacing to the notice
* Removed the empty navigation footer from the opening screen
* Reclaimed enough vertical space for the opening screen to fit without unnecessary scrolling

## Version 0.4.19

* Moved Available Professions help into a compact separate popup
* Kept the question mark aligned beside the setting label
* Prevented help from moving the dropdown or expanding the setup page
* Reordered profession catalogs from Quickstart through the recommended complete catalog, with The Complex Only last

## Version 0.4.18

* Added Need to Know Free Quickstart as an available profession catalog
* Limited the quickstart catalog to its six published professions
* Renamed profession source controls to Available Professions
* Added expandable help explaining every profession catalog choice
* Kept Agent's Handbook and The Complex as the initial and recommended default

## Version 0.4.17

* Reduced the Damaged Veteran background window to match its content
* Anchored settings footers to the bottom of their windows
* Preserved internal scrolling when settings content exceeds the available space

## Version 0.4.16

* Added narrative descriptions to every configurable Damaged Veteran background
* Added concise mechanical effect tags matching the player creation cards
* Expanded the background configuration window for improved readability

## Version 0.4.15

* Added exact arrays and concise explanations to every statistic method in Handler setup
* Matched the Handler descriptions to the player facing statistic method cards
* Corrected the stale Highly Focused array displayed on the player page

## Version 0.4.14

* Removed the unnecessary scrollbar from the collapsed Handler setup splash
* Reduced the splash artwork track so the complete page footer fits at the default window size
* Preserved scrolling when recommended settings are expanded or the window is made smaller

## Version 0.4.13

* Added confirmation before replacing a complete Random Agent draft
* Added a session only option to suppress repeated reroll confirmations
* Clarified that rerolling does not alter the Actor until Apply to Sheet is used

## Version 0.4.12

* Removed the duplicate Reroll Complete Agent action from the top of Review
* Kept the single reroll action beside Apply to Sheet in the persistent footer

## Version 0.4.11

* Added a Reroll Complete Agent action to Review for Agents created through complete random generation
* Kept the reroll action out of guided and imported Agent reviews
* Added a player facing notice when complete Random Agents may receive a Damaged Veteran background
* Hid the notice when the Handler requires complete Random Agents to remain Fresh Recruits

## Version 0.4.10

* Rebuilt the Handler setup page indicators with explicit bar and label elements
* Isolated the progress controls from Foundry's global button appearance rules
* Removed the empty outlined button boxes introduced in version 0.4.9

## Version 0.4.9

* Added visible Content, Statistics, and Creation and Review labels beneath the Handler setup progress segments
* Kept every label inside its corresponding clickable and keyboard accessible navigation control

## Version 0.4.8

* Made every Handler setup progress segment clickable for direct page navigation
* Added accessible section labels, current page state, keyboard focus, and hover feedback
* Preserved page validation and draft collection when navigating through the progress control

## Version 0.4.7

* Added a transparent recommended settings preview to the Handler setup splash
* Changed the recommended Motivation requirement to zero while encouraging at least one character hook
* Added Handler control over custom professions and each Damaged Veteran background
* Added a configurable default Bond suggestion pool
* Enforced disabled profession and Veteran options throughout guided creation, random generation, and player imports
* Added clear disclosure when complete Random Agents may receive a Damaged Veteran background

## Version 0.4.6

* Anchored the Handler setup footer to the bottom of the window on every configuration page
* Removed the empty space caused by shorter setup pages collapsing around their content

## Version 0.4.5

* Added a dedicated Handler setup splash screen with original classified dossier styling
* Added clear paths to begin manual setup or review recommended settings before saving

## Version 0.4.4

Agent import and export controls now live in clearly labeled transfer panels on the opening and Review screens.

Aligned Damaged Veteran rules with the Agent's Handbook: only Things Man Was Not Meant to Know resets Breaking Point, and Hard Experience improves four skills. Restored the Pilot or Sailor specialty choice, connected profession specific biography data, and normalized creator equipment flags.

Corrected the Highly Focused statistic array, added the required Anthropology or Archeology choice, corrected the ATF Criminal Investigative Analyst suggestions, and aligned shotgun and thrown grenade equipment data with the supplied books.

### Creation workflow

* Guided creation with guarded navigation and automatic draft saving
* Complete Random Agent generation with Review before Actor application
* Handler controlled Guided, Guided plus Random, and Random only creation modes
* Agent's Handbook professions, The Complex professions, and a Custom Profession builder
* Generalist, Focused, Highly Focused, rolled, 72 point allocation, and randomized statistic methods
* Professional skill choices, typed specialties, and eight Background Skill improvements
* Background packages and Handler controlled section randomizers
* Profession accurate Bonds and configurable required Motivations
* Biography, physical description, portrait selection, and final Review
* Optional Damaged Veteran creation with exact effect previews

### Portable Agents

* Export a completed creator state as readable DGAC Agent Exchange JSON
* Copy a compact `DGAC1:` Agent Code for chat or message sharing
* Import JSON files or pasted Agent Codes into Review before Actor application
* Handler control over player imports
* Import checks for profession sources, statistic methods, Damaged Veteran availability, and complete creator validation
* A documented versioned format intended for future website and VTT integrations

See `docs/agent-exchange-format.md` for the interchange specification.

### Handler controls

* First load Handler Setup Wizard with permanent access from settings
* Allowed profession sources and fixed specialty policy
* Allowed statistic methods, default method, and roll visibility
* Required Motivations and optional Damaged Veteran availability
* Creation mode and complete Random Agent Veteran frequency
* Independent randomizer controls for guided creation
* Player Agent import policy

### Player preferences

* Character sheet style
* Opening screen preference when permitted by Handler rules
* Confirmation before applying an Agent
* Agent Creator title bar control visibility
* Expandable Tips visibility
* Compact creator layout

### Character sheet styles

* System Default
* Midnight Casework
* Hacker Terminal
* Old Timer

## Application behavior

Applying an Agent replaces creator managed statistics, standard skills, typed skills, Bonds, Motivations, biography, physical description, and Damaged Veteran adaptations. A confirmation is always shown when the Actor already contains character data.

Equipment creation is intentionally deferred and is not part of the active workflow.

## Credits

This module was informed by community Delta Green creator projects and the Delta Green Foundry system.

Delta Green is a trademark and copyright of the Delta Green Partnership. This is an unofficial fan made module and includes no rulebook PDF or artwork.
