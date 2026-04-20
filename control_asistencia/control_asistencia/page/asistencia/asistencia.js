/**
 * Página de Control de Asistencia - Versión Web inspirada en App Mobile
 */

frappe.pages['asistencia'].on_page_load = async function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Marcar Asistencia'),
        single_column: true
    });
    
    // Ocultar la cabecera estándar de Frappe para usar diseño a pantalla completa
    $(wrapper).find('.page-head').hide();

    const css = "" +
        ".asistencia-mobile-container {" +
        "    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;" +
        "    background-color: #0f172a;" +
        "    min-height: calc(100vh - 80px);" +
        "    display: flex;" +
        "    flex-direction: column;" +
        "    color: white;" +
        "    margin: -15px -15px -60px -15px;" +
        "    overflow: hidden;" +
        "}" +
        ".am-header {" +
        "    background-color: #1e293b;" +
        "    padding: 40px 25px 25px 25px;" +
        "    border-bottom-left-radius: 30px;" +
        "    border-bottom-right-radius: 30px;" +
        "    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);" +
        "    z-index: 10;" +
        "}" +
        ".am-title-row {" +
        "    display: flex;" +
        "    justify-content: space-between;" +
        "    align-items: center;" +
        "}" +
        ".am-title {" +
        "    color: #ffffff;" +
        "    font-size: 26px;" +
        "    font-weight: 800;" +
        "    letter-spacing: 0.5px;" +
        "    margin-bottom: 5px;" +
        "    margin-top: 0;" +
        "}" +
        ".am-logout {" +
        "    color: #f43f5e;" +
        "    font-weight: bold;" +
        "    text-decoration: none !important;" +
        "    cursor: pointer;" +
        "}" +
        ".am-greeting {" +
        "    color: #94a3b8;" +
        "    font-size: 16px;" +
        "    margin: 0;" +
        "}" +
        ".am-branch-container {" +
        "    margin-top: 15px;" +
        "    background-color: rgba(255, 255, 255, 0.05);" +
        "    padding: 12px;" +
        "    border-radius: 12px;" +
        "}" +
        ".am-branch-label {" +
        "    color: #94a3b8;" +
        "    font-size: 12px;" +
        "    font-weight: 600;" +
        "    text-transform: uppercase;" +
        "    letter-spacing: 1px;" +
        "    margin-bottom: 2px;" +
        "}" +
        ".am-branch-text {" +
        "    color: #e2e8f0;" +
        "    font-size: 16px;" +
        "    font-weight: 700;" +
        "    margin: 0;" +
        "}" +
        ".am-content {" +
        "    flex: 1;" +
        "    padding: 25px;" +
        "    display: flex;" +
        "    flex-direction: column;" +
        "    justify-content: center;" +
        "}" +
        ".am-status-card {" +
        "    background-color: #ffffff;" +
        "    border-radius: 24px;" +
        "    padding: 25px;" +
        "    box-shadow: 0 12px 20px rgba(99, 102, 241, 0.15);" +
        "    margin-bottom: 40px;" +
        "    text-align: center;" +
        "    color: #334155;" +
        "    transition: transform 0.3s ease;" +
        "}" +
        ".am-pulse {" +
        "    animation: pulse-animation 2s infinite;" +
        "}" +
        "@keyframes pulse-animation {" +
        "    0% { transform: scale(1); }" +
        "    50% { transform: scale(1.02); }" +
        "    100% { transform: scale(1); }" +
        "}" +
        ".am-indicator-container {" +
        "    display: flex;" +
        "    align-items: center;" +
        "    justify-content: center;" +
        "    margin-bottom: 15px;" +
        "}" +
        ".am-dot {" +
        "    width: 12px;" +
        "    height: 12px;" +
        "    border-radius: 50%;" +
        "    margin-right: 10px;" +
        "}" +
        ".am-dot-gray { background-color: #cbd5e1; }" +
        ".am-dot-green {" +
        "    background-color: #10b981;" +
        "    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);" +
        "}" +
        ".am-status-text {" +
        "    font-size: 18px;" +
        "    font-weight: 700;" +
        "    margin: 0;" +
        "    color: #334155;" +
        "}" +
        ".am-divider {" +
        "    height: 1px;" +
        "    background-color: #e2e8f0;" +
        "    margin: 15px 0;" +
        "}" +
        ".am-distance-container {" +
        "    text-align: center;" +
        "}" +
        ".am-distance-label {" +
        "    font-size: 14px;" +
        "    color: #64748b;" +
        "    font-weight: 500;" +
        "    margin-bottom: 5px;" +
        "}" +
        ".am-distance-value {" +
        "    font-size: 28px;" +
        "    font-weight: 800;" +
        "    color: #10b981;" +
        "    margin: 0;" +
        "}" +
        ".am-text-red {" +
        "    color: #ef4444 !important;" +
        "}" +
        ".am-warning-text {" +
        "    margin-top: 8px;" +
        "    font-size: 12px;" +
        "    color: #ef4444;" +
        "    font-weight: 600;" +
        "    margin-bottom: 0;" +
        "}" +
        ".am-error-text {" +
        "    color: #ef4444;" +
        "    font-weight: 600;" +
        "    font-size: 14px;" +
        "    margin: 0;" +
        "}" +
        ".am-info-text {" +
        "    color: #64748b;" +
        "    font-size: 14px;" +
        "    margin: 0;" +
        "}" +
        ".am-refresh-btn {" +
        "    margin-top: 20px;" +
        "    padding: 10px 20px;" +
        "    background-color: #f1f5f9;" +
        "    border-radius: 10px;" +
        "    border: none;" +
        "    color: #6366f1;" +
        "    font-weight: 700;" +
        "    font-size: 14px;" +
        "    cursor: pointer;" +
        "    transition: background-color 0.2s;" +
        "}" +
        ".am-refresh-btn:hover {" +
        "    background-color: #e2e8f0;" +
        "}" +
        ".am-actions {" +
        "    display: flex;" +
        "    justify-content: space-between;" +
        "    gap: 15px;" +
        "}" +
        ".am-btn-action {" +
        "    flex: 1;" +
        "    height: 60px;" +
        "    border-radius: 16px;" +
        "    border: none;" +
        "    color: #ffffff;" +
        "    font-size: 16px;" +
        "    font-weight: 800;" +
        "    letter-spacing: 1px;" +
        "    cursor: pointer;" +
        "    box-shadow: 0 4px 6px rgba(0,0,0,0.1);" +
        "    transition: all 0.2s;" +
        "}" +
        ".am-btn-action:active:not(:disabled) {" +
        "    transform: scale(0.98);" +
        "}" +
        ".am-btn-in {" +
        "    background-color: #10b981;" +
        "}" +
        ".am-btn-out {" +
        "    background-color: #f43f5e;" +
        "}" +
        ".am-btn-disabled {" +
        "    background-color: #94a3b8 !important;" +
        "    cursor: not-allowed;" +
        "    opacity: 0.7;" +
        "    box-shadow: none;" +
        "}" +
        ".am-loading {" +
        "    display: flex;" +
        "    justify-content: center;" +
        "    align-items: center;" +
        "    height: 100%;" +
        "    color: #6366f1;" +
        "    font-size: 18px;" +
        "    font-weight: 600;" +
        "    flex-grow: 1;" +
        "}";

    frappe.dom.set_style(css);

    $(page.body).html(
        '<div class="asistencia-mobile-container" id="am-app">' +
        '    <div class="am-loading">Cargando perfil y estado...</div>' +
        '</div>'
    );

    let profile = null;
    let locationDist = null;
    let currentLocation = null;
    let isCheckingLoc = false;
    let locErrorMsg = null;
    let savingLog = false;

    function render() {
        if (!profile) return;

        const app = $('#am-app');
        const allowed_dist = profile.max_distance || 20;
        const canAction = !profile.require_geolocation || !profile.branch_lat || (locationDist !== null && locationDist <= allowed_dist);
        const status = profile.last_log_type === 'IN' ? 'checked-in' : 'checked-out';

        let locHtml = '';
        if (profile.require_geolocation) {
            if (locErrorMsg) {
                locHtml = '<p class="am-error-text">' + locErrorMsg + '</p>';
            } else if (!profile.branch_lat) {
                locHtml = '<p class="am-info-text">Esta sucursal no tiene validación GPS activa.</p>';
            } else if (isCheckingLoc) {
                locHtml = '<p class="am-info-text">Obteniendo ubicación actual...</p>';
            } else if (locationDist !== null) {
                let distClass = !canAction ? 'am-text-red' : '';
                locHtml = 
                    '<div class="am-distance-container">' +
                    '    <p class="am-distance-label">Distancia actual a la sucursal:</p>' +
                    '    <p class="am-distance-value ' + distClass + '">' + locationDist + ' metros</p>';
                if (!canAction) {
                    locHtml += '    <p class="am-warning-text">Debes acercarte a menos de ' + allowed_dist + 'm para registrarte.</p>';
                }
                locHtml += '</div>';
            } else {
                locHtml = '<p class="am-info-text">Esperando ubicación...</p>';
            }
            locHtml += '<button class="am-refresh-btn" id="am-btn-refresh">Actualizar Ubicación</button>';
        }

        const inDisabled = !canAction || status === 'checked-in' || savingLog || isCheckingLoc;
        const outDisabled = !canAction || status === 'checked-out' || savingLog || isCheckingLoc;

        const employeeName = profile.employee_name || 'Empleado';
        const branchName = profile.branch || 'Sin sucursal';
        const statusDot = status === 'checked-in' ? 'am-dot-green' : 'am-dot-gray';
        const statusLabel = status === 'checked-in' ? 'Turno Activo (Check-IN)' : 'Sin turno activo';
        const inStr = (savingLog && profile._attemptAction === 'IN') ? 'Guardando...' : 'Check IN';
        const outStr = (savingLog && profile._attemptAction === 'OUT') ? 'Guardando...' : 'Check OUT';

        let html = 
            '<div class="am-header">' +
            '    <div class="am-title-row">' +
            '        <h1 class="am-title">Marcar Asistencia</h1>' +
            '        <span class="am-logout" onclick="window.location.href=\'/app\'">Salir</span>' +
            '    </div>' +
            '    <p class="am-greeting">Hola, ' + employeeName + '</p>' +
            '    <div class="am-branch-container">' +
            '        <p class="am-branch-label">Sucursal Asignada</p>' +
            '        <p class="am-branch-text">' + branchName + '</p>' +
            '    </div>' +
            '</div>' +
            '<div class="am-content">' +
            '    <div class="am-status-card am-pulse">' +
            '        <div class="am-indicator-container">' +
            '            <div class="am-dot ' + statusDot + '"></div>' +
            '            <h2 class="am-status-text">' + statusLabel + '</h2>' +
            '        </div>';
        
        if (profile.require_geolocation) {
            html += '<div class="am-divider"></div>' + locHtml;
        }

        html +=
            '    </div>' +
            '    <div class="am-actions">' +
            '        <button class="am-btn-action am-btn-in ' + (inDisabled ? 'am-btn-disabled' : '') + '" id="am-btn-in" ' + (inDisabled ? 'disabled' : '') + '>' + inStr + '</button>' +
            '        <button class="am-btn-action am-btn-out ' + (outDisabled ? 'am-btn-disabled' : '') + '" id="am-btn-out" ' + (outDisabled ? 'disabled' : '') + '>' + outStr + '</button>' +
            '    </div>' +
            '</div>';

        app.html(html);

        $('#am-btn-refresh').on('click', checkLocation);
        $('#am-btn-in').on('click', function() { handleLog('IN'); });
        $('#am-btn-out').on('click', function() { handleLog('OUT'); });
    }

    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Radio de la tierra en metros
        const p1 = lat1 * Math.PI / 180;
        const p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
                  Math.cos(p1) * Math.cos(p2) *
                  Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(R * c);
    }

    function checkLocation() {
        if (!profile || !profile.require_geolocation) return;
        isCheckingLoc = true;
        locErrorMsg = null;
        render();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(pos) {
                currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if (profile.branch_lat && profile.branch_lng) {
                    locationDist = getDistance(pos.coords.latitude, pos.coords.longitude, profile.branch_lat, profile.branch_lng);
                } else {
                    locationDist = null;
                }
                isCheckingLoc = false;
                render();
            }, function(err) {
                isCheckingLoc = false;
                locErrorMsg = err.message || 'Error al obtener la ubicación GPS.';
                locationDist = null;
                render();
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        } else {
            isCheckingLoc = false;
            locErrorMsg = "Geolocalización no soportada por su navegador.";
            render();
        }
    }

    function handleLog(actionType) {
        if (savingLog) return;
        
        let deviceId = localStorage.getItem('attendance_device_id');
        if (!deviceId) {
            deviceId = frappe.utils.get_random(20);
            localStorage.setItem('attendance_device_id', deviceId);
        }

        savingLog = true;
        profile._attemptAction = actionType;
        render();

        frappe.call({
            method: 'control_asistencia.control_asistencia.shift_panel.record_mobile_checkin',
            args: {
                log_type: actionType,
                latitude: currentLocation ? currentLocation.lat : null,
                longitude: currentLocation ? currentLocation.lng : null,
                device_id: deviceId
            },
            callback: function(r) {
                savingLog = false;
                if (!r.exc && r.message) {
                    frappe.show_alert({
                        message: 'Marcación de ' + (actionType === 'IN' ? 'Entrada' : 'Salida') + ' exitosa', 
                        indicator: 'green'
                    });
                    profile.last_log_type = actionType;
                    render();
                } else {
                    let errMsg = 'Hubo un error al registrar la marcación.';
                    if (r._server_messages) {
                        try {
                            const msgs = JSON.parse(r._server_messages);
                            if (msgs.length > 0) {
                                errMsg = JSON.parse(msgs[0]).message.replace(/<[^>]+>/g, '');
                            }
                        } catch(e){}
                    }
                    frappe.msgprint({title: 'Error de Marcación', message: errMsg, indicator: 'red'});
                    render();
                }
            },
            error: function() {
                savingLog = false;
                render();
            }
        });
    }

    // Inicializar cargando el perfil
    frappe.call({
        method: 'control_asistencia.control_asistencia.shift_panel.get_mobile_profile',
        callback: function(r) {
            if (r.message) {
                profile = r.message;
                render();
                if (profile.require_geolocation) {
                    checkLocation();
                }
            } else {
                $('#am-app').html(
                    '<div style="flex:1; display:flex; justify-content:center; align-items:center; padding:40px;">' +
                    '    <span class="am-error-text">No se pudo cargar el perfil del empleado o su sesión ha expirado.</span>' +
                    '</div>'
                );
            }
        }
    });
};
