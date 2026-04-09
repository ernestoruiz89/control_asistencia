/**
 * Página de Control de Asistencia
 * --------------------------------
 * Botones:
 *   • Entrada         → inicio de jornada
 *   • Inicio de Break → salir a break
 *   • Fin de Break    → regresar de break
 *   • Salida          → fin de jornada
 */

frappe.pages['asistencia'].on_page_load = async function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Control de Asistencia'),
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
                <div class="col-12 mb-3"><button id="btn-entrada"  class="btn btn-info    btn-lg btn-block">Entrada</button></div>
                <div class="col-12 mb-3"><button id="btn-break" class="btn btn-warning btn-lg btn-block disabled-button" disabled>Inicio de Break</button></div>
                <div class="col-12 mb-3"><button id="btn-regreso"  class="btn btn-success btn-lg btn-block disabled-button" disabled>Fin de Break</button></div>
                <div class="col-12 mb-3"><button id="btn-salida"   class="btn btn-danger  btn-lg btn-block disabled-button" disabled>Salida</button></div>
                <div class="col-12 mb-3"><button id="btn-consulta" class="btn btn-primary btn-lg btn-block">Consultar tiempo laborado</button></div>
            </div>
        </div>`);

    initialise_page();
};

// ---------- constants --------------------------------------------------------
const BUTTON_IDS = ['btn-entrada', 'btn-break', 'btn-regreso', 'btn-salida'];
const ACTION_MAP = {
    'btn-entrada'  : { logType: 'IN',  label: 'clock-in' },
    'btn-break' : { logType: 'OUT', label: 'break start' },
    'btn-regreso'  : { logType: 'IN',  label: 'break end' },
    'btn-salida'   : { logType: 'OUT', label: 'clock-out' }
};

// ---------- boot sequence ----------------------------------------------------
function initialise_page() {
    const emp = frappe.session.user_fullname || frappe.session.user;
    document.getElementById('employee-name').innerText = __('Empleado: {0}', [emp]);

    BUTTON_IDS.forEach(id =>
        document.getElementById(id).addEventListener('click', () => register_checkin(id))
    );
    document.getElementById('btn-consulta').addEventListener('click', consult_worked_time);

    refresh_button_state();
}

// ---------- habilitar / deshabilitar botones --------------------------------
function refresh_button_state() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    frappe.call({
        method: 'finde.functions.get_current_status',
        args:   { client_timezone: tz },
        callback: ({ message }) => update_buttons_for(message ? message.last_action : null),
        error: () => frappe.msgprint(__('No se pudo obtener el estado actual del servidor.'))
    });
}

function update_buttons_for(lastAction) {
    // Deshabilitar todos primero
    BUTTON_IDS.forEach(disable_button);

    switch (lastAction) {
        case 'clock-in':         // jornada iniciada
            enable_button('btn-break');  // Inicio de Break
            enable_button('btn-salida');    // Salida
            break;

        case 'break start':      // en break
            enable_button('btn-regreso');   // Fin de Break
            break;

        case 'break end':        // regresó de break
            enable_button('btn-break');  // Puede iniciar otro break
            enable_button('btn-salida');    // O cerrar jornada
            break;

        default:                 // 'clock-out' o sin registros
            enable_button('btn-entrada');   // Nuevo día
    }
}

function enable_button(id)  { const e = document.getElementById(id); e.disabled = false; e.classList.remove('disabled-button'); }
function disable_button(id) { const e = document.getElementById(id); e.disabled = true;  e.classList.add('disabled-button'); }

// ---------- flujo de registro ------------------------------------------------
function register_checkin(btnId) {
    const { logType, label } = ACTION_MAP[btnId];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    BUTTON_IDS.forEach(disable_button);

    frappe.db.get_single_value('Ajustes de Control Asistencia', 'require_geolocation')
        .then(requireGeo => {
            if (!requireGeo) {
                // Geolocalización no requerida — registrar sin coordenadas
                submit_checkin(logType, label, null, null, tz);
                return;
            }
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => submit_checkin(logType, label, pos.coords.latitude, pos.coords.longitude, tz),
                    ()  => {
                        frappe.msgprint(__('La geolocalización es requerida pero no está disponible. Por favor habilite los servicios de ubicación.'));
                        refresh_button_state();
                    }
                );
            } else {
                frappe.msgprint(__('La geolocalización es requerida pero su navegador no la soporta.'));
                refresh_button_state();
            }
        });
}
function submit_checkin(logType, customLabel, lat, lon, tz) {
    frappe.call({
        method: 'finde.functions.register_checkin',
        args:   { log_type: logType, custom_registration_type: customLabel, latitude: lat, longitude: lon, client_timezone: tz },
        callback: ({ message }) => {
            frappe.msgprint(message || __('Registro guardado.'));
            refresh_button_state();
        },
        error: () => {
            frappe.msgprint(__('Error del servidor – su acción NO fue registrada.'));
            refresh_button_state();
        }
    });
}

// ---------- consulta de tiempo laborado --------------------------------------
function consult_worked_time() {
    const clientTime = new Date().toISOString().slice(0, 19); // strip TZ
    frappe.call({
        method: 'control_asistencia.control_asistencia.functions.get_current_worked_hours',
        args:   { client_time: clientTime },
        callback: ({ message }) => {
            if (!message) return frappe.msgprint(__('No se pudo obtener el tiempo laborado.'));
            const { worked_hours, break_hours } = message;
            frappe.msgprint({
                title: __('Tiempo Laborado'),
                indicator: 'blue',
                message: `<div style="font-size:24px;text-align:center;">${worked_hours}<br>${break_hours}</div>`
            });
        },
        error: () => frappe.msgprint(__('Error del servidor al obtener el tiempo laborado.'))
    });
}
