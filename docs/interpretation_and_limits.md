# Interpretation and data-quality limits

## Published report versus source replication

The article's day-7 cure rates (87.04% versus 65.38%) match the supplied participant workbook. Under the locked two-sided, uncorrected Pearson test, the independent result is p = 0.008662. The article's abstract and results text say p < 0.005, while its Figure 3 displays p = 0.009. The figure is compatible with the rounded independent result. The prespecified threshold of 0.05 is met either way.

The [13-row reconciliation table](../results/reconciliation.csv) also records differences in selected DLQI, safety, and baseline values. They have not all been explained by access to the original authors' analysis code, so the table distinguishes exact matches, compatible rounding, and unresolved differences. No source observations were changed to force agreement.

## Source and OMOP analyses

The source analysis applied the documented post-cure structural-zero rule to daily VAS through day 7. The observed-only sensitivity is in [`vas_observed_only_sensitivity.csv`](../results/vas_observed_only_sensitivity.csv), and counts of observed, derived-zero, and unresolved values are in [`vas_missingness_qc.csv`](../results/vas_missingness_qc.csv). Day 28 remains observed-only.

The live read-only OMOP reconciliation record reports 106 persons, 1,116 observed measurements, 106 core pain-duration observations, 2,968 linked source-audit rows, and 212 cohort rows. It records all eight aggregate tables as exact or numerically equivalent to the locked source package. The OMOP analysis verifies record joins and data representation but calls the same statistical functions as the source script, so it is not an independent statistical reimplementation.

Treatment assignment was available; actual delivered acupuncture and medication exposure were not verified at the participant level. Treatment procedures, drug exposures, or dated safety events should not be inferred merely from randomization. The project-specific CDM therefore has important clinical provenance limits.

## Data Quality Dashboard

The V003 Data Quality Dashboard report ran 2,374 checks. A mutually exclusive accounting is 669 passed, 28 failed, 50 execution errors without an inapplicable flag, 658 execution errors also marked inapplicable, and 969 inapplicable without an error. Thus 708 checks had execution errors and 1,627 carried inapplicable flags; the categories overlap by 658. Of the 697 checks completed with a pass/fail result, 669 passed (95.98%). This is **not an overall CDM pass rate**.

Fourteen CDM tables absent from the study-specific project account for all 708 execution errors and 14 of the 28 failed checks. The other 14 failures include nine source-dependent concept fields, four empty or derived table checks, and one shared-vocabulary finding. These coverage limits remain after the aggregate OMOP analysis reconciles. The raw DQD reports and participant-level CDM export are not public in this repository.

Source: the governed QiBo aggregate analysis, OMOP reconciliation, and DQD adjudication dated 23–24 September 2026. The [publisher article](https://doi.org/10.1371/journal.pone.0318386) and [Figure 3](https://doi.org/10.1371/journal.pone.0318386.g003) provide the published comparisons.
