#!/bin/bash
# fix-overlay-z-order-level.sh - Corrige el orden Z del Overlay usando el nivel más alto.

LOG_PREFIX="[Z-ORDER-V4]"
MAIN_JS_FILE="main.js"
APP_NAME="lolmetamind-electron"
NODE_PORT=3001

echo "=========================================================="
echo "$LOG_PREFIX 🚀 Aplicando Fix Definitivo de Visibilidad Z-Order (Nivel Screen-Saver)"
echo "=========================================================="

# 1. Reemplazamos la función createOverlayWindow con la versión de Z-Order más alto y simplificada.

sed -i '/function createOverlayWindow() {/,/overlayWindow.on('closed', () => (overlayWindow = null));/c\
function createOverlayWindow() {\
    const primaryDisplay = screen.getPrimaryDisplay();\
    const { width, height } = primaryDisplay.workAreaSize;\
\
    overlayWindow = new BrowserWindow({\
        width, height, x: 0, y: 0,\
        transparent: true, // Overlay debe ser transparente\
        frame: false,\
        focusable: false,\
        alwaysOnTop: true,\
        skipTaskbar: true, // Ocultar de la barra de tareas\
        webPreferences: {\
            preload: path.join(__dirname, 'preload.js'),\
            nodeIntegration: false,\
            contextIsolation: true,\
        },\
    });\
\
    overlayWindow.loadURL(OVERLAY_PATH);\
\
    // FIX DE VISIBILIDAD CRÍTICO (MODO DEV) Y ORDEN Z MÁS ALTO\
    if (isDevMode) {\
        // CRÍTICO: Usamos 'screen-saver' para el Z-order más alto, garantizando que esté sobre el Dashboard.\
        overlayWindow.setAlwaysOnTop(true, 'screen-saver');\
        overlayWindow.showInactive(); \
        console.log("[OVERLAY] ✅ Ventana de Overlay visible (Z-Order: Screen Saver). Use CTRL+F1/F2.");\
    } else {\
        // Comportamiento de producción: siempre oculto al inicio.\
        overlayWindow.hide();\
        overlayWindow.setAlwaysOnTop(true); // Se mantiene alwaysOnTop pero en nivel default\
    }\
\
    // Estado inicial de interacción: Pasivo (transparente a clicks)\
    overlayWindow.setIgnoreMouseEvents(true);\
    \
    overlayWindow.on('closed', () => (overlayWindow = null));\
}' "$MAIN_JS_FILE"

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al aplicar la corrección de Z-Order en $MAIN_JS_FILE. Abortando."
    exit 1
fi
echo "$LOG_PREFIX ✅ Corrección de Z-Order (Nivel Screen-Saver) en main.js aplicada con éxito."
echo "$LOG_PREFIX ----------------------------------------------------------"

# 2. PROCESO DE ARRANQUE ROBUSTO

echo "$LOG_PREFIX 🧹 [PASO 1/3] Limpiando procesos antiguos..."
if command -v pkill &> /dev/null; then
    pkill -f "$APP_NAME" 2>/dev/null || true
fi

sleep 1 

echo "$LOG_PREFIX 🟢 [PASO 2/3] Iniciando el Sistema de Coaching en tiempo real..."
echo "----------------------------------------------------------"
echo "$LOG_PREFIX ⏳ ESPERE: El Overlay DEBE aparecer ahora sobre cualquier otra ventana (incluyendo el Dashboard)."
echo "$LOG_PREFIX 💡 Recuerda: Pulsa CTRL+F1 para que los widgets se vuelvan clickeables y arrastrables."
echo "----------------------------------------------------------"

# Ejecuta el script principal de desarrollo concurrente
exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi

exit 0