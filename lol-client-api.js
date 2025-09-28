// lol-client-api.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const Store = require('electron-store'); 
const { fetchScrapedData } = require('./lol-strategic-data-fallback');
const store = new Store(); 

// Agente HTTPS para ignorar el certificado SSL autofirmado de la LCU y el backend.
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

// 🚨 RUTAS CRÍTICAS
const LOCKFILE_PATH_INSTALL = 'C:\\Riot Games\\League of Legends\\lockfile';
const LOCKFILE_PATH_APPDATA = path.join(
  process.env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : ''),
  'Riot Games', 
  'League of Legends', 
  'lockfile'
);

/**
 * Llama a la API de Riot (Espectador) para obtener datos estratégicos (PRIORIDAD 2).
 */
async function fetchRiotApiData(riotApiKey, region) {
    if (!riotApiKey) {
        console.log('[RIOT API FALLBACK] No se encontró la clave API.');
        return null;
    }
    
    // ... (Lógica de Riot API Spectator es una simulación) ...
    const SPECTATOR_BASE_URL = `https://${region.toLowerCase()}.api.riotgames.com`; 
    
    try {
        console.log(`[RIOT API FALLBACK] -> Usando API Key para datos estratégicos en región: ${region}.`);
        // Simulación:
        const response = await axios.get(
            `${SPECTATOR_BASE_URL}/lol/spectator/v4/active-games/by-summoner/SIMULATED_ID`, 
            {
                headers: { 'X-Riot-Token': riotApiKey },
                timeout: 5000
            }
        );

        if (response.status === 200) {
            console.log('[RIOT API FALLBACK] [OK] Datos estratégicos recibidos con éxito.');
            return { fallbackMode: true, gameData: response.data };
        }
        return null;
    } catch (error) {
        if (error.response?.status === 404) {
             console.log('[RIOT API FALLBACK] [ALERTA] Error 404: No hay partida activa en Riot API.');
        } else if (error.response?.status === 429) {
             console.error('[RIOT API FALLBACK] [FALLO CRÍTICO] Límite de peticiones de Riot API excedido (429).');
        } else {
             console.error('[RIOT API FALLBACK] Error al conectar con Riot API:', error.message);
        }
        return null;
    }
}


/**
 * Lee el archivo lockfile para obtener el puerto y el token (password) del cliente LoL.
 */
async function readLoLCreds() {
    try {
        let lockfilePath = null;
        
        // ... (Lógica de búsqueda de lockfile) ...
        console.log(`[LCU CREDENTIALS] Intentando leer lockfile en Ruta de Instalacion: ${LOCKFILE_PATH_INSTALL}`);
        if (fs.existsSync(LOCKFILE_PATH_INSTALL)) {
            lockfilePath = LOCKFILE_PATH_INSTALL;
            console.log(`[LCU CREDENTIALS] [OK] lockfile encontrado en la Ruta de Instalacion.`);
        } 
        
        // Búsqueda 2: Ruta AppData (Fallback)
        if (!lockfilePath && process.platform === 'win32') {
            console.log(`[LCU CREDENTIALS] Intentando leer lockfile en AppData: ${LOCKFILE_PATH_APPDATA}`);
            if (fs.existsSync(LOCKFILE_PATH_APPDATA)) {
                lockfilePath = LOCKFILE_PATH_APPDATA;
                console.log(`[LCU CREDENTIALS] [OK] lockfile encontrado en AppData.`);
            }
        }
        
        if (!lockfilePath) {
            console.log('[LCU CREDENTIALS] [FALLO] lockfile no encontrado. ¿El cliente de LoL está abierto?');
            return null; 
        }

        const content = fs.readFileSync(lockfilePath, 'utf-8');
        const parts = content.split(':');

        if (parts.length < 5) {
             console.error(`[LCU CREDENTIALS] [FALLO] lockfile con formato invalido.`);
             return null;
        }

        const creds = {
            port: parseInt(parts[2], 10),
            password: parts[3],
        };
        
        console.log(`[LCU CREDENTIALS] [OK] Exito al leer lockfile! Puerto: ${creds.port}, Contrasena (Password/Token): [REDACTED]`);
        return creds;

    } catch (e) {
        console.error(`[LCU CREDENTIALS] [FALLO] Error critico al intentar leer lockfile: ${e.message}`);
        return null;
    }
}

/**
 * Llama a la Live Client Data API (puerto 2999).
 */
async function fetchLiveGameData() {
    const url = `https://127.0.0.1:2999/liveclientdata/allgamedata`; 
    // ... (Lógica de fetchLiveGameData es la misma) ...
    try {
        console.log('[LIVE DATA API] -> Intentando conexión al puerto 2999...');
        
        const response = await axios.get(url, {
            httpsAgent: lcuAgent,
            timeout: 3000,
        });

        if (response.status === 200 && response.data && response.data.activePlayer) {
            console.log('[LIVE DATA API] [OK] Datos de partida activa (2999) recibidos con exito.');
            return response.data;
        }
        return null;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
             console.log('[LIVE DATA API] [ALERTA] Puerto 2999 no responde. (El juego no está activo o cargado).');
        } else if (error.response?.status === 404) {
             console.log('[LIVE DATA API] [ALERTA] Error 404: Live Data API disponible, pero no hay partida activa.');
        } else {
             console.error('[LIVE DATA API] Error:', error.message);
        }
        return null;
    }
}


/**
 * FUNCIÓN PRINCIPAL DE CONEXIÓN Y ENVÍO LCU/API/SCRAPING
 */
