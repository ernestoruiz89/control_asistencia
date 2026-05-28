import frappe
from frappe import _
from datetime import datetime, timedelta, time


def _fmt_hour(t):
    """Format a time object as '8a', '5p', '12p', etc."""
    if isinstance(t, str):
        parts = t.split(":")
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    elif isinstance(t, timedelta):
        total_secs = int(t.total_seconds())
        h = total_secs // 3600
        m = (total_secs % 3600) // 60
    else:
        h, m = t.hour, t.minute

    suffix = "a" if h < 12 else "p"
    display_h = h if h <= 12 else h - 12
    if display_h == 0:
        display_h = 12
    if m:
        return f"{display_h}:{m:02d}{suffix}"
    return f"{display_h}{suffix}"


def _fmt_hour_12(t):
    """Format a time object as '8:00am', '5:00pm', etc."""
    if isinstance(t, str):
        parts = t.split(":")
        h, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
    elif isinstance(t, timedelta):
        total_secs = int(t.total_seconds())
        h = total_secs // 3600
        m = (total_secs % 3600) // 60
    else:
        h, m = t.hour, t.minute

    suffix = "am" if h < 12 else "pm"
    display_h = h if h <= 12 else h - 12
    if display_h == 0:
        display_h = 12
    return f"{display_h}:{m:02d}{suffix}"


def _get_session_employee():
    if frappe.session.user == "Guest":
        frappe.throw(_("Not logged in"), frappe.AuthenticationError)

    employee = frappe.db.get_value(
        "Employee",
        {"user_id": frappe.session.user},
        ["name", "employee_name", "leave_approver"],
        as_dict=True,
    )
    if not employee:
        frappe.throw(_("No hay ningun Empleado vinculado a tu cuenta de usuario."))
    return employee


def _get_leave_approver(employee):
    approver = frappe.db.get_value("Employee", employee, "leave_approver")
    if approver:
        return approver

    user = frappe.db.get_value(
        "Has Role",
        {"role": "HR Manager", "parenttype": "User"},
        "parent",
        order_by="creation asc",
    )
    if user:
        return user

    frappe.throw(_("No hay aprobador de vacaciones configurado para este empleado."))


def _is_privileged_approver():
    """Return True if the current user is a System Manager or HR Manager."""
    roles = frappe.get_roles(frappe.session.user)
    return "System Manager" in roles or "HR Manager" in roles


@frappe.whitelist()
def get_shift_types():
    """Return all Shift Type records with a UI-friendly label."""
    shifts = frappe.get_all(
        "Shift Type",
        fields=["name", "start_time", "end_time"],
        order_by="start_time ASC",
    )
    for s in shifts:
        if s.start_time is not None and s.end_time is not None:
            s.label = f"{_fmt_hour_12(s.start_time)} - {_fmt_hour_12(s.end_time)}"
        else:
            s.label = s.name
    return shifts


