/**
 * Panel de Turnos – Vista semanal
 * Muestra empleados × días con código de colores según asistencia.
 */

const API = 'control_asistencia.control_asistencia.shift_panel';
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STATUS_LABELS = {
    on_time: 'En tiempo',
    out_of_schedule: 'Fuera de horario',
    absent: 'Ausente',
    leave: 'Vacaciones / Permiso',
    not_scheduled: 'No programado',
    future: 'Día futuro',
};

let currentStartDate = getMonday(new Date());
let currentViewType = 'week';
let weeklyData = [];

frappe.pages['panel-turnos'].on_page_load = function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Panel de Turnos'),
        single_column: true,
    });

    $(page.body).html(`
        <div class="shift-panel-container">
            <div class="shift-panel-toolbar" style="width: 100%; display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
                <!-- Fila 1: Semana y Leyenda -->
                <div style="display: flex; align-items: center; gap: 15px; flex-wrap: nowrap;">
                    <select id="view-type" class="form-control input-sm" style="width: 100px; height: 28px; padding: 2px 5px;">
                        <option value="week">Semanal</option>
                        <option value="month">Mensual</option>
                    </select>
                    <div style="display: flex; align-items: center; background: var(--control-bg, #fff); border: 1px solid var(--border-color, #d1d8dd); border-radius: 4px; padding: 2px;">
                        <button class="btn btn-default btn-xs" id="prev-btn" style="border:none; background:transparent; color: var(--text-color);">◀</button>
                        <span id="date-label" style="font-weight: 600; margin: 0 10px; min-width: 180px; text-align: center; font-size: 13px; color: var(--text-color);"></span>
                        <button class="btn btn-default btn-xs" id="next-btn" style="border:none; background:transparent; color: var(--text-color);">▶</button>
                    </div>
                    <div id="shift-legend" style="display: flex; gap: 15px; align-items: center; font-size: 12px; color: var(--text-muted, #718096);"></div>
                </div>

                <!-- Fila 2: Filtros y Acciones -->
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <select id="branch-filter" class="form-control input-sm" style="width: 160px;">
                        <option value="">Todas las Sucursales</option>
                    </select>
                    <select id="status-filter" class="form-control input-sm" style="width: 140px;">
                        <option value="All">Filtro: Todos</option>
                        <option value="Active" selected>Solo Activos</option>
                        <option value="Inactive">Inactivos</option>
                        <option value="Suspended">Suspendidos</option>
                        <option value="Left">Egresados</option>
                    </select>
                    <div style="position: relative; width: 180px;">
                        <i class="fa fa-search" style="position: absolute; left: 10px; top: 9px; color: #a0aec0;"></i>
                        <input type="text" id="employee-filter" class="form-control input-sm" placeholder="Buscar empleado..." style="padding-left: 30px;">
                    </div>

                    <div style="flex: 1;"></div>

                    <button class="btn btn-primary btn-sm" id="btn-create-shift">
                        <i class="fa fa-clock-o"></i> ${__('Crear Turno')}
                    </button>
                    <button class="btn btn-success btn-sm" id="btn-assign-shift">
                        <i class="fa fa-calendar-check-o"></i> ${__('Asignar Turno')}
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-add-employee">
                        <i class="fa fa-user-plus"></i> ${__('Nuevo Empleado')}
                    </button>
                    <button class="btn btn-default btn-sm" id="btn-fullscreen" title="${__('Pantalla Completa')}">
                        <i class="fa fa-expand"></i>
                    </button>
                </div>
            </div>
            <div id="grid-wrapper" style="max-height: 70vh; overflow: auto; border: 1px solid var(--border-color, #d1d8dd);"></div>
        </div>
    `);

    renderLegend();
    bindEvents();
    loadData();

    // Escuchar eventos en tiempo real (WebSockets) desde el backend
    frappe.realtime.on('update_shift_panel', () => {
        loadData();
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
        not_scheduled: 'var(--bg-color)', future: 'var(--bg-color)',
    };
    let html = '';
    for (const [key, label] of Object.entries(STATUS_LABELS)) {
        if (key === 'future') continue; // Omitir, se combina con el anterior

        let finalLabel = label;
        if (key === 'not_scheduled') {
            finalLabel = 'No programado / Día futuro';
        }

        html += `<span style="display: inline-flex; align-items: center; gap: 6px; margin-right: 15px;">
                    <span class="legend-dot" style="background:${colors[key]}; width: 12px; height: 12px; border: 1px solid #d1d8dd; border-radius: 2px; display: inline-block;"></span>
                    <span>${finalLabel}</span>
                 </span>`;
    }
    document.getElementById('shift-legend').innerHTML = html;
}

// ── Events ──────────────────────────────────────────────────────────────────

