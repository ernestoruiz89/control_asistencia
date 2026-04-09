import frappe
from datetime import datetime, timedelta
import pytz
import logging

ENTRY_SET        = {"entrada", "clock‑in", "clock in"}
EXIT_SET         = {"salida", "clock‑out", "clock out"}
BREAK_START_SET  = {"break start", "inicio de pausa", "salir a almorzar"}
BREAK_END_SET    = {"break end", "finalización de pausa", "regresar de almorzar"}

def is_entry(action):        return action in ENTRY_SET
def is_exit(action):         return action in EXIT_SET
def is_break_start(action):  return action in BREAK_START_SET
def is_break_end(action):    return action in BREAK_END_SET



@frappe.whitelist()
def get_server_time():
    """Devuelve la hora actual del servidor."""
    return {
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@frappe.whitelist()
def register_checkin(log_type, custom_tipo_registro, latitude=None, longitude=None, client_timezone=None):
    import pytz
    from datetime import datetime

    # Validar que el empleado existe
    employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
    if not employee:
        frappe.throw("No se encontró un empleado asociado al usuario actual.")

    # Validar latitud y longitud
    if latitude is None or longitude is None:
        frappe.throw("Se requieren valores de latitud y longitud para el registro.")

    # Obtener la zona horaria del cliente o usar UTC por defecto
    client_tz = pytz.timezone(client_timezone) if client_timezone else pytz.UTC

    # Hora actual en la zona horaria del cliente
    current_time_client = datetime.now(client_tz)

    # Registrar el check-in
    custom_tipo_registro = custom_tipo_registro.lower()
    checkin = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee,
        "log_type": log_type,
        "time": current_time_client.strftime('%Y-%m-%d %H:%M:%S'),  # Guardar en hora local
        "custom_tipo_registro": custom_tipo_registro,
        "latitude": latitude,
        "longitude": longitude
    })
    checkin.insert()
    frappe.db.commit()

    # Si es "salida", calcular y agregar comentario
    if custom_tipo_registro == "salida":
        time_data = calculate_worked_hours(employee)
        worked_hours = time_data.get("worked_hours", "No se pudo calcular el tiempo laborado.")
        break_hours = time_data.get("break_hours", "No se pudo calcular el tiempo de almuerzo.")

        # Agregar el comentario al registro
        checkin.add_comment('Comment', f"{worked_hours}\n{break_hours}")
        frappe.db.commit()

    return f"Check-in registrado con éxito a las {current_time_client.strftime('%Y-%m-%d %H:%M:%S')} ({client_timezone or 'UTC'})"

@frappe.whitelist()
def get_last_checkin(employee):
    """Obtiene el último registro del empleado en el Doctype Employee Checkin."""
    last_checkin = frappe.db.get_all(
        "Employee Checkin",
        filters={"employee": employee},
        fields=["custom_tipo_registro", "time", "entry_time", "total_break_time"],
        order_by="time DESC",
        limit=1
    )
    return last_checkin[0] if last_checkin else None
    
@frappe.whitelist()
def get_total_break_time(employee):
    """Calcula el tiempo total de almuerzo desde la última entrada."""
    last_entry = frappe.db.get_all(
        "Employee Checkin",
        filters={"employee": employee, "custom_tipo_registro": "Entrada"},
        fields=["time"],
        order_by="time DESC",
        limit=1
    )

    if not last_entry:
        return {"total_break_time": 0}

    start_time = last_entry[0]["time"]

    breaks = frappe.db.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": [">=", start_time],
            "custom_tipo_registro": ["in", ["Salir a Almorzar", "Regresar de Almorzar"]],
        },
        fields=["custom_tipo_registro", "time"],
        order_by="time ASC"
    )

    total_break_time = 0
    break_start = None
    for record in breaks:
        if record["custom_tipo_registro"] == "Salir a Almorzar":
            break_start = record["time"]
        elif record["custom_tipo_registro"] == "Regresar de Almorzar" and break_start:
            total_break_time += (record["time"] - break_start).total_seconds() * 1000  # Convertir a milisegundos
            break_start = None

    return {"total_break_time": total_break_time}

@frappe.whitelist()
def get_current_status(client_timezone=None):
    from datetime import datetime, timedelta
    import pytz

    # Obtener el empleado asociado al usuario actual
    employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
    if not employee:
        frappe.throw("No se encontró un empleado asociado al usuario actual.")

    # Obtener la zona horaria del cliente o usar UTC por defecto
    server_tz = pytz.UTC
    client_tz = pytz.timezone(client_timezone) if client_timezone else server_tz

    # Hora actual en la zona horaria del cliente
    now_client = datetime.now(client_tz)

    # Calcular el inicio y fin del día en la zona horaria del cliente
    start_of_day_client = now_client.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day_client = now_client.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Convertir estos valores a UTC para filtrar correctamente
    start_of_day_utc = start_of_day_client.astimezone(server_tz)
    end_of_day_utc = end_of_day_client.astimezone(server_tz)

    # Inicializar el diccionario de datos
    data = {
        "start_time": None,
        "break_start_time": None,
        "total_break_time": 0,
        "is_on_break": False,
        "is_finished": False,
        "last_action": None
    }

    # Obtener los registros de check-in dentro del rango UTC calculado
    records = frappe.db.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": ["between", [start_of_day_utc, end_of_day_utc]]
        },
        fields=["custom_tipo_registro", "time"],
        order_by="time ASC"
    )

    # Variables auxiliares
    start_time = None
    break_start_time = None
    total_break_time = timedelta()
    is_on_break = False
    is_finished = False
    last_action = None
    break_start = None

    # Procesar los registros
    for record in records:
        action = record["custom_tipo_registro"].lower()
        time = record["time"]

        last_action = action  # Actualizar la última acción

        if is_entry(action):
            start_time = time
        elif is_break_start(action):
            break_start = time
            is_on_break = True
        elif is_break_end(action):
            if break_start:
                total_break_time += time - break_start
                break_start = None
                is_on_break = False
        elif is_exit(action):
            is_finished = True

    # Convertir las fechas a la zona horaria del cliente para la respuesta
    if start_time:
        start_time = start_time.astimezone(client_tz).isoformat()
    if break_start:
        break_start_time = break_start.astimezone(client_tz).isoformat()

    # Actualizar el diccionario de datos
    data["start_time"] = start_time
    data["break_start_time"] = break_start_time
    data["total_break_time"] = int(total_break_time.total_seconds() * 1000)  # En milisegundos
    data["is_on_break"] = is_on_break
    data["is_finished"] = is_finished
    data["last_action"] = last_action

    return data