async function fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT) {
  
    let consolidatedData = null;
    const riotApiKey = store.get('riotApiKey'); 
    const userToken = store.get('userToken'); // 🔑 CLAVE: Obtener el token del Store para la auth


    // ----------------------------------------------------
    // 🔑 PRIORITY 1: MODO TIEMPO REAL (LCU)
    // ----------------------------------------------------
    
    const creds = await readLoLCreds(); 
    
    if (creds && creds.port && creds.password) {
        // LCU DETECTADO: Continuar con la lógica LCU original
        try {
            // ... (Lógica de fetch LCU original: Obtener datos de LCU y 2999) ...
            const port = creds.port;
            const password = creds.password;
            const token = Buffer.from(`riot:${password}`).toString('base64'); 
            
            const LCU_BASE_URL = `https://127.0.0.1:${port}`;
            const commonHeaders = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };

            let gameflowData = null;
            let currentSummoner = null;
            let champSelectData = null;
            let liveClientData = null;
            let gameTime = 0;
            let gameStatus = 'None';
            
            const options = { 
                headers: commonHeaders, 
                httpsAgent: lcuAgent, 
                timeout: 5000,
                validateStatus: (status) => { return status === 200 || status === 404; }
            };
            
            // 3. INTENTO 1: Obtener el Invocador Actual
            const summonerResponse = await axios.get(`${LCU_BASE_URL}/lol/summoner/v1/current-summoner`, options);
            if (summonerResponse.status === 200) { currentSummoner = summonerResponse.data; gameStatus = 'ClientOpen'; } 

            // 4. INTENTO 2: Conexión a Gameflow
            const gameflowResponse = await axios.get(`${LCU_BASE_URL}/lol/gameflow/v1/session`, options);
            if (gameflowResponse.status === 200) { gameflowData = gameflowResponse.data; gameStatus = gameflowData.phase; } 

            // 5. Obtener datos de Champion Select (Si aplica)
            if (gameStatus === 'ChampionSelect') {
                const champSelectResponse = await axios.get(`${LCU_BASE_URL}/lol/champ-select/v1/session`, options);
                if (champSelectResponse.status === 200) { champSelectData = champSelectResponse.data; }
            }

            // 6. LIVE CLIENT DATA API (puerto 2999)
            if (gameStatus === 'InProgress' || gameStatus === 'InGame') {
                liveClientData = await fetchLiveGameData(); 
                if (liveClientData) { gameTime = liveClientData.gameData.gameTime; }
            }

            // 7. CONSOLIDAR DATA COMPLETA (LCU)
            consolidatedData = { 
                mode: 'Realtime',
                gameflow: gameflowData || { phase: gameStatus }, 
                currentSummoner: currentSummoner, 
                champSelect: champSelectData || {}, 
                liveData: liveClientData || {},
                gameTime: gameTime,
            };

        } catch (axiosError) {
             console.error(`[LCU POLLING] [FALLO DE CONEXIÓN] Pasando a Fallback. Error: ${axiosError.message}`);
        }
    } 
    
    // ----------------------------------------------------
    // 🔑 PRIORITY 2: MODO ESTRATÉGICO (RIOT API)
    // ----------------------------------------------------
    
    if (!consolidatedData && riotApiKey) {
        // LCU falló Y tenemos API Key: Intentar modo estratégico
        const userRegion = store.get('userRegion') || 'LAS'; 
        const strategicData = await fetchRiotApiData(riotApiKey, userRegion);

        if (strategicData) {
            consolidatedData = { 
                mode: 'Strategic_API',
                data: strategicData,
                gameTime: 0, 
            };
        } else {
            console.log('[RIOT API FALLBACK] No se pudieron obtener datos estratégicos con la clave API.');
        }
    }
    
    // ----------------------------------------------------
    // 🔑 PRIORITY 3: MODO ESTRATÉGICO EXTREMO (WEB SCRAPING)
    // ----------------------------------------------------
    
    if (!consolidatedData) {
        // LCU falló Y RIOT API falló/no hay clave: Intentar Scraping
        const strategicData = await fetchScrapedData(); 
        
        if (strategicData) {
            consolidatedData = { 
                mode: strategicData.mode, 
                data: strategicData.data,
                gameTime: 0,
            };
        } else {
            console.log('[STRATEGIC FALLBACK] No se pudieron obtener datos Estratégicos (Web Scraping).');
        }
    }

    // ----------------------------------------------------
    // 🔑 FINAL: ENVIAR DATA AL BACKEND
    // ----------------------------------------------------
    
    if (consolidatedData) {
        const backendAgent = new https.Agent({ rejectUnauthorized: false });
        const modeLog = consolidatedData.mode; 
        
        // 🚨 CLAVE: Añadir el encabezado de Autorización con el token JWT
        const requestHeaders = { 
            'Content-Type': 'application/json',
            'Authorization': userToken ? `Bearer ${userToken}` : undefined 
        };
        
        try {
             const response = await axios.post(
                `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                consolidatedData, 
                { headers: requestHeaders, httpsAgent: backendAgent, timeout: 5000 }
            );

            if (response.status === 200 || response.status === 204) {
                const logMessage = response.status === 204 ? 'No Content' : `DB Updated. Mode: ${modeLog}`;
                console.log(`[LCU POLLING] [OK] Envio a Backend exitoso. Mode: ${modeLog}. Status: ${logMessage}.`);
            } else {
                console.error(`[LCU POLLING] [FALLO] Error al enviar data al backend: ${response.status}`);
            }
        } catch (backendError) {
            console.error(`[LCU POLLING] [FALLO CRÍTICO BACKEND] Error de red al enviar datos: ${backendError.message}`);
        }
    } else {
         console.log(`[LCU POLLING] [ALERTA] LCU, Riot API y Estratégico no disponibles. Polling en espera.`);
    }

}

module.exports = { fetchAndSendLcuData, fetchLiveGameData };