function bindEvents() {
    document.getElementById('branch-filter').addEventListener('change', () => applyFilterAndRender());
    document.getElementById('status-filter').addEventListener('change', () => applyFilterAndRender());
    document.getElementById('employee-filter').addEventListener('input', () => applyFilterAndRender());

    document.getElementById('view-type').addEventListener('change', (e) => {
        currentViewType = e.target.value;
        if (currentViewType === 'month') {
            currentStartDate = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), 1);
        } else {
            currentStartDate = getMonday(currentStartDate);
        }
        loadData();
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentViewType === 'week') {
            currentStartDate.setDate(currentStartDate.getDate() - 7);
        } else {
            currentStartDate.setMonth(currentStartDate.getMonth() - 1);
        }
        loadData();
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentViewType === 'week') {
            currentStartDate.setDate(currentStartDate.getDate() + 7);
        } else {
            currentStartDate.setMonth(currentStartDate.getMonth() + 1);
        }
        loadData();
    });

    document.getElementById('btn-create-shift').addEventListener('click', showCreateShiftDialog);
    document.getElementById('btn-assign-shift').addEventListener('click', showAssignShiftDialog);
    document.getElementById('btn-add-employee').addEventListener('click', () => {
        showAddEmployeeDialog();
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        const container = document.querySelector('.shift-panel-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error(`Error Fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const btn = document.getElementById('btn-fullscreen');
        const container = document.querySelector('.shift-panel-container');
        if (document.fullscreenElement) {
            btn.innerHTML = '<i class="fa fa-compress"></i>';
            container.classList.add('is-fullscreen');
        } else {
            btn.innerHTML = '<i class="fa fa-expand"></i>';
            container.classList.remove('is-fullscreen');
        }
    });

    // Click on any day cell to edit
    document.getElementById('grid-wrapper').addEventListener('click', (e) => {
        const tdEmp = e.target.closest('td.cell-employee');
        if (tdEmp) {
            showEditEmployeeDialog(tdEmp.getAttribute('data-employee-id'));
            return;
        }

        const td = e.target.closest('td[data-employee]');
        if (!td) return;
        const employee = td.dataset.employee;
        const date = td.dataset.date;
        const empName = td.closest('tr').querySelector('.cell-employee').textContent.trim();
        showDayEditDialog(employee, empName, date);
    });
}

// ── Load & Render ───────────────────────────────────────────────────────────

function loadData() {
    const ws = fmtDate(currentStartDate);
    let numDays = 7;
    let label = "";

    if (currentViewType === 'week') {
        const we = new Date(currentStartDate);
        we.setDate(we.getDate() + 6);
        label = fmtShort(currentStartDate) + ' – ' + fmtShort(we) + ' ' + currentStartDate.getFullYear();
        numDays = 7;
    } else {
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        label = monthNames[currentStartDate.getMonth()] + ' ' + currentStartDate.getFullYear();
        numDays = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth() + 1, 0).getDate();
    }

    document.getElementById('date-label').textContent = label;

    frappe.call({
        method: `${API}.get_weekly_panel_data`,
        args: {
            start_date: ws,
            days: numDays
        },
        callback: ({ message }) => {
            weeklyData = message || [];
            updateBranchFilter(weeklyData);
            applyFilterAndRender();
        },
        error: () => frappe.msgprint(__('Error al cargar los datos del panel.')),
    });
}

function updateBranchFilter(data) {
    const branchSelect = document.getElementById('branch-filter');
    if (!branchSelect) return;
    const prevVal = branchSelect.value;
    const branches = new Set();
    data.forEach(emp => { if (emp.branch) branches.add(emp.branch); });

    let html = '<option value="">Todas las sucursales</option>';
    Array.from(branches).sort().forEach(b => {
        html += `<option value="${b}">${b}</option>`;
    });
    branchSelect.innerHTML = html;
    branchSelect.value = prevVal || '';
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
                        loadData();
                    }, delayMs);
                    shiftTimeouts.push(to);
                }
            }
        }
    }
}

function applyFilterAndRender() {
    const filterText = (document.getElementById('employee-filter').value || '').toLowerCase();
    const branchVal = document.getElementById('branch-filter').value;
    const statusVal = document.getElementById('status-filter').value;

    let data = weeklyData;

    if (branchVal) {
        data = data.filter(emp => emp.branch === branchVal);
    }

    if (statusVal && statusVal !== 'All') {
        data = data.filter(emp => emp.status === statusVal);
    }

    if (filterText) {
        data = data.filter(emp =>
            emp.employee_name.toLowerCase().includes(filterText) ||
            emp.employee.toLowerCase().includes(filterText) ||
            (emp.custom_identificacion && emp.custom_identificacion.toLowerCase().includes(filterText))
        );
    }
    renderGrid(data);
    scheduleTimeouts(data);
}