@frappe.whitelist()
def calculate_worked_hours(employee, client_timezone=None):
    # ➊ Rango del día en zona del cliente ➜ convertir a UTC para consultar
    server_tz = pytz.UTC
    client_tz = pytz.timezone(client_timezone) if client_timezone else server_tz
    now_cli   = datetime.now(client_tz)
    day_start = now_cli.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end   = now_cli.replace(hour=23, minute=59, second=59, microsecond=999999)
    start_utc, end_utc = day_start.astimezone(server_tz), day_end.astimezone(server_tz)

    # ➋ Traer registros del día
    records = frappe.db.get_all(
        "Employee Checkin",
        filters={"employee": employee, "time": ["between", [start_utc, end_utc]]},
        fields=["custom_tipo_registro", "time"],
        order_by="time ASC"
    )

    # ➌ Recorrer y acumular
    total_work   = timedelta()
    total_break  = timedelta()
    working      = False
    break_start  = None
    last_time    = None

    for rec in records:
        action = rec["custom_tipo_registro"].lower()
        time   = rec["time"]

        if is_entry(action):
            working, last_time = True, time

        elif is_break_start(action) and working and not break_start:
            total_work  += time - last_time
            break_start, last_time = time, time

        elif is_break_end(action) and break_start:
            total_break += time - break_start
            break_start, last_time = None, time

        elif is_exit(action) and working:
            if break_start:                          # cierre durante un break
                total_break += time - break_start
                break_start = None
            total_work += time - last_time
            working     = False

    # ➍ Si sigue laborando en este instante
    now_srv = datetime.now(server_tz)
    if working:
        if break_start:
            total_break += now_srv - break_start
        else:
            total_work  += now_srv - last_time

    return {
        "worked_hours": f"Tiempo total laborado: {str(total_work).split('.')[0]}",
        "break_hours":  f"Tiempo de break: {str(total_break).split('.')[0]}"
    }

@frappe.whitelist()
def get_current_worked_hours(client_time=None, client_timezone=None):
    """Devuelve horas trabajadas y tiempo de break transcurridos hoy."""
    from datetime import datetime, timedelta
    import pytz

    # ➊ Validaciones básicas -------------------------------------------------
    if not client_time:
        frappe.throw("Se requiere la hora del cliente (ISO: YYYY‑MM‑DDTHH:MM:SS).")

    try:
        client_time = datetime.strptime(client_time, "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        frappe.throw("Formato de hora del cliente inválido.")

    employee = frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name')
    if not employee:
        frappe.throw("No se encontró un empleado asociado al usuario actual.")

    # ➋ Rango de hoy en hora del cliente (naive) ----------------------------
    day_start = client_time.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end   = client_time.replace(hour=23, minute=59, second=59, microsecond=999999)

    # ➌ Traer registros ------------------------------------------------------
    records = frappe.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": ["between", [day_start, day_end]]
        },
        fields=["custom_tipo_registro", "time"],
        order_by="time ASC"
    )

    if not records:
        return {
            "worked_hours": "Tiempo total laborado: 00:00:00",
            "break_hours":  "Tiempo de break: 00:00:00"
        }

    # ➍ Recorrer y acumular --------------------------------------------------
    total_work_time  = timedelta()
    total_break_time = timedelta()
    working          = False
    break_start      = None
    last_time        = None

    for rec in records:
        action = rec["custom_tipo_registro"].lower()
        time   = rec["time"].replace(tzinfo=None)   # aseguramos naive

        if is_entry(action):
            working, last_time = True, time

        elif is_break_start(action) and working and not break_start:
            total_work_time  += time - last_time
            break_start, last_time = time, time

        elif is_break_end(action) and break_start:
            total_break_time += time - break_start
            break_start, last_time = None, time

        elif is_exit(action) and working:
            if break_start:
                total_break_time += time - break_start
                break_start = None
            total_work_time += time - last_time
            working, last_time = False, None

    # 5  Si sigue laborando al momento de la consulta ------------------------
    if working:
        if break_start:
            total_break_time += client_time - break_start
        else:
            total_work_time  += client_time - last_time

    # 6 Formatear resultados -------------------------------------------------
    def fmt(td):  # quita microsegundos
        return str(td).split('.')[0]

    return {
        "worked_hours": f"Tiempo total laborado: {fmt(total_work_time)}",
        "break_hours":  f"Tiempo de break: {fmt(total_break_time)}"
    }




def get_formatted_time(employee):
    last_checkin = frappe.db.get_value(
        "Employee Checkin",
        {"employee": employee},
        "time",
        order_by="time DESC"
    )

    if not last_checkin:
        return "No hay registros disponibles."

    # Convertir la hora UTC al tiempo del cliente
    client_time = convert_utc_to_user_timezone(last_checkin, "America/Managua")
    return client_time.strftime("%Y-%m-%d %H:%M:%S")