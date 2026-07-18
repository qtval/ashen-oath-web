# Chapter One Route and Continuity Audit

**Audit date:** 2026-07-18
**Build audited:** `6148036`
**Chapter:** The Carrion Road
**Decision:** Chapter One is structurally playable but is not yet pacing-locked, continuity-locked, or ready for final panel production.

## Method

The audit combined:

- exhaustive traversal of all 302,940 legal path combinations;
- displayed-word counts including narration, available choice labels, ending titles, and matched ending consequences;
- live browser replays of the records, witness, merchant, and authority investigation routes;
- checks of evidence custody, character availability, promise timing, delayed state use, environmental context, and panel briefs;
- browser-console inspection after the four representative replays.

The automated timing estimate assumes 190 words per minute, 12 seconds at each multi-option decision, and 2 seconds for a single continue action. A cautious first-read ceiling uses 160 words per minute, 20 seconds per decision, and 3 seconds per continue. These are planning estimates, not a substitute for timing outside players.

## Timing result

| Investigation route | Displayed words | Rendered nodes | Transitions | Estimated normal play |
| --- | ---: | ---: | ---: | ---: |
| Records | 874-963 | 15-16 | 14-15 | 6.7-7.6 minutes |
| Witness | 886-977 | 15-16 | 14-15 | 6.8-7.6 minutes |
| Merchant | 884-964 | 15-16 | 14-15 | 6.8-7.6 minutes |
| Authority | 870-950 | 15-16 | 14-15 | 6.7-7.5 minutes |

Even the cautious first-read model remains around 9.5-10.3 minutes. Scene transitions, final artwork, and tap pacing may add weight, but they cannot responsibly turn this amount of story into the intended 20-30 minute chapter.

**Pacing verdict:** the chapter is roughly one-third to one-half of its target duration. The correction must add purposeful dramatic beats, world pressure, and state payoffs. It must not pad existing dialogue or slow the interface to disguise missing content.

## What already works

- The opening establishes rain, checkpoint authority, Orl's packet, and immediate distrust quickly.
- Meret, Tavin, and Sella have distinct voices and incompatible needs.
- The four investigation routes reveal genuinely different combinations of evidence.
- Missing folio, strap, warrant, or testimony is generally remembered rather than silently restored.
- Scene 12 makes evidence custody a player decision instead of an abstract score.
- Scene 13 always charges a civilian cost.
- The four endings state compromises rather than victory or defeat and correctly retain multiple categories of remembered state.
- All representative routes completed in the live browser without console errors.
- All 40 nodes have distinct environmental panel descriptions, although they still use one shared placeholder image.

## Priority findings

### P0 - Repair before pacing expansion or final art

#### 1. Tavin's physical continuity can break

If Garren abandons Tavin at the axle, the lockdown says Tavin vanished into the crowd. The records route then places Tavin in a private evidence scene without showing how he was found. The player can give the case to him and unlock the chapel ending while `tavin_status` still says `abandoned`.

Related cases:

- a captured Tavin can move from Meret's cage to the culvert without an authored release beat;
- a hidden or bargaining Tavin is treated as present in some shared scenes and absent in others;
- Scene 13 says Tavin draws breath to accuse someone even when he previously vanished;
- custody of proof can make the chapel route available without proving that Tavin is physically available.

**Required correction:** author explicit recovery, transfer, release, or absence variants. Gate testimony, evidence handoff, culvert escape, and chapel access using both proof custody and Tavin's physical state. No branch may restore him off-page.

**Resolved:** Chapter One now preserves a separate authored escape-access state. Captured, hidden, bargaining, and abandoned routes receive distinct testimony/contact text; unavailable Tavin routes cannot take the witness investigation, receive proof, use the culvert, or reach the chapel. Formal custody is the explicit transfer that can move a captured or returned Tavin into protection.

#### 2. The political consequence of the truth is not dramatized

The project question asks whether truth is worth protecting if disclosure begins another war, but the playable chapter never makes the threatened war concrete. The player learns that Red Hollow was arranged, not who benefits from the official story, who would mobilize after disclosure, or why the refugees and checkpoint are politically connected to that danger.

**Required correction:** add at least one purposeful world-pressure beat before evidence distribution. It should identify the human group or political actor likely to answer disclosure with violence, without turning the story into a lore lecture.

**Resolved:** A reprisal courier now brings a village list before the investigation begins. The scene establishes that the Chancellor's peace depends on blaming the Bracken lords for Red Hollow, that their levies can void the truce and mobilize within a day, and that Bracken refugee families inside the checkpoint are already being sorted as hostages. Garren's choice to delay the sorting or warn the families returns in the clearing crisis and its immediate aftermath.

#### 3. The 20-30 minute target is not met

Current routes contain about 900 displayed words and 10-12 multi-option decisions. Reaching the target will likely require several additional situation changes and roughly two to three times the present playable substance, subject to human timing.

Good candidates for expansion are:

- the social cost of the failed war while Garren waits at the checkpoint;
- a concrete consequence of Garren's former interrogation work;
- a route-specific obstacle between discovery and evidence assembly;
- a principal character reacting to the player's earlier treatment rather than only changing a number;
- a short pressure beat that makes the threatened renewed war tangible;
- a pre-crisis attempt by the superior's agents to recover or destroy one specific proof.

