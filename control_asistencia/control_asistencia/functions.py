import frappe
from frappe import _
from datetime import datetime, timedelta
import pytz

# ---------------------------------------------------------------------------
# Action classification sets (translatable labels should match the values
# stored in *custom_registration_type* – keep lowercase).
# ---------------------------------------------------------------------------
ENTRY_SET       = {"clock-in"}
EXIT_SET        = {"clock-out"}
BREAK_START_SET = {"break start"}
BREAK_END_SET   = {"break end"}


def is_entry(action):       return action in ENTRY_SET
def is_exit(action):        return action in EXIT_SET
def is_break_start(action): return action in BREAK_START_SET
def is_break_end(action):   return action in BREAK_END_SET


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _get_employee():
    """Return the Employee ID linked to the current session user."""
    employee = frappe.db.get_value(
        "Employee", {"user_id": frappe.session.user}, "name"
    )
    if not employee:
        frappe.throw(_("No se encontró un empleado asociado al usuario actual."))
    return employee


def _day_range(client_tz):
    """Return (start_utc, end_utc, now_client) for today in *client_tz*."""
    now_client = datetime.now(client_tz)
    start = now_client.replace(hour=0, minute=0, second=0, microsecond=0)
    end   = now_client.replace(hour=23, minute=59, second=59, microsecond=999999)
    utc   = pytz.UTC
    return start.astimezone(utc), end.astimezone(utc), now_client


def _fetch_records(employee, start_utc, end_utc):
    """Fetch today's checkin records for *employee* ordered by time ASC."""
    return frappe.db.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": ["between", [start_utc, end_utc]],
        },
        fields=["custom_registration_type", "time"],
        order_by="time ASC",
    )


def _accumulate(records, reference_now=None, strip_tz=False):
    """Walk *records* and return accumulated work/break timedeltas + state.

    Parameters
    ----------
    records : list[dict]
        Checkin records with ``custom_registration_type`` and ``time``.
    reference_now : datetime | None
        If the employee is still working/on‑break, use this moment as the
        upper bound.  When *None*, open intervals are ignored.
    strip_tz : bool
        If *True*, make each timestamp timezone‑naive before arithmetic
        (useful when *reference_now* is also naive).

    Returns
    -------
    dict  with keys ``total_work``, ``total_break``, ``working``,
          ``is_on_break``, ``is_finished``, ``last_action``,
          ``start_time``, ``break_start``.
    """
    total_work  = timedelta()
    total_break = timedelta()
    working     = False
    break_start = None
    last_time   = None
    start_time  = None
    last_action = None

    for rec in records:
        action = (rec.get("custom_registration_type") or "").lower()
        t = rec["time"]
        if strip_tz:
            t = t.replace(tzinfo=None)

        last_action = action

        if is_entry(action):
            start_time = start_time or t
            working, last_time = True, t

        elif is_break_start(action) and working and not break_start:
            total_work  += t - last_time
            break_start  = t
            last_time    = t

        elif is_break_end(action) and break_start:
            total_break += t - break_start
            break_start  = None
            last_time    = t

        elif is_exit(action) and working:
            if break_start:
                total_break += t - break_start
                break_start  = None
            total_work += t - last_time
            working     = False
            last_time   = None

    # If the employee is still working / on break right now
    if reference_now is not None and working:
        now = reference_now
        # DB timestamps are naive; strip tz from now to avoid mixed subtraction
        if strip_tz or (last_time and last_time.tzinfo is None):
            now = now.replace(tzinfo=None)
        if break_start:
            total_break += now - break_start
        elif last_time:
            total_work += now - last_time

    return {
        "total_work":   total_work,
        "total_break":  total_break,
        "working":      working,
        "is_on_break":  break_start is not None,
        "is_finished":  not working and last_action is not None and is_exit(last_action or ""),
        "last_action":  last_action,
        "start_time":   start_time,
        "break_start":  break_start,
    }


def _fmt_td(td):
    """Format a timedelta as HH:MM:SS (no microseconds)."""
    return str(td).split(".")[0]


def _resolve_tz(client_timezone=None):
    """Return a pytz timezone; defaults to UTC."""
    return pytz.timezone(client_timezone) if client_timezone else pytz.UTC


# ---------------------------------------------------------------------------
# Public / whitelisted API
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_server_time():
    """Return the current server time."""
    return {
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


@frappe.whitelist()
def register_checkin(
    log_type,
    custom_registration_type,
    latitude=None,
    longitude=None,
    client_timezone=None,
):
    """Create an Employee Checkin record.

    When the action is an *exit*, a comment with worked / break hours is
    automatically appended.
    """
    employee = _get_employee()

    require_geo = frappe.db.get_single_value(
        "Ajustes de Control Asistencia", "require_geolocation"
    )
    if require_geo and (latitude is None or longitude is None):
        frappe.throw(_("Se requieren valores de latitud y longitud para el registro."))

    client_tz = _resolve_tz(client_timezone)
    now_client = datetime.now(client_tz)

    custom_registration_type = custom_registration_type.lower()
    checkin = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee,
        "log_type": log_type,
        "time": now_client.strftime("%Y-%m-%d %H:%M:%S"),
        "custom_registration_type": custom_registration_type,
        "latitude": latitude,
        "longitude": longitude,
    })
    checkin.insert()
    frappe.db.commit()

    # On exit: attach a summary comment
    if is_exit(custom_registration_type):
        time_data = calculate_worked_hours(employee, client_timezone)
        worked = time_data.get("worked_hours", _("No se pudo calcular el tiempo laborado."))
        brk    = time_data.get("break_hours",  _("No se pudo calcular el tiempo de break."))
        checkin.add_comment("Comment", f"{worked}\n{brk}")
        frappe.db.commit()

    return _(
        "Registro guardado exitosamente a las {0} ({1})"
    ).format(now_client.strftime("%Y-%m-%d %H:%M:%S"), client_timezone or "UTC")


