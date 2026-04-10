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

    # Also fetch employees with no assignments but who are active
    all_employees = frappe.get_all(
        "Employee",
        filters={"status": ["in", ["Active", "Inactive", "Suspended", "Left"]]},
        fields=["name", "employee_name", "custom_identificacion", "branch", "status"],
        order_by="employee_name ASC",
    )

    # Build employee map
    emp_map = {}
    for emp in all_employees:
        emp_map[emp.name] = {
            "employee": emp.name,
            "employee_name": emp.employee_name,
            "custom_identificacion": emp.custom_identificacion,
            "branch": emp.branch,
            "status": emp.status,
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


def notify_shift_panel_update(doc, method):
    """Publish a realtime event when a related document is modified."""
    frappe.publish_realtime("update_shift_panel")
