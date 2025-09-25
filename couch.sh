#!/bin/bash

# =========================================================================================
# SCRIPT DE PREPARACIÓN DE LA APP DE ESCRITORIO (lolmetamind-electron)
# 1. Desactiva temporalmente el requerimiento de licencia (Bypass para pruebas).
# 2. Implementa la lógica para enviar datos en tiempo real (LCU API) al backend.
# =========================================================================================

REPO_PATH="so-in2025/lolmetamind-electron/lolmetamind-electron-1d7c483b453b52fd5ad20ff92d04c9c002543f51"

echo "--- 1. Pausando el Requerimiento de Licencia: src/app/page.jsx ---"
# El archivo src/app/page.jsx es la página de login. Redirigimos al overlay si es Electron.
cat > "${REPO_PATH}/src/app/page.jsx" << 'EOL'
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LicenseForm from '@/components/LicenseForm';

// Detecta si la aplicación está corriendo dentro de Electron
const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        if (isElectron) {
            console.log("Modo Electron detectado. Saltando requerimiento de clave para prueba personal.");
            // >>>>>>>>>>>>>>>>> BYPASS DE LICENCIA TEMPORAL (INICIO) <<<<<<<<<<<<<<<<<
            // Se asume que en producción, el token JWT se cargaría de forma persistente.
            // Para la prueba personal, redirigimos directamente al HUD.
            router.push('/overlay');
            // >>>>>>>>>>>>>>>>> BYPASS DE LICENCIA TEMPORAL (FIN) <<<<<<<<<<<<<<<<<<<
        }
    }, [router]);

    // Mostrar un mensaje de carga/bypass si se está en Electron
    if (isElectron) {
        return <div className="flex items-center justify-center min-h-screen text-lol-gold">Cargando Coach de Élite... (Bypass de Licencia activo)</div>;
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <LicenseForm />
        </div>
    );
}
EOL
echo "src/app/page.jsx modificado para bypass temporal de licencia."


echo "--- 2. Implementando Bridge LCU API: preload.js ---"
# El archivo preload.js es la interfaz segura de Node.js (Electron) al frontend (Next.js)
cat > "${REPO_PATH}/preload.js" << 'EOL'
const { contextBridge, ipcRenderer } = require('electron');
const https = require('https');

// La LCU API usa certificados auto-firmados, se requiere un agente personalizado.
// NOTA: 'rejectUnauthorized: false' es necesario para la API local del cliente LoL
const agent = new https.Agent({
    rejectUnauthorized: false 
});

const LCU_URL = 'https://127.0.0.1:2999/liveclientdata/allgamedata';

function fetchLcuData() {
    return new Promise((resolve) => {
        https.get(LCU_URL, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    // Si el juego está activo, devuelve el JSON. Si no, intenta parsear lo que haya.
                    resolve(JSON.parse(data));
                } catch (e) {
                    // Falla al parsear JSON (p. ej., puerto abierto pero no hay partida)
                    resolve(null); 
                }
            });
        }).on('error', (err) => {
            // El puerto no está abierto (fuera de partida)
            resolve(null);
        });
    });
}

/**
 * Inicia el polling de la LCU API y envía los datos al proceso principal (main.js)
 * para que este los postee al servidor backend.
 */
const startLcuPolling = (intervalTime = 10000) => {
    let intervalId = null;

    const poll = async () => {
        const gameData = await fetchLcuData();
        
        if (gameData && gameData.gameTime > 0) {
            console.log(`[LCU Polling] Enviando datos al backend (Tiempo: ${gameData.gameTime})`);
            // IPC al proceso principal para que POSTEE al backend
            // main.js será el encargado de adjuntar el JWT y hacer la llamada HTTP a Render/Vercel
            ipcRenderer.send('lcu-data-update', gameData);
        } else {
            console.log('[LCU Polling] Esperando partida activa o datos de LCU...');
        }
    };
    
    // Ejecutar inmediatamente y luego en el intervalo
    poll();
    intervalId = setInterval(poll, intervalTime);

    // Función de limpieza para detener el polling
    return () => {
        if (intervalId) clearInterval(intervalId);
    };
};

// Exponer la función al contexto de renderizado (frontend Next.js)
contextBridge.exposeInMainWorld('electronApi', {
    startLcuPolling: startLcuPolling,
    // Otras funciones de electronApi se mantienen
});
EOL
echo "preload.js actualizado con LCU Polling bridge."

echo "--- 3. Implementando Lógica de Red y Token en: main.js ---"
# Aquí se usa Axios (que debes instalar) para enviar los datos al backend de producción.
cat > "${REPO_PATH}/main.js" << 'EOL'
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const axios = require('axios'); // Asegúrate de haber instalado 'axios'

