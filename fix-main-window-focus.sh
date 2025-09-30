#!/bin/bash
# fix-main-window-focus.sh - Corrige el robo de foco del Dashboard para que el Overlay sea visible.

LOG_PREFIX="[FOCUS-FIX]"
MAIN_JS_FILE="main.js"

echo "=========================================================="
echo "$LOG_PREFIX 🚀 Aplicando Fix de Foco del Dashboard"
echo "$LOG_PREFIX Se forzará al Dashboard a mostrarse de forma inactiva."
echo "=========================================================="

# 1. Reemplazamos la función createMainWindow para usar showInactive()

sed -i '/function createMainWindow() {/,/mainWindow.on('closed', () => {/c\
function createMainWindow() {\
    // 1. Cierra la ventana antigua (Login)\
    if (loginWindow) loginWindow.close(); \
    \
    // 2. Crea la nueva ventana (Dashboard)\
    mainWindow = new BrowserWindow({\
        // CRÍTICO: Reduje el minWidth/minHeight para evitar problemas en monitores pequeños en desarrollo.\
        width: 1920,\
        height: 1080,\
        minWidth: 1000, // Ajustado\
        minHeight: 720, // Ajustado\
        show: false, // Inicia oculto para evitar el flash blanco\
        frame: false,\
        transparent: false, \
        backgroundColor: '#0A141A', // Fondo sólido para el Dashboard\
        webPreferences: {\
            preload: path.join(__dirname, 'preload.js'),\
            nodeIntegration: false,\
            contextIsolation: true,\
        },\
    });\
\
    // 3. Carga la URL del Dashboard\
    mainWindow.loadURL(INDEX_PATH); \
\
    // 4. CRÍTICO: Muestra la ventana del Dashboard SÓLO cuando está lista, pero INACTIVA.\
    mainWindow.once('ready-to-show', () => {\
        console.log("[MAIN] READY-TO-SHOW disparado. Mostrando mainWindow (Dashboard) INACTIVO.");\
        mainWindow.showInactive(); \
        mainWindow.center();\
        // El inicio del polling se hace en el setTimeout de app.on('ready')\
    });\
\
\
    mainWindow.on('closed', () => {\
        mainWindow = null;\
    });\
}' "$MAIN_JS_FILE"

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR: Fallo al aplicar la corrección de Foco en $MAIN_JS_FILE. Abortando."
    exit 1
fi
echo "$LOG_PREFIX ✅ Corrección de Foco de Dashboard aplicada con éxito."
echo "$LOG_PREFIX ----------------------------------------------------------"

# 2. PROCESO DE ARRANQUE

echo "$LOG_PREFIX 🟢 [PASO 2/2] Reiniciando el Sistema de Coaching..."
echo "----------------------------------------------------------"

# Ejecuta el script principal de desarrollo concurrente
exec npm run electron:dev

if [ $? -ne 0 ]; then
    echo "$LOG_PREFIX ❌ ERROR CRÍTICO: El comando 'npm run electron:dev' ha fallado al iniciar la aplicación."
    exit 1
fi

exit 0