function renderGrid(data) {
    const ws = new Date(currentStartDate);
    const numDays = data.length > 0 ? data[0].days.length : (currentViewType === 'week' ? 7 : 31);

    let headerCols = '<th class="col-employee" style="min-width: 250px;">Empleado</th>';
    for (let i = 0; i < numDays; i++) {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);

        let displayDay;
        if (currentViewType === 'week') {
            displayDay = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
        } else {
            displayDay = d.getDate();
        }

        headerCols += `<th style="min-width: 100px;">${displayDay}<br><small>${fmtShort(d)}</small></th>`;
    }

    let rows = '';
    const colspan = numDays + 1;
    if (!data.length) {
        rows = `<tr><td colspan="${colspan}" style="padding:20px;color:#999;">No hay datos para mostrar en este rango.</td></tr>`;
    }
    for (const emp of data) {
        let statusTag = '';
        if (emp.status && emp.status !== 'Active') {
            let labelMapping = {
                'Inactive': __('Inactivo'),
                'Suspended': __('Suspendido'),
                'Left': __('Salida')
            };
            const label = labelMapping[emp.status] || emp.status;
            statusTag = ` <small style="color: #e74c3c; font-weight: normal;">(${label})</small>`;
        }
        let cells = `<td class="cell-employee" data-employee-id="${emp.employee}" title="Clic para editar empleado" style="cursor: pointer;">
            <div style="font-weight: 600;">${emp.employee_name}${statusTag}</div>
        </td>`;
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
            { fieldname: 'end_time', label: __('Hora de Fin'), fieldtype: 'Time', reqd: 1 },
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

            let defaultEndDate;
            if (currentViewType === 'month') {
                defaultEndDate = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth() + 1, 0);
            } else {
                defaultEndDate = new Date(currentStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
            }

            const d = new frappe.ui.Dialog({
                title: __('Asignar Turno'),
                fields: [
                    { fieldname: 'employee', label: __('Empleado'), fieldtype: 'Link', options: 'Employee', reqd: 1 },
                    { fieldname: 'shift_type', label: __('Turno'), fieldtype: 'Select', options: options, reqd: 1 },
                    { fieldtype: 'Section Break' },
                    { fieldname: 'start_date', label: __('Fecha Inicio'), fieldtype: 'Date', reqd: 1, default: fmtDate(currentStartDate) },
                    { fieldname: 'end_date', label: __('Fecha Fin'), fieldtype: 'Date', reqd: 1, default: fmtDate(defaultEndDate) },
                    { fieldtype: 'Section Break', label: __('Días Programables') },
                    { fieldtype: 'HTML', fieldname: 'quick_actions' },
                    { fieldtype: 'Section Break' },
                    { fieldname: 'mon', label: __('Lunes'), fieldtype: 'Check', default: 0 },
                    { fieldname: 'tue', label: __('Martes'), fieldtype: 'Check', default: 0 },
                    { fieldname: 'wed', label: __('Miércoles'), fieldtype: 'Check', default: 0 },
                    { fieldname: 'thu', label: __('Jueves'), fieldtype: 'Check', default: 0 },
                    { fieldtype: 'Column Break' },
                    { fieldname: 'fri', label: __('Viernes'), fieldtype: 'Check', default: 0 },
                    { fieldname: 'sat', label: __('Sábado'), fieldtype: 'Check', default: 0 },
                    { fieldname: 'sun', label: __('Domingo'), fieldtype: 'Check', default: 0 },
                ],
                primary_action_label: __('Asignar'),
                primary_action: (values) => {
                    const selected = [values.mon, values.tue, values.wed, values.thu, values.fri, values.sat, values.sun];
                    let is_empty = selected.every(val => !val);
                    if (is_empty) {
                        frappe.msgprint({ title: 'Nota Informativa', message: 'Como no seleccionaste días específicos, el turno se programará sobre <b>todos los días</b> correspondientes entre la Fecha Inicial y Fecha Final de manera ininterrumpida.', indicator: 'blue' });
                        values.days_enabled = JSON.stringify([1, 1, 1, 1, 1, 1, 1]); // Habilita completamente todos
                    } else {
                        values.days_enabled = JSON.stringify(selected);
                    }
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
                            loadData();
                        },
                    });
                },
            });
            d.fields_dict.quick_actions.$wrapper.html(`
                <div style="margin-bottom: 12px;">
                    <button type="button" class="btn btn-xs btn-default" id="sel-all">Seleccionar Todo</button>
                    <button type="button" class="btn btn-xs btn-default" id="sel-week">Lunes - Viernes</button>
                    <button type="button" class="btn btn-xs btn-default" id="sel-none">Ninguno</button>
                </div>
            `);
            d.fields_dict.quick_actions.$wrapper.find('#sel-all').on('click', () => {
                ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(f => d.set_value(f, 1));
            });
            d.fields_dict.quick_actions.$wrapper.find('#sel-week').on('click', () => {
                ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(f => d.set_value(f, 1));
                ['sat', 'sun'].forEach(f => d.set_value(f, 0));
            });
            d.fields_dict.quick_actions.$wrapper.find('#sel-none').on('click', () => {
                ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(f => d.set_value(f, 0));
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

    // ── Left Column (Shift & Checkins) ──
    let leftHtml = '<div style="padding-right: 5px;">';
    leftHtml += `<h5 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom: 12px; color: #2c3e50;"><i class="fa fa-clock-o"></i> ${__('Turno y Asistencia')}</h5>`;

    if (hasShift) {
        leftHtml += `<div class="alert alert-info" style="padding:10px 12px;margin-bottom:15px;font-size:13px;background-color:#eaf2f8;border:none;">
            <strong style="color: #2980b9;">${__('Turno asignado:')}</strong> ${currentShifts[0].shift_type}
        </div>`;
    } else {
        leftHtml += `<div class="text-muted" style="margin-bottom:15px;font-size:13px;font-style:italic;">${__('Este empleado no tiene turno configurado hoy.')}</div>`;
    }

    const checkins = details.checkins || [];
    if (checkins.length) {
        const fmtTime = (t) => {
            const dt = new Date(t);
            return dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true });
        };
        const resolveAction = (c) => {
            const crt = (c.custom_registration_type || '').toLowerCase();
            if (crt) return crt;
            const lt = (c.log_type || '').toUpperCase();
            if (lt === 'IN') return 'clock-in';
            if (lt === 'OUT') return 'clock-out';
            return '';
        };
        const typeLabel = (action) => {
            if (action === 'clock-in') return '🟢 Entrada';
            if (action === 'clock-out') return '🔴 Salida';
            if (action === 'break start') return '🟡 Inicio Break';
            if (action === 'break end') return '🔵 Fin Break';
            return action || '—';
        };

        const firstIn = checkins.find(c => resolveAction(c) === 'clock-in');
        const lastOut = [...checkins].reverse().find(c => resolveAction(c) === 'clock-out');

        leftHtml += `<div class="alert alert-success" style="padding:10px 12px;margin-bottom:15px;font-size:13px;border-left:4px solid #2ecc71;">
            <strong style="color:#27ae60;">${__('Registros')}</strong><br>
            <div style="margin-top: 5px;">
                <span>${__('Entrada:')} <strong>${firstIn ? fmtTime(firstIn.time) : '—'}</strong></span> &nbsp;|&nbsp; 
                <span>${__('Salida:')} <strong>${lastOut ? fmtTime(lastOut.time) : '—'}</strong></span>
            </div>
            <table style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse;background:white;border-radius:4px;overflow:hidden;">
                <tr style="background:#e8f8f5; border-bottom:1px solid rgba(0,0,0,0.05);">
                    <th style="text-align:left;padding:4px 6px;">${__('Hora')}</th>
                    <th style="text-align:left;padding:4px 6px;">${__('Tipo')}</th>
                </tr>`;
        for (const c of checkins) {
            const action = resolveAction(c);
            leftHtml += `<tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                <td style="padding:4px 6px;">${fmtTime(c.time)}</td>
                <td style="padding:4px 6px;">${typeLabel(action)}</td>
            </tr>`;
        }
        leftHtml += '</table></div>';
    } else {
        leftHtml += `<div class="text-muted" style="margin-bottom:15px;font-size:13px;font-style:italic;">${__('No hay ninguna marcación para este día.')}</div>`;
    }
    leftHtml += '</div>';

    // ── Right Column (Leaves) ──
    let rightHtml = '<div style="padding-left: 5px;">';
    rightHtml += `<h5 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom: 12px; color: #d35400;"><i class="fa fa-plane"></i> ${__('Vacaciones / Permiso')}</h5>`;

    let dialogFields = [
        { fieldname: 'left_html', fieldtype: 'HTML', options: leftHtml },
        { fieldname: 'shift_type', label: __('Nuevo Tipo de Turno'), fieldtype: 'Select', options: '' },
        { fieldtype: 'Column Break' }
    ];

    if (hasLeave) {
        const lv = currentLeaves[0];
        rightHtml += `<div class="alert alert-warning" style="padding:10px 12px;margin-bottom:15px;font-size:13px;background-color:#fef5e7;border:none;">
            <strong style="color: #d35400;">${__('Permiso Activo:')}</strong> ${lv.leave_type}${lv.half_day ? ' (' + __('Medio día') + ')' : ''}
            ${lv.description ? '<div style="margin-top: 5px;">' + __('Motivo:') + ' <i>' + lv.description + '</i></div>' : ''}
        </div>
        <div class="text-muted" style="font-size: 13px;">${__('Ya existe un permiso asignado en esta fecha. Si deseas programar unas nuevas vacaciones, primero deberás cancelar este permiso.')}</div>`;
        rightHtml += '</div>';

        dialogFields.push({ fieldname: 'right_html', fieldtype: 'HTML', options: rightHtml });
    } else {
        rightHtml += `<div class="text-muted" style="margin-bottom:20px;font-size:13px;">${__('Sin historial de permisos programados para este día. Puedes generar uno usando el formato de abajo:')}</div>`;
        rightHtml += '</div>';

        dialogFields.push(
            { fieldname: 'right_html', fieldtype: 'HTML', options: rightHtml },
            { fieldname: 'leave_type', label: __('Aplicar Nuevo Permiso'), fieldtype: 'Link', options: 'Leave Type' },
            { fieldname: 'half_day', label: __('Sólo abarca medio día'), fieldtype: 'Check', default: 0 },
            { fieldname: 'description', label: __('Motivo:'), fieldtype: 'Small Text' }
        );
    }

    const d = new frappe.ui.Dialog({
        title: `${employeeName} — ${dateDisplay}`,
        fields: dialogFields,
        size: 'large',
        primary_action_label: __('Asignar Turno'),
        primary_action: (values) => {
            if (!values.shift_type) {
                frappe.msgprint(__('Seleccione un tipo de turno para asignar individualmente a esta celda.'));
                return;
            }
            frappe.call({
                method: `${API}.assign_shift`,
                args: { employee, shift_type: values.shift_type, start_date: date },
                freeze: true,
                freeze_message: __('Asignando turno...'),
                callback: () => {
                    d.hide();
                    frappe.show_alert({ message: __('Turno asignado en esta sola fecha.'), indicator: 'green' });
                    loadData();
                },
            });
        },
    });

    // ── Custom footer buttons ──
    const $footer = d.$wrapper.find('.modal-footer');

    // "Quitar Turno" button
    if (hasShift) {
        const $btnRemove = $(`<button class="btn btn-danger btn-sm" style="position:absolute;left:15px;">
            <i class="fa fa-trash"></i> ${__('Borrar Turno')}
        </button>`);
        $footer.css('position', 'relative').prepend($btnRemove);
        $btnRemove.on('click', () => {
            frappe.confirm(__('¿Estás seguro que deseas dejar esta celda completamente vacía sin turno?'), () => {
                frappe.call({
                    method: `${API}.remove_shift_assignment`,
                    args: { employee, date },
                    freeze: true,
                    callback: () => {
                        d.hide();
                        frappe.show_alert({ message: __('Turno individual removido con éxito.'), indicator: 'orange' });
                        loadData();
                    },
                });
            });
        });
    }

    // Contextual button handling based on Leave statys
    if (!hasLeave) {
        const $btnLeave = $(`<button class="btn btn-warning btn-sm" style="margin-right:8px;">
            <i class="fa fa-calendar-plus-o"></i> ${__('Registrar Permiso')}
        </button>`);
        $footer.find('.btn-primary').before($btnLeave);
        $btnLeave.on('click', () => {
            const values = d.get_values(true);
            if (!values || !values.leave_type) {
                frappe.msgprint(__('Por favor selecciona a qué banco de vacaciones o tipo de permiso imputar este día.'));
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
                freeze_message: __('Procesando...'),
                callback: () => {
                    d.hide();
                    frappe.show_alert({ message: __('Aprobado de forma instantánea.'), indicator: 'blue' });
                    loadData();
                },
            });
        });
    } else {
        const $btnCancelLeave = $(`<button class="btn btn-outline-danger btn-sm" style="margin-right:8px;">
            <i class="fa fa-times"></i> ${__('Cancelar Permiso')}
        </button>`);
        $footer.find('.btn-primary').before($btnCancelLeave);
        $btnCancelLeave.on('click', () => {
            frappe.confirm(__('¿Estás seguro de desaprobar esta configuración de vacaciones particular? El día volverá a su normalidad laboral.'), () => {
                frappe.call({
                    method: `${API}.cancel_leave`,
                    args: { leave_name: currentLeaves[0].name },
                    freeze: true,
                    callback: () => {
                        d.hide();
                        frappe.show_alert({ message: __('Ausencia anulada. El balance será restituido.'), indicator: 'red' });
                        loadData();
                    },
                });
            });
        });
    }

    // ── Populate shift type options ──
    frappe.call({
        method: `${API}.get_shift_types`,
        callback: ({ message: shifts }) => {
            if (!shifts || shifts.length === 0) {
                // No shift types exist — hide select and show a create button
                d.fields_dict.shift_type.df.hidden = 1;
                d.fields_dict.shift_type.refresh();
                d.fields_dict.shift_type.$wrapper.after(`
                    <div class="frappe-control" style="margin-bottom: 15px;">
                        <label class="control-label" style="margin-bottom: 8px; display: block;">${__('Nuevo Tipo de Turno')}</label>
                        <button class="btn btn-sm btn-primary" id="btn-create-shift-inline">
                            <i class="fa fa-plus"></i> ${__('Crear Turno')}
                        </button>
                        <p class="text-muted" style="margin-top: 6px; font-size: 12px;">
                            ${__('No hay turnos creados en el sistema. Crea uno primero para poder asignarlo.')}
                        </p>
                    </div>
                `);
                d.$wrapper.find('#btn-create-shift-inline').on('click', () => {
                    d.hide();
                    showCreateShiftDialog();
                });
            } else {
                const options = [{ label: '', value: '' }].concat(shifts.map(s => ({
                    label: s.label || s.name,
                    value: s.name
                })));
                d.fields_dict.shift_type.df.options = options;
                d.fields_dict.shift_type.refresh();
                if (hasShift) {
                    d.set_value('shift_type', currentShifts[0].shift_type);
                }
            }
        },
    });

    d.show();

}