// !!! REEMPLAZAR ESTAS VARIABLES CON TUS VALORES REALES DE PRODUCCIÓN !!!
// El token JWT debe ser obtenido durante el login y guardado de forma persistente.
// Para esta prueba, puedes pegar un token JWT válido que uses en Postman.
let USER_JWT_TOKEN = 'YOUR_PERSISTED_JWT_TOKEN_HERE'; 
const BACKEND_DOMAIN = 'https://lolmetamind.render.com'; // Dominio de tu backend (Vercel/Render)

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 750,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, 
        },
    });

    if (isDev) {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, 'out', 'index.html'));
    }

    if (isDev) {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // ==================================================================
    // IPC MAIN: MANEJO DE DATOS DEL CLIENTE (LCU)
    // ==================================================================
    ipcMain.on('lcu-data-update', async (event, gameData) => {
        if (!USER_JWT_TOKEN || !BACKEND_DOMAIN) {
            console.error("❌ ERROR: JWT Token o Backend Domain no configurados. Saltando POST.");
            return;
        }

        try {
            // POSTEAR los datos del juego al servidor de producción
            const response = await axios.post(
                `${BACKEND_DOMAIN}/api/live-game/update`,
                gameData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${USER_JWT_TOKEN}`
                    }
                }
            );
            // console.log(`✅ Backend Response: ${response.data.message}`);

        } catch (error) {
            // Manejo de errores de conexión o API.
            console.error('❌ Error al enviar datos al backend:', error.message);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
EOL
echo "main.js actualizado para manejar la data LCU y postear al backend."


echo "--- 4. Conectar el Polling al Frontend: src/app/overlay/page.jsx ---"
# El front del overlay necesita iniciar el polling
cat > "${REPO_PATH}/src/app/overlay/page.jsx" << 'EOL'
'use client';
import { useEffect, useState } from 'react';
import UnifiedHUD from '@/components/widgets/UnifiedHUD';
import RealtimeCoachHUD from '@/components/widgets/RealtimeCoachHUD'; // Asumiendo que necesitas este componente

const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

export default function OverlayPage() {
    const [statusMessage, setStatusMessage] = useState("Inicializando Coach en Tiempo Real...");

    useEffect(() => {
        let stopPolling = null;
        
        if (isElectron && window.electronApi && window.electronApi.startLcuPolling) {
            setStatusMessage("Conectando con el cliente de League of Legends...");
            
            // Iniciar el polling al LCU API cada 10 segundos
            // La función devuelve una función para detener el intervalo (cleanup)
            stopPolling = window.electronApi.startLcuPolling(10000); 

            // Configurar la conexión WebSocket al servidor principal (Render)
            // (Esta parte asume que el UnifiedHUD o un componente interno maneja la conexión WS)
            
            setStatusMessage("Coach LCU activo. Esperando el inicio de la partida...");
        } else {
            setStatusMessage("Esta página debe ejecutarse dentro de la aplicación Electron.");
        }

        // Función de limpieza al desmontar el componente
        return () => {
            if (stopPolling) {
                stopPolling();
                console.log("Polling LCU detenido.");
            }
        };
    }, []);

    return (
        <main className="w-screen h-screen">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <p className="text-lol-gold text-lg">{statusMessage}</p>
            </div>
            
            {/* El UnifiedHUD se encarga de conectar el WebSocket para recibir la respuesta de la IA */}
            <UnifiedHUD /> 
            
            {/* Opcional: Un componente específico para el mensaje de élite */}
            <RealtimeCoachHUD /> 
        </main>
    );
}
EOL
echo "src/app/overlay/page.jsx actualizado para iniciar el Polling LCU."


echo "--- 5. Pasos Manuales Finales (CRÍTICO) ---"
echo ""
echo "Para que el flujo funcione, debes ejecutar los siguientes comandos y reemplazos:"
echo ""
echo "1. INSTALAR DEPENDENCIAS CRÍTICAS DE RED:"
echo "   En la raíz de lolmetamind-electron (donde está package.json):"
echo "   npm install axios"
echo ""
echo "2. CONFIGURACIÓN DE PRODUCCIÓN EN main.js:"
echo "   Abre el archivo ${REPO_PATH}/main.js y edita las siguientes líneas:"
echo "   - USER_JWT_TOKEN: Pega un JWT válido de tu usuario."
echo "   - BACKEND_DOMAIN: Asegúrate de que esta URL sea el dominio de tu backend principal (Vercel/Render)."
echo ""
echo "3. PROBAR:"
echo "   Ejecuta la app de escritorio (npm run dev o electron .) con el cliente de LoL abierto y en una partida para que el polling funcione."