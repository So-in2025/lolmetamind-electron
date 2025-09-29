// lol-client-api.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const Store = require('electron-store'); 
const store = new Store(); 

// 🚨 MAPEO 1: Para el ROUTING Regional (API de Cuentas)
const REGION_MAPPING = {
    'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
    'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS', 
    'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA',
};

// 🔑 MAPEO 2: Para el SUBDOMINIO de Plataforma (Soluciona ENOTFOUND)
const FRIENDLY_TO_PLATFORM_ID = {
    'LAS': 'LA2', 'LAN': 'LA1', 'EUW': 'EUW1', 'EUNE': 'EUN1', 'BR': 'BR1', 
    'NA': 'NA1', 'OC': 'OC1', 'KR': 'KR',
};

// Agente HTTPS para el LCU y backend (ignora certificados)
const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

// 🚨 RUTAS CRÍTICAS DEL LCU
const LOCKFILE_PATH_INSTALL = 'C:\\Riot Games\\League of Legends\\lockfile';
const LOCKFILE_PATH_APPDATA = path.join(
  process.env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : ''),
  'Riot Games', 
  'League of Legends', 
  'lockfile'
);


/**
 * 🔑 FUNCIÓN RIOT API: Obtiene PUUID -> Summoner ID -> Ligas/Maestrías/Historial (5 llamadas).
 */