function showAddEmployeeDialog() {
    // Fetch designations and departments first, then build the dialog
    Promise.all([
        frappe.db.get_list('Designation', { fields: ['name'], limit: 200, order_by: 'name asc' }),
        frappe.db.get_list('Department', { fields: ['name'], limit: 200, order_by: 'name asc' }),
    ]).then(([designations, departments]) => {
        const desigOptions = [{ label: __('— Seleccionar —'), value: '' }]
            .concat(designations.map(d => ({ label: d.name, value: d.name })));
        const deptOptions = [{ label: __('— Seleccionar —'), value: '' }]
            .concat(departments.map(d => ({ label: d.name, value: d.name })));

        const roleOptions = [
            { label: __('Personal (Solo consulta)'), value: 'Employee' },
            { label: __('Supervisor'), value: 'HR User' },
            { label: __('Administrador RRHH'), value: 'HR Manager' },
            { label: __('Administrador Sistema'), value: 'System Manager' },
        ];

        // Compute default joining date = Jan 1 of current year
        const today = new Date();
        const defaultJoining = today.getFullYear() + '-01-01';

        const dialog = new frappe.ui.Dialog({
            title: __('Alta Rápida de Empleado'),
            size: 'large',
            fields: [
                // ── Intro banner ──
                {
                    fieldtype: 'HTML',
                    fieldname: 'intro_html',
                    options: `<div style="
                        background: #f0f4ff;
                        border-left: 4px solid #4a6cf7;
                        border-radius: 4px;
                        padding: 10px 14px;
                        margin-bottom: 4px;
                        font-size: 13px;
                        color: #4a5568;
                    ">
                        ${__('Se crearán automáticamente los perfiles de usuario del sistema y HR vinculados.')}
                    </div>`,
                },

                // ── Datos Personales ──
                { fieldtype: 'Section Break', label: __('DATOS PERSONALES'), collapsible: 0 },
                {
                    fieldname: 'first_name',
                    fieldtype: 'Data',
                    label: __('Nombres'),
                    reqd: 1,
                },
                {
                    fieldname: 'email',
                    fieldtype: 'Data',
                    label: __('Correo Electrónico'),
                    description: __('Se usará como usuario de ingreso al sistema.'),
                },
                { fieldtype: 'Column Break' },
                {
                    fieldname: 'last_name',
                    fieldtype: 'Data',
                    label: __('Apellidos'),
                },
                {
                    fieldname: 'date_of_birth',
                    fieldtype: 'Date',
                    label: __('Fecha de Nacimiento'),
                },
                {
                    fieldname: 'gender',
                    fieldtype: 'Select',
                    label: __('Género'),
                    reqd: 1,
                    options: [
                        { label: __('— Seleccionar —'), value: '' },
                        { label: __('Masculino'), value: 'Male' },
                        { label: __('Femenino'), value: 'Female' },
                        { label: __('Otro'), value: 'Other' },
                    ],
                },

                // ── Información Laboral ──
                { fieldtype: 'Section Break', label: __('INFORMACIÓN LABORAL'), collapsible: 0 },
                {
                    fieldname: 'designation',
                    fieldtype: 'Select',
                    label: __('Cargo'),
                    options: desigOptions,
                },
                {
                    fieldname: 'date_of_joining',
                    fieldtype: 'Date',
                    label: __('Fecha de Ingreso'),
                    default: defaultJoining,
                    description: __('Por defecto: 1 de enero del presente año.'),
                },
                { fieldtype: 'Column Break' },
                {
                    fieldname: 'department',
                    fieldtype: 'Select',
                    label: __('Departamento'),
                    options: deptOptions,
                },
                {
                    fieldname: 'branch',
                    fieldtype: 'Link',
                    label: __('Sucursal (Branch)'),
                    options: 'Branch',
                },
                // ── Configuración de Acceso ──
                { fieldtype: 'Section Break', label: __('CONFIGURACIÓN DE ACCESO'), collapsible: 0 },
                {
                    fieldname: 'user_role',
                    fieldtype: 'Select',
                    label: __('Rol en el Sistema'),
                    options: roleOptions,
                    default: 'Employee',
                    description: __('Define el nivel de acceso del empleado en el sistema.'),
                },
                { fieldtype: 'Column Break' },
                {
                    fieldname: 'password',
                    fieldtype: 'Password',
                    label: __('Contraseña de Acceso'),
                    description: __('Si se deja vacío, el empleado deberá solicitar su contraseña.'),
                },
            ],
            primary_action_label: __('Crear Empleado'),
            primary_action(values) {
                if (!values.first_name) {
                    frappe.msgprint(__('El campo <b>Nombres</b> es obligatorio.'));
                    return;
                }

                frappe.call({
                    method: `${API}.create_employee_with_user`,
                    args: {
                        first_name: values.first_name || '',
                        last_name: values.last_name || '',
                        email: values.email || '',
                        gender: values.gender || '',
                        date_of_birth: values.date_of_birth || '',
                        date_of_joining: values.date_of_joining || defaultJoining,
                        designation: values.designation || '',
                        department: values.department || '',
                        branch: values.branch || '',
                        user_role: values.user_role || 'Employee',
                        password: values.password || '',
                    },
                    freeze: true,
                    freeze_message: __('Creando empleado...'),
                    callback({ message: res }) {
                        if (!res) return;
                        dialog.hide();
                        let msg = __('Empleado <b>{0}</b> creado exitosamente.', [res.employee_name]);
                        if (res.user_created) {
                            msg += '<br>' + __('Usuario del sistema creado: <b>{0}</b>', [res.user]);
                        } else if (res.user && !res.user_created) {
                            msg += '<br>' + __('El usuario <b>{0}</b> ya existía y fue vinculado.', [res.user]);
                        }
                        frappe.msgprint({ title: __('¡Empleado Creado!'), message: msg, indicator: 'green' });
                        loadData();
                    },
                });
            },
        });

        dialog.show();
    });
}

