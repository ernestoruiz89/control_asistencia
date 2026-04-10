import frappe
import os
import json

def execute():
	"""
	Reinstalación limpia del Workspace de Control de Asistencia.
	Borra cualquier rastro previo para evitar errores de JavaScript por datos corruptos.
	"""
	# 1. Borrar el registro existente y sus hijos (links, shortcuts, etc.)
	if frappe.db.exists("Workspace", "Control de Asistencia"):
		frappe.delete_doc("Workspace", "Control de Asistencia", force=True, ignore_permissions=True)
	
	# 2. Limpiar registros huérfanos en tablas hijas por si acaso
	frappe.db.sql("DELETE FROM `tabWorkspace Link` WHERE parent='Control de Asistencia'")
	frappe.db.sql("DELETE FROM `tabWorkspace Shortcut` WHERE parent='Control de Asistencia'")

	# 3. Intentar cargar el JSON desde la ruta del workspace
	try:
		# reload_doc(module, doctype, name)
		# Nota: Asegurarse de que el nombre del módulo sea correcto
		frappe.reload_doc("Control Asistencia", "workspace", "Control de Asistencia")
	except Exception:
		# Fallback manual si reload_doc falla
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
	
	# 4. Confirmar cambios y limpiar caché
	frappe.db.commit()
	frappe.clear_cache()