@frappe.whitelist()
def create_shift_type(start_time, end_time):
    """Create a new Shift Type with auto-generated name like '8:00am - 5:00pm'."""
    name = f"{_fmt_hour_12(start_time)} - {_fmt_hour_12(end_time)}"

    if frappe.db.exists("Shift Type", name):
        frappe.throw(_("El turno '{0}' ya existe.").format(name))

    doc = frappe.get_doc({
        "doctype": "Shift Type",
        "name": name,
        "__newname": name,
        "start_time": start_time,
        "end_time": end_time,
        "enable_auto_attendance": 1,
        "determine_check_in_and_check_out": "Alternating entries as IN and OUT during the same shift",
        "working_hours_calculation_based_on": "First Check-in and Last Check-out",
        "begin_check_in_before_shift_start_time": 60,
        "allow_check_out_after_shift_end_time": 60,
        "enable_late_entry_marking": 1,
        "late_entry_grace_period": 0,
        "enable_early_exit_marking": 1,
        "early_exit_grace_period": 0,
        "process_attendance_after": "2026-01-01",
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "start_time": str(doc.start_time), "end_time": str(doc.end_time)}


@frappe.whitelist()
def assign_shift(employee, shift_type, start_date, end_date=None, days_enabled=None):
    """Create one Shift Assignment per day so each day can be modified individually."""
    import json
    if not end_date:
        end_date = start_date

    start = datetime.strptime(str(start_date), "%Y-%m-%d").date()
    end = datetime.strptime(str(end_date), "%Y-%m-%d").date()

    enabled_list = [1] * 7
    if days_enabled:
        try:
            enabled_list = json.loads(days_enabled)
        except Exception:
            pass

    created = []
    current = start
    while current <= end:
        ds = str(current)

        if not enabled_list[current.weekday()]:
            current += timedelta(days=1)
            continue

        # Cancel any existing submitted assignments that cover this day
        existing = frappe.get_all(
            "Shift Assignment",
            filters={
                "employee": employee,
                "start_date": ["<=", ds],
                "end_date": [">=", ds],
                "docstatus": 1,
            },
            fields=["name"],
        )
        for ex in existing:
            try:
                old = frappe.get_doc("Shift Assignment", ex.name)
                old.cancel()
            except Exception:
                pass

        doc = frappe.get_doc({
            "doctype": "Shift Assignment",
            "employee": employee,
            "shift_type": shift_type,
            "start_date": ds,
            "end_date": ds,
        })
        doc.insert(ignore_permissions=True)
        doc.submit()
        created.append(doc.name)

        current += timedelta(days=1)

    frappe.db.commit()
    return {"names": created, "count": len(created)}


@frappe.whitelist()
def get_weekly_panel_data(start_date, days=7):
    """Return panel data for a range starting on *start_date*.
    *days* can be 7 (week) or 28-31 (month).
    """
    from datetime import date as date_type

    from frappe.utils import getdate, nowdate
    start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
    days = int(days)
    end_date = start_date + timedelta(days=days-1)
    today = getdate(nowdate())

    # ── 1. Employees with shift assignments in this range ──
    assignments = frappe.get_all(
        "Shift Assignment",
        filters={
            "start_date": ["<=", str(end_date)],
            "end_date": [">=", str(start_date)],
            "docstatus": 1,
        },
        fields=["employee", "employee_name", "shift_type", "start_date", "end_date"],
        order_by="employee_name ASC",
    )

    employee_fields = ["name", "employee_name", "custom_identificacion", "branch", "status"]
    has_no_aplica_turno = frappe.db.has_column("Employee", "no_aplica_turno")
    if has_no_aplica_turno:
        employee_fields.append("no_aplica_turno")

    # Also fetch employees with no assignments but who are active
    all_employees = frappe.get_all(
        "Employee",
        filters={"status": ["in", ["Active", "Suspended", "Left"]]},
        fields=employee_fields,
        order_by="employee_name ASC",
    )

    # Build employee map
    emp_map = {}
    for emp in all_employees:
        if has_no_aplica_turno and emp.get("no_aplica_turno"):
            continue
        emp_map[emp.name] = {
            "employee": emp.name,
            "employee_name": emp.employee_name,
            "custom_identificacion": emp.custom_identificacion,
            "branch": emp.branch,
            "status": emp.status,
            "no_aplica_turno": emp.get("no_aplica_turno") or 0,
            "shifts": {},  # date_str -> shift_type
        }

    for asgn in assignments:
        eid = asgn.employee
        if eid not in emp_map:
            continue
        s = asgn.start_date
        e = asgn.end_date or asgn.start_date
        d = max(s, start_date)
        end = min(e, end_date)
        while d <= end:
            emp_map[eid]["shifts"][str(d)] = asgn.shift_type
            d += timedelta(days=1)

    # ── 2. Checkins in this range ──
    checkins = frappe.get_all(
        "Employee Checkin",
        filters={
            "time": ["between", [str(start_date), str(end_date) + " 23:59:59"]],
        },
        fields=["employee", "time", "log_type"],
        order_by="time ASC",
    )

    # Group checkins by employee and date
    checkin_map = {}  # emp -> date_str -> list of {time, action}
    for c in checkins:
        eid = c.employee
        ds = str(c.time.date())
        checkin_map.setdefault(eid, {}).setdefault(ds, []).append({
            "time": c.time,
            "action": "clock-in" if c.log_type=="IN" else "clock-out"
        })

    # ── 3. Leaves ──
    leaves = frappe.get_all(
        "Leave Application",
        filters={
            "employee": ["in", list(emp_map.keys()) or [""]],
            "from_date": ["<=", str(end_date)],
            "to_date": [">=", str(start_date)],
            "status": "Approved",
            "docstatus": 1,
        },
        fields=["employee", "from_date", "to_date", "leave_type", "half_day", "half_day_date"]
    )

    leave_map = {}  # emp -> date_str -> dict
    for lv in leaves:
        eid = lv.employee
        d = max(lv.from_date, start_date)
        end = min(lv.to_date, end_date)
        while d <= end:
            is_half = bool(lv.half_day) and str(lv.half_day_date) == str(d)
            leave_map.setdefault(eid, {})[str(d)] = {
                "type": lv.leave_type,
                "is_half": is_half
            }
            d += timedelta(days=1)

    # ── 4. Shift Type details ──
    shift_types = {}
    for st in frappe.get_all("Shift Type", fields=["name", "start_time", "end_time",
                                                     "begin_check_in_before_shift_start_time",
                                                     "allow_check_out_after_shift_end_time",
                                                     "late_entry_grace_period",
                                                     "early_exit_grace_period"]):
        shift_types[st.name] = st

    # ── 5. Build result ──
    result = []
    num_days = (end_date - start_date).days + 1
    for eid, info in emp_map.items():
        days = []
        for i in range(num_days):
            d = start_date + timedelta(days=i)
            ds = str(d)
            shift_name = info["shifts"].get(ds)
            leave_info = leave_map.get(eid, {}).get(ds)
            day_checkins = checkin_map.get(eid, {}).get(ds, [])

            status = "not_scheduled"
            shift_label = ""
            detail = ""
            trigger_at = None

            st = shift_types.get(shift_name, {}) if shift_name else None

            if leave_info:
                if leave_info["is_half"] and shift_name:
                    status = "leave"
                    if st and st.get("start_time") is not None and st.get("end_time") is not None:
                        shift_label = f"{_fmt_hour_12(st['start_time'])} - {_fmt_hour_12(st['end_time'])}"
                    else:
                        shift_label = shift_name
                    detail = leave_info["type"]
                else:
                    status = "leave"
                    shift_label = "Vacaciones/Permiso"
                    detail = leave_info["type"]
            elif shift_name:
                if st and st.get("start_time") is not None and st.get("end_time") is not None:
                    shift_label = f"{_fmt_hour_12(st['start_time'])} - {_fmt_hour_12(st['end_time'])}"
                else:
                    shift_label = shift_name

                shift_start = st.get("start_time") or timedelta(hours=8)
                shift_end = st.get("end_time") or timedelta(hours=17)
                grace_in = int(st.get("late_entry_grace_period") or 0)
                grace_out = int(st.get("early_exit_grace_period") or 0)

                # Convert shift times to datetime for comparison
                if isinstance(shift_start, timedelta):
                    shift_start_dt = datetime.combine(d, time()) + shift_start
                else:
                    shift_start_dt = datetime.combine(d, time()) + shift_start

                if isinstance(shift_end, timedelta):
                    shift_end_dt = datetime.combine(d, time()) + shift_end
                else:
                    shift_end_dt = datetime.combine(d, time()) + shift_end

                if d > today:
                    status = "future"
                elif not day_checkins:
                    if d == today:
                        from frappe.utils import now_datetime
                        now_dt = now_datetime().replace(tzinfo=None)
                        if now_dt < shift_start_dt:
                            status = "future"
                            detail = "Pendiente"
                            trigger_at = shift_start_dt.isoformat()
                        else:
                            status = "absent"
                    else:
                        status = "absent"
                else:
                    # Determine on-time vs late/early
                    first_in = None
                    last_out = None
                    for ck in day_checkins:
                        if ck["action"] == "clock-in" and first_in is None:
                            first_in = ck["time"]
                        if ck["action"] == "clock-out":
                            last_out = ck["time"]

                    late_in = False
                    early_out = False

                    if first_in:
                        checkin_time = first_in if isinstance(first_in, datetime) else datetime.combine(d, first_in)
                        if checkin_time.replace(tzinfo=None) > (shift_start_dt + timedelta(minutes=grace_in)):
                            late_in = True

                    if last_out:
                        checkout_time = last_out if isinstance(last_out, datetime) else datetime.combine(d, last_out)
                        if checkout_time.replace(tzinfo=None) < (shift_end_dt - timedelta(minutes=grace_out)):
                            early_out = True

                    if late_in or early_out:
                        status = "out_of_schedule"
                        if late_in and early_out:
                            detail = "Fuera de horario (E y S)"
                        elif late_in:
                            detail = "Fuera de horario (E)"
                        else:
                            detail = "Fuera de horario (S)"
                    else:
                        status = "on_time"
            else:
                if d > today:
                    status = "future"
                else:
                    status = "not_scheduled"

            days.append({
                "date": ds,
                "shift": shift_label,
                "shift_type": shift_name or "",
                "status": status,
                "detail": detail,
                "trigger_at": trigger_at
            })

        # Always include active employees
        result.append({
            "employee": eid,
            "employee_name": info["employee_name"],
            "custom_identificacion": info.get("custom_identificacion") or "",
            "branch": info.get("branch") or "",
            "status": info.get("status") or "Active",
            "days": days,
        })

    return result


@frappe.whitelist()
def get_day_details(employee, date):
    """Return shift assignment, leave, and checkin details for a specific employee+date."""
    shifts = frappe.get_all(
        "Shift Assignment",
        filters={
            "employee": employee,
            "start_date": ["<=", date],
            "end_date": [">=", date],
            "docstatus": 1,
        },
        fields=["name", "shift_type", "start_date", "end_date"],
    )
    leaves = frappe.get_all(
        "Leave Application",
        filters={
            "employee": employee,
            "from_date": ["<=", date],
            "to_date": [">=", date],
            "docstatus": 1,
        },
        fields=["name", "leave_type", "from_date", "to_date",
                "half_day", "half_day_date", "description", "status"],
    )
    checkins = frappe.get_all(
        "Employee Checkin",
        filters={
            "employee": employee,
            "time": ["between", [f"{date} 00:00:00", f"{date} 23:59:59"]],
        },
        fields=["name", "time", "custom_registration_type", "log_type"],
        order_by="time ASC",
    )
    # Format times as strings for JSON serialization
    for c in checkins:
        c["time"] = str(c["time"])

    return {
        "shift_assignments": shifts,
        "leave_applications": leaves,
        "checkins": checkins,
    }


@frappe.whitelist()
def remove_shift_assignment(employee, date):
    """Cancel shift assignment(s) for a specific employee+date."""
    existing = frappe.get_all(
        "Shift Assignment",
        filters={
            "employee": employee,
            "start_date": ["<=", date],
            "end_date": [">=", date],
            "docstatus": 1,
        },
        fields=["name"],
    )
    cancelled = []
    for ex in existing:
        doc = frappe.get_doc("Shift Assignment", ex.name)
        doc.cancel()
        cancelled.append(ex.name)
    frappe.db.commit()
    return {"cancelled": cancelled, "count": len(cancelled)}


@frappe.whitelist()
def create_leave(employee, leave_type, from_date, to_date,
                half_day=0, half_day_date=None, description=None):
    """Create and submit a Leave Application.

    Automatically creates a Leave Allocation if none exists for the
    employee + leave_type covering the requested period.
    """
    # Ensure a Leave Allocation exists for this period
    _ensure_leave_allocation(employee, leave_type, from_date, to_date)

    doc = frappe.get_doc({
        "doctype": "Leave Application",
        "employee": employee,
        "leave_type": leave_type,
        "from_date": from_date,
        "to_date": to_date,
        "half_day": int(half_day),
        "half_day_date": half_day_date if int(half_day) else None,
        "description": description or "",
        "status": "Approved",
        "leave_approver": frappe.session.user,
    })
    doc.insert(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()
    return {"name": doc.name}


def _ensure_leave_allocation(employee, leave_type, from_date, to_date):
    """Create a Leave Allocation if none covers the requested dates."""
    existing = frappe.get_all(
        "Leave Allocation",
        filters={
            "employee": employee,
            "leave_type": leave_type,
            "from_date": ["<=", from_date],
            "to_date": [">=", to_date],
            "docstatus": 1,
        },
        limit=1,
    )
    if existing:
        return

    # Build an allocation for the full year containing from_date
    year = datetime.strptime(str(from_date), "%Y-%m-%d").year
    alloc = frappe.get_doc({
        "doctype": "Leave Allocation",
        "employee": employee,
        "leave_type": leave_type,
        "from_date": f"{year}-01-01",
        "to_date": f"{year}-12-31",
        "new_leaves_allocated": 30,
    })
    alloc.insert(ignore_permissions=True)
    alloc.submit()
    frappe.db.commit()


@frappe.whitelist()
def cancel_leave(leave_name):
    """Cancel an existing Leave Application."""
    doc = frappe.get_doc("Leave Application", leave_name)
    doc.cancel()
    frappe.db.commit()
    return {"name": doc.name}


@frappe.whitelist()
def get_leave_type_options():
    """Return leave types available for employee self-service."""
    return frappe.get_all(
        "Leave Type",
        fields=["name"],
        order_by="name asc",
        limit=200,
    )


@frappe.whitelist()
def get_my_leave_applications(limit=20):
    """Return the current employee's recent leave applications."""
    employee = _get_session_employee()
    rows = frappe.get_all(
        "Leave Application",
        filters={"employee": employee.name, "docstatus": ["<", 2]},
        fields=[
            "name",
            "leave_type",
            "from_date",
            "to_date",
            "half_day",
            "half_day_date",
            "status",
            "description",
            "leave_approver",
            "creation",
        ],
        order_by="creation desc",
        limit=int(limit or 20),
    )
    for row in rows:
        row["can_cancel"] = row.status == "Open"
    return rows


@frappe.whitelist()
def request_mobile_leave(leave_type, from_date, to_date, half_day=0, half_day_date=None, description=None):
    """Create a draft Leave Application for approval from the attendance page."""
    employee = _get_session_employee()

    from frappe.utils import getdate

    start = getdate(from_date)
    end = getdate(to_date)
    if end < start:
        frappe.throw(_("La fecha final no puede ser menor que la fecha inicial."))

    half_day = int(half_day or 0)
    if half_day and not half_day_date:
        half_day_date = from_date

    overlapping = frappe.get_all(
        "Leave Application",
        filters={
            "employee": employee.name,
            "from_date": ["<=", str(end)],
            "to_date": [">=", str(start)],
            "status": ["in", ["Open", "Approved"]],
            "docstatus": ["<", 2],
        },
        fields=["name", "status"],
        limit=1,
    )
    if overlapping:
        frappe.throw(_("Ya existe una solicitud de vacaciones en ese rango."))

    # ── Asegurar Asignación de Licencia con Fechas y Saldo Suficientes ──
    allocations = frappe.db.get_all(
        "Leave Allocation",
        filters={
            "employee": employee.name,
            "leave_type": leave_type,
            "docstatus": 1
        },
        fields=["name", "from_date", "to_date", "new_leaves_allocated"],
        order_by="from_date asc"
    )

    if allocations:
        # Buscar si alguna cubre completamente el rango start/end
        covering_alloc = None
        for alloc in allocations:
            if getdate(alloc.from_date) <= start and getdate(alloc.to_date) >= end:
                covering_alloc = alloc
                break
        
        if covering_alloc:
            # Asegurar saldo de días
            new_leaves = float(covering_alloc.new_leaves_allocated or 0) + 30
            frappe.db.set_value("Leave Allocation", covering_alloc.name, {
                "new_leaves_allocated": new_leaves,
                "total_leaves_allocated": new_leaves
            })
        else:
            # Expandir la fecha de la asignación existente para que cubra la solicitud
            target_alloc = allocations[0]
            curr_from = getdate(target_alloc.from_date)
            curr_to = getdate(target_alloc.to_date)
            
            new_from = start if start < curr_from else curr_from
            new_to = end if end > curr_to else curr_to
            new_leaves = float(target_alloc.new_leaves_allocated or 0) + 30
            
            frappe.db.set_value("Leave Allocation", target_alloc.name, {
                "from_date": new_from,
                "to_date": new_to,
                "new_leaves_allocated": new_leaves,
                "total_leaves_allocated": new_leaves
            })
    else:
        # No existe ninguna asignación, creamos una nueva que cubra el año completo
        from frappe.utils import get_year_start, get_year_end
        alloc_doc = frappe.get_doc({
            "doctype": "Leave Allocation",
            "employee": employee.name,
            "leave_type": leave_type,
            "from_date": get_year_start(start),
            "to_date": get_year_end(end),
            "new_leaves_allocated": 30,
            "description": "Auto-asignado por sistema móvil"
        })
        alloc_doc.insert(ignore_permissions=True)
        alloc_doc.submit()

    # Crear e insertar la solicitud de licencia
    doc = frappe.get_doc({
        "doctype": "Leave Application",
        "employee": employee.name,
        "leave_type": leave_type,
        "from_date": start,
        "to_date": end,
        "half_day": half_day,
        "half_day_date": half_day_date if half_day else None,
        "description": description or "",
        "status": "Open",
        "leave_approver": _get_leave_approver(employee.name),
    })

    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    notify_shift_panel_update(doc, None)
    return {"name": doc.name}


@frappe.whitelist()
def cancel_mobile_leave(leave_name):
    """Allow an employee to cancel their own pending leave request."""
    employee = _get_session_employee()
    doc = frappe.get_doc("Leave Application", leave_name)
    if doc.employee != employee.name:
        frappe.throw(_("No puedes cancelar una solicitud de otro empleado."))
    if doc.status != "Open" or doc.docstatus != 0:
        frappe.throw(_("Solo se pueden cancelar solicitudes sin aprobar o rechazar."))

    doc.status = "Cancelled"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    notify_shift_panel_update(doc, None)
    return {"name": doc.name}


@frappe.whitelist()
def get_pending_leave_approvals():
    """Return pending leave applications assigned to the current leave approver."""
    if frappe.session.user == "Guest":
        frappe.throw(_("Not logged in"), frappe.AuthenticationError)

    filters = {
        "status": "Open",
        "docstatus": 0,
    }
    if not _is_privileged_approver():
        filters["leave_approver"] = frappe.session.user

    rows = frappe.get_all(
        "Leave Application",
        filters=filters,
        fields=[
            "name",
            "employee",
            "employee_name",
            "leave_type",
            "from_date",
            "to_date",
            "half_day",
            "half_day_date",
            "description",
            "leave_approver",
            "creation",
        ],
        order_by="creation asc",
        limit=200,
    )
    return rows


@frappe.whitelist()
def decide_leave_application(leave_name, action):
    """Approve or reject a pending leave application assigned to this approver."""
    if frappe.session.user == "Guest":
        frappe.throw(_("Not logged in"), frappe.AuthenticationError)

    doc = frappe.get_doc("Leave Application", leave_name)
    if doc.leave_approver != frappe.session.user and not _is_privileged_approver():
        frappe.throw(_("No eres el aprobador asignado para esta solicitud y no tienes permisos de administrador."))
    if doc.status != "Open" or doc.docstatus != 0:
        frappe.throw(_("Esta solicitud ya fue procesada."))

    action = (action or "").lower()
    if action == "approve":
        _ensure_leave_allocation(doc.employee, doc.leave_type, doc.from_date, doc.to_date)
        doc.status = "Approved"
        doc.leave_approver = frappe.session.user
        doc.save(ignore_permissions=True)
        doc.submit()
    elif action == "reject":
        doc.status = "Rejected"
        doc.save(ignore_permissions=True)
    else:
        frappe.throw(_("Accion no valida."))

    frappe.db.commit()
    notify_shift_panel_update(doc, None)
    return {"name": doc.name, "status": doc.status}


def _split_first_name(raw_name):
    """Split a compound first-name into (first_name, middle_name).

    Handles Spanish connectors so that, for example:
    - "Juan Alonso"        → ("Juan", "Alonso")
    - "Ana de los Angeles" → ("Ana", "de los Angeles")
    - "María"              → ("María", "")

    Connectors (de, del, de la, de los, de las, el, la, los, las)
    are kept together with the word that follows them.
    """
    CONNECTORS = {"de", "del", "la", "las", "los", "el"}
    parts = (raw_name or "").strip().split()
    if len(parts) <= 1:
        return (raw_name or "").strip(), ""

    first = parts[0]
    rest = parts[1:]

    # If the remaining text starts with a connector, keep it all as middle
    if rest[0].lower() in CONNECTORS:
        return first, " ".join(rest)

    return first, " ".join(rest)


SHIFT_PANEL_USER_ROLES = ("Employee", "HR User", "HR Manager", "System Manager")


@frappe.whitelist()
def get_shift_panel_user_role(user):
    if not user:
        return "Employee"

    roles = set(frappe.get_roles(user))
    for role in reversed(SHIFT_PANEL_USER_ROLES):
        if role in roles:
            return role
    return "Employee"


@frappe.whitelist()
def update_employee_user_access(user, user_role=None, new_password=None, enabled=1, username=None):
    if not user:
        frappe.throw(_("Usuario no especificado."))

    user_doc = frappe.get_doc("User", user)
    user_doc.enabled = 1 if int(enabled or 0) else 0

    if username is not None:
        user_doc.username = username

    if new_password:
        user_doc.new_password = new_password

    if user_role:
        if user_role not in SHIFT_PANEL_USER_ROLES:
            frappe.throw(_("Rol no permitido: {0}").format(user_role))

        managed_roles = set(SHIFT_PANEL_USER_ROLES)
        existing_roles = [{"role": row.role} for row in user_doc.get("roles", []) if row.role not in managed_roles]
        user_doc.set("roles", existing_roles)
        user_doc.append("roles", {"role": user_role})

    user_doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"user": user_doc.name, "user_role": get_shift_panel_user_role(user_doc.name)}


@frappe.whitelist()
def create_employee_with_user(
    first_name,
    last_name=None,
    email=None,
    gender=None,
    date_of_birth=None,
    date_of_joining=None,
    designation=None,
    department=None,
    branch=None,
    user_role="Employee",
    password=None,
    username=None,
):
    """Alta Rápida de Empleado.

    Creates an Employee record and, when *email* is supplied, ensures a
    matching User account exists (creates one if it doesn't).  The User is
    linked to the employee via the ``user_id`` field.

    The incoming *first_name* is parsed to extract
    ``first_name`` / ``middle_name`` (e.g. "Ana de los Angeles" →
    first="Ana", middle="de los Angeles").

    Returns ``{"employee": name, "user": email_or_None, "user_created": bool}``.
    """
    # ── 0. Parse composite first name ───────────────────────────────────────
    actual_first, actual_middle = _split_first_name(first_name)

    # Build full employee_name
    name_parts = [actual_first]
    if actual_middle:
        name_parts.append(actual_middle)
    if last_name:
        name_parts.append(last_name)
    employee_name = " ".join(name_parts)

    # ── 1. Create the Employee ──────────────────────────────────────────────
    emp_doc = frappe.get_doc({
        "doctype": "Employee",
        "first_name": actual_first,
        "middle_name": actual_middle,
        "last_name": last_name or "",
        "employee_name": employee_name,
        "date_of_birth": date_of_birth or None,
        "date_of_joining": date_of_joining or frappe.utils.today(),
        "designation": designation or None,
        "department": department or None,
        "branch": branch or None,
        "salary_mode": "Bank",
        "status": "Active",
        "company": frappe.defaults.get_defaults().get("company"),
        "gender": gender or "Male",
    })
    if email:
        emp_doc.prefered_email = email

    emp_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # ── 2. Ensure a User exists for this email ──────────────────────────────
    user_created = False
    if email:
        email = email.strip().lower()
        if not frappe.db.exists("User", email):
            # Create the User WITHOUT the target role first to avoid
            # Frappe stripping it (it validates Employee ↔ User link).
            user_doc = frappe.get_doc({
                "doctype": "User",
                "email": email,
                "first_name": actual_first,
                "last_name": last_name or "",
                "username": username,
                "send_welcome_email": 0,
                "user_type": "System User",
            })
            if password:
                user_doc.new_password = password
            user_doc.insert(ignore_permissions=True)
            user_created = True

        # Link employee → user (must happen BEFORE adding the role)
        frappe.db.set_value("Employee", emp_doc.name, "user_id", email)
        frappe.db.commit()

        # Now add the role — the Employee link exists so Frappe keeps it
        user_doc = frappe.get_doc("User", email)
        has_role = any(r.role == user_role for r in user_doc.get("roles", []))
        if not has_role:
            user_doc.add_roles(user_role)
        frappe.db.commit()

    return {
        "employee": emp_doc.name,
        "employee_name": emp_doc.employee_name,
        "user": email if email else None,
        "user_created": user_created,
    }


@frappe.whitelist()
def get_mobile_profile():
    if frappe.session.user == "Guest":
        frappe.throw(_("Not logged in"), frappe.AuthenticationError)
        
    employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, ["name", "employee_name", "branch"], as_dict=True)
    if not employee:
        return {"not_employee": True}
        
    # Get Branch details
    branch_data = {}
    if employee.get("branch"):
        branch_data = frappe.db.get_value(
            "Branch", 
            employee["branch"], 
            ["name", "custom_latitud", "custom_longitud"], 
            as_dict=True
        ) or {}
        
    # Get Settings max_distance and geolocation toggle
    settings = frappe.get_doc("Ajustes de Control Asistencia")
    try:
        max_distance_meters = float(settings.max_distance_meters) if settings.max_distance_meters is not None else 20
    except ValueError:
        max_distance_meters = 20
        
    require_geolocation = bool(settings.require_geolocation)

    # Get last checkin status to determine if we should show IN or OUT
    last_log_type = frappe.db.get_value(
        "Employee Checkin",
        {"employee": employee.name},
        "log_type",
        order_by="time desc"
    ) or "OUT"

    user_roles = frappe.get_roles(frappe.session.user)
    show_desk_btn = any(role in user_roles for role in ["HR User", "HR Manager", "Administrator", "System Manager"])
        
    return {
        "employee_id": employee.name,
        "employee_name": employee.employee_name,
        "branch": branch_data.get("name"),
        "branch_lat": branch_data.get("custom_latitud"),
        "branch_lng": branch_data.get("custom_longitud"),
        "max_distance": max_distance_meters,
        "last_log_type": last_log_type,
        "require_geolocation": require_geolocation,
        "show_desk_btn": show_desk_btn
    }

