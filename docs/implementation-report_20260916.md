# Compound Specimen Visualizer — Implementation Report

> implementation-report_20260916.md
> 2026-09-16
> compound-specimen-visualizer

## 1. Scope

Two pieces of work were requested:

1. Convert the scaffolded Vue project from TypeScript to plain JavaScript.
2. Build a Vue application that reads any dataset conforming to the format in
   `/data` and renders each compound specimen as a tree diagram plus supporting
   tables, resembling `docs/example-geodagi-specimen-profile_20260726.pdf`.

Both are complete. The application runs against the supplied sample dataset
(202 rows → 50 compound specimens) and against arbitrary CSV files with the same
structural columns.

---

## 2. Inputs analysed

### 2.1 The specification

`docs/specifications/compound_specimens_specification.md` defines the structure
entirely through a self-join on `id = is_part_of`:

| Rule | Implementation |
| --- | --- |
| A record with `is_part_of` set is a **specimen part** | `records.filter(r => r.isPartOf)` grouped into `childrenByParent` |
| A record with an `id` and no `is_part_of` is a top level specimen | `topLevel` in `src/lib/specimens.js` |
| A top level specimen whose `id` appears in `is_part_of` is **compound**, otherwise **simple** | `isCompound: partCount > 0` |
| Compound specimen names live in `cataloged_name` | `nodeName(record, isRoot = true)` |
| Part names live in `authoritative_name` | `nodeName(record, isRoot = false)` |

An important consequence of expressing the rule as a self-join rather than as a
two-level parent/child split: nesting is **not** limited to two levels. A part
row that also carries an `id` can itself be the parent of further parts. The
reference PDF shows exactly this — `Meta-Rodingite` → `Rodingite (Rhodingite)`
→ three minerals. The builder therefore recurses (with a visited-set guard
against cyclic `is_part_of` references) instead of doing a single join pass.

### 2.2 The sample dataset

`data/compound_specimen_sample_dataset_20260915.csv` — 202 rows, 8 columns:

```
id, is_part_of, material_category, material_subcategory,
cataloged_name, authoritative_name, verbatim_name, dataset_code
```

Observations that shaped the implementation:

- It contains four source collections (`mhngeneva`, `mnbasel`, `nmstgallen`,
  `nmbern`), which motivated the dataset filter in the sidebar.
- Name population is inconsistent between collections. `mhngeneva` populates
  `cataloged_name` on roots and `authoritative_name` on parts; `mnbasel` and
  `nmstgallen` leave the root's `authoritative_name` empty and the part's
  `cataloged_name` empty; `nmbern` leaves `material_category` empty on some
  roots. The name resolver therefore uses an ordered fallback chain rather than
  a single field, preferring the specification's field for each node type.
- All 50 top-level records in the sample are compound. The simple-specimen path
  was verified separately (see §6).
- Fan-out reaches 8 parts (`Epidot`, cat. 37884), which drove the layout work in
  §5.2.
- The file carries **no** columns beyond the minimum schema, so the "additional
  attributes" table renders an explanatory empty state for this dataset. It was
  verified against an extended file (see §6).

### 2.3 The reference profile

The PDF establishes the page contract that was reproduced:

- serif title `<name> · cat. <id>`, with a muted subtitle
  `Dataset: <code> · <n> part record(s)`;
- a bordered *Specimen hierarchy* card containing a top-down tree with
  rectangular nodes, white labels and curved arrowed links;
- colour coding: the compound specimen green, `Rock` purple, `Mineral` blue;
- a *Parent specimen record* key/value table;
- a *Parts (n)* table.

The PDF's *Names (7)* table is derived from a richer pipeline model (name type,
primary flag, remarks) that does not exist in the import dataset format, so it
is not reproduced. Its role — "everything else about the records" — is filled by
the *Additional attributes* table, which is what the brief asked for.

---

## 3. TypeScript → JavaScript conversion

| Removed | Replaced by |
| --- | --- |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `env.d.ts` | — |
| `src/main.ts`, `vite.config.ts` | `src/main.js`, `vite.config.js` |
| `typescript`, `vue-tsc`, `@vue/tsconfig`, `@tsconfig/node24`, `@types/node` | — |
| `npm-run-all2` (only needed to run `type-check` alongside `build`) | — |
| `"build": "run-p type-check \"build-only {@}\" --"` | `"build": "vite build"` |
| `<script setup lang="ts">` | `<script setup>` |

The scaffold's demo components (`HelloWorld.vue`, `TheWelcome.vue`,
`WelcomeItem.vue`, `components/icons/`) and its starter stylesheet were deleted
rather than converted, since none of them survive into the application.

