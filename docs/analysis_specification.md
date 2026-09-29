# Herpes Pain Source Replication Analysis Specification

Version: v001
Date: 2026-09-23
Status: Locked for source replication

## 1 Purpose and lock

This specification fixes the source-data analysis rules for the replication of the randomized trial of wrist-ankle acupuncture for acute herpes zoster pain. It implements confirmed Decisions D001 through D005 and resolves the statistical implementation details required before producing the replication results.

The source-replication code must implement this specification without outcome-dependent changes. Any later change requires a new specification version, a corresponding decision-log entry, and reruns of every affected table, figure, validation result, and manifest. Updated modern analyses will be specified and reported separately after this strict replication is complete.

## 2 Frozen inputs

| Role | Project relative path | SHA 256 |
| --- | --- | --- |
| Published article | `01_Study_Design/Current/journal.pone.0318386.pdf` | `68705cb76577995f16877b105e96672308b8d55201aca8b616450d27c3c4dfd6` |
| English protocol | `01_Study_Design/Current/journal.pone.0318386.s003.docx` | `2d9fb4c3bc2c300bd4409ecba48e19aa98cae97a65e86fe7eb3ed9df055376c7` |
| Restricted participant source | `02_Data/Current/Restricted_Source/journal.pone.0318386.s004.xlsx` | `5e2f51bf004344bd3215be266c7115d8104cc26431ea89d5d9a047c0fc79edb3` |
| Deidentified working data | `02_Data/Current/Deidentified_Working/Herpes_Pain_Deidentified_Working_Data_2026-09-23_v001.xlsx` | `6decf0e070c0a3b3515dc0b9ce28d24c101aad2e55cedaa5540d7803c1b0a54f` |

The source-file manifest is `03_OMOP_Load/Current/Manifests/Herpes_Pain_Source_File_Manifest_2026-09-23_v001.tsv`. The deidentification manifest is `03_OMOP_Load/Current/Manifests/Herpes_Pain_Deidentification_Manifest_2026-09-23_v001.tsv`.

Only the deidentified working data may be used by the analysis code. The restricted workbook is used only for frozen provenance and authorized source verification.

## 3 Analysis population and treatment groups

The analysis population consists of all 106 randomized participants represented in the workbook. The observed allocation is 52 participants in the control group and 54 in the experimental group. No participant will be excluded to reproduce the protocol's planned 53 per group allocation.

The control group is the reference group. Effect measures are oriented as experimental relative to control. The risk difference is experimental risk minus control risk. The risk ratio is experimental risk divided by control risk. The odds ratio is experimental odds divided by control odds.

## 4 Source variables and derived variables

### 4.1 Pain measurements

The analysis retains baseline VAS, scheduled VAS values for days 1 through 7, and day 28. Baseline and day 1 are distinct source fields even though their values are identical for all 106 participants.

For each participant, the first observed VAS value of zero on days 1 through 7 establishes observed cure. A blank scheduled VAS value after that first observed zero is represented as a derived zero through day 7 and flagged `POST_CURE_STRUCTURAL_ZERO`. A blank before the first observed zero remains missing. If no zero is observed by day 7, every blank remains missing. Any later observed nonzero value is retained and flagged as a post-cure inconsistency rather than overwritten.

Day 28 is not structurally filled. Its observed value or missing status is retained.

### 4.2 Day 7 cure

`cure_by_day7` equals 1 when a participant has an observed VAS value of zero on any scheduled day from day 1 through day 7. It equals 0 when no zero is observed in that interval. The structural-zero rule preserves the post-cure trajectory but does not create cure without an observed zero. All 106 randomized participants receive a day 7 cure classification.

### 4.3 Dermatology Life Quality Index

Admission and discharge DLQI totals are retained as provided. Improvement is defined as:

`dlqi_change = dlqi_admission_total - dlqi_discharge_total`

A positive value therefore indicates improvement. Change is missing if either component is missing.

### 4.4 Safety outcomes

Each source adverse-event flag is analyzed as a binary variable. Gastrointestinal disorder is derived as the union of nausea or vomiting. A participant with both is counted once. No source event will be added or changed to match the publication.

## 5 Missing data

Other than the confirmed post-cure structural-zero rule, no values will be imputed. Secondary analyses use available cases for the specific variable and time point. Every table will display the analyzed denominator when it differs from the randomized group total.

The observed-only VAS sensitivity analysis excludes derived structural zeros and retains the original blanks. Missing day 28 values remain missing in every analysis. Missingness and derived-value counts will be summarized by treatment group and study day.

## 6 Descriptive statistics

Age is summarized using the arithmetic mean and sample standard deviation with denominator (n - 1). Categorical variables are summarized as count and percentage. VAS, hospitalization duration, and DLQI measures are summarized as median and interquartile range, where the interquartile range is the 75th percentile minus the 25th percentile.

Percentiles use the IBM SPSS `EXAMINE` default `HAVERAGE` convention. For ordered nonmissing values X1 through Xn, percentile p is obtained by linear interpolation at rank `(n + 1) p`, with values below rank 1 or above rank n clamped to the nearest endpoint. This convention is fixed for all medians, quartiles, and interquartile ranges.

## 7 Primary day 7 cure analysis

