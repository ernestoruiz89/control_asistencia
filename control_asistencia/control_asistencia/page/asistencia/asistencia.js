/**
 * Employee Time‑Tracking Page (English version)
 * ---------------------------------------------
 * UI labels:
 *   • Clock‑in        → start of workday
 *   • Break Start     → leaving for break
 *   • Break End       → coming back from break
 *   • Clock‑out       → end of workday
 */

frappe.pages['asistencia'].on_page_load = async function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Working Time'),
        single_column: true
    });

    const disabledBtnCSS = `
		button.disabled-button{
			opacity:.3 !important;
			pointer-events:none !important;
			cursor:not-allowed !important;
			background:#dcdcdc !important;
			color:#808080 !important;
			border-color:#c0c0c0 !important;
		}`;

	// Prefer modern helper if present; otherwise fallback to vanilla JS
	if (frappe.dom && frappe.dom.set_style) {
		frappe.dom.set_style(disabledBtnCSS);
	} else {
		const styleTag = document.createElement('style');
		styleTag.innerHTML = disabledBtnCSS;
		document.head.appendChild(styleTag);
	}

    $(page.body).html(`
        <div class="container-fluid text-center">
            <h3 id="employee-name" class="mb-4"></h3>
            <div class="row">
                <div class="col-12 mb-3"><button id="btn-entrada"  class="btn btn-info    btn-lg btn-block">Clock‑in</button></div>
                <div class="col-12 mb-3"><button id="btn-almuerzo" class="btn btn-warning btn-lg btn-block disabled-button" disabled>Break Start</button></div>
                <div class="col-12 mb-3"><button id="btn-regreso"  class="btn btn-success btn-lg btn-block disabled-button" disabled>Break End</button></div>
                <div class="col-12 mb-3"><button id="btn-salida"   class="btn btn-danger  btn-lg btn-block disabled-button" disabled>Clock‑out</button></div>
                <div class="col-12 mb-3"><button id="btn-consulta" class="btn btn-primary btn-lg btn-block">Worked‑time summary</button></div>
            </div>
        </div>`);

    initialise_page();
};

// ---------- constants --------------------------------------------------------
const BUTTON_IDS = ['btn-entrada', 'btn-almuerzo', 'btn-regreso', 'btn-salida'];
const ACTION_MAP = {
    'btn-entrada'  : { logType: 'IN',  label: 'entrada' },
    'btn-almuerzo' : { logType: 'OUT', label: 'break start' },
    'btn-regreso'  : { logType: 'IN',  label: 'break end' },
    'btn-salida'   : { logType: 'OUT', label: 'salida' }
};

// ---------- boot sequence ----------------------------------------------------
function initialise_page() {
    const emp = frappe.session.user_fullname || frappe.session.user;
    document.getElementById('employee-name').innerText = __('Employee: {0}', [emp]);

    BUTTON_IDS.forEach(id =>
        document.getElementById(id).addEventListener('click', () => register_checkin(id))
    );
    document.getElementById('btn-consulta').addEventListener('click', consult_worked_time);

    refresh_button_state();
}

// ---------- enable / disable buttons ----------------------------------------
function refresh_button_state() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    frappe.call({
        method: 'finde.functions.get_current_status',
        args:   { client_timezone: tz },
        callback: ({ message }) => update_buttons_for(message ? message.last_action : null),
        error: () => frappe.msgprint(__('Unable to retrieve current status from server.'))
    });
}

function update_buttons_for(lastAction) {
    // Deshabilitar todo
    BUTTON_IDS.forEach(disable_button);

    switch (lastAction) {
        case 'entrada':          // jornada recién iniciada
            enable_button('btn-almuerzo');  // Break Start
            enable_button('btn-salida');    // Clock‑out
            break;

        case 'break start':      // está en pausa
            enable_button('btn-regreso');   // Break End
            break;

        case 'break end':        // pausa terminada
            enable_button('btn-almuerzo');  // Puede iniciar otra
            enable_button('btn-salida');    // O cerrar jornada
            break;

        default:                 // 'salida' o sin registros
            enable_button('btn-entrada');   // Nuevo día
    }
}

function enable_button(id)  { const e = document.getElementById(id); e.disabled = false; e.classList.remove('disabled-button'); }
function disable_button(id) { const e = document.getElementById(id); e.disabled = true;  e.classList.add('disabled-button'); }

// ---------- check‑in flow ----------------------------------------------------
function register_checkin(btnId) {
    const { logType, label } = ACTION_MAP[btnId];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    BUTTON_IDS.forEach(disable_button);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => submit_checkin(logType, label, pos.coords.latitude, pos.coords.longitude, tz),
            ()  => fallback_geo(logType, label, tz)
        );
    } else {
        fallback_geo(logType, label, tz);
    }
}
function fallback_geo(logType, label, tz) {
    frappe.msgprint(__('Geolocation unavailable – continuing without coordinates.'));
    submit_checkin(logType, label, 0.0, 0.0, tz);
}
function submit_checkin(logType, customLabel, lat, lon, tz) {
    frappe.call({
        method: 'finde.functions.register_checkin',
        args:   { log_type: logType, custom_tipo_registro: customLabel, latitude: lat, longitude: lon, client_timezone: tz },
        callback: ({ message }) => {
            frappe.msgprint(message || __('Check‑in saved.'));
            refresh_button_state();
        },
        error: () => {
            frappe.msgprint(__('Server error – your action was NOT recorded.'));
            refresh_button_state();
        }
    });
}

// ---------- worked‑time summary ---------------------------------------------
function consult_worked_time() {
    const clientTime = new Date().toISOString().slice(0, 19); // strip TZ
    frappe.call({
        method: 'control_asistencia.control_asistencia.functions.get_current_worked_hours',
        args:   { client_time: clientTime },
        callback: ({ message }) => {
            if (!message) return frappe.msgprint(__('Unable to obtain worked time.'));
            const { worked_hours, break_hours } = message;
            frappe.msgprint({
                title: __('Worked Time'),
                indicator: 'blue',
                message: `<div style="font-size:24px;text-align:center;">${worked_hours}<br>${break_hours}</div>`
            });
        },
        error: () => frappe.msgprint(__('Server error while retrieving worked time.'))
    });
}
