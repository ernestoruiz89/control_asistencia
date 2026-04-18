# Aplicación de Escritorio - Control de Asistencia

Esta aplicación de escritorio, desarrollada con Python y Tkinter, permite a los empleados registrar su entrada y salida directamente desde sus ordenadores locales. El sistema vincula al empleado con el dispositivo mediante su dirección MAC, evitando así que un empleado registre su asistencia desde múltiples computadoras o desde equipos no autorizados.

## Requisitos Previos

Asegúrate de contar con Python instalado en tu sistema (preferiblemente Python 3.10+).

Las siguientes librerías de terceros son requeridas para la ejecución de la aplicación:
- `requests` (para la comunicación con la API de ERPNext)
- `python-dotenv` (para la gestión segura de credenciales y variables de entorno)

Puedes instalarlas usando el siguiente comando:
```bash
pip install requests python-dotenv
```

Otras bibliotecas como `tkinter`, `os`, `uuid`, `json` y `datetime` ya están incluidas en la biblioteca estándar de Python.

## Ejecución en modo desarrollo

Para probar o ejecutar la aplicación directamente desde el código fuente sin compilar:
```bash
python check_in.py
```

## Compilación del Ejecutable (`.exe`)

Para distribuir esta aplicación como un archivo ejecutable independiente (`.exe`), sin necesidad de que las terminales destino tengan Python instalado, utilizamos **PyInstaller**.

1. Instala PyInstaller:
```bash
pip install pyinstaller
```

2. Ejecuta el siguiente comando dentro de esta carpeta (`app/desktop/`) para generar el ejecutable:
```bash
pyinstaller --noconfirm --onefile --windowed --icon "icon.ico" check_in.py
```

**Explicación de los parámetros:**
- `--onefile`: Empaqueta todas las dependencias y recursos en un único archivo `.exe`.
- `--windowed` (o `-w`): Ejecuta la interfaz gráfica sin abrir la ventana de la terminal (CMD) en segundo plano.
- `--icon "icon.ico"`: (*Opcional*) Asigna el icono al programa (debes tener el archivo `icon.ico` en la misma carpeta).

### ¿Dónde encuentro el ejecutable?
Al finalizar el proceso, notarás que se han generado las carpetas `build/` y `dist/`. Tu aplicación final lista para distribuir estará ubicada dentro de la carpeta **`dist/`** bajo el nombre `check_in.exe`. Copia ese archivo a las computadoras de los empleados.

## Notas sobre Variables de Entorno (`.env`)

Durante su uso, el sistema generará de forma automática un archivo local `.env` (oculto en algunos sistemas operativos) en la misma ruta donde se encuentre el archivo ejecutable. Este archivo sirve para almacenar en memoria local:
- La dirección (URL) del servidor ERP.
- Los tokens API de acceso (API Key y API Secret).
- El número de identificación de empleado enlazado.

> **Importante:** El archivo `.env` ha sido añadido a la lista `.gitignore` para prevenir exponer accidentalmente credenciales activas en repositorios públicos. Lo mismo aplica para las carpetas generadas de compilación `build/` y `dist/`.
