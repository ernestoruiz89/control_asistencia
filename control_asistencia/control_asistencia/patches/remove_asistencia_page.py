import frappe

def execute():
    if frappe.db.exists("Page", "asistencia"):
        frappe.delete_doc("Page", "asistencia", ignore_permissions=True)
