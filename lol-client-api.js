// lol-client-api.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Agente HTTPS para ignorar el certificado SSL autofirmado de la LCU.
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

// 🚨 RUTAS CRÍTICAS: La ruta C:\Riot Games\League of Legends\lockfile es prioritaria.
const LOCKFILE_PATH_INSTALL = 'C:\\Riot Games\\League of Legends\\lockfile';
const LOCKFILE_PATH_APPDATA = path.join(
  process.env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : ''),
  'Riot Games', 
  'League of Legends', 
  'lockfile'
);

/**
 * Lee el archivo lockfile para obtener el puerto y el token (password) del cliente LoL.
 */
async function readLoLCreds() {
    try {
        let lockfilePath = null;
        
        // Búsqueda 1: Ruta de Instalación (Prioritaria)
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
 * Llama a la Live Client Data API (puerto 2999). No requiere autenticación.
 */
async function fetchLiveGameData() {
    const url = `https://127.0.0.1:2999/liveclientdata/allgamedata`; 
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
 * FUNCIÓN PRINCIPAL DE CONEXIÓN Y ENVÍO LCU
 */
async function fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT) {
  
  const creds = await readLoLCreds(); 
  
  if (!creds || !creds.port || !creds.password) {
    console.log(`[LCU POLLING] [ALERTA] LCU No detectado. Polling en espera.`);
    return;
  }
  
  const port = creds.port;
  const password = creds.password;
  const token = Buffer.from(`riot:${password}`).toString('base64'); 
  console.log(`[LCU POLLING] [OK] Credenciales LCU listas: Puerto ${port}.`);
  
  const LCU_BASE_URL = `https://127.0.0.1:${port}`;
  const commonHeaders = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };

  let gameflowData = null;
  let currentSummoner = null;
  let champSelectData = null;
  let liveClientData = null;
  let gameTime = 0;
  let gameStatus = 'None';
  
  try {
    // 🚨 CLAVE: Configuración de Axios para no fallar con 404 (Estado normal del cliente) o 200.
    const options = { 
        headers: commonHeaders, 
        httpsAgent: lcuAgent, 
        timeout: 5000,
        // CLAVE: No lanzar error si el estado es 200 o 404. 
        validateStatus: (status) => {
            return status === 200 || status === 404; 
        }
    };
    
    // 3. INTENTO 1: Obtener el Invocador Actual
    console.log(`[LCU POLLING] -> Intentando obtener Invocador Actual...`);
    const summonerResponse = await axios.get(`${LCU_BASE_URL}/lol/summoner/v1/current-summoner`, options);
    
    if (summonerResponse.status === 200) {
        currentSummoner = summonerResponse.data;
        console.log(`[LCU POLLING] [OK] Invocador encontrado: ${currentSummoner.displayName}.`);
    } else if (summonerResponse.status === 404) {
        console.log(`[LCU POLLING] [ALERTA] Invocador 404. Cliente LoL en inicio o perfil no cargado.`);
    }

    
    // 4. INTENTO 2: Conexión a Gameflow (También permitimos el 404)
    console.log(`[LCU POLLING] -> Intentando Conexión Gameflow...`);
    const gameflowResponse = await axios.get(`${LCU_BASE_URL}/lol/gameflow/v1/session`, options);
    
    if (gameflowResponse.status === 200) {
        gameflowData = gameflowResponse.data;
        gameStatus = gameflowData.phase;
        console.log(`[LCU POLLING] [OK] LCU Gameflow conectado. Fase: ${gameStatus}.`);
    } else if (gameflowResponse.status === 404) {
        console.log(`[LCU POLLING] [ALERTA] Gameflow 404. Asumiendo fase: None.`);
        gameStatus = 'None';
    }


    // 5. Obtener datos de Champion Select (Si aplica)
    if (gameStatus === 'ChampionSelect') {
        const champSelectResponse = await axios.get(`${LCU_BASE_URL}/lol/champ-select/v1/session`, options);
        if (champSelectResponse.status === 200) {
             champSelectData = champSelectResponse.data;
             console.log(`[LCU POLLING] [OK] Datos de Champion Select obtenidos.`);
        }
    }

    // 6. LIVE CLIENT DATA API (puerto 2999)
    if (gameStatus === 'InProgress' || gameStatus === 'InGame') {
        liveClientData = await fetchLiveGameData(); 
        if (liveClientData) {
             gameTime = liveClientData.gameData.gameTime;
        }
    }

    // 7. CONSOLIDAR DATA COMPLETA
    const consolidatedData = { 
        gameflow: gameflowData || { phase: gameStatus }, 
        currentSummoner: currentSummoner, 
        champSelect: champSelectData || {}, 
        liveData: liveClientData || {},
        gameTime: gameTime,
    };
    
    // 8. ENVIAR DATA AL BACKEND
    const backendAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.post(
        `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
        consolidatedData, 
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: backendAgent, timeout: 5000 }
    );

    if (response.status === 200 || response.status === 204) {
        const logMessage = response.status === 204 ? 'No Content' : `DB Updated, Time: ${gameTime}`;
        console.log(`[LCU POLLING] [OK] Envio a Backend exitoso. Fase: ${gameStatus}. Status: ${logMessage}.`);
    } else {
        console.error(`[LCU POLLING] [FALLO] Error al enviar data LCU al backend: ${response.status}`);
    }

  } catch (axiosError) {
    // MANEJO DETALLADO DE ERRORES (Solo se ejecuta por 403 o fallas de red/timeout)
    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
        console.error(`[LCU POLLING] [FALLO] ERROR CRITICO (RED/CONEXIÓN): El puerto ${port} no responde. ¿El cliente LoL está abierto?`);
    } else if (axiosError.response) {
        if (axiosError.response.status === 403) {
             console.error(`[LCU POLLING] [FALLO] ERROR CRITICO 403 (PROHIBIDO): ¡FALLO DE AUTENTICACIÓN!`);
        } else {
            console.error(`[LCU POLLING] [FALLO] Fallo de API LCU (Estatus ${axiosError.response.status}): ${axiosError.response.statusText}`);
        }
    } else {
        console.error(`[LCU POLLING] [FALLO] ERROR NO MANEJADO: ${axiosError.message}`);
    }
  }
}

module.exports = { fetchAndSendLcuData, fetchLiveGameData };