async function fetchRiotApiData() { 
    
    // 1. RECUPERAR DATOS DEL STORE
    const riotApiKey = store.get('riotApiKey'); 
    const platformRegion = store.get('userRegion'); 
    const summonerName = store.get('userSummonerName'); 
    const tagLine = store.get('userTagline'); 
    
    if (!riotApiKey || !platformRegion || !summonerName || !tagLine) { 
        console.error('[RIOT API] ❌ Error de Store: Faltan datos críticos (Key, Región, Invocador).');
        return null; 
    }

    const upperRegion = platformRegion.toUpperCase();
    const regionalRouting = REGION_MAPPING[upperRegion];
    const platformId = FRIENDLY_TO_PLATFORM_ID[upperRegion] || upperRegion;
    
    if (!regionalRouting) { 
        console.error(`[RIOT API] ❌ Error de Región: Región '${platformRegion}' no mapeada.`);
        return null; 
    } 
    
    let encryptedSummonerId = null;
    let puuid = null;
    let summonerRankData = null; 
    let championMasteries = null; 
    let matchHistory = null; 
    
    // ----------------------------------------------------
    // API CALL 1/5: Obtener PUUID (Account API)
    // ----------------------------------------------------
    try {
        // 🔑 VALIDACIÓN EXPLÍCITA DEL FORMATO (PARA EL LOG)
        console.log(`[RIOT API] 🔑 VALIDACIÓN: Usando Riot ID: ${summonerName}#${tagLine} en routing: ${regionalRouting.toUpperCase()}`); 
        console.log(`[RIOT API] 1/5: Buscando PUUID para ${summonerName}#${tagLine}...`);
        
        const accountResponse = await axios.get(
            `https://${regionalRouting.toLowerCase()}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`,
            { headers: { 'X-Riot-Token': riotApiKey } }
        );
        puuid = accountResponse.data.puuid;
        console.log(`[RIOT API] ✅ PUUID obtenido. PUUID_LEN=${puuid.length}`);
    } catch (error) {
        console.error(`[RIOT API] ❌ 1/5 Fallo PUUID (CRÍTICO). Status: ${error.response?.status || 'Network'}. Error: ${error.message}`);
        return null; 
    }

    // ----------------------------------------------------
    // API CALL 2/5: Obtener Summoner ID Cifrado (Summoner API)
    // ----------------------------------------------------
    try {
        console.log(`[RIOT API] 2/5: Buscando Summoner ID en ${platformId.toUpperCase()}...`);
        const summonerResponse = await axios.get(
            `https://${platformId.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
            { 
                headers: { 'X-Riot-Token': riotApiKey },
                httpsAgent: lcuAgent,
            }
        );
        encryptedSummonerId = summonerResponse.data.id;
        console.log(`[RIOT API] ✅ Summoner ID cifrado obtenido.`); 
    } catch (error) {
        const status = error.response?.status;
        console.error(`[RIOT API] ❌ 2/5 Fallo CRÍTICO Summoner ID. Status: ${status || 'Network'}. Error: ${error.message}`);
        return null; 
    }

    // ----------------------------------------------------
    // 🔑 API CALL 3/5: Obtener Datos de Liga (League API)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`[RIOT API] 3/5: Buscando datos de Liga...`);
            const leagueResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            summonerRankData = leagueResponse.data;
            console.log(`[RIOT API] ✅ Datos de Liga obtenidos (${summonerRankData.length} colas).`);
        } catch (error) {
            const status = error.response?.status;
            if (status === 404) {
                console.log(`[RIOT API] ⚠️ 3/5 Fallo 404: Invocador no clasificado. Se inicializa a [].`);
            } else if (status === 403) {
                 console.error(`[RIOT API] ❌ 3/5 Fallo 403: API Key no autorizada/expirada. Devolviendo [].`);
            } else if (status === 429) {
                 console.error(`[RIOT API] ❌ 3/5 Fallo 429: Rate Limit excedido. Devolviendo [].`);
            } else {
                console.error(`[RIOT API] ❌ 3/5 Fallo CRÍTICO. Status: ${status || 'Network'}. Error: ${error.message}`);
            }
            summonerRankData = []; 
        }
    }

    // ----------------------------------------------------
    // 🔑 API CALL 4/5: Obtener Maestrías de Campeón (Champion Mastery API)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`[RIOT API] 4/5: Buscando Maestrías de Campeón...`);
            const masteryResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            championMasteries = masteryResponse.data.slice(0, 5); 
            console.log(`[RIOT API] ✅ Maestrías de Campeón obtenidas (Top 5).`);
        } catch (error) {
            const status = error.response?.status;
            if (status === 404) {
                console.log(`[RIOT API] ⚠️ 4/5 Fallo 404: Sin maestrías. Se inicializa a [].`);
            } else if (status === 403) {
                 console.error(`[RIOT API] ❌ 4/5 Fallo 403: API Key no autorizada/expirada. Devolviendo [].`);
            } else if (status === 429) {
                 console.error(`[RIOT API] ❌ 4/5 Fallo 429: Rate Limit excedido. Devolviendo [].`);
            } else {
                console.error(`[RIOT API] ❌ 4/5 Fallo CRÍTICO. Status: ${status || 'Network'}. Error: ${error.message}`);
            }
            championMasteries = []; 
        }
    }
    
    // ----------------------------------------------------
    // 🔑 API CALL 5/5: Obtener Historial de Partidas (Match-V5)
    // ----------------------------------------------------
    if (puuid) {
        try {
            console.log(`[RIOT API] 5/5: Buscando Historial de Partidas (Últimos 5 IDs)...`);
            const matchHistoryResponse = await axios.get(
                `https://${regionalRouting.toLowerCase()}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            matchHistory = matchHistoryResponse.data; 
            console.log(`[RIOT API] ✅ IDs de Partidas obtenidos (${matchHistory.length} IDs).`);
        } catch (error) {
            const status = error.response?.status;
            if (status === 404) {
                console.log(`[RIOT API] ⚠️ 5/5 Fallo 404: Sin partidas recientes. Se inicializa a [].`);
            } else if (status === 403) {
                 console.error(`[RIOT API] ❌ 5/5 Fallo 403: API Key no autorizada/expirada. Devolviendo [].`);
            } else if (status === 429) {
                 console.error(`[RIOT API] ❌ 5/5 Fallo 429: Rate Limit excedido. Devolviendo [].`);
            } else {
                 console.error(`[RIOT API] ❌ 5/5 Fallo CRÍTICO. Status: ${status || 'Network'}. Error: ${error.message}`);
            }
            matchHistory = []; 
        }
    }

    // ----------------------------------------------------
    // CLAVE FINAL: Devolver el objeto de datos si el PUUID existe.
    // ----------------------------------------------------
    if (puuid) {
        console.log('[RIOT API] ✅ PROCESO ESTRATÉGICO COMPLETADO. Devolviendo objeto de perfil.');
        return {
            mode: 'Strategic_API_Profile', 
            // 🔑 Forzamos a usar el array de datos o un array vacío si no se obtuvieron.
            summonerRankData: summonerRankData || [], 
            championMasteries: championMasteries || [],
            matchHistory: matchHistory || [],
        };
    } else {
         console.error('[RIOT API] ❌ Fallo Final: El PUUID es nulo. Devolviendo NULL.');
         return null; 
    }
}

// -----------------------------------------------------------------------------------------
// LÓGICA DE SOPORTE LCU Y FUNCIÓN PRINCIPAL (fetchAndSendLcuData) (MANTENIDA)
// -----------------------------------------------------------------------------------------

async function readLoLCreds() {
    try {
        let lockfilePath = null;
        
        if (fs.existsSync(LOCKFILE_PATH_INSTALL)) {
            lockfilePath = LOCKFILE_PATH_INSTALL;
        } else if (process.platform === 'win32' && fs.existsSync(LOCKFILE_PATH_APPDATA)) {
            lockfilePath = LOCKFILE_PATH_APPDATA;
        }
        
        if (!lockfilePath) return null; 

        const content = fs.readFileSync(lockfilePath, 'utf-8');
        const parts = content.split(':');

        if (parts.length < 5) return null;

        return { port: parseInt(parts[2], 10), password: parts[3] };
    } catch (e) {
        return null;
    }
}