@frappe.whitelist()
def record_mobile_checkin(log_type, latitude=None, longitude=None, device_id=None):
    if frappe.session.user == "Guest":
        frappe.throw(_("Not logged in"), frappe.AuthenticationError)
        
    emp_data = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, ["name", "attendance_device_id", "branch"], as_dict=True)
    if not emp_data:
        frappe.throw(_("No employee linked to your account."))
        
    employee_id = emp_data["name"]
    
    # ── Validación de Geolocalización (si es requerida) ──
    settings = frappe.get_doc("Ajustes de Control Asistencia")
    if bool(settings.require_geolocation):
        if not emp_data.get("branch"):
            frappe.throw(_("No se puede registrar asistencia: No tienes una sucursal asignada y la geolocalización es requerida."))
        
        branch_coords = frappe.db.get_value("Branch", emp_data["branch"], ["custom_latitud", "custom_longitud"], as_dict=True)
        if not branch_coords or branch_coords.get("custom_latitud") is None or branch_coords.get("custom_longitud") is None:
            frappe.throw(_("No se puede registrar asistencia: Tu sucursal no tiene coordenadas de geolocalización configuradas."))
            
        if latitude is None or longitude is None:
            frappe.throw(_("Se requiere la ubicación GPS para registrar asistencia."))
            
        # Calcular distancia
        import math
        def get_distance_py(lat1, lon1, lat2, lon2):
            R = 6371000  # metros
            p1 = math.radians(lat1)
            p2 = math.radians(lat2)
            dp = math.radians(lat2 - lat1)
            dl = math.radians(lon2 - lon1)
            a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        try:
            dist = get_distance_py(float(latitude), float(longitude), float(branch_coords["custom_latitud"]), float(branch_coords["custom_longitud"]))
        except (ValueError, TypeError):
            frappe.throw(_("Coordenadas de ubicación inválidas."))
            
        max_dist = float(settings.max_distance_meters) if settings.max_distance_meters is not None else 20
        if dist > max_dist:
            frappe.throw(_("Estás fuera del rango permitido de la sucursal. Distancia: {0} metros. Máximo permitido: {1} metros.").format(round(dist), max_dist))

    # ── Validación de Dispositivo (MAC/Device ID) ──
    if emp_data.get("attendance_device_id"):
        if emp_data.get("attendance_device_id") != device_id:
            frappe.throw("Seguridad: Este dispositivo no está autorizado para este usuario. Tu dispositivo enlazado es diferente.")
    else:
        # Auto-enroll si no tiene dispositivo 
        if device_id and device_id != 'unknown':
            frappe.db.set_value("Employee", employee_id, "attendance_device_id", device_id)
            frappe.db.commit()
            
    doc = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee_id,
        "log_type": log_type,
        "time": frappe.utils.now(),
        "latitude": latitude,
        "longitude": longitude
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "time": doc.time, "log_type": doc.log_type}

