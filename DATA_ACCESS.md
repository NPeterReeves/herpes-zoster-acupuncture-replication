# Source data access

The participant-level source data for this replication are published by Pu and colleagues as **S4 Data: Raw Data (XLSX)** with their PLOS ONE article:

- [Publisher-hosted S4 Raw Data (XLSX)](https://doi.org/10.1371/journal.pone.0318386.s004)
- [Read the article and its Supporting information section](https://doi.org/10.1371/journal.pone.0318386)

On the article page, scroll to **Supporting information → S4 Data. Raw Data** to download the workbook. The S4 DOI is the stable source link; this repository does not host a copy of the participant rows.

**Citation:** Pu J, Li D, Luo X, et al. (2025). Wrist-ankle acupuncture alleviates pain in the acute phase of herpes zoster: A randomized controlled trial. *PLOS ONE* 20(5): e0318386. https://doi.org/10.1371/journal.pone.0318386

## Using the data with this replication

Keep the downloaded workbook outside the GitHub repository. It contains participant-level records, including original date and admission fields. The [deidentification script](analysis/Herpes_Pain_Deidentification_Script_2026-09-23_v001.py) documents the transformation used to create a separate working file; the [analysis specification](docs/analysis_specification.md) defines the statistical rules. The [aggregate results](results/) and [analysis code](analysis/) are available here without redistributing participant rows.

The locked source analysis verifies the exact SHA-256 of the governed transformed workbook. A fresh transformation can produce a different XLSX file hash even when its cell values match, so the published code and source link do not form an automatic one-command rerun. See the [README](README.md#data-access-and-rerunning-the-analysis) for the example commands and this limitation.
