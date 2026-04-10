/**
 * Panel de Turnos – Vista semanal
 * Muestra empleados × días con código de colores según asistencia.
 */

const API = 'control_asistencia.control_asistencia.shift_panel';
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STATUS_LABELS = {
    on_time:         'En tiempo',
    out_of_schedule: 'Fuera de horario',
    absent:          'Ausente',
    leave:           'Vacaciones/Permiso',
    not_scheduled:   'No programado',
    future:          'Día futuro',
};

let currentWeekStart = getMonday(new Date());
let weeklyData = [];

frappe.pages['panel-turnos'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Panel de Turnos'),
        single_column: true,
    });

    $(page.body).html(`
        <div class="shift-panel-container">
            <div class="shift-panel-toolbar">
                <button class="btn btn-default btn-sm" id="prev-week">◀ Anterior</button>
                <span class="week-label" id="week-label"></span>
                <button class="btn btn-default btn-sm" id="next-week">Siguiente ▶</button>
                <div style="flex:1"></div>
                <input type="text" id="employee-filter" class="form-control input-sm" placeholder="Buscar empleado..." style="max-width: 200px;">
                <button class="btn btn-primary btn-sm" id="btn-create-shift">+ Crear Turno</button>
                <button class="btn btn-success btn-sm" id="btn-assign-shift">Asignar Turno</button>
            </div>
            <div class="shift-legend" id="shift-legend"></div>
            <div id="grid-wrapper" style="max-height: 70vh; overflow: auto; border: 1px solid var(--border-color, #d1d8dd);"></div>
        </div>
    `);

    renderLegend();
    bindEvents();
    loadWeek();

    // Escuchar eventos en tiempo real (WebSockets) desde el backend
    frappe.realtime.on('update_shift_panel', () => {
        loadWeek();
    });
};

frappe.pages['panel-turnos'].on_page_show = function (wrapper) {
    // The panel auto-refreshes using real-time WebSockets and precise millisecond timeouts
    // so no periodic polling is needed here.
};

frappe.pages['panel-turnos'].on_page_hide = function (wrapper) {
    if (typeof clearShiftTimeouts === 'function') {
        clearShiftTimeouts();
    }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    dt.setDate(diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function fmtDate(d) {
    return d.toISOString().slice(0, 10);
}

function fmtShort(d) {
    return d.getDate() + '/' + (d.getMonth() + 1);
}

function renderLegend() {
    const colors = {
        on_time: '#d4edda', out_of_schedule: '#ffe8cc',
        absent: '#f8d7da', leave: '#cce5ff',
        not_scheduled: '#ffffff', future: '#ffffff',
    };
    let html = '';
    for (const [key, label] of Object.entries(STATUS_LABELS)) {
        html += `<span><span class="legend-dot" style="background:${colors[key]}"></span>${label}</span>`;
    }
    document.getElementById('shift-legend').innerHTML = html;
}

// ── Events ──────────────────────────────────────────────────────────────────

function bindEvents() {
    document.getElementById('employee-filter').addEventListener('input', () => {
        applyFilterAndRender();
    });
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeek();
    });
    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeek();
    });
    document.getElementById('btn-create-shift').addEventListener('click', showCreateShiftDialog);
    document.getElementById('btn-assign-shift').addEventListener('click', showAssignShiftDialog);

    // Click on any day cell to edit
    document.getElementById('grid-wrapper').addEventListener('click', (e) => {
        const td = e.target.closest('td[data-employee]');
        if (!td) return;
        const employee = td.dataset.employee;
        const date = td.dataset.date;
        const empName = td.closest('tr').querySelector('.cell-employee').textContent.trim();
        showDayEditDialog(employee, empName, date);
    });
}

// ── Load & Render ───────────────────────────────────────────────────────────

function loadWeek() {
    const ws = fmtDate(currentWeekStart);
    const we = new Date(currentWeekStart);
    we.setDate(we.getDate() + 6);

    document.getElementById('week-label').textContent =
        fmtShort(currentWeekStart) + ' – ' + fmtShort(we) + ' ' + currentWeekStart.getFullYear();

    frappe.call({
        method: `${API}.get_weekly_panel_data`,
        args: { week_start: ws },
        callback: ({ message }) => {
            weeklyData = message || [];
            applyFilterAndRender();
        },
        error: () => frappe.msgprint(__('Error al cargar los datos del panel.')),
    });
}

let shiftTimeouts = [];

function clearShiftTimeouts() {
    shiftTimeouts.forEach(clearTimeout);
    shiftTimeouts = [];
}