@frappe.whitelist()
def get_last_checkin(employee):
    """Return the latest Employee Checkin record for *employee*."""
    rows = frappe.db.get_all(
        "Employee Checkin",
        filters={"employee": employee},
        fields=["custom_registration_type", "time", "entry_time", "total_break_time"],
        order_by="time DESC",
        limit=1,
    )
    return rows[0] if rows else None


@frappe.whitelist()
def get_total_break_time(employee):
    """Calculate the total break time since the last clock‑in."""
    last_entry = frappe.db.get_all(
        "Employee Checkin",
        filters={"employee": employee, "custom_registration_type": ["in", list(ENTRY_SET)]},
        fields=["time"],
        order_by="time DESC",
        limit=1,
    )
    if not last_entry:
        return {"total_break_time": 0}

    since = last_entry[0]["time"]
    all_labels = list(BREAK_START_SET) + list(BREAK_END_SET)
    breaks = frappe.db.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": [">=", since],
            "custom_registration_type": ["in", all_labels],
        },
        fields=["custom_registration_type", "time"],
        order_by="time ASC",
    )

    total_ms = 0
    brk_start = None
    for rec in breaks:
        action = (rec.get("custom_registration_type") or "").lower()
        if is_break_start(action):
            brk_start = rec["time"]
        elif is_break_end(action) and brk_start:
            total_ms += (rec["time"] - brk_start).total_seconds() * 1000
            brk_start = None

    return {"total_break_time": total_ms}


@frappe.whitelist()
def get_current_status(client_timezone=None):
    """Return the current attendance state for today (clock‑in time, break
    status, worked/break durations, etc.)."""
    employee  = _get_employee()
    client_tz = _resolve_tz(client_timezone)

    start_utc, end_utc, now_client = _day_range(client_tz)
    records = _fetch_records(employee, start_utc, end_utc)

    acc = _accumulate(records, reference_now=datetime.now(pytz.UTC))

    # Convert key timestamps to the client timezone for the response
    start_iso = None
    if acc["start_time"]:
        start_iso = acc["start_time"].astimezone(client_tz).isoformat()

    break_start_iso = None
    if acc["break_start"]:
        break_start_iso = acc["break_start"].astimezone(client_tz).isoformat()

    return {
        "start_time":       start_iso,
        "break_start_time": break_start_iso,
        "total_break_time": int(acc["total_break"].total_seconds() * 1000),
        "is_on_break":      acc["is_on_break"],
        "is_finished":      acc["is_finished"],
        "last_action":      acc["last_action"],
    }


@frappe.whitelist()
def calculate_worked_hours(employee, client_timezone=None):
    """Return formatted worked and break hours for *employee* today."""
    client_tz = _resolve_tz(client_timezone)
    start_utc, end_utc, _ = _day_range(client_tz)

    records = _fetch_records(employee, start_utc, end_utc)
    acc = _accumulate(records, reference_now=datetime.now(pytz.UTC))

    return {
        "worked_hours": _("Tiempo total laborado: {0}").format(_fmt_td(acc["total_work"])),
        "break_hours":  _("Tiempo de break: {0}").format(_fmt_td(acc["total_break"])),
    }


@frappe.whitelist()
def get_current_worked_hours(client_time=None, client_timezone=None):
    """Return worked and break hours using the client's local clock as *now*.

    This is useful when the server and client clocks may differ.
    """
    if not client_time:
        frappe.throw(_("Se requiere la hora del cliente (formato ISO: YYYY-MM-DDTHH:MM:SS)."))

    try:
        client_dt = datetime.strptime(client_time, "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        frappe.throw(_("Formato de hora del cliente inválido."))

    employee = _get_employee()

    day_start = client_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end   = client_dt.replace(hour=23, minute=59, second=59, microsecond=999999)

    records = frappe.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": ["between", [day_start, day_end]],
        },
        fields=["custom_registration_type", "time"],
        order_by="time ASC",
    )

    if not records:
        return {
            "worked_hours": _("Tiempo total laborado: 00:00:00"),
            "break_hours":  _("Tiempo de break: 00:00:00"),
        }

    acc = _accumulate(records, reference_now=client_dt, strip_tz=True)

    return {
        "worked_hours": _("Tiempo total laborado: {0}").format(_fmt_td(acc["total_work"])),
        "break_hours":  _("Tiempo de break: {0}").format(_fmt_td(acc["total_break"])),
    }