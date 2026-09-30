# Exploratory first-week VAS trajectory analysis

This package supplements the governed source replication. It does not alter the prespecified primary day-7 cure comparison. No participant-level data or identifiers are packaged.

## Estimand and method

- Participants: all 106 randomized (52 medication alone, 54 WAA plus medication).
- Input: approved deidentified working workbook with SHA-256 `6decf0e070c0a3b3515dc0b9ce28d24c101aad2e55cedaa5540d7803c1b0a54f`.
- Outcome: trapezoidal area under each participant's day-1 to day-7 VAS trajectory at equal one-day spacing. The seven ratings span six between-assessment intervals, so units are VAS score-days. Day 1 equals the separate baseline VAS for all participants. The original protocol recorded worst pain in the prior 24 hours, so this is a summary of repeated worst-pain ratings, not directly observed integrated pain intensity.
- Missingness: after the first documented zero, a blank daily score through day 7 is derived as zero under the already governed structural-zero rule. All 50 originally blank week-one cells meet this rule; no pre-cure blanks remain. Derived zeros are not source observations.
- Contrast: WAA plus medication minus medication alone; negative differences favor WAA.
- Unadjusted inference: Welch two-sample t interval and test of participant AUCs. The baseline-adjusted model is OLS AUC ~ arm + baseline VAS, with HC3 robust standard errors and t reference with 103 degrees of freedom. A stratified 10,000-resample percentile bootstrap (seed 20260930) is an interval sensitivity check.
- A simple arithmetic mean of the seven daily ratings and a days-2-to-7 mean provide alternate summaries. All these tests are exploratory and post hoc; no multiplicity adjustment is claimed.

## Aggregate result

| Measure | Medication alone | WAA plus medication | WAA minus control |
|---|---:|---:|---:|
| Day-1-to-7 AUC (VAS score-days), mean (SD) | 19.35 (4.84) | 15.70 (5.47) | -3.64 (95% CI -5.63 to -1.65; Welch p=0.00044) |
| AUC, adjusted for baseline VAS | — | — | -4.20 (HC3 95% CI -5.63 to -2.77; p<0.000001; bootstrap 95% CI -5.59 to -2.84) |
| Arithmetic mean of day-1-to-7 daily VAS | 3.18 | 2.65 | -0.53 (95% CI -0.84 to -0.21; Welch p=0.0014) |

Hedges' g for unadjusted AUC is -0.70. The adjusted model's coefficient and the group means answer different, complementary questions; neither isolates a needling-specific mechanism or measures actual analgesic use.

## Reproduce

With `openpyxl`, `numpy`, and `scipy` available:

```bash
python Herpes_Pain_First_Week_VAS_Burden_2026-09-30_v001.py \
  --input /path/to/Herpes_Pain_Deidentified_Working_Data_2026-09-23_v001.xlsx \
  --output ./aggregate_results.json
```

The script checks the input checksum and population, does not modify the workbook, and writes aggregate JSON only. It does not export participant records.

## Interpretation and limits

The result supports lower reported worst-pain scores during the acute treatment week for the WAA plus medication strategy. It cannot distinguish needling-specific effects from attention, expectation, or other contextual contributions because this open-label trial has no matched sham/attention arm. The day-28 measurement is too early to establish prevention of postherpetic neuralgia. Because participants were randomized after illness began and received medication, a fall in either arm cannot be equated with untreated natural history.

Relevant sources: Pu et al., *PLOS ONE* 2025, doi:10.1371/journal.pone.0318386; CDC, [Shingles Symptoms and Complications](https://www.cdc.gov/shingles/signs-symptoms/index.html); Drolet et al., *CMAJ* 2010, doi:10.1503/cmaj.091711; Wood et al., *J Antimicrob Chemother* 1995, doi:10.1093/jac/36.6.1089.
