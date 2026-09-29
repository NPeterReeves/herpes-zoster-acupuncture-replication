#!/usr/bin/env python3
"""Read-only OMOP trial analysis, reconciled against the locked source analysis.

Participant-level database rows remain in memory. Only aggregate outputs are saved.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import zipfile

VERSION = "2026-09-24_v001"
SOURCE_SCRIPT_SHA = "14079fb8da47a7c06641b21c96f4778fc6bee31c4defdc8752f166bb572df3e2"
SOURCE_PACKAGE_SHA = "a5d1b670012f1d2f70c210d5c859b4dd331cbf654e92c1463e03dfd764d898fd"
SOURCE_DATA_SHA = "6decf0e070c0a3b3515dc0b9ce28d24c101aad2e55cedaa5540d7803c1b0a54f"
ETL_VERSION = "2026-09-24_v003"
BASE = ("vas_baseline", "vas_day_1", "vas_day_2", "vas_day_3", "vas_day_4",
        "vas_day_5", "vas_day_6", "vas_day_7", "vas_day_28", "dlqi_admission_total",
        "dlqi_discharge_total")
SAFETY = ("nephrotoxicity_flag", "hepatotoxicity_flag", "nausea_flag",
          "vomiting_flag", "upper_gi_bleeding_flag", "fainting_flag",
          "needle_break_flag", "hematoma_flag")
OUTPUTS = ("primary_cure.csv", "table1_baseline.csv", "table2_vas.csv",
           "table3_dlqi.csv", "table4_safety.csv",
           "vas_observed_only_sensitivity.csv", "vas_missingness_qc.csv",
           "reconciliation.csv")
TABLES = {
    "person": ("herpes_pain_cdm.person", "person_id", "cdm/PERSON.csv"),
    "measurement": ("herpes_pain_cdm.measurement", "measurement_id", "cdm/MEASUREMENT.csv"),
    "observation": ("herpes_pain_cdm.observation", "observation_id", "cdm/OBSERVATION.csv"),
    "cdm_source": ("herpes_pain_cdm.cdm_source", "cdm_source_name", "cdm/CDM_SOURCE.csv"),
    "assignment": ("herpes_pain_ext.qibo_study_assignment", "person_id", "extensions/QIBO_STUDY_ASSIGNMENT.csv"),
    "variable": ("herpes_pain_ext.qibo_study_variable", "study_variable_id", "extensions/QIBO_STUDY_VARIABLE.csv"),
    "cohort": ("herpes_pain_results.cohort", "subject_id, cohort_definition_id", "results/COHORT.csv"),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def rows_from_text(data: str, name: str) -> list[dict[str, str]]:
    handle = io.StringIO(data)
    reader = csv.DictReader(handle)
    require(bool(reader.fieldnames), "No CSV header for " + name)
    result = list(reader)
    require(bool(result), "No rows for " + name)
    return result


def get_table(name: str, export_dir: Path | None) -> list[dict[str, str]]:
    table, order, relative = TABLES[name]
    if export_dir is not None:
        return rows_from_text((export_dir / relative).read_text(encoding="utf-8-sig"), name)
    command = ["docker", "exec", "-e", "PGOPTIONS=-c default_transaction_read_only=on",
               os.environ.get("QIBO_POSTGRES_CONTAINER", "qibo-omop-postgres"),
               "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-U",
               os.environ.get("QIBO_DB_USER", "qibo_admin"), "-d",
               os.environ.get("QIBO_DB_NAME", "qibo_omop"),
               "-c", f"COPY (SELECT * FROM {table} ORDER BY {order}) TO STDOUT WITH (FORMAT csv, HEADER true)"]
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    require(result.returncode == 0, f"Read-only database query failed for {name}: {result.stderr[-500:]}")
    return rows_from_text(result.stdout, name)


def load_source_module(path: Path):
    require(sha(path) == SOURCE_SCRIPT_SHA, "Locked source-analysis script checksum differs")
    spec = importlib.util.spec_from_file_location("locked_herpes_source_analysis", path)
    require(spec is not None and spec.loader is not None, "Cannot import locked source script")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def number(row: dict[str, str], field: str) -> float | None:
    value = row[field]
    return float(value) if value not in (None, "") else None


def prepare_records(tables: dict[str, list[dict[str, str]]]) -> tuple[list[dict], dict]:
    cdm_source = tables["cdm_source"]
    require(len(cdm_source) == 1 and ETL_VERSION in cdm_source[0]["cdm_etl_reference"],
            "CDM_SOURCE does not identify the governed V003 ETL")
    require(cdm_source[0]["vocabulary_version"] == "Athena 2026-07-30", "Vocabulary lineage differs")
    persons = {int(p["person_id"]): p for p in tables["person"]}
    assignments = {int(a["person_id"]): a for a in tables["assignment"]}
    require(len(persons) == len(assignments) == 106 and set(persons) == set(assignments),
            "Person-to-assignment population mismatch")
    require(all(a["source_file_sha256"] == SOURCE_DATA_SHA and a["actual_exposure_confirmed_flag"] == "0"
                for a in assignments.values()), "Source hash or exposure provenance mismatch")
    variables: dict[int, dict[str, dict[str, str]]] = {person_id: {} for person_id in persons}
    for v in tables["variable"]:
        person_id, key = int(v["person_id"]), v["source_variable_name"]
        require(person_id in variables and key not in variables[person_id], "Unexpected/duplicate audit variable")
        require(v["source_file_sha256"] == SOURCE_DATA_SHA, "Audit source hash differs")
        variables[person_id][key] = v
    require(sum(map(len, variables.values())) == 2968, "Audit row total differs from approved export")
    measurements = {int(m["measurement_id"]): m for m in tables["measurement"]}
    observations = {int(o["observation_id"]): o for o in tables["observation"]}
    require(len(measurements) == 1116 and len(observations) == 212,
            "Unexpected core measurement or observation count")
    linked_measurements: set[int] = set()
    linked_observations: set[int] = set()
    records = []
    for person_id, person in sorted(persons.items()):
        a, v = assignments[person_id], variables[person_id]
        require(len(v) == 28 and a["randomized_group_label"] in ("Control", "Experimental"),
                "Participant audit or randomized group incomplete")
        group = int(a["randomized_group_code"])
        require((group, a["randomized_group_label"]) in ((1, "Control"), (2, "Experimental")),
                "Randomized arm code/label mismatch")
        sex = person["gender_source_value"]
        require(sex in ("Female", "Male") and v["sex"]["value_as_string"] == sex,
                "Core person sex differs from audited source")
        age = number(v["age_years"], "value_as_number")
        require(age is not None and int(person["year_of_birth"]) == 2000 - int(age),
                "Core birth year differs from audited source age")
        require(number(v["randomized_group_code"], "value_as_number") == group and
                v["randomized_group_label"]["value_as_string"] == a["randomized_group_label"],
                "Assignment extension differs from audited group")
        record = {"study_participant_id": person_id, "randomized_group_code": group,
                  "randomized_group_label": a["randomized_group_label"], "sex": sex,
                  "age_years": age, "hospitalization_days_source":
                  number(v["hospitalization_days_source"], "value_as_number")}
        for key in BASE:
            audit = v[key]
            if audit["missing_flag"] == "1":
                require(not audit["target_table"] and not audit["target_record_id"] and
                        audit["value_as_number"] == "", "Missing outcome incorrectly linked to core")
                record[key] = None
                continue
            require(audit["missing_flag"] == "0" and audit["target_table"] == "MEASUREMENT" and
                    audit["target_record_id"], "Observed outcome lacks core measurement link")
            target_id = int(audit["target_record_id"])
            require(target_id in measurements and target_id not in linked_measurements,
                    "Missing or duplicate core measurement link")
            m = measurements[target_id]
            require(int(m["person_id"]) == person_id and m["measurement_source_value"] == key and
                    int(m["measurement_concept_id"]) == (3036453 if key.startswith("vas_") else 4167755) and
                    number(m, "value_as_number") == number(audit, "value_as_number"),
                    "Core measurement differs from audited source")
            linked_measurements.add(target_id)
            record[key] = number(m, "value_as_number")
        audit = v["pain_duration_days"]
        require(audit["target_table"] == "OBSERVATION" and audit["target_record_id"],
                "Pain-duration observation link missing")
        obs_id = int(audit["target_record_id"])
        require(obs_id in observations and obs_id not in linked_observations,
                "Missing or duplicate pain-duration observation")
        obs = observations[obs_id]
        require(int(obs["person_id"]) == person_id and
                obs["observation_source_value"] == "pain_duration_days" and
                obs["unit_concept_id"] == "8512" and
                number(obs, "value_as_number") == number(audit, "value_as_number"),
                "Core pain-duration observation differs from audit")
        linked_observations.add(obs_id)
        record["pain_duration_days"] = number(obs, "value_as_number")
        for key in SAFETY:
            flag = v[key]
            require(flag["target_table"] == "" and flag["target_record_id"] == "" and
                    flag["value_as_number"] in ("0", "1"), "Safety flag has an invented core event")
            record[key] = float(flag["value_as_number"])
        records.append(record)
    require(len(linked_measurements) == len(measurements) and len(linked_observations) == 106,
            "Unreconciled outcome measurements or pain-duration observations")
    cohort = {(int(r["subject_id"]), int(r["cohort_definition_id"])) for r in tables["cohort"]}
    expected = {(r["study_participant_id"], id) for r in records
                for id in (1003, 1002 if r["randomized_group_code"] == 1 else 1001)}
    require(len(tables["cohort"]) == 212 and cohort == expected,
            "Results cohorts differ from randomized assignment")
    require(sum(r["randomized_group_code"] == 1 for r in records) == 52 and
            sum(r["randomized_group_code"] == 2 for r in records) == 54,
            "Randomized-arm counts differ")
    return records, {"population": 106, "control": 52, "experimental": 54,
                     "observed_measurements": len(measurements),
                     "core_pain_duration_observations": len(linked_observations),
                     "source_audit_rows": 2968, "cohort_rows": 212}


def is_numeric(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return bool(value)


def compare_to_source(outputs: dict[str, list[dict]], package: Path) -> dict:
    require(sha(package) == SOURCE_PACKAGE_SHA, "Locked source replication package checksum differs")
    comparisons = {}
    with zipfile.ZipFile(package) as z:
        for name, rows in outputs.items():
            expected = rows_from_text(z.read(name).decode("utf-8-sig"), name)
            require(len(rows) == len(expected), f"{name}: aggregate row count differs")
            for index, (actual, reference) in enumerate(zip(rows, expected), start=1):
                require(set(actual) == set(reference), f"{name}: aggregate columns differ")
                for key, value in actual.items():
                    found, required = str(value), reference[key]
                    if is_numeric(found) and is_numeric(required):
                        matched = math.isclose(float(found), float(required), rel_tol=1e-10, abs_tol=1e-10)
                    else:
                        matched = found == required
                    require(matched, f"{name} row {index}, column {key} differs from locked source analysis")
            comparisons[name] = {"rows": len(rows), "status": "EXACT_OR_NUMERICALLY_EQUIVALENT"}
    return comparisons


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--database", action="store_true", help="Query the loaded V003 schemas read-only")
    mode.add_argument("--export-dir", type=Path, help="Validate against a local V003 CSV export")
    ap.add_argument("--source-script", required=True, type=Path)
    ap.add_argument("--source-package", required=True, type=Path)
    ap.add_argument("--output-dir", required=True, type=Path)
    args = ap.parse_args()
    require(not args.output_dir.exists() or not any(args.output_dir.iterdir()),
            "Output directory already has files: " + str(args.output_dir))
    source = load_source_module(args.source_script)
    tables = {key: get_table(key, args.export_dir) for key in TABLES}
    records, qc = prepare_records(tables)
    analyzed, audit = source.apply_structural_zeros(records)
    primary, primary_checks = source.build_primary_cure(analyzed)
    require((primary_checks["control_cured"], primary_checks["experimental_cured"]) == (34, 47),
            "Primary cure counts differ from approved source analysis")
    table1 = source.build_table1(analyzed)
    table2 = source.build_vas_table(analyzed)
    table3 = source.build_table3(analyzed)
    table4 = source.build_table4(analyzed)
    outputs = dict(zip(OUTPUTS, (primary, table1, table2, table3, table4,
                                source.build_vas_table(records, sensitivity=True),
                                source.build_qc(records, analyzed, audit),
                                source.build_reconciliation(table1, table2, table3, table4, primary_checks))))
    comparison = compare_to_source(outputs, args.source_package)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in outputs.items():
        source.write_csv(args.output_dir / name, rows)
    summary = {"analysis_version": VERSION,
               "input": "read_only_database" if args.database else "staged_v003_export",
               "database_etl": ETL_VERSION, "source_package_sha256": SOURCE_PACKAGE_SHA,
               "source_script_sha256": SOURCE_SCRIPT_SHA,
               "source_data_sha256": SOURCE_DATA_SHA,
               "reconciliation_status": "PASS", "population": qc,
               "primary": primary_checks, "outputs": comparison}
    (args.output_dir / "omop_reconciliation.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("===== BEGIN HERPES PAIN OMOP ANALYSIS =====")
    print(json.dumps(summary, indent=2))
    print("===== END HERPES PAIN OMOP ANALYSIS: PASS =====")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        sys.exit(f"HERPES PAIN OMOP ANALYSIS FAILED: {error}")