The primary hypothesis compares day 7 cure proportions between the experimental and control groups. The null hypothesis is equality of the two cure proportions. The primary test is a two-sided, uncorrected Pearson chi-square test with one degree of freedom at alpha 0.05. The analysis includes all 106 randomized participants.

The primary cure table will report:

- cured and not cured counts by group;
- group-specific cure rates with two-sided 95 percent Wilson score confidence intervals;
- risk difference with a two-sided 95 percent Newcombe score confidence interval without continuity correction;
- risk ratio with a two-sided 95 percent log-scale Katz confidence interval;
- odds ratio with a two-sided 95 percent log-scale Woolf confidence interval; and
- the two-sided uncorrected Pearson chi-square statistic and p value.

The following are sensitivity analyses and will be labeled separately:

- a one-sided pooled-proportion z test in the favorable experimental direction, numerically equivalent to the directional half of the Pearson result when the observed effect favors the experimental group;
- a two-sided Pearson chi-square test with Yates continuity correction; and
- a two-sided Fisher exact test.

The primary conclusion is based only on the two-sided uncorrected Pearson test. Sensitivity results will not be selected according to agreement with the publication.

## 8 Secondary source replication analyses

### 8.1 Baseline and hospitalization table

Age is compared using a two-sided pooled-variance independent-samples t test. Sex is compared using a two-sided uncorrected Pearson chi-square test. Baseline VAS, admission DLQI, and hospitalization duration are compared using two-sided asymptotic Mann-Whitney U tests with tie correction and no continuity correction.

The pooled t test is used for age because the publication displays mean and standard deviation, its methods prescribe a t test for normally distributed variables, and the published p value is reproduced by the pooled t test rather than the Mann-Whitney test. The contradictory Table 1 footnote remains recorded as a discrepancy.

### 8.2 Daily pain table

VAS is summarized for baseline or day 1, days 2 through 7, and day 28 using median and interquartile range. Days 1 through 7 use the confirmed structural-zero rule. Day 28 uses observed values only. Groups are compared at each time point using two-sided asymptotic Mann-Whitney U tests with tie correction and no continuity correction.

An observed-only sensitivity table will repeat days 1 through 7 without derived structural zeros and will show available-case denominators.

### 8.3 Dermatology Life Quality Index table

Admission DLQI, discharge DLQI, and DLQI change are summarized using median and interquartile range and compared with two-sided asymptotic Mann-Whitney U tests with tie correction and no continuity correction.

### 8.4 Safety table

Each adverse event is summarized as count and percentage by group and overall. The strict replication comparison uses a two-sided uncorrected Pearson chi-square test when at least one event is present. A two-sided Fisher exact p value is added as a sensitivity measure when any expected cell count is below 5. If both groups have zero events, no inferential p value is reported.

## 9 Multiplicity and interpretation

No multiplicity adjustment is applied to the publication-defined secondary analyses. Their p values are descriptive replication results and do not alter the primary day 7 cure conclusion. Statistical significance is evaluated at alpha 0.05 only where the specification defines a hypothesis test.

## 10 Numerical precision and presentation

Counts are reported as integers. Percentages, means, standard deviations, medians, interquartile ranges, effect estimates, and confidence limits are displayed to two decimal places. P values are displayed to three decimal places; values below 0.001 are shown as `<0.001`. Test statistics are displayed to three decimal places.

Calculations use full internal precision. Displayed values are rounded only after all calculations are complete. Published values are compared using their displayed precision rather than unrounded values that are unavailable.

## 11 Reconciliation and quality controls

The source replication package will include a reconciliation matrix for every published table value. Each item will be classified as exact, rounding compatible, method explained, or unresolved discrepancy. Source-derived values take precedence over publication values when the frozen workbook and prespecified method disagree.

Required checks include:

- 106 unique study participant identifiers and a 52 versus 54 group allocation;
- valid ranges and types for every analysis variable;
- separate counts of observed, missing, and derived VAS values by day and group;
- confirmation that cure is never created without an observed zero;
- confirmation that later observed nonzero VAS values are never overwritten;
- confirmation that baseline and day 1 VAS remain distinct but fully duplicated;
- confirmation that all output files exclude names, admission numbers, original dates, and restricted source paths; and
- independent recomputation of the primary 2 by 2 cure table and effect estimates.

## 12 Reproducibility package

The source-replication package will contain the analysis script, machine-readable result tables, formatted tables, reconciliation matrix, software and package versions, command line, start and completion timestamps, input and output SHA-256 checksums, and a run manifest. No random procedure is required for the strict analyses. If a later sensitivity analysis uses resampling, its random seed must be fixed and recorded.

The locked checkpoint will be retained before any OMOP-derived replication or updated modern analysis is reviewed.

## 13 Known discrepancies carried forward

The analysis must not force agreement with the publication where the source data differ. The controlling decision log records the protocol schedule difference, observed allocation difference, day 7 narrative conflict, cure p-value difference, vomiting-event difference, DLQI quartile and p-value inconsistencies, safety-table differences, and complete duplication of baseline and day 1 VAS.

## 14 References

IBM. PERCENTILES Subcommand for the EXAMINE Command. IBM SPSS Statistics documentation. https://www.ibm.com/docs/en/spss-statistics/31.0.0?topic=examine-percentiles-subcommand-command

Published article: `journal.pone.0318386.pdf`

English protocol: `journal.pone.0318386.s003.docx`
