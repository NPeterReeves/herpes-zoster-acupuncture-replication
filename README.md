# Independent replication: wrist-ankle acupuncture for acute herpes zoster pain

QiBo Institute analyzed the participant-level supporting data for the randomized trial by Pu and colleagues and compared aggregate results with the published report. This repository contains analysis code, aggregate outputs, methods, an OMOP reconciliation record, and a public presentation. It contains **no participant-level workbook or OMOP row export**.

**Original study:** Pu J, Li D, Luo X, et al. (2025). *Wrist-ankle acupuncture alleviates pain in the acute phase of herpes zoster: A randomized controlled trial.* PLOS ONE 20(5): e0318386. [Article](https://doi.org/10.1371/journal.pone.0318386) · [Publisher-hosted S4 Raw Data](https://doi.org/10.1371/journal.pone.0318386.s004) · [English protocol](https://doi.org/10.1371/journal.pone.0318386.s003). This independent analysis has not been endorsed by the study authors.

## Main comparison

The locked analysis includes all 106 randomized participants and defines day-7 cure as a VAS pain score of zero by day 7. A blank daily VAS after an observed zero is treated as a derived structural zero through day 7; the original blank is preserved in the working data. The primary test is two-sided, uncorrected Pearson chi-square.

| Result | Medication alone | Wrist-ankle acupuncture + medication |
| --- | ---: | ---: |
| Cured by day 7 | 34/52 (65.38%) | 47/54 (87.04%) |

Risk difference: **21.65 percentage points** (95% CI 5.44–36.73); Pearson χ² = **6.8911**, **p = 0.008662**. The group rates reproduce the article. Its abstract and results text state p < 0.005, while [Figure 3](https://doi.org/10.1371/journal.pone.0318386.g003) displays p = 0.009, consistent with the rounded two-sided replication. Other differences are itemized in [reconciliation.csv](results/reconciliation.csv); they should be interpreted alongside the article and analysis specification rather than called errors without adjudication.

The read-only OMOP analysis recorded agreement with the eight governed aggregate output tables in [omop_reconciliation.json](results/omop_reconciliation.json). This checks the database-to-analysis path; the OMOP script intentionally reuses the source analysis functions for statistics. The separate DQD run **did not pass overall**: among 2,374 checks, 669 passed, 28 failed, and 708 had execution errors (including checks also marked not applicable). See [interpretation and limits](docs/interpretation_and_limits.md).

## Repository contents

| Location | Contents |
| --- | --- |
| [`analysis/`](analysis/) | Deidentification, locked source analysis, read-only OMOP analysis, and optional result-workbook builder |
| [`results/`](results/) | Eight aggregate CSV tables, analysis metadata, result workbook, and aggregate OMOP reconciliation JSON |
| [`docs/`](docs/) | Locked analysis specification and interpretation/quality limits |
| [`provenance/`](provenance/) | Original aggregate-only source package and its file-checksum manifest |
| [`presentation/`](presentation/) | Public PowerPoint summary with an editable next-study table |
| [`DATA_ACCESS.md`](DATA_ACCESS.md) | Publisher-hosted source-data link, citation, and access instructions |

## Data access and rerunning the analysis

See [DATA_ACCESS.md](DATA_ACCESS.md) for the publisher's source-data link, citation, and download instructions. Obtain the original participant workbook from the [publisher's S4 link](https://doi.org/10.1371/journal.pone.0318386.s004). Keep it outside this repository. The source workbook includes pseudonymized participant rows and original date/admission fields; neither it nor the transformed participant workbook is redistributed here. The [deidentification script](analysis/Herpes_Pain_Deidentification_Script_2026-09-23_v001.py) builds a separate approved-field workbook and removes those fields.

The analysis was run with Python 3.12.14, NumPy 2.3.5, SciPy 1.17.0, and `openpyxl` (version not recorded). Example commands after installing those packages:

```bash
python3 analysis/Herpes_Pain_Deidentification_Script_2026-09-23_v001.py \
  --source /private/path/journal.pone.0318386.s004.xlsx \
  --output /private/path/Herpes_Pain_Deidentified_Working_Data.xlsx

python3 analysis/Herpes_Pain_Source_Replication_Analysis_2026-09-23_v001.py \
  --input-xlsx /private/path/Herpes_Pain_Deidentified_Working_Data.xlsx \
  --output-dir /private/path/reproduced_analysis
```

The locked source script checks the exact SHA-256 of the governed transformed XLSX. A newly written XLSX can have a different file hash even when cell values agree. Therefore the second command may stop at its integrity check; verify the transformation and variable-level equivalence before changing that pin in a separately documented rerun. The public package supplies the code and outputs but is **not a one-command replay** from the publisher download.

The OMOP script additionally requires a locally loaded study CDM or its restricted row-level export. Neither is in this repository. The recorded JSON documents a prior read-only database run. The optional workbook builder requires `@oai/artifact-tool`, which is not provided as a public dependency; the completed aggregate workbook is supplied under `results/`.

The aggregate-only ZIP in `provenance/` is unchanged from the governed 23 September 2026 package. Its SHA-256 is `a5d1b670012f1d2f70c210d5c859b4dd331cbf654e92c1463e03dfd764d898fd`; the accompanying manifest checks its individual files. The ZIP is retained because the locked OMOP comparison verifies this exact package hash.

## Attribution and reuse

The original article and supporting material are © Pu et al. and published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); cite the authors and publisher when using them. QiBo prepared the analysis code, summaries, and presentation independently. No outbound license has yet been selected for QiBo-created code or materials. See [NOTICE.md](NOTICE.md).
