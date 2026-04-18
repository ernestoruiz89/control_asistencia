# Aplicación de Escritorio - Control de Asistencia

Esta aplicación de escritorio basada en Tkinter permite a los empleados registrar su entrada y salida directamente desde sus ordenadores locales, vinculando un único registro por dispositivo validado mediante la dirección MAC, limitando intentos de registrar desde múltiples computadoras.

## Requisitos Previos

Asegúrate de contar con Python instalado en tu sistema (preferiblemente Python 3.8+).

Las siguientes librerías de terceros son requeridas para la ejecución de la aplicación:
- `requests` (para la comunicación con la API de ERPNext)
- `python-dotenv` (para la gestión segura y de credenciales y variables de entorno)

Puedes instalarlas usando el siguiente comando:
```bash
pip install requests python-dotenv
```

Otras bibliotecas como `tkinter`, `os`, `uuid`, `json` y `datetime` ya están incluidas en la biblioteca estándar de Python.

## Ejecución en modo desarrollo

Para probar o ejecutar la aplicación sin compilar:
```bash
python check_in.py
```

## Compilación del Ejecutable (`.exe`)

Para distribuir esta aplicación como un archivo ejecutable independiente (`.exe`) sin necesidad de que las terminales tengan Python instalado, te recomendamos usar **PyInstaller**.

1. Instala PyInstaller:
```bash
pip install pyinstaller
```

2. Ejecuta el siguiente comando dentro de esta carpeta (`app/desktop/`) para generar el ejecutable:
```bash
pyinstaller --noconfirm --onefile --windowed --icon "icon.ico" "check_in.py"
```

**Explicación de parámetros:**
- `--onefile`: Empaqueta todo en un único archivo `.exe`.
- `--windowed` (o `-w`): Evita que se abra una ventana de la consola (CMD) de fondo al ejecutar la app gráfica.
- `--icon "icon.ico"`: (*Opcional*) Asigna el icono a tu programa (debe existir un archivo `icon.ico` válido en el mismo directorio).

### ¿Dónde encuentro el ejecutable?
Al finalizar el proceso, notarás que se generaron las carpetas `build/` y `dist/`. Tu aplicación final estará ubicada dentro de la carpeta **`dist/`** bajo el nombre `check_in.exe`. Ese único archivo es el que debes distribuir o copiar a las computadoras de los empleados.

## Notas sobre Variables de Entorno (`.env`)

Durante su uso, el sistema generará automáticamente un archivo `.env` para almacenar en caché:
- La configuración a la URL del ERP.
- Los tokens API (Key y Secret).
- El ID del empleado enlazado.

> **Importante:** El archivo `.env` ha sido añadido a la lista de `.gitignore` para prevenir filtrar credenciales al repositorio público, al igual que las carpetas compiladas `build/` y `dist/`.
