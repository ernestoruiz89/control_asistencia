"""Migrate data from custom_tipo_registro → custom_registration_type.

Copies values from the old field to the new field, translating Spanish
values to their canonical English equivalents:

    Entrada / entrada / clock in  → clock-in
    Salida / salida / clock out   → clock-out
    Salir a Almorzar / …          → break start
    Regresar de Almorzar / …      → break end
"""
import frappe


VALUE_MAP = {
    # Clock-in
    "entrada":              "clock-in",
    "clock in":             "clock-in",
    "clock-in":             "clock-in",
    # Clock-out
    "salida":               "clock-out",
    "clock out":            "clock-out",
    "clock-out":            "clock-out",
    # Break start
    "salir a almorzar":     "break start",
    "inicio de pausa":      "break start",
    "inicio de break":      "break start",
    "break start":          "break start",
    # Break end
    "regresar de almorzar": "break end",
    "finalización de pausa":"break end",
    "fin de pausa":         "break end",
    "fin de break":         "break end",
    "break end":            "break end",
}


def execute():
    # Ensure the new column exists before writing to it
    if not frappe.db.has_column("Employee Checkin", "custom_registration_type"):
        frappe.log("Patch skipped: custom_registration_type column does not exist yet.")
        return

    records = frappe.get_all(
        "Employee Checkin",
        filters={"custom_tipo_registro": ["is", "set"]},
        fields=["name", "custom_tipo_registro"],
        limit_page_length=0,
    )

    updated = 0
    for rec in records:
        old_val = (rec.get("custom_tipo_registro") or "").strip()
        new_val = VALUE_MAP.get(old_val.lower())
        if new_val:
            frappe.db.set_value(
                "Employee Checkin", rec["name"],
                "custom_registration_type", new_val,
                update_modified=False,
            )
            updated += 1

    if updated:
        frappe.db.commit()

    frappe.log(f"Patch: migrated {updated} records from custom_tipo_registro → custom_registration_type.")
