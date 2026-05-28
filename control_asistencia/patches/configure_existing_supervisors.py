import frappe
from control_asistencia.control_asistencia.shift_panel import configure_supervisor_workspace_and_modules

def execute():
    # Get all active users
    users = frappe.get_all("User", filters={"enabled": 1})
    for u in users:
        roles = frappe.get_roles(u.name)
        if "HR User" in roles:
            user_doc = frappe.get_doc("User", u.name)
            # Re-apply workspace and module restriction rules
            configure_supervisor_workspace_and_modules(user_doc, True)
            user_doc.save(ignore_permissions=True)
            
    frappe.db.commit()
