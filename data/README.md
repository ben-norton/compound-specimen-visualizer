# Dataset format

Every `.csv` in this directory is bundled at build time and appears in the
dataset picker in the app header. `compound_specimen_template.csv` is a
fictional starter file — copy it, replace the rows, keep the header.

All names, catalog numbers, localities and institutions in the template are
invented. It contains no real collection data.

## Required columns

| Column | Required | Purpose |
| --- | --- | --- |
| `id` | yes | Identifier of a top level specimen, or of a part that is itself a parent. Leave blank on leaf parts. |
| `is_part_of` | yes | The `id` of this record's parent. Blank on top level specimens. |

The hierarchy is built entirely from the self-join `id = is_part_of`, so those
two columns must exist even when every value in one of them is blank.

## Optional columns

| Column | Purpose |
| --- | --- |
| `material_category` | `Mineral`, `Rock`, `Ore`, `Fossil`, … — drives node colour and the legend |
| `material_subcategory` | Free text, shown in the parts table |
| `cataloged_name` | Name of a top level specimen |
| `authoritative_name` | Name of a part |
| `verbatim_name` | Label text, when it differs from the accepted name |
| `dataset_code` | Source collection; becomes an entry in the dataset filter |

Any other column — `collection_code`, `locality_description`, whatever your
export produces — is shown in the **Additional attributes** table beneath the
diagram, per record. Nothing needs to be declared in advance.

## Record types

```
id        is_part_of   meaning
--------  -----------  -------------------------------------------------------
DEMO-001  (blank)      top level specimen; simple if no row points at it,
                       compound if some row's is_part_of equals its id
(blank)   DEMO-002     leaf part
DEMO-003  (blank)      top level specimen
DEMO-003A DEMO-003     part that carries its own id, so it can parent further
                       parts — this is how trees deeper than two levels are built
```

The template exercises all four: one simple specimen, one flat compound
specimen, one nested three levels deep, and one mixing material categories
across two `dataset_code` values.

## Conventions

- Save as **UTF-8**. Diacritics in mineral names are common and will otherwise
  be mangled.
- Quote any field containing a comma, the usual CSV way:
  `"Placeholderite, Exemplar, Mockstone"`.
- Header names are matched case- and separator-insensitively, and a few aliases
  are accepted (`dataset_name` for `dataset_code`, `parent_id` for
  `is_part_of`). See `src/lib/schema.js` for the full list.
- A part whose `is_part_of` matches no `id` in the file is reported as a warning
  banner; the rest of the file still renders.
