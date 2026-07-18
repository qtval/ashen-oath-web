# The Ashen Oath - Living Roadmap

> Product goal: a portrait-first, choice-driven dark fantasy visual novel. It should feel like walking through an illustrated world where every promise, lie, and act of mercy can return later with a cost.

## How we use this document

- This is the project's source of truth for priorities and progress.
- We work on one small, testable task at a time. A task moves to done only after it works in the live browser preview.
- We update this document whenever a milestone changes status or we deliberately change scope.
- We protect the core: atmosphere, distinct characters, meaningful choices, and a smooth mobile reading experience matter more than extra systems.

## Product principles

1. **World before interface.** Each scene is a full-screen monochrome environmental panel. The player should feel the weather, architecture, distance, and tension before reading a word.
2. **Choices, not morality points.** Choices represent competing motives and imperfect information. We do not label options as good, evil, optimal, or plus-five trust.
3. **Consequences have memory.** Important actions affect people, evidence, faction pressure, access, and later scenes - not merely the next line of dialogue.
4. **Characters are people, not quest dispensers.** Every major character has a public goal, a private fear, a self-deception, and a breaking point.
5. **Mobile is the primary screen.** Portrait layout, one-thumb controls, legible type, fast resume, and calm interruption handling are requirements, not polish.
6. **Original work only.** We may learn from great grim fantasy and narrative games, but we do not copy their characters, plots, dialogue, factions, or visual identities.
7. **Web game first, Android last.** We design and test for phone screens throughout development, but we do not package or ship the Android app until the complete browser game has passed full-game testing and content lock.

## Current status

**Current milestone:** 0.2 - Immersive visual-novel reader  
**Playable preview:** https://qtval.github.io/ashen-oath-web/  
**Current chapter:** The Carrion Road - the checkpoint opening

Completed so far:

- Browser-first repository and live GitHub Pages preview
- JSON-driven branching story reader with local saves and restart
- Opening checkpoint narrative prototype with hidden state and endings
- First full-screen monochrome atmospheric-panel direction
- Repository-wide text-encoding validation to prevent corrupted punctuation

## Milestone 0.2 - Immersive visual-novel reader

**Purpose:** Make the basic interaction feel like a visual novel rather than a website.

- [x] Full-bleed scene layout with choices as a minimal overlay
- [x] Touch-friendly choice targets and local save/restart
- [x] First atmospheric checkpoint panel integrated as a visual reference
- [ ] Confirm the full-screen layout on a real phone and a narrow desktop window
- [ ] Add a gentle scene transition that respects reduced-motion settings
- [ ] Add tap-to-continue pacing for narration before choices appear
- [ ] Add a compact Settings screen: text size, reduced motion, restart confirmation
- [ ] Add an accessible Chronicle that shows only facts the current protagonist knows

**Done when:** the opening is comfortable to read and control on a phone, visually atmospheric, accessible, and stable after refresh or resume.

## Milestone 0.3 - Chapter One script and consequence design

**Purpose:** Turn the checkpoint prototype into a coherent 20-30 minute chapter.

- [ ] Write the Chapter One beat sheet: 15-20 scenes, each with purpose, location, choice, and consequence
- [ ] Define Garren Vale's voice, contradiction, and arc for this chapter
- [ ] Finalize Captain Meret, Tavin, and Sella Venn: goals, secrets, loyalties, and breaking points
- [ ] Establish the Red Hollow mystery and the sealed-letter evidence trail
- [ ] Replace placeholder routes with deliberate branches and reconvergences
- [ ] Ensure each route contains at least one delayed consequence
- [ ] Write 3-5 distinct Chapter One endings that state the cost, not a win/lose result
- [ ] Add automated validation for broken links, missing art references, and invalid requirements

**Done when:** a first-time player can finish in 20-30 minutes, understands the immediate conflict, and wants to replay to see consequences they missed.

## Milestone 0.4 - Art and sound vertical slice

**Purpose:** Make Chapter One feel like a finished interactive graphic novel.

- [ ] Create an art bible: ink treatment, grayscale range, camera distance, weather, architecture, and no-protagonist-close-up rules
- [ ] Create a shot list for every Chapter One scene
- [ ] Produce a separate environment-first monochrome panel for each key scene
- [ ] Add subtle panel motion: rain, fog, embers, or camera drift only where it strengthens the scene
- [ ] Add an atmospheric sound palette: rain, wheels, wood, distant bells, crowd murmur, silence
- [ ] Add a small adaptive music set for tension, discovery, betrayal, and aftermath
- [ ] Add captions and independent volume controls

**Done when:** Chapter One can be played with sound on or off and still lands emotionally; art, text, and sound tell the same story.

## Milestone 0.5 - One-hour playable vertical slice

**Purpose:** Prove that the game can hold attention beyond one chapter.

