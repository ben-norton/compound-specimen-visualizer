# compound-specimen-visualizer
A visualization app for compound specimens in geology collections

Compound specimen records from collections databases are flat tables in which a
single physical object is described across several rows, linked by the self-join
`id = is_part_of`. This app reads such a table and, for each specimen, draws the
hierarchy as a tree and lists the underlying records as tables — a specimen
profile in the style of `docs/example-geodagi-specimen-profile_20260726.pdf`.

## What it shows

For the selected specimen:

- **Specimen hierarchy** — a tree diagram, coloured by material category, with
  zoom, pan and an orientation toggle.
- **Parent specimen record** — the top level record, field by field.
- **Parts** — every part record, with its material category and parent.
- **Additional attributes** — any column beyond the minimum schema, per record.

The sidebar lists all specimens in the file, with search and filters for source
collection and for compound vs. simple specimens.

## Requirements

Node.js `^22.18.0` or `>=24.12.0`.

## Running it

```sh
npm install
npm run dev
```

Then open the URL Vite prints, normally <http://localhost:5173>.

To build and check a production bundle:

```sh
npm run build     # output in dist/
npm run preview
```

## Loading data

Every `.csv` in `data/` is bundled at build time and appears in the dataset
picker in the header. Any other CSV can be opened at runtime with **Load CSV…**
— nothing is uploaded, the file is read in the browser.

A dataset needs `id` and `is_part_of` at minimum. The other fields of the
compound specimen schema are used when present, and any remaining column is
shown in the *Additional attributes* table.

`data/compound_specimen_template.csv` is a fictional starter file covering each
structural case; copy it and replace the rows. `data/README.md` documents the
format.

## Project layout

```
data/     datasets, plus the template and format notes
docs/     specification, reference profile, implementation report
src/lib/  CSV parsing, the self-join rules, tree layout, colours
src/components/
```

## Stack

Vue 3 (`<script setup>`, plain JavaScript), Vite, d3 v7 for CSV parsing and tree
layout, Tailwind CSS v4, Roboto with Roboto Serif for titles.

## Further reading

- `docs/specifications/compound_specimens_specification.md` — the data model
- `docs/implementation-report_20260916.md` — how the app is built and why