def _get_attendance_data(employee, date_obj, shift_name=None):
    """Calculate attendance status/times for an employee on a specific date."""
    ds = str(date_obj)

    # 1. Get shift (if not provided by checkin doc)
    if not shift_name:
        asgn = frappe.get_all(
            "Shift Assignment",
            filters={"employee": employee, "start_date": ["<=", ds], "end_date": [">=", ds], "docstatus": 1},
            fields=["shift_type"],
            limit=1
        )
        shift_name = asgn[0].shift_type if asgn else None
    
    # 2. Get shift details
    st = None
    if shift_name:
        st = frappe.get_value("Shift Type", shift_name, 
                             ["start_time", "end_time", "late_entry_grace_period", "early_exit_grace_period"], 
                             as_dict=True)

    # 3. Get checkins
    checkins = frappe.get_all(
        "Employee Checkin",
        filters={"employee": employee, "time": ["between", [f"{ds} 00:00:00", f"{ds} 23:59:59"]]},
        fields=["time", "log_type"],
        order_by="time ASC"
    )

    first_in = None
    last_out = None
    for ck in checkins:
        if ck.log_type == "IN" and first_in is None:
            first_in = ck.time
        if ck.log_type == "OUT":
            last_out = ck.time

    late_entry = 0
    early_exit = 0
    if st and st.start_time and first_in:
        grace = int(st.late_entry_grace_period or 0)
        shift_start_dt = datetime.combine(date_obj, (datetime.min + st.start_time).time())
        if first_in.replace(tzinfo=None) > (shift_start_dt + timedelta(minutes=grace)):
            late_entry = 1

    if st and st.end_time and last_out:
        grace = int(st.early_exit_grace_period or 0)
        shift_end_dt = datetime.combine(date_obj, (datetime.min + st.end_time).time())
        if last_out.replace(tzinfo=None) < (shift_end_dt - timedelta(minutes=grace)):
            early_exit = 1

    return {
        "shift": shift_name,
        "late_entry": late_entry,
        "early_exit": early_exit,
        "in_time": first_in,
        "out_time": last_out,
        "status": "Present" if first_in else "Absent"
    }


