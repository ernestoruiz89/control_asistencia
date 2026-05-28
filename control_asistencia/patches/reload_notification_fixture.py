import frappe

def execute():
    # Force delete the notification so that bench migrate re-imports it from the fixture json file
    frappe.delete_doc("Notification", "Nueva Solicitud de Permiso", ignore_missing=True, force=True)
    frappe.db.commit()
