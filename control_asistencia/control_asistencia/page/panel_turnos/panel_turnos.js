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
    leave:           'Vacaciones',
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
            cells += `<td class="${cls}">
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
            const options = (shifts || []).map(s => s.name);

            const d = new frappe.ui.Dialog({
                title: __('Asignar Turno'),
                fields: [
                    { fieldname: 'employee', label: __('Empleado'), fieldtype: 'Link', options: 'Employee', reqd: 1 },
                    { fieldname: 'shift_type', label: __('Turno'), fieldtype: 'Select', options: options.join('\n'), reqd: 1 },
                    { fieldname: 'start_date', label: __('Fecha Inicio'), fieldtype: 'Date', reqd: 1, default: fmtDate(currentWeekStart) },
                    { fieldname: 'end_date',   label: __('Fecha Fin'),    fieldtype: 'Date', reqd: 1,
                        default: fmtDate(new Date(currentWeekStart.getTime() + 6*24*60*60*1000)) },
                ],
                primary_action_label: __('Asignar'),
                primary_action: (values) => {
                    frappe.call({
                        method: `${API}.assign_shift`,
                        args: values,
                        callback: () => {
                            d.hide();
                            frappe.msgprint(__('Turno asignado correctamente.'));
                            loadWeek();
                        },
                    });
                },
            });
            d.show();
        },
    });
}