def sync_attendance_from_checkin(doc, method=None):
    """Hook: auto-create/update Attendance record when a checkin is added."""
    from frappe.utils import getdate
    
    employee = doc.employee
    date_obj = getdate(doc.time)
    
    # Get attendance metrics, using doc.shift if available
    data = _get_attendance_data(employee, date_obj, shift_name=doc.get("shift"))
    
    # Find or create Attendance
    filters = {"employee": employee, "attendance_date": date_obj, "docstatus": ["<", 2]}
    name = frappe.db.get_value("Attendance", filters, "name")
    
    if name:
        att = frappe.get_doc("Attendance", name)
        att.status = data["status"]
        att.shift = data["shift"]
        att.late_entry = data["late_entry"]
        att.early_exit = data["early_exit"]
        att.in_time = data["in_time"]
        att.out_time = data["out_time"]
        att.save(ignore_permissions=True)
    else:
        # Create new but only if they have at least one checkin
        if data["status"] == "Present":
            emp_info = frappe.db.get_value("Employee", employee, ["employee_name", "company", "department"], as_dict=True)
            att = frappe.get_doc({
                "doctype": "Attendance",
                "employee": employee,
                "employee_name": emp_info.employee_name,
                "company": emp_info.company,
                "department": emp_info.department,
                "attendance_date": date_obj,
                "status": data["status"],
                "shift": data["shift"],
                "late_entry": data["late_entry"],
                "early_exit": data["early_exit"],
                "in_time": data["in_time"],
                "out_time": data["out_time"]
            })
            att.insert(ignore_permissions=True)
    
    frappe.db.commit()


def notify_shift_panel_update(doc, method):
    """Publish a realtime event when a related document is modified."""
    if doc.doctype == "Employee Checkin":
        sync_attendance_from_checkin(doc, method)
    frappe.publish_realtime("update_shift_panel")
