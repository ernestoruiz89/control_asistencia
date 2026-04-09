import frappe
from control_asistencia.control_asistencia.shift_panel import _fmt_hour_12

def execute():
    """Rename all existing Shift Types to the 12-hour format '8:00am - 5:00pm'."""
    shifts = frappe.get_all("Shift Type", fields=["name", "start_time", "end_time"])
    
    for shift in shifts:
        start_time = shift.get("start_time")
        end_time = shift.get("end_time")
        
        if not start_time or not end_time:
            continue
            
        new_name = f"{_fmt_hour_12(start_time)} - {_fmt_hour_12(end_time)}"
        
        # Only rename if the new name is different
        if shift.name != new_name:
            try:
                # rename_doc handles automatically updating linked documents (like Shift Assignments)
                frappe.rename_doc("Shift Type", shift.name, new_name, force=True)
            except Exception as e:
                frappe.log_error(title="Error renaming Shift Type", message=str(e))
                pass
