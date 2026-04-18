# Aplicación Móvil - Asistencia

App nativa (Android / iOS) estructurada en [React Native](https://reactnative.dev/) vía [Expo](https://expo.dev/) para el registro de check-ins de empleados con validación de geocerca y asignación de dispositivo único.

## Características Principales

1. **Gestión de Sesión Constante**: Se almacena la última URL del servidor conectada utilizando AsyncStorage y cookies del lado del servidor nativo.
2. **Geolocalización In-App**: Rastrea la latitud y longitud antes de procesar cualquier entrada para verificar que se encuentre dentro del radio de metros configurados en el ERP.
3. **Restricción de Dispositivo Multicuenta**: Valida internamente el `device_id` simulando la MAC con el serial propio del dispositivo para bloquear marcaciones compartidas.
4. **Diseño Premium Interactivo**: Construcción visual amigable con *Dark Mode* predeterminado, indicadores vivos (pulse animations) y respuestas inmediatas en la cuadrícula del ERP.

---

## 💻 Desarrollo Local

### Requisitos
- Node.js versión LTS (18+ o superior)
- Tener la app global instalada de `expo-cli`
- Descargar la aplicación cliente de **Expo Go** en la App Store (iPhone) o Play Store (Android).

### Ejecución
1. Dirígete a esta carpeta `app/asistencia_mobile`.
2. Instala por primera vez las dependencias completas del ecosistema Node (solo necesitas hacerlo una vez):
   ```bash
   npm install
   ```
3. Ejecuta en terminal:
   ```bash
   npx expo start
   ```
4. Se generará un código QR en tu pantalla. Ábrelo utilizando la cámara normal de tu iPhone, o utilizando el escáner de un dispositivo Android adentro de la app **Expo Go** (deberías estar en la misma red de WiFi que tu computador).

---

## 📦 Compilación a APK para Producción

Esta aplicación interactúa con la compilación gratuita en la nube de **EAS (Expo Application Services)**, lo que omite completamente la dolorosa necesidad de instalar Android Studio en tu equipo central.

1. Si no lo has hecho, deberás loguearte tu cuenta de Expo:
   ```bash
   npx eas login
   ```
2. Inicia la solicitud de compilación del instalable (`.apk` directos) hacia los servidores. Se usará el perfil `preview` como se diseñó en `eas.json` para sacar instaladores sin ser obligatoriamente paquetes AAB (tienda):
   ```bash
   npx eas build -p android --profile preview
   ```
3. Esto te entregará un enlace a la web de Expo. Tu consola volverá de nuevo cuando su trabajo de 10-15 minutos armando el instalador por debajo haya terminado, y te proveerá directamente un código **QR instalable real** + un botón de descarga pura.

Para conocer más sobre este flujo, consultar la [Documentación de Compilaciones Expo EAS](https://docs.expo.dev/build/setup/).