function scheduleTimeouts(data) {
    clearShiftTimeouts();
    const now = new Date();
    for (const emp of data) {
        for (const day of emp.days) {
            if (day.trigger_at) {
                const triggerTime = new Date(day.trigger_at);
                const delayMs = triggerTime - now;
                if (delayMs > 0 && delayMs <= 86400000) { // only if within 24 hours
                    const to = setTimeout(() => {
                        loadWeek();
                    }, delayMs);
                    shiftTimeouts.push(to);
                }
            }
        }
    }
}

function applyFilterAndRender() {
    const filterText = (document.getElementById('employee-filter').value || '').toLowerCase();
    let data = weeklyData;
    if (filterText) {
        data = weeklyData.filter(emp => 
            emp.employee_name.toLowerCase().includes(filterText) || 
            emp.employee.toLowerCase().includes(filterText)
        );
    }
    renderGrid(data);
    scheduleTimeouts(data);
}

function renderGrid(data) {
    const ws = new Date(currentWeekStart);
    let headerCols = '<th class="col-employee">Empleado</th>';
    for (let i = 0; i < 7; i++) {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        headerCols += `<th>${DAY_NAMES[i]}<br><small>${fmtShort(d)}</small></th>`;
    }

    let rows = '';
    if (!data.length) {
        rows = `<tr><td colspan="8" style="padding:20px;color:#999;">No hay turnos asignados en esta semana.</td></tr>`;
    }
    for (const emp of data) {
        let cells = `<td class="cell-employee" title="${emp.employee}">${emp.employee_name}</td>`;
        for (const day of emp.days) {
            const cls = 'cell-' + day.status;
            const label = day.shift || '—';
            const detail = day.detail || STATUS_LABELS[day.status] || '';
            cells += `<td class="${cls} day-cell" data-employee="${emp.employee}" data-date="${day.date}">
                <span class="shift-name">${label}</span>
                <span class="shift-detail">${detail}</span>
            </td>`;
        }
        rows += `<tr>${cells}</tr>`;
    }

    document.getElementById('grid-wrapper').innerHTML = `
        <table class="shift-grid">
            <thead><tr>${headerCols}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ── Dialogs ─────────────────────────────────────────────────────────────────

function showCreateShiftDialog() {
    const d = new frappe.ui.Dialog({
        title: __('Crear Nuevo Turno'),
        fields: [
            { fieldname: 'start_time', label: __('Hora de Inicio'), fieldtype: 'Time', reqd: 1 },
            { fieldname: 'end_time',   label: __('Hora de Fin'),    fieldtype: 'Time', reqd: 1 },
        ],
        primary_action_label: __('Crear'),
        primary_action: (values) => {
            frappe.call({
                method: `${API}.create_shift_type`,
                args: { start_time: values.start_time, end_time: values.end_time },
                callback: ({ message }) => {
                    d.hide();
                    frappe.msgprint(__('Turno "{0}" creado.', [message.name]));
                },
            });
        },
    });
    d.show();
}

function showAssignShiftDialog() {
    frappe.call({
        method: `${API}.get_shift_types`,
        callback: ({ message: shifts }) => {
            const options = (shifts || []).map(s => ({ label: s.label || s.name, value: s.name }));

            const d = new frappe.ui.Dialog({
                title: __('Asignar Turno'),
                fields: [
                    { fieldname: 'employee', label: __('Empleado'), fieldtype: 'Link', options: 'Employee', reqd: 1 },
                    { fieldname: 'shift_type', label: __('Turno'), fieldtype: 'Select', options: options, reqd: 1 },
                    { fieldname: 'start_date', label: __('Fecha Inicio'), fieldtype: 'Date', reqd: 1, default: fmtDate(currentWeekStart) },
                    { fieldname: 'end_date',   label: __('Fecha Fin'),    fieldtype: 'Date', reqd: 1,
                        default: fmtDate(new Date(currentWeekStart.getTime() + 6*24*60*60*1000)) },
                ],
                primary_action_label: __('Asignar'),
                primary_action: (values) => {
                    frappe.call({
                        method: `${API}.assign_shift`,
                        args: values,
                        freeze: true,
                        freeze_message: __('Asignando turnos...'),
                        callback: ({ message }) => {
                            d.hide();
                            const n = message.count || 1;
                            frappe.msgprint(
                                n === 1
                                    ? __('Turno asignado correctamente.')
                                    : __('Se asignaron {0} turnos (uno por día).', [n])
                            );
                            loadWeek();
                        },
                    });
                },
            });
            d.show();
        },
    });
}

// ── Day Cell Edit Dialog ────────────────────────────────────────────────────

function showDayEditDialog(employee, employeeName, date) {
    frappe.call({
        method: `${API}.get_day_details`,
        args: { employee, date },
        freeze: true,
        freeze_message: __('Cargando...'),
        callback: ({ message }) => {
            _buildDayDialog(employee, employeeName, date, message);
        },
    });
}

function _buildDayDialog(employee, employeeName, date, details) {
    const currentShifts = details.shift_assignments || [];
    const currentLeaves = details.leave_applications || [];
    const hasShift = currentShifts.length > 0;
    const hasLeave = currentLeaves.length > 0;

    const dateObj = new Date(date + 'T12:00:00');
    const dateDisplay = dateObj.toLocaleDateString('es', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // ── Build info HTML ──
    const checkins = details.checkins || [];
    let infoHtml = '<div style="margin-bottom:4px;">';
    if (hasShift) {
        infoHtml += `<div class="alert alert-info" style="padding:8px 12px;margin-bottom:6px;font-size:13px;">
            <strong>${__('Turno actual:')}</strong> ${currentShifts[0].shift_type}
            <br><small class="text-muted">${currentShifts[0].name}</small>
        </div>`;
    }
    if (hasLeave) {
        const lv = currentLeaves[0];
        infoHtml += `<div class="alert alert-warning" style="padding:8px 12px;margin-bottom:6px;font-size:13px;">
            <strong>${__('Permiso:')}</strong> ${lv.leave_type}${lv.half_day ? ' (' + __('Medio día') + ')' : ''}
            ${lv.description ? '<br>' + __('Motivo:') + ' ' + lv.description : ''}
            <br><small class="text-muted">${lv.name}</small>
        </div>`;
    }
    if (!hasShift && !hasLeave) {
        infoHtml += `<div class="text-muted" style="margin-bottom:6px;font-size:13px;">${__('Sin turno ni permiso asignado.')}</div>`;
    }

    // ── Checkin info ──
    if (checkins.length) {
        const fmtTime = (t) => {
            const dt = new Date(t);
            return dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true });
        };
        // Resolve action: prefer custom_registration_type, fallback to log_type
        const resolveAction = (c) => {
            const crt = (c.custom_registration_type || '').toLowerCase();
            if (crt) return crt;
            // Fallback to log_type field (IN/OUT)
            const lt = (c.log_type || '').toUpperCase();
            if (lt === 'IN') return 'clock-in';
            if (lt === 'OUT') return 'clock-out';
            return '';
        };
        const typeLabel = (action) => {
            if (action === 'clock-in')     return '🟢 Entrada';
            if (action === 'clock-out')    return '🔴 Salida';
            if (action === 'break start')  return '🟡 Inicio Break';
            if (action === 'break end')    return '🔵 Fin Break';
            return action || '—';
        };

        const firstIn = checkins.find(c => resolveAction(c) === 'clock-in');
        const lastOut = [...checkins].reverse().find(c => resolveAction(c) === 'clock-out');

        let checkinHtml = '<div class="alert alert-success" style="padding:8px 12px;margin-bottom:6px;font-size:13px;">';
        checkinHtml += `<strong>${__('Registros de asistencia')}</strong><br>`;
        checkinHtml += `<span>${__('Primer entrada:')} <strong>${firstIn ? fmtTime(firstIn.time) : '—'}</strong></span>`;
        checkinHtml += ` &nbsp;|&nbsp; `;
        checkinHtml += `<span>${__('Última salida:')} <strong>${lastOut ? fmtTime(lastOut.time) : '—'}</strong></span>`;

        // Full list
        checkinHtml += '<table style="width:100%;margin-top:6px;font-size:12px;border-collapse:collapse;">';
        checkinHtml += `<tr style="border-bottom:1px solid rgba(0,0,0,0.1);"><th style="text-align:left;padding:2px 4px;">${__('Hora')}</th><th style="text-align:left;padding:2px 4px;">${__('Tipo')}</th></tr>`;
        for (const c of checkins) {
            const action = resolveAction(c);
            checkinHtml += `<tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                <td style="padding:2px 4px;">${fmtTime(c.time)}</td>
                <td style="padding:2px 4px;">${typeLabel(action)}</td>
            </tr>`;
        }
        checkinHtml += '</table></div>';
        infoHtml += checkinHtml;
    } else {
        infoHtml += `<div class="text-muted" style="margin-bottom:6px;font-size:12px;">${__('Sin registros de asistencia.')}</div>`;
    }

    infoHtml += '</div>';

    const d = new frappe.ui.Dialog({
        title: `${employeeName} — ${dateDisplay}`,
        fields: [
            { fieldname: 'info_html', fieldtype: 'HTML', options: infoHtml },
            { fieldtype: 'Section Break', label: __('Turno') },
            { fieldname: 'shift_type', label: __('Tipo de Turno'), fieldtype: 'Select', options: '' },
            { fieldtype: 'Section Break', label: __('Permiso / Vacaciones'), collapsible: 1,
              collapsible_depends_on: 'eval:false' },
            { fieldname: 'leave_type', label: __('Tipo de Permiso'), fieldtype: 'Link', options: 'Leave Type' },
            { fieldname: 'half_day', label: __('Medio Día'), fieldtype: 'Check', default: 0 },
            { fieldname: 'description', label: __('Descripción'), fieldtype: 'Small Text' },
        ],
        size: 'large',
        primary_action_label: __('Asignar Turno'),
        primary_action: (values) => {
            if (!values.shift_type) {
                frappe.msgprint(__('Seleccione un tipo de turno.'));
                return;
            }
            frappe.call({
                method: `${API}.assign_shift`,
                args: { employee, shift_type: values.shift_type, start_date: date },
                freeze: true,
                freeze_message: __('Asignando turno...'),
                callback: () => {
                    d.hide();
                    frappe.show_alert({ message: __('Turno asignado.'), indicator: 'green' });
                    loadWeek();
                },
            });
        },
    });

    // ── Custom footer buttons ──
    const $footer = d.$wrapper.find('.modal-footer');

    // "Quitar Turno" button (only if shift exists)
    if (hasShift) {
        const $btnRemove = $(`<button class="btn btn-danger btn-sm" style="position:absolute;left:15px;">
            ${__('Quitar Turno')}
        </button>`);
        $footer.css('position', 'relative').prepend($btnRemove);
        $btnRemove.on('click', () => {
            frappe.confirm(__('¿Desea quitar el turno de este día?'), () => {
                frappe.call({
                    method: `${API}.remove_shift_assignment`,
                    args: { employee, date },
                    freeze: true,
                    callback: () => {
                        d.hide();
                        frappe.show_alert({ message: __('Turno removido.'), indicator: 'orange' });
                        loadWeek();
                    },
                });
            });
        });
    }

    // "Crear Permiso" button
    const $btnLeave = $(`<button class="btn btn-warning btn-sm" style="margin-right:8px;">
        ${__('Crear Permiso')}
    </button>`);
    $footer.find('.btn-primary').before($btnLeave);
    $btnLeave.on('click', () => {
        const values = d.get_values(true);
        if (!values || !values.leave_type) {
            frappe.msgprint(__('Seleccione un tipo de permiso.'));
            return;
        }
        frappe.call({
            method: `${API}.create_leave`,
            args: {
                employee,
                leave_type: values.leave_type,
                from_date: date,
                to_date: date,
                half_day: values.half_day ? 1 : 0,
                half_day_date: values.half_day ? date : null,
                description: values.description || '',
            },
            freeze: true,
            freeze_message: __('Creando permiso...'),
            callback: () => {
                d.hide();
                frappe.show_alert({ message: __('Permiso creado.'), indicator: 'blue' });
                loadWeek();
            },
        });
    });

    // "Cancelar Permiso" button (only if leave exists)
    if (hasLeave) {
        const $btnCancelLeave = $(`<button class="btn btn-outline-danger btn-sm" style="margin-right:8px;">
            ${__('Cancelar Permiso')}
        </button>`);
        $footer.find('.btn-primary').before($btnCancelLeave);
        $btnCancelLeave.on('click', () => {
            frappe.confirm(__('¿Desea cancelar el permiso existente?'), () => {
                frappe.call({
                    method: `${API}.cancel_leave`,
                    args: { leave_name: currentLeaves[0].name },
                    freeze: true,
                    callback: () => {
                        d.hide();
                        frappe.show_alert({ message: __('Permiso cancelado.'), indicator: 'red' });
                        loadWeek();
                    },
                });
            });
        });
    }

    // ── Populate shift type options ──
    frappe.call({
        method: `${API}.get_shift_types`,
        callback: ({ message: shifts }) => {
            const options = [{ label: '', value: '' }].concat((shifts || []).map(s => ({
                label: s.label || s.name,
                value: s.name
            })));
            d.fields_dict.shift_type.df.options = options;
            d.fields_dict.shift_type.refresh();
            if (hasShift) {
                d.set_value('shift_type', currentShifts[0].shift_type);
            }
        },
    });

    d.show();
}
