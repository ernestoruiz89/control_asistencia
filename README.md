<![CDATA[<div align="center">

# 🕐 Control Asistencia

**Sistema integral de control de asistencia para empleados**
construido sobre [Frappe Framework](https://frappeframework.com) / [ERPNext](https://erpnext.com).

![Python](https://img.shields.io/badge/Python-≥3.10-3776AB?logo=python&logoColor=white)
![Frappe](https://img.shields.io/badge/Frappe-v15-0089FF?logo=frappe&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-Expo_54-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## 📋 Descripción General

**Control Asistencia** es una aplicación Frappe que extiende ERPNext con un ecosistema completo de registro de asistencia. El sistema ofrece tres interfaces de marcación (web, escritorio y móvil) conectadas a un backend centralizado que gestiona turnos, permisos, geocercas y seguridad por dispositivo.

### Arquitectura

```
┌────────────────────────────────────────────────────────────┐
│                    Frappe / ERPNext Backend                 │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │   Shift Panel     │  │    Asistencia    │  │  Settings │ │
│  │  (Panel de Turnos)│  │   (Desk Page)    │  │  Doctype  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └─────┬─────┘ │
│           │                     │                   │       │
│  ┌────────┴─────────────────────┴───────────────────┴─────┐ │
│  │               API Python (whitelisted methods)         │ │
│  │         functions.py  ·  shift_panel.py                │ │
│  └────────┬──────────────────────┬────────────────────────┘ │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
    ┌───────┴──────┐       ┌───────┴──────┐
    │  Desktop App │       │  Mobile App  │
    │  (Tkinter)   │       │ (Expo / RN)  │
    └──────────────┘       └──────────────┘
```

---

## ✨ Funcionalidades Principales

### 📅 Panel de Turnos (Shift Panel)

Centro de control visual avanzado para la gestión de horarios y asistencia:

- **Vistas Flexibles:** Alterna entre vista semanal y mensual según la necesidad de planificación.
- **Modo Pantalla Completa:** Botón de expansión para una visualización inmersiva y maximizada de la cuadrícula.
- **Temas (Dark/Light):** Soporte completo para Modo Oscuro y Claro utilizando variables nativas de Frappe.
- **Navegación Fluida:** Cuadrícula con scroll horizontal y nombres de empleados fijos (columnas pegajosas) para facilitar la lectura.
- **Real-Time:** Actualización automática del estado de asistencia mediante WebSockets en tiempo real.
- **Acciones Rápidas:** Botones para Crear Turnos, Asignar Horarios, dar de alta Nuevos Empleados y editar empleados existentes directamente desde la interfaz.
- **Filtros Avanzados:** Filtrado por sucursal, estado del empleado y búsqueda por nombre/ID/identificación.
- **Gestión de Permisos:** Creación y cancelación de Leave Applications (vacaciones/permisos) con asignación automática de Leave Allocation.
- **Detalle por Celda:** Click en cualquier celda para ver asignaciones de turno, checkins y permisos del día específico.

### 🖥️ Página de Asistencia (Desk)

Interfaz web integrada en el escritorio de ERPNext para que los empleados registren su jornada:

- **Botones Contextuales:** Entrada → Inicio Break → Fin Break → Salida, habilitados/deshabilitados según el último evento registrado.
- **Geolocalización Opcional:** Si está habilitada en la configuración, captura coordenadas GPS desde el navegador.
- **Consulta en Vivo:** Botón para consultar el tiempo total laborado y de break calculado en tiempo real.

### 💻 Aplicación de Escritorio (Windows)

Aplicación standalone en Python/Tkinter para terminales fijas:

- **Vinculación por MAC:** Auto-enrola la dirección MAC del equipo al primer uso; bloquea registros desde dispositivos no autorizados.
- **Identificación Inicial:** El empleado se vincula ingresando su número de identificación la primera vez.
- **Ejecutable Portátil:** Se compila a `.exe` con PyInstaller para distribución sin dependencias.
- **Autenticación por API Keys:** Usa tokens API de ERPNext (Key + Secret) almacenados en `.env`.

### 📱 Aplicación Móvil (React Native / Expo)

App nativa para Android e iOS con validación de proximidad:

- **Autenticación por Sesión:** Login contra el endpoint de Frappe con persistencia de cookies.
- **Geocerca (Geofencing):** Valida la distancia del empleado a las coordenadas GPS de su sucursal antes de permitir la marcación.
- **Distancia Configurable:** El radio máximo se configura desde `Ajustes de Control Asistencia` en ERPNext.
- **Seguridad por Device ID:** Vinculación automática del dispositivo (Android ID / iOS Vendor ID) para evitar marcaciones cruzadas.
- **Interfaz Premium:** Diseño dark-mode con animaciones, indicadores de estado en tiempo real y tarjetas informativas.

### ⚙️ Configuración Centralizada

Doctype **Ajustes de Control Asistencia** (Single):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `require_geolocation` | Check | Activar/desactivar el requerimiento de coordenadas GPS al registrar |
| `max_distance_meters` | Int | Distancia máxima permitida (en metros) para validar geocerca (default: 20) |

### 🔧 Custom Fields (Fixtures)

Campos personalizados inyectados en doctypes estándar de ERPNext:

| Doctype | Campo | Tipo | Uso |
|---------|-------|------|-----|
| Employee Checkin | `custom_registration_type` | Select | Tipo de registro: `clock-in`, `clock-out`, `break start`, `break end` |
| Employee | `custom_identificacion` | Data | Número de identificación del empleado (para vinculación desde app desktop) |
| Branch | `custom_latitud` | Float | Latitud GPS de la sucursal (para geocerca) |
| Branch | `custom_longitud` | Float | Longitud GPS de la sucursal (para geocerca) |

### 📡 Eventos en Tiempo Real (WebSockets)

El sistema publica el evento `update_shift_panel` ante cualquier cambio en:

- `Shift Assignment` (crear, actualizar, cancelar, eliminar)
- `Employee Checkin` (crear, actualizar, cancelar, eliminar)
- `Leave Application` (crear, actualizar, cancelar, eliminar)
- `Employee` (crear, actualizar, eliminar)

Esto permite que el Panel de Turnos se refresque automáticamente en todos los clientes conectados.

---

## 🚀 Instalación

### Requisitos Previos

- **Frappe Bench** v15+ ([guía de instalación](https://frappeframework.com/docs/user/en/installation))
- **ERPNext** instalado y configurado en el bench
- **Python** ≥ 3.10

### Instalar la App

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/ernestoruiz89/control_asistencia --branch develop
bench install-app control_asistencia
bench migrate
```

### Configuración Post-Instalación

1. Navegar a **Ajustes de Control Asistencia** y configurar las opciones de geolocalización.
2. En cada **Branch** (Sucursal), ingresar las coordenadas GPS (`Latitud` y `Longitud`) si se desea habilitar geocerca.
3. Crear los **Shift Types** (Turnos) desde el Panel de Turnos o desde la lista estándar de ERPNext.

---

## 📁 Estructura del Proyecto

```
control_asistencia/
├── control_asistencia/              # Módulo principal de Frappe
│   ├── hooks.py                     # Doc events, fixtures, configuración de la app
│   ├── modules.txt                  # "Control Asistencia"
│   ├── patches.txt                  # Data migrations
│   ├── patches/                     # Scripts de migración
│   ├── fixtures/                    # Custom fields exportados como JSON
│   ├── config/                      # Configuración del módulo
│   ├── public/                      # Assets estáticos
│   ├── templates/                   # Plantillas web
│   └── control_asistencia/          # Lógica de negocio
│       ├── functions.py             # API: register_checkin, get_current_status, etc.
│       ├── shift_panel.py           # API: panel de turnos, asignaciones, empleados, mobile
│       ├── doctype/
│       │   └── ajustes_de_control_asistencia/   # Doctype de configuración (Single)
│       ├── page/
│       │   ├── panel_turnos/        # Página: Panel de Turnos (JS + CSS)
│       │   └── asistencia/          # Página: Control de Asistencia (Desk)
│       └── workspace/
│           └── control_de_asistencia/   # Workspace para el módulo
│
├── app/                             # Aplicaciones cliente
│   ├── desktop/                     # App de escritorio (Python / Tkinter)
│   │   ├── check_in.py              # Código fuente principal
│   │   ├── check_in.spec            # Spec de PyInstaller
│   │   ├── icon.ico                 # Icono de la aplicación
│   │   └── README.md                # Documentación específica del desktop
│   │
│   └── asistencia_mobile/           # App móvil (React Native / Expo 54)
│       ├── App.tsx                  # Componente principal
│       ├── package.json             # Dependencias (expo, geolib, async-storage)
│       └── app.json                 # Configuración de Expo
│
├── pyproject.toml                   # Configuración del proyecto Python (ruff, flit)
├── license.txt                      # Licencia MIT
└── README.md                        # Este archivo
```

---

## 🔌 API Reference

### `functions.py` — Endpoints de Asistencia

| Método | Descripción |
|--------|-------------|
| `register_checkin` | Registra un Employee Checkin (entrada, salida, break). Valida dispositivo y geolocalización. |
| `get_current_status` | Retorna el estado actual del empleado (trabajando, en break, finalizado). |
| `get_current_worked_hours` | Calcula horas trabajadas y de break usando la hora del cliente. |
| `calculate_worked_hours` | Calcula horas trabajadas para un empleado por ID. |
| `get_last_checkin` | Retorna el último registro de checkin de un empleado. |
| `get_total_break_time` | Calcula el tiempo total de break desde el último clock-in. |
| `get_server_time` | Retorna la hora actual del servidor. |
| `get_employee_and_enroll` | Busca empleado por identificación y vincula MAC address del dispositivo. |

### `shift_panel.py` — Endpoints del Panel de Turnos

| Método | Descripción |
|--------|-------------|
| `get_shift_types` | Lista todos los Shift Types con etiqueta formateada (ej: "8:00am - 5:00pm"). |
| `create_shift_type` | Crea un nuevo Shift Type con nombre auto-generado. |
| `assign_shift` | Asigna turno a un empleado en un rango de fechas (una asignación por día). |
| `get_weekly_panel_data` | Datos del panel: empleados, turnos, checkins, permisos para un rango de fechas. |
| `get_day_details` | Detalle del día: asignaciones, permisos y checkins de un empleado+fecha. |
| `remove_shift_assignment` | Cancela asignaciones de turno de un empleado+fecha. |
| `create_leave` | Crea y aprueba un Leave Application (con auto-allocation). |
| `cancel_leave` | Cancela un Leave Application existente. |
| `create_employee_with_user` | Alta rápida de empleado con creación opcional de User. |
| `get_mobile_profile` | Perfil del empleado para la app móvil (sucursal, coordenadas, distancia). |
| `record_mobile_checkin` | Registra checkin desde la app móvil con validación de Device ID. |

---

## 🤝 Contributing

Esta app usa `pre-commit` para formateo y linting de código. [Instala pre-commit](https://pre-commit.com/#installation) y habilítalo:

```bash
cd apps/control_asistencia
pre-commit install
```

Herramientas configuradas:

- **ruff** — linter y formatter de Python
- **eslint** — linter de JavaScript
- **prettier** — formatter de código
- **pyupgrade** — modernización de sintaxis Python

---

## 📄 Licencia

Este proyecto está licenciado bajo la **[MIT License](license.txt)**.

Desarrollado por **Ernesto Ruiz Escorcia** · [eruiz@wbapps.com](mailto:eruiz@wbapps.com)
]]>