Each addition must change information, leverage, access, custody, or a relationship. Do not split existing sentences into extra clicks merely to increase duration.

**Expansion progress:** The reprisal roll now makes renewed war and its civilian hostages concrete. Perrin Dask now recognizes Garren's interrogation cadence and asks him to recover his daughter's travel slate; the player's answer changes public pressure, later civilian action, and Garren's exposure at the open-gate oath. Outside timing is still required before this finding can be closed.

### P1 - Repair during the structural expansion

#### 4. Several remembered relationship states are inert

`tavin_trust`, `tavin_fear`, `meret_trust`, `meret_suspicion`, `sella_trust`, `meret_guilt_named`, `sella_tip_known`, and `civilian_pressure` are recorded but do not currently gate a later choice or select ending prose. They preserve intent in the schema without consistently paying the player back.

**Required correction:** use a small number of authored thresholds or categorical conversions at Scenes 12-14. Relationships should change dialogue, cooperation, evidence access, or the price of a crisis option. Do not expose the numbers.

#### 5. Sella's promise can become `kept` too early

Accepting Sella's terms during the merchant or witness investigation marks the promise `kept` before her wagon or dependents have passed the checkpoint. Later routes may therefore describe passage as already honored even when the crisis choice did not provide it.

**Required correction:** distinguish `renewed` or `binding` from `kept`. Mark the promise kept only when the wagon passes or the selected ending explicitly fulfills it.

#### 6. The clerk approach has no delayed informational payoff

Watching the clerk exchange orders unlocks “Follow the clerk's paper trail,” but that choice immediately reconverges at the same search table without revealing a clerk, document path, or later access advantage. The ditch approach, by contrast, unlocks Tavin's crisis escape.

**Required correction:** let clerk knowledge expose a seizure entry, identify the superior's courier, preserve a copy, or alter the warrant-destruction option later.

#### 7. Warrant access is occasionally implied rather than earned

“Destroy the warrant where the crowd can hear it” is always offered in the crisis, including routes where `search_warrant_status` remains `unseen`. The action may be plausible once the superior's order arrives, but the transfer into Garren's hands is not shown.

**Required correction:** add an authored public reveal/seizure beat or gate the action by actual warrant access, with a different public-defiance option for routes that never obtained it.

#### 8. Some evidence transfers occur only as state changes

Choosing the authority route can move Orl's packet from Sella's collateral to Meret without an explicit handoff. Decoy choices consistently treat Orl's packet as the strongest proof even when another item may be more important to that route.

**Required correction:** narrate material transfers and define what the decoy contains versus what each custodian actually receives.

### P2 - Address after story continuity is locked

#### 9. The shared open-gate panel hides visible branch consequences

Scene 13 has distinct outcome briefs for detained refugees, the culvert escape, the wagon breakthrough, and the riot. Scene 14 then reconverges on one neutral threshold description. The composition should retain visible evidence of the paid civilian cost.

**Required correction:** create conditional Scene 14 panel briefs, or four panel variants, before the shot list is locked.

#### 10. World context remains too thin for the requested inhabitable setting

The chapter needs concise context for the refugees, the Crown's checkpoint powers, Orl's importance to Garren, and the political mechanism by which Red Hollow could restart war. Context should arrive through material conditions, overheard orders, documents, and character needs rather than encyclopedia narration.

## Route notes

### Records

Strongest chronological case: ration manipulation plus Tavin's twelve minutes. The major defect is Tavin reappearing after abandonment without a recovery beat.

### Witness

Strong character triangle: Tavin's confession, Sella's betrayal, and the courier strap. Captured-to-culvert movement needs a visible release or rescue action.

### Merchant

Sella's motive and the present cover-up are clear. Promise timing must be separated from actual fulfillment, and the route needs a consequence if Garren uses her tip against her.

### Authority

Meret's guilt, self-deception, and institutional compromise land well. The clerk approach needs a real payoff, and packet transfers into Meret's chain need to occur on-page.

## Panel readiness

- Distinct panel briefs: 42
- Explicit final panel images: 0
- Current image treatment: one shared atmospheric placeholder
- Shot-list readiness: blocked by the remaining P0 pacing work and P1 story corrections

Do not commission or generate the complete panel set yet. Pacing expansion and conditional crisis/open-gate variants may add, remove, or split situations. After those are locked, convert every surviving node and material state variant into the permanent shot list requested by the project owner.

## Acceptance decision

Milestone 0.3 is **not yet accepted** despite the complete beat-sheet implementation. The structure, state model, and endings are strong enough to continue, but the chapter misses its duration target and contains continuity/state-payoff defects that would be expensive to illustrate around.

## Exact next task

**Repair Sella's promise timing.**

Accepting Sella's terms during the merchant or witness investigation must record a renewed or binding promise, not a kept one. Mark it kept only when her wagon passes or an ending explicitly fulfills the bargain. Update every affected conditional consequence and test the timing across all routes without adding dialogue, scenes, or final art.
