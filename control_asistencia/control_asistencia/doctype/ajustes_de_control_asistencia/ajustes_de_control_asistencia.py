# Copyright (c) 2026, Ernesto Ruiz Escorcia and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class AjustesdeControlAsistencia(Document):
	def on_update(self):
		import frappe
		frappe.publish_realtime("update_max_distance", self.max_distance_meters)
