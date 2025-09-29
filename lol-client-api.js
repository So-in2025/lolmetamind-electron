// lol-client-api.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const Store = require('electron-store'); 
const store = new Store(); 

// 🔑 Helper function para crear un delay (FUNCIÓN AGREGADA Y CORREGIDA)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 🚨 MAPEO 1: Para el ROUTING Regional (API de Cuentas y Match)
const REGION_MAPPING = {
    'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
    'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS', 
    'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA',
};

// 🔑 MAPEO 2: Para el SUBDOMINIO de Plataforma (Soluciona ENOTFOUND en llamadas Summoner, League, Mastery)
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
 * Función central de la aplicación. Ejecuta una batería de 10 llamadas API
 * para diagnosticar la usabilidad de la clave de desarrollo.
 */

/**
 * Función que revisa el objeto final de datos y reporta qué pruebas fallaron.
 * Esto asegura que los errores no se pierdan.
 */
function logDiagnosticSummary(data) {
    const tests = [
        { name: '3/10: League V4 (Ligas)', data: data.summonerRankData },
        { name: '4/10: Mastery V4 (Maestrías)', data: data.championMasteries },
        { name: '6/10: TFT League V1', data: data.tftLeagueData },
        { name: '9/10: Challenges V1', data: data.challengesPlayerInfo },
        { name: '10/10: Spectator V5', data: data.activeGame },
    ];
    
    console.log('\n--- RESUMEN FINAL DEL DIAGNÓSTICO (FALLOS) ---');
    let hasCriticalFailure = false;

    tests.forEach(test => {
        const isDataEmpty = Array.isArray(test.data) ? test.data.length === 0 : test.data === null;
        
        if (isDataEmpty && test.name !== '10/10: Spectator V5') {
            console.error(`[DIAG] ⚠️ ${test.name}: FALLÓ (Datos vacíos). Código 403/429 probable.`);
            hasCriticalFailure = true;
        } else if (test.name === '10/10: Spectator V5' && isDataEmpty) {
            console.log(`[DIAG] ➡️ ${test.name}: OK (404 si no estás jugando).`);
        }
    });

    if (!hasCriticalFailure) {
        console.log('[DIAG] ✅ Las APIs clave (Ligas, Maestrías, TFT, Challenges) NO generaron un fallo vacío. Revisa logs detallados.');
    }
    console.log('------------------------------------------------');
}