async function fetchLiveGameData() {
    const url = `https://127.0.0.1:2999/liveclientdata/allgamedata`; 
    try {
        const response = await axios.get(url, {
            httpsAgent: lcuAgent,
            timeout: 3000,
        });

        if (response.status === 200 && response.data && response.data.activePlayer) {
            return response.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}


/**
 * FUNCIÓN PRINCIPAL DE SONDEO Y ENVÍO
 */
async function fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT, ipcSender) {
  
    let consolidatedData = null;
    let shouldCheckRiotApi = true; 
    const userToken = store.get('userToken'); 

    // ----------------------------------------------------
    // 🔑 PRIORITY 1: LCU (Cliente abierto y sondeo de estado)
    // ----------------------------------------------------
    
    const creds = await readLoLCreds(); 
    
    if (creds && creds.port && creds.password) {
        try {
            const port = creds.port;
            const password = creds.password;
            const token = Buffer.from(`riot:${password}`).toString('base64'); 
            
            const LCU_BASE_URL = `https://127.0.0.1:${port}`;
            const commonHeaders = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };
            const options = { 
                headers: commonHeaders, 
                httpsAgent: lcuAgent, 
                timeout: 5000,
                validateStatus: (status) => { return status === 200 || status === 404; }
            };

            const gameflowResponse = await axios.get(`${LCU_BASE_URL}/lol/gameflow/v1/session`, options);
            if (gameflowResponse.status === 200) { 
                const gameStatus = gameflowResponse.data.phase; 
                
                if (gameStatus === 'InProgress' || gameStatus === 'InGame' || gameStatus === 'InProcess') {
                    const liveClientData = await fetchLiveGameData(); 
                    
                    consolidatedData = { 
                        mode: 'Realtime',
                        gameflow: gameflowResponse.data,
                        liveData: liveClientData || {},
                    };
                    shouldCheckRiotApi = false; 
                    console.log(`[LCU POLLING] LCU en fase ACTIVA (${gameStatus}).`);
                } else {
                    shouldCheckRiotApi = true;
                    console.log(`[LCU POLLING] LCU en fase NO-ACTIVA (${gameStatus}). Pasando a Riot API (Prioridad 2).`);
                }
            } else {
                 shouldCheckRiotApi = true;
                 console.log(`[LCU POLLING] LCU abierto, pero estado no disponible. Pasando a Riot API (Prioridad 2).`);
            }

        } catch (axiosError) {
             console.log(`[LCU POLLING] [FALLO DE CONEXIÓN LCU] Pasando a Riot API (Prioridad 2).`);
             shouldCheckRiotApi = true;
        }
    } 
    
    // ----------------------------------------------------
    // 🔑 PRIORITY 2: RIOT API (Estratégico)
    // ----------------------------------------------------
    
    if (shouldCheckRiotApi && !consolidatedData) {
        
        const riotData = await fetchRiotApiData(); // 🔑 Ejecuta las 4 llamadas de perfil

        if (riotData) {
            consolidatedData = { ...riotData, mode: riotData.mode };
            
            // 🚀 CLAVE: Enviar datos al frontend (Dashboard) via IPC
            ipcSender(consolidatedData);
            
        }
    }

    // ----------------------------------------------------
    // 🔑 FINAL: ENVIAR DATA AL BACKEND
    // ----------------------------------------------------
    
    if (consolidatedData) {
        
        const modeLog = consolidatedData.mode; 
        
        // Lógica de logging
        if (modeLog === 'Realtime') {
             console.log(`[POLLING] [SENT] LCU Data. Phase: ${consolidatedData.gameflow.phase}.`);
        } else if (modeLog === 'Strategic_API_Profile') {
             console.log(`[POLLING] [SENT] RIOT API Data. Clave en uso. Mode: ${modeLog}.`);
        }
        
        const backendAgent = new https.Agent({ rejectUnauthorized: false });
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
                console.log(`[POLLING] [OK] Envio a Backend exitoso. Mode: ${modeLog}. Status: ${logMessage}.`);
            } else {
                console.error(`[POLLING] [FALLO] Error al enviar data al backend: ${response.status}`);
            }
        } catch (backendError) {
            console.error(`[POLLING] [FALLO CRÍTICO BACKEND] Error de red al enviar datos: ${backendError.message}`);
        }
    } else {
         console.log(`[POLLING] [ALERTA] LCU y Riot API fallaron o no están disponibles. Polling en espera.`);
    }

}

// 🛑 EXPORTACIONES LIMPIAS
module.exports = { fetchAndSendLcuData };