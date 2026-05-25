import frappe


def execute():
    if not frappe.db.exists("Custom Field", "Employee-no_aplica_turno"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Employee",
            "module": "Control Asistencia",
            "fieldname": "no_aplica_turno",
            "fieldtype": "Check",
            "label": "No Aplica Turno",
            "default": "0",
            "insert_after": "branch",
            "translatable": 0,
        }).insert(ignore_permissions=True)

    if frappe.db.has_column("Employee", "no_aplica_turno"):
        frappe.db.sql("""
            update `tabEmployee`
            set no_aplica_turno = 0
            where no_aplica_turno is null
        """)