function showEditEmployeeDialog(employeeName) {
    if (!employeeName) return;

    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Employee', name: employeeName },
        freeze: true,
        callback: function (r) {
            if (!r.message) return;
            const emp = r.message;

            const dialog = new frappe.ui.Dialog({
                title: __('Editar Empleado: ') + emp.employee_name,
                fields: [
                    { fieldname: 'first_name', fieldtype: 'Data', label: __('Primer Nombre'), reqd: 1, default: emp.first_name },
                    { fieldname: 'middle_name', fieldtype: 'Data', label: __('Segundo Nombre'), default: emp.middle_name },
                    { fieldname: 'last_name', fieldtype: 'Data', label: __('Apellidos'), default: emp.last_name },
                    { fieldname: 'date_of_birth', fieldtype: 'Date', label: __('Fecha de Nacimiento'), reqd: 1, default: emp.date_of_birth },
                    { fieldtype: 'Column Break' },
                    { fieldname: 'custom_identificacion', fieldtype: 'Data', label: __('Identificación'), reqd: 1, default: emp.custom_identificacion },
                    { fieldname: 'gender', fieldtype: 'Select', label: __('Género'), options: '\nMale\nFemale\nOther', reqd: 1, default: emp.gender },
                    { fieldname: 'status', fieldtype: 'Select', label: __('Estado'), options: '\nActive\nInactive\nSuspended\nLeft', reqd: 1, default: emp.status },
                    { fieldname: 'relieving_date', fieldtype: 'Date', label: __('Fecha de Salida'), depends_on: 'eval:doc.status=="Left"' },
                    { fieldtype: 'Section Break' },
                    { fieldname: 'date_of_joining', fieldtype: 'Date', label: __('Fecha de Ingreso'), reqd: 1, default: emp.date_of_joining },
                    { fieldname: 'branch', fieldtype: 'Link', options: 'Branch', label: __('Sucursal (Branch)'), default: emp.branch },
                    { fieldtype: 'Section Break' },
                    { fieldname: 'attendance_device_id', fieldtype: 'Data', label: __('Dispositivo Vinculado (MAC)'), read_only: 1, default: emp.attendance_device_id || '' },
                    { fieldtype: 'HTML', fieldname: 'btn_unlink' },
                    // ── Cambio de contraseña ──
                    { fieldtype: 'Section Break', label: __('Acceso al Sistema') },
                    {
                        fieldname: 'new_password',
                        fieldtype: 'Password',
                        label: __('Nueva Contraseña'),
                        description: emp.user_id
                            ? __('Usuario vinculado: {0}. Dejá vacío para no cambiarla.', [emp.user_id])
                            : __('Este empleado no tiene usuario del sistema vinculado.'),
                        read_only: emp.user_id ? 0 : 1,
                    },
                    {
                        fieldname: 'disable_user',
                        fieldtype: 'Check',
                        label: __('Desactivar usuario del sistema'),
                        default: (emp.user_id && emp.status !== 'Active') ? 1 : 0,
                        read_only: emp.user_id ? 0 : 1,
                        description: emp.user_id
                            ? __('Si está marcado, el usuario no podrá ingresar al sistema.')
                            : __('Sin usuario vinculado. No aplica.'),
                    },
                ],
                primary_action_label: __('Guardar Cambios'),
                primary_action: function (values) {
                    if (values.status === 'Left' && !values.relieving_date) {
                        frappe.msgprint(__('La <b>Fecha de Salida</b> es requerida cuando el estado es "Left".'));
                        return;
                    }
                    // Separar campos que no van al Employee
                    const new_password = values.new_password || '';
                    const disable_user = values.disable_user;
                    let db_values = Object.assign({}, values);
                    delete db_values.new_password;
                    delete db_values.disable_user;
                    if (db_values.status !== 'Left') {
                        db_values.relieving_date = null;
                    }

                    frappe.call({
                        method: 'frappe.client.set_value',
                        args: { doctype: 'Employee', name: employeeName, fieldname: db_values },
                        freeze: true,
                        callback: function () {
                            if (!emp.user_id) {
                                frappe.show_alert({ message: __('Datos actualizados.'), indicator: 'green' });
                                dialog.hide();
                                loadData();
                                return;
                            }

                            // Construir los campos a actualizar en el User
                            const userFields = { enabled: disable_user ? 0 : 1 };
                            if (new_password) userFields.new_password = new_password;

                            frappe.call({
                                method: 'frappe.client.set_value',
                                args: {
                                    doctype: 'User',
                                    name: emp.user_id,
                                    fieldname: userFields,
                                },
                                freeze: true,
                                callback: function () {
                                    const msg = new_password
                                        ? __('Datos, contraseña y acceso actualizados.')
                                        : __('Datos y acceso al sistema actualizados.');
                                    frappe.show_alert({ message: msg, indicator: 'green' });
                                    dialog.hide();
                                    loadData();
                                }
                            });
                        }
                    });
                }
            });

            if (emp.attendance_device_id) {
                dialog.fields_dict.btn_unlink.$wrapper.html(`
                    <div style="margin-top: 15px;">
                        <button class="btn btn-sm btn-danger" id="btn-desvincular-mac">
                            <i class="fa fa-trash"></i> Desvincular Computadora
                        </button>
                    </div>
                `);

                dialog.fields_dict.btn_unlink.$wrapper.find('#btn-desvincular-mac').on('click', () => {
                    frappe.confirm('Al desvincular el equipo, la aplicación de escritorio creará automáticamente una vinculación como si fuera la primera vez durante la próxima marcación del empleado.<br><br>¿Seguro de desvincular la MAC?', () => {
                        frappe.call({
                            method: 'frappe.client.set_value',
                            args: { doctype: 'Employee', name: employeeName, fieldname: 'attendance_device_id', value: '' },
                            freeze: true,
                            callback: function () {
                                frappe.msgprint({ title: 'Computadora Desvinculada', message: 'El dispositivo ha quedado desvinculado con éxito. Se registrará la nueva MAC automáticamente cuando el empleado registre asistencia.', indicator: 'orange' });
                                dialog.hide();
                            }
                        });
                    });
                });
            } else {
                dialog.fields_dict.btn_unlink.$wrapper.html(`
                    <div style="margin-top: 15px; color: #7f8c8d; font-size: 0.9em; font-style: italic;">
                        El empleado no tiene ninguna computadora vinculada actualmente.
                    </div>
                `);
            }
            dialog.add_custom_action('Ver Registro Completo', () => {
                frappe.set_route('Form', 'Employee', employeeName);
                dialog.hide();
            });

            dialog.show();
        }
    });
}
