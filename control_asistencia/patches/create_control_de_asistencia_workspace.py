import frappe

def execute():
	"""Crear el Workspace de Control de Asistencia si no existe o forzar su actualización."""
	frappe.reload_doc("control_asistencia", "workspace", "control_de_asistencia")
