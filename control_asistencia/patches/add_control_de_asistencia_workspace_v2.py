import frappe
import os
import json

def execute():
	"""Forzar la carga del Workspace de Control de Asistencia."""
	try:
		# reload_doc buscará en la ruta estándar del módulo
		frappe.reload_doc("Control Asistencia", "workspace", "Control de Asistencia")
	except Exception:
		# Fallback manual buscando en la subcarpeta del workspace
		if not frappe.db.exists("Workspace", "Control de Asistencia"):
			# Esta ruta coincide con la estructura workspace/control_de_asistencia/control_de_asistencia.json
			path = frappe.get_app_path(
				"control_asistencia", 
				"control_asistencia", 
				"workspace", 
				"control_de_asistencia", 
				"control_de_asistencia.json"
			)
			if os.path.exists(path):
				with open(path, "r") as f:
					doc_data = json.load(f)
				
				doc_data.update({
					"name": "Control de Asistencia",
					"doctype": "Workspace",
					"is_standard": 1,
					"public": 1
				})
				
				doc = frappe.get_doc(doc_data)
				doc.insert(ignore_permissions=True)
				frappe.db.commit()