- [ ] Expand from Chapter One into roughly one hour of connected play
- [ ] Add the ruined chapel / Red Hollow follow-up arc
- [ ] Introduce the first faction conflict and a consequence from the checkpoint decision
- [ ] Add evidence, relationship, and promise records to the Chronicle
- [ ] Add at least one scene where a past small choice changes dialogue or access unexpectedly
- [ ] Add complete save migration and a clean new-game flow
- [ ] Conduct a small outside playtest and record confusion, drop-off, and favourite moments

**Done when:** players understand the game's identity, stay engaged for an hour, and can describe a decision that felt personally theirs.

## Milestone 0.6 - Full-game blueprint and production readiness

**Purpose:** Turn the successful vertical slice into a deliberately scoped plan for the complete game.

- [ ] Define the target playtime, chapter count, principal routes, and ending structure
- [ ] Complete the full-story beat sheet and consequence map before drafting every scene
- [ ] Finalize the essential cast, factions, locations, lore boundaries, and character arcs
- [ ] Establish the repeatable writing, story-data, artwork, sound, validation, and review pipeline
- [ ] Test offline loading, refresh, interrupted sessions, corrupted saves, and save migration
- [ ] Add loading, missing-art, and missing-story fallback states
- [ ] Establish version numbers, changelog discipline, content notes, and accessibility standards

**Done when:** the complete game has a controlled scope, coherent narrative plan, reliable production pipeline, and no unresolved structural questions that would force major rewrites later.

## Milestone 0.7 - Full-game production

**Purpose:** Write, implement, illustrate, and score the complete game in the browser build.

- [ ] Write and implement every planned chapter
- [ ] Complete all principal routes, reconvergences, delayed consequences, and endings
- [ ] Integrate final environment panels, sound design, music, and interface presentation
- [ ] Maintain character, lore, geography, chronology, and consequence continuity across the full story
- [ ] Replace all temporary story, artwork, audio, and interface placeholders
- [ ] Validate every chapter and complete every reachable route in the browser build

**Done when:** the entire intended game is playable from beginning to ending in the browser, with final content rather than prototype placeholders.

## Milestone 0.8 - Full-game beta, polish, and content lock

**Purpose:** Prove that the complete game is finished before any Android packaging begins.

- [ ] Recruit outside players who were not involved in development
- [ ] Test complete playthroughs, endings, save migration, refresh, interruption, and recovery
- [ ] Test portrait layouts across common phone widths, devices, and text-size settings
- [ ] Complete accessibility, proofreading, performance, image compression, and audio balancing passes
- [ ] Record and fix confusion, pacing problems, continuity errors, technical failures, and weak choices
- [ ] Remove all release-blocking defects and explicitly lock the story and asset scope
- [ ] Create a final browser release candidate and complete the full-game release checklist

**Done when:** the complete browser game has passed external playtesting, contains no known release blockers or placeholders, and is formally content-locked.

## Milestone 0.9 - Android packaging and device verification

**Entry gate:** This milestone cannot begin until Milestone 0.8 is complete and the full game is content-locked.

**Purpose:** Package the finished browser game for Android without changing its product scope.

- [ ] Choose the final packaging path based on the finished game's requirements
- [ ] Create the Android project and signing plan; never store signing keys in the repository
- [ ] Test Android back behaviour, safe areas, performance, save persistence, installation, updates, and audio focus
- [ ] Fix platform-specific defects without introducing new game features or story scope
- [ ] Produce internal APK and Android App Bundle release candidates

**Done when:** the packaged Android game faithfully matches the locked browser release and works reliably on representative physical Android phones.

## Milestone 1.0 - Google Play closed test and launch preparation

**Purpose:** Validate the finished Android package and prepare an honest public release.

- [ ] Run a Google Play closed test with outside players
- [ ] Track completion, return sessions, crashes, technical failures, and player feedback
- [ ] Fix release-blocking Android defects and reverify the locked game
- [ ] Prepare the icon, screenshots, feature graphic, description, privacy policy, and content rating
- [ ] Finalize pricing or monetization only after the complete game is enjoyable
- [ ] Approve the final release candidate and store listing

**Done when:** the finished game has a stable Android release candidate and a complete, accurate Google Play submission.

## Explicitly deferred

These are not current work:

- Combat systems
- Open-world map exploration
- Multiplayer, accounts, or cloud saves
- Ads, battle passes, or aggressive monetization
- Character creator
- Multiple playable protagonists before Garren's first arc works
- Android packaging, signing, APK/AAB creation, and store work until the complete browser game is content-locked
- iOS release until the finished Android release is proven

## Immediate next task

**Finish Milestone 0.2's real-phone layout check, then create the Chapter One beat sheet.**

That beat sheet will be the bridge from a good-looking prototype to a deliberate, playable chapter.