/**
 * Función central de la aplicación. Ejecuta una batería de 10 llamadas API
 * para diagnosticar la usabilidad de la clave de desarrollo.
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
    let consolidatedData = {
        summonerRankData: [], 
        championMasteries: [], 
        matchHistory: [],
        matchTimeline: null, 
        tftLeagueData: [], 
        challengesPlayerInfo: null, 
        serviceStatus: null, 
        activeGame: null,
    };
    
    // ----------------------------------------------------
    // API CALL 1/10: Obtener PUUID (Account API)
    // ----------------------------------------------------
    try {
        console.log(`\n[TEST 1/10 - Account V1] 🔑 Buscando PUUID para ${summonerName}#${tagLine}...`);
        const accountResponse = await axios.get(
            `https://${regionalRouting.toLowerCase()}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`,
            { headers: { 'X-Riot-Token': riotApiKey } }
        );
        puuid = accountResponse.data.puuid;
        console.log(`[TEST 1/10] ✅ ÉXITO: PUUID obtenido. (Routing: ${regionalRouting})`);
    } catch (error) {
        console.error(`[TEST 1/10] ❌ Fallo CRÍTICO (PUUID). Status: ${error.response?.status || 'Network'}.`);
        return null; 
    }
    await delay(500); // 🔑 Pausa Serial

    // ----------------------------------------------------
    // API CALL 2/10: Obtener Summoner ID Cifrado (Summoner API)
    // ----------------------------------------------------
    if (puuid) {
        try {
            console.log(`\n[TEST 2/10 - Summoner V4] 🔑 Buscando Summoner ID...`);
            const summonerResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            encryptedSummonerId = summonerResponse.data.id;
            console.log(`[TEST 2/10] ✅ ÉXITO: Summoner ID cifrado obtenido. (Platform: ${platformId})`); 
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 2/10] ❌ Fallo CRÍTICO (Summoner ID). Status: ${status || 'Network'}.`);
            return null; 
        }
    }
    await delay(500); // 🔑 Pausa Serial

    // --- PRUEBAS CON PLATFORM ID (Esperado: 403) ---

    // ----------------------------------------------------
    // API CALL 3/10: Datos de Liga (League API)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`\n[TEST 3/10 - League V4] ⚠️ Buscando datos de Liga...`);
            const leagueResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.summonerRankData = leagueResponse.data;
            console.log(`[TEST 3/10] ✅ ÉXITO INESPERADO: Datos de Liga obtenidos (${consolidatedData.summonerRankData.length} colas).`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 3/10] ❌ FALLO [Ligas]: Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial

    // ----------------------------------------------------
    // API CALL 4/10: Maestrías de Campeón (Champion Mastery API)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`\n[TEST 4/10 - Mastery V4] ⚠️ Buscando Maestrías...`);
            const masteryResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.championMasteries = masteryResponse.data.slice(0, 5); 
            console.log(`[TEST 4/10] ✅ ÉXITO INESPERADO: Maestrías de Campeón obtenidas (Top 5).`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 4/10] ❌ FALLO [Maestrías]: Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial
    
    // ----------------------------------------------------
    // API CALL 5/10: Estado del Servicio LoL (Status V4)
    // ----------------------------------------------------
    if (platformId) {
        try {
            console.log(`\n[TEST 5/10 - Status V4] ➡️ Buscando Estado del Servicio LoL...`);
            const statusResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/status/v4/platform-data`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.serviceStatus = statusResponse.data;
            console.log(`[TEST 5/10] ✅ ÉXITO: Estado del Servicio obtenido. (Status: ${statusResponse.status})`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 5/10] ❌ FALLO: Status V4. Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial
    
    // ----------------------------------------------------
    // API CALL 6/10: Datos de Liga TFT (TFT-League-V1)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`\n[TEST 6/10 - TFT League V1] ⚠️ Buscando datos de Liga TFT...`);
            const tftResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/tft/league/v1/entries/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.tftLeagueData = tftResponse.data;
            console.log(`[TEST 6/10] ✅ ÉXITO: Datos de Liga TFT obtenidos.`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 6/10] ❌ FALLO [TFT League]: Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial

    // --- PRUEBAS CON REGIONAL ROUTING (AMERICAS/EUROPE) (ÉXITO) ---

    // ----------------------------------------------------
    // API CALL 7/10: Historial de Partidas (Match-V5)
    // ----------------------------------------------------
    if (puuid) {
        try {
            console.log(`\n[TEST 7/10 - Match V5] 🚀 Buscando Historial de Partidas (Últimos 5 IDs)...`);
            const matchHistoryResponse = await axios.get(
                `https://${regionalRouting.toLowerCase()}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.matchHistory = matchHistoryResponse.data; 
            console.log(`[TEST 7/10] ✅ ÉXITO: IDs de Partidas obtenidos (${consolidatedData.matchHistory.length} IDs).`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 7/10] ❌ FALLO: Match V5. Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial
    
    // ----------------------------------------------------
    // API CALL 8/10: Match Timeline (Timeline de la última partida)
    // ----------------------------------------------------
    if (consolidatedData.matchHistory.length > 0) {
        const latestMatchId = consolidatedData.matchHistory[0];
        try {
            console.log(`\n[TEST 8/10 - Match V5] ➡️ Buscando Timeline para Match ID: ${latestMatchId}...`);
            const timelineResponse = await axios.get(
                `https://${regionalRouting.toLowerCase()}.api.riotgames.com/lol/match/v5/matches/${latestMatchId}/timeline`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.matchTimeline = timelineResponse.data; 
            console.log(`[TEST 8/10] ✅ ÉXITO: Timeline de Partida obtenida.`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 8/10] ❌ FALLO: Match Timeline. Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial

    // ----------------------------------------------------
    // API CALL 9/10: Desafíos (Challenges V1)
    // ----------------------------------------------------
    if (puuid) {
        try {
            console.log(`\n[TEST 9/10 - Challenges V1] ➡️ Buscando Progreso de Desafíos...`);
            const challengesResponse = await axios.get(
                `https://${regionalRouting.toLowerCase()}.api.riotgames.com/lol/challenges/v1/player-data/${puuid}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.challengesPlayerInfo = challengesResponse.data;
            console.log(`[TEST 9/10] ✅ ÉXITO: Progreso de Desafíos obtenido.`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 9/10] ❌ FALLO: Challenges V1. Status: ${status || 'Network'}.`);
        }
    }
    await delay(500); // 🔑 Pausa Serial

    // ----------------------------------------------------
    // API CALL 10/10: Datos de Partida Activa (Spectator V5)
    // ----------------------------------------------------
    if (encryptedSummonerId) {
        try {
            console.log(`\n[TEST 10/10 - Spectator V5] ⚠️ Buscando Partida Activa (Live Game Lookup)...`);
            const spectatorResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encryptedSummonerId}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            consolidatedData.activeGame = spectatorResponse.data;
            console.log(`[TEST 10/10] ✅ ÉXITO: Partida Activa encontrada.`);
        } catch (error) {
             const status = error.response?.status;
            if (status === 404) {
                // 🔑 LOG DETALLADO: 404 es el comportamiento normal si no hay partida
                console.log(`[TEST 10/10] ⚠️ FALLO ESPERADO: Spectator V5. Status: 404 (No estás en partida).`);
            } else {
                // 🔑 LOGGING AGRESIVO
                console.error(`[TEST 10/10] ❌ FALLO [Spectator]: Status: ${status || 'Network'}.`);
            }
        }
    }

    // ----------------------------------------------------
    // CLAVE FINAL: Devolver el objeto de datos si el PUUID existe.
    // ----------------------------------------------------
    if (puuid) {
        // 🔑 EJECUCIÓN DEL REPORTE FINAL
        logDiagnosticSummary(consolidatedData);

        console.log('\n======================================================');
        console.log('[RIOT API] ✅ BATERÍA DE PRUEBAS COMPLETADA. Ver logs arriba.');
        console.log('======================================================');
        return {
            mode: 'Strategic_API_Profile', 
            ...consolidatedData
        };
    } else {
         console.error('[RIOT API] ❌ Fallo Final: El PUUID es nulo. Devolviendo NULL.');
         return null; 
    }
}

// -----------------------------------------------------------------------------------------
// LÓGICA DE SOPORTE LCU Y FUNCIÓN PRINCIPAL (fetchAndSendLcuData)
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
        
        const riotData = await fetchRiotApiData(); 

        if (riotData) {
            consolidatedData = { ...riotData, mode: riotData.mode };
            
            // 🚀 CLAVE: Enviar datos al frontend (Dashboard) via IPC
            if (typeof ipcSender === 'function') {
                ipcSender(consolidatedData);
            }
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