Type information that was genuinely useful is retained as JSDoc comments on the
exported functions in `src/lib/`, which gives editors the same completions
without a compile step.

---

## 4. Library choices

### 4.1 d3.js — used, as requested

`d3` v7 is used for three distinct jobs:

| Module | Job |
| --- | --- |
| `d3-dsv` (`csvParse`) | RFC-4180 CSV parsing, including the quoted, comma-bearing `authoritative_name` values in the sample |
| `d3-hierarchy` (`hierarchy`, `tree`) | Reingold–Tilford tidy tree layout |
| `d3-shape` (`linkVertical`, `linkHorizontal`) | Curved link path generation |
| `d3-zoom` | Pan and zoom on the diagram |
| `d3-selection` | Binding the zoom behaviour to the `<svg>` element |

No alternative library was substituted, so no justification for one is needed.

**One deliberate deviation from idiomatic d3 is worth recording.** The usual d3
pattern (`selection.data().join()`) writes to the DOM directly, which fights
Vue's ownership of the same subtree. Instead, d3 is used purely as a *layout and
geometry engine*: `src/lib/treeLayout.js` returns plain arrays of node and link
objects, and the Vue template renders the SVG declaratively with `v-for`. The
only imperative d3 call that touches the DOM is `d3-zoom`, which needs real
event listeners and writes a single transform string back into reactive state.

This keeps node selection, hover and keyboard focus inside Vue's reactivity
system, and avoids the class of bug where Vue re-renders over d3's enter/exit
mutations.

### 4.2 Tailwind CSS v4 — responsive behaviour

Installed as `tailwindcss` + `@tailwindcss/vite`. v4 is configured in CSS rather
than in `tailwind.config.js`; the design tokens live in the `@theme` block of
`src/assets/main.css`, which makes them available both as Tailwind utilities
(`text-ink-muted`, `border-rule`) and as raw CSS variables for the scoped styles
inside components.

### 4.3 No other runtime dependencies

The full production dependency list is `vue` and `d3`. CSV parsing, layout,
colour assignment and text wrapping are all handled by those two plus about 400
lines of application code.

---

## 5. Application design

### 5.1 Structure

```
src/
  lib/
    schema.js       canonical field names, header aliasing, core/extra split
    specimens.js    CSV → specimen hierarchies (the self-join rules)
    palette.js      node colours by material category
    treeLayout.js   d3-hierarchy layout → plain render data
  components/
    SpecimenPicker.vue    sidebar: search, dataset filter, kind filter
    SpecimenProfile.vue   one specimen: title, tree, three tables
    SpecimenTree.vue      the d3 diagram
    DataTable.vue         parts + additional attributes tables
    KeyValueTable.vue     parent specimen record table
    ProfileSection.vue    section heading + spacing
  App.vue           dataset loading, selection state, layout shell
```

**Minimum schema vs. additional columns.** `schema.js` resolves the eight
canonical fields against the headers actually present, case- and separator-
insensitively, with a short alias list (for example `dataset_name` is accepted
for `dataset_code`, and `catalog_number`-style identifier columns for `id`).
Every column *not* claimed by a canonical field becomes an "additional
attribute" and is rendered in the table below the tree, per record. This is what
makes the app dataset-agnostic: it never hard-codes a column list beyond the
structural minimum.

If `id` or `is_part_of` is missing the file is rejected with a specific message
rather than rendering an empty page. Non-fatal problems — parts pointing at a
parent id that is absent from the file, rows with neither `id` nor `is_part_of`
— are surfaced as warning banners and the rest of the file still renders.

**Datasets.** Every CSV under `/data` is picked up by `import.meta.glob`, so
adding another export to that directory makes it selectable without a code
change. A file picker in the header loads any other CSV at runtime.

### 5.2 The tree diagram

Matching the reference meant a top-down tidy tree with fixed-width boxes. Three
problems needed solving beyond the plain `d3.tree()` output:

**Label wrapping.** Node labels such as
`Vesuvian (Vesuvianit) — Mineral · cat. 42335` do not fit one line. Words are
measured with an offscreen canvas 2D context using the same font as the SVG
text, then greedily wrapped to at most three lines with an ellipsis on overflow.
All nodes share one box height (the tallest label's), which keeps tree levels
visually aligned.

**Wide fan-outs.** A specimen with eight parts is ~1 900 px wide as a top-down
tree. Scaled to fit a typical column that is ~0.6×, at which point 11.5 px
labels become unreadable. The component therefore computes the vertical layout's
fit scale first and, if it falls below 0.62, re-lays the tree left-to-right
instead — where eight parts stack in a legible column. The same flip happens
unconditionally below 720 px of available width. A button lets the user override
the automatic choice in either direction.

**Small screens.** Below a scale of 0.8 the diagram stops shrinking and is
allowed to overflow its card horizontally with a scrollbar, rather than becoming
illegible. Zoom, pan (drag), zoom buttons and a "fit" reset are available at all
sizes.

Nodes are keyboard focusable and clickable; selecting one highlights the
corresponding row in the *Parts* table and vice versa.

### 5.3 Visual design

Minimalist, following the reference: white cards on a light grey canvas, 1 px
rules, no shadows, no rounded-corner flourish beyond 3–4 px.

- **Roboto** is the primary typeface (300/400/500/700).
- **Roboto Serif** is the alternate serif used for the app title and the
  specimen title, which is what gives the profile its document-like feel.
- **Roboto Mono** is used for identifiers, where column alignment and
  digit/letter disambiguation matter.

All three load from Google Fonts with `preconnect` and `display=swap`.

Colours follow the reference PDF: compound specimen `#2f7a4f`, `Mineral`
`#2f7cbf`, `Rock` `#8e3b9e`. Categories outside the fixed list (`Ore`, `Fossil`,
`Meteorite`, `Sediment` are also mapped) are assigned from a repeatable cycle,
so an unfamiliar dataset still gets stable, distinguishable colours. A legend
below the diagram names the categories actually present.

### 5.4 Responsive layout

| Width | Layout |
| --- | --- |
| ≥ 1024 px | Sidebar fixed at 310 px, sticky full-height; profile beside it |
| < 1024 px | Sidebar collapses behind a "Specimens" button, opens above the profile |
| < 720 px (diagram) | Tree flips to left-to-right |
| Any | Tables scroll horizontally inside their card rather than overflowing the page |

---

## 6. Verification

| Check | Result |
| --- | --- |
| `parseDataset` against the sample file | 202 rows → 50 specimens, 50 compound, 0 simple, 4 dataset codes, 0 warnings |
| Three-level nesting (`id` on a part row) | Renders green → purple → blue, matching the reference PDF's structure |
| Additional attributes | Extended file with `collection_code`, `institution_code`, `locality_description`, `earliest_age` → 4 columns detected, table populated per record |
| Simple specimen | Row with an `id` that nothing references → "SIMPLE SPECIMEN" badge, single node, parts table shows its empty state |
| Wide fan-out (8 parts) | Auto-flips to horizontal, labels legible at full size |
| Responsive | Verified in-browser at 390 px, 768 px and ~1500 px |
| Production build | `vite build` succeeds; 155 kB JS / 16 kB CSS (56 kB / 4.3 kB gzipped) |

The ad-hoc fixtures used during development were temporary and have been
removed. `/data` now holds the supplied sample plus
`compound_specimen_template.csv` (§8).

### Known limitation

The reference PDF's *Names* table is not reproduced, because name type, primary
flag and provenance remarks are not present in the import dataset format. If
those columns are added to a future export they will appear automatically in the
*Additional attributes* table; rendering them as a dedicated table would need a
small addition to `SpecimenProfile.vue`.

---

## 7. Template dataset

`data/compound_specimen_template.csv` is a starter file for anyone producing a
dataset for this app. Every name, catalog number, locality and institution in it
is invented; it contains no real collection data. Fourteen rows cover four
specimens, chosen to exercise each structural case:

| Specimen | Demonstrates |
| --- | --- |
| `DEMO-001` | A simple specimen — an `id` that nothing points at |
| `DEMO-002` | A flat compound specimen, plus `verbatim_name`, `material_subcategory`, and a quoted comma-bearing `cataloged_name` |
| `DEMO-003` | Three-level nesting via a part row (`DEMO-003-A`) that carries its own `id` |
| `DEMO-004` | Mixed material categories (`Ore`, `Mineral`, `Fossil`) under a second `dataset_code` |

It also carries four columns beyond the minimum schema —
`collection_code`, `institution_code`, `locality_description` and
`template_note` — so that the *Additional attributes* table is populated when
the template is opened. `template_note` doubles as inline documentation: each
row explains the rule it illustrates, and those notes are visible in the app.

`data/README.md` documents the format alongside it: which two columns are
required, which are optional, how the record types differ, and the UTF-8 and
quoting conventions.

## 8. Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle
```

To visualise a different dataset, either drop a CSV into `data/` (it becomes
selectable in the header) or use **Load CSV…** to open one at runtime. The file
needs `id` and `is_part_of` at minimum; any other columns are either mapped to
the canonical schema or shown as additional attributes. Start from
`data/compound_specimen_template.csv`.
