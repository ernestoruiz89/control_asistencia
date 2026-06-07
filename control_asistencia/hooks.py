app_name = "control_asistencia"
app_title = "Control Asistencia"
app_publisher = "Ernesto Ruiz Escorcia"
app_description = "Control de asistencia de empleados"
app_email = "eruiz@wbapps.com"
app_license = "mit"

# Fixtures
# ------------------
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [["module", "=", "Control Asistencia"]],
    },
    {
        "dt": "Notification",
        "filters": [["name", "in", ["Nueva Solicitud de Permiso"]]],
    },
    {
        "dt": "Custom DocPerm",
        "filters": [
            ["role", "in", ["HR Manager", "System Manager", "Administrator"]],
            ["parent", "in", ["User", "Employee"]]
        ]
    },
]

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "control_asistencia",
# 		"logo": "/assets/control_asistencia/logo.png",
# 		"title": "Control Asistencia",
# 		"route": "/control_asistencia",
# 		"has_permission": "control_asistencia.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/control_asistencia/css/control_asistencia.css"
# app_include_js = "/assets/control_asistencia/js/control_asistencia.js"

# include js, css files in header of web template
# web_include_css = "/assets/control_asistencia/css/control_asistencia.css"
# web_include_js = "/assets/control_asistencia/js/control_asistencia.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "control_asistencia/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "control_asistencia/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "control_asistencia.utils.jinja_methods",
# 	"filters": "control_asistencia.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "control_asistencia.install.before_install"
# after_install = "control_asistencia.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "control_asistencia.uninstall.before_uninstall"
# after_uninstall = "control_asistencia.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "control_asistencia.utils.before_app_install"
# after_app_install = "control_asistencia.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "control_asistencia.utils.before_app_uninstall"
# after_app_uninstall = "control_asistencia.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "control_asistencia.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"Shift Assignment": {
		"on_update": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_cancel": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_trash": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"after_insert": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update"
	},
	"Employee Checkin": {
		"on_update": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_cancel": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_trash": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"after_insert": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update"
	},
	"Leave Application": {
		"on_update": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_cancel": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_trash": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"after_insert": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update"
	},
	"Employee": {
		"on_update": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"on_trash": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update",
		"after_insert": "control_asistencia.control_asistencia.shift_panel.notify_shift_panel_update"
	}
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"control_asistencia.tasks.all"
# 	],
# 	"daily": [
# 		"control_asistencia.tasks.daily"
# 	],
# 	"hourly": [
# 		"control_asistencia.tasks.hourly"
# 	],
# 	"weekly": [
# 		"control_asistencia.tasks.weekly"
# 	],
# 	"monthly": [
# 		"control_asistencia.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "control_asistencia.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "control_asistencia.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "control_asistencia.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["control_asistencia.utils.before_request"]
# after_request = ["control_asistencia.utils.after_request"]

# Job Events
# ----------
# before_job = ["control_asistencia.utils.before_job"]
# after_job = ["control_asistencia.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"control_asistencia.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

