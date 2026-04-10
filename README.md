### Control Asistencia

Control de asistencia de empleados

### Key Features

#### 📅 Panel de Turnos (Shift Panel)
Centro de control visual avanzado para la gestión de horarios y asistencia:
- **Vistas Flexibles:** Alterna entre vista semanal y mensual según la necesidad de planificación.
- **Modo Pantalla Completa:** Botón de expansión para una visualización inmersiva y maximizada de la cuadrícula.
- **Diseño Adaptable (Temas):** Soporte completo para Modo Oscuro y Claro utilizando variables nativas de Frappe.
- **Navegación Fluida:** Cuadrícula con scroll horizontal y nombres de empleados fijos (columnas pegajosas) para facilitar la lectura.
- **Real-Time:** Actualización automática del estado de asistencia mediante WebSockets.
- **Acceso Rápido:** Botones optimizados para Crear Turnos, Asignar Horarios y dar de alta Nuevos Empleados directamente desde la interfaz.

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app control_asistencia
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/control_asistencia
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
