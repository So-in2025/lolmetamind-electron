// lol-client-api.js - VERSIÓN CORREGIDA Y CON LOGS MEJORADOS

const axios = require('axios');
const https = require('https');
const Store = require('electron-store');
const store = new Store();
const { exec } = require('child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const REGION_MAPPING = {
    'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
    'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS',
    'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA',
};

const FRIENDLY_TO_PLATFORM_ID = {
    'LAS': 'LA2', 'LAN': 'LA1', 'EUW': 'EUW1', 'EUNE': 'EUN1', 'BR': 'BR1',
    'NA': 'NA1', 'OC': 'OC1', 'KR': 'KR',
};

const lcuAgent = new https.Agent({
  rejectUnauthorized: false,
});

async function fetchLcuCurrentSummoner(creds) {
    if (!creds || !creds.port || !creds.password) return null;
    try {
        const port = creds.port;
        const password = creds.password;
        const token = Buffer.from(`riot:${password}`).toString('base64');
        const LCU_BASE_URL = `https://127.0.0.1:${port}`;
        
        const response = await axios.get(`${LCU_BASE_URL}/lol-summoner/v1/current-summoner`, {
            httpsAgent: lcuAgent,
            headers: { 'Authorization': `Basic ${token}` },
            timeout: 3000,
        });

        if (response.status === 200 && response.data) {
            console.log('[LCU ID] ✅ IDs obtenidos del cliente activo.');
            return {
                lcuPuuid: response.data.puuid,
                lcuSummonerId: response.data.summonerId,
            };
        }
    } catch (e) {
        console.warn(`[LCU ID] ⚠️ Fallo al obtener perfil del LCU: ${e.message}`);
    }
    return null;
}

/**
 * Función central de la aplicación. Ejecuta la batería de llamadas API de Riot
 * utilizando las credenciales del Store, priorizando los IDs del LCU si está abierto.
 */
async function fetchRiotApiData() {
    console.log('[RIOT API] Iniciando la batería de pruebas de la API de Riot...');

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

    let puuid = null;
    let encryptedSummonerId = null;
    let consolidatedData = {
        mode: 'Strategic_API_Profile',
        summonerRankData: [],
        championMasteries: [],
        matchHistory: [],
        activeGame: null,
        error: undefined, // Para enviar el error de la clave al frontend
    };

    // ==========================================================
    // PASO 0: OBTENER IDs DEL LCU SI ESTÁ ABIERTO (PRIORIDAD AL CLIENTE)
    // ==========================================================
    const creds = await readLoLCreds();
    if (creds) {
        const lcuIds = await fetchLcuCurrentSummoner(creds);
        if (lcuIds) {
            puuid = lcuIds.lcuPuuid;
            encryptedSummonerId = lcuIds.lcuSummonerId;
            console.log(`[LCU MITIGATION] ✅ IDs obtenidos del cliente. PUUID: ${puuid ? 'SÍ' : 'NO'}`);
        }
    }


    // ==========================================================
    // PASO 1: OBTENER PUUID de Riot API (SOLO SI NO SE OBTUVO DEL LCU)
    // ==========================================================
    if (!puuid) {
        try {
            console.log(`\n[TEST 1/3 - Account V1] 🔑 Buscando PUUID para ${summonerName}#${tagLine} en ${regionalRouting}...`);
            const accountResponse = await axios.get(
                `https://${regionalRouting.toLowerCase()}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagLine}`,
                { headers: { 'X-Riot-Token': riotApiKey } }
            );
            puuid = accountResponse.data.puuid;
            console.log(`[TEST 1/3] ✅ ÉXITO: PUUID obtenido.`);
        } catch (error) {
            const status = error.response?.status;
            console.error(`[TEST 1/3] ❌ Fallo CRÍTICO (PUUID). Status: ${status || 'Network'}.`);
            
            // Fallo definitivo: devolver objeto de fallo para el frontend
            return { error: `Clave API inválida o Invocador/Tagline incorrecto. (Status: ${status || 'Network Error'})` }; 
        }
    }
    await delay(200);

    // ==========================================================
    // PASO 2: OBTENER Summoner ID Cifrado (SOLO SI NO SE OBTUVO DEL LCU)
    // ==========================================================
    if (puuid && !encryptedSummonerId) {
        try {
            console.log(`\n[TEST 2/3 - Summoner V4] 🔑 Buscando Summoner ID en ${platformId}...`);
            const summonerResponse = await axios.get(
                `https://${platformId.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
                { headers: { 'X-Riot-Token': riotApiKey }, httpsAgent: lcuAgent }
            );
            
            // Intentar capturar 'id' (Puede ser undefined en clave de desarrollo)
            encryptedSummonerId = summonerResponse.data.id; 

            if (!encryptedSummonerId) {
                console.warn(`[TEST 2/3] ⚠️ ADVERTENCIA: Summoner ID no obtenido (Clave de Desarrollo). Funcionalidad Spectator/Runas limitada.`);
                consolidatedData.error = 'Clave de Desarrollo (24h) limita la obtención de IDs. Funcionalidad avanzada limitada.';
            } else {
                 console.log(`[TEST 2/3] ✅ ÉXITO: Summoner ID cifrado obtenido.`);
            }
        } catch (error) {
            console.warn(`[TEST 2/3] ❌ Fallo al obtener Summoner ID. Status: ${error.response?.status || 'Network'}. Saltando Masteries/Spectator.`);
            encryptedSummonerId = null;
        }
    }
    await delay(200);


    // ==========================================================
    // PASO 3: LLAMADAS EN PARALELO (Rank, Mastery, Match History)
    // ==========================================================
    
    // Las llamadas que requieren encryptedSummonerId (Rank/Mastery/Spectator) deben ser condicionales.
    
    const parallelCalls = [
        // 1. Ligas (Requiere Summoner ID)
        encryptedSummonerId 
            ? axios.get(`https://${platformId.toLowerCase()}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`, { headers: { 'X-Riot-Token': riotApiKey } })
            : Promise.resolve({ status: 400, reason: 'ID_NULL' }),
        
        // 2. Maestrías (Requiere Summoner ID)
        encryptedSummonerId
            ? axios.get(`https://${platformId.toLowerCase()}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${encryptedSummonerId}`, { headers: { 'X-Riot-Token': riotApiKey } })
            : Promise.resolve({ status: 400, reason: 'ID_NULL' }),

        // 3. Historial de Partidas (Requiere PUUID) - CRÍTICO, SIEMPRE DEBE FUNCIONAR.
        axios.get(`https://${regionalRouting.toLowerCase()}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`, { headers: { 'X-Riot-Token': riotApiKey } }),

        // 4. Partida Activa (Requiere Summoner ID)
        encryptedSummonerId
            ? axios.get(`https://${platformId.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encryptedSummonerId}`, { headers: { 'X-Riot-Token': riotApiKey } })
            : Promise.resolve({ status: 400, reason: 'ID_NULL' }),
    ];

    try {
        const results = await Promise.allSettled(parallelCalls);

        // [0] Ligas
        if (results[0].status === 'fulfilled' && results[0].value?.data) {
            consolidatedData.summonerRankData = results[0].value.data;
        } else if (results[0].reason?.reason !== 'ID_NULL') {
            console.warn(`[RIOT API] ⚠️ Fallo al obtener datos de Liga. Status: ${results[0].reason?.response?.status || 'Network Error'}`);
        }

        // [1] Maestrías
        if (results[1].status === 'fulfilled' && results[1].value?.data) {
            consolidatedData.championMasteries = results[1].value.data;
        } else if (results[1].reason?.reason !== 'ID_NULL') {
            console.warn(`[RIOT API] ⚠️ Fallo al obtener Maestrías.`);
        }
        
        // [2] Historial de Partidas (PUUID)
        if (results[2].status === 'fulfilled' && results[2].value?.data) {
            consolidatedData.matchHistory = results[2].value.data;
            console.log(`[RIOT API] ✅ Historial de Partidas obtenido (${consolidatedData.matchHistory.length} IDs).`);
        } else {
            console.error(`[RIOT API] ❌ Fallo CRÍTICO al obtener Historial de Partidas (Match V5).`);
            consolidatedData.error = consolidatedData.error || 'No se pudo cargar el historial de partidas (Match V5).';
        }

        // [3] Partida Activa
        if (results[3].status === 'fulfilled' && results[3].value?.data) {
            consolidatedData.activeGame = results[3].value.data;
            console.log(`[RIOT API] ✅ Partida activa encontrada.`);
        } else if (results[3].reason?.response?.status !== 404 && results[3].reason?.reason !== 'ID_NULL') {
            console.warn(`[RIOT API] ⚠️ Fallo al obtener Partida Activa. (404 esperado si no está jugando)`);
        }

    } catch (parallelError) {
        console.error('[RIOT API] ❌ Error inesperado durante las llamadas en paralelo:', parallelError);
    }

    console.log('[RIOT API] ✅ Batería de pruebas completada. Devolviendo datos consolidados.');
    return {
        puuid,
        encryptedSummonerId,
        ...consolidatedData
    };
}

async function readLoLCreds() {
    console.log('[LCU Creds] Buscando credenciales del LCU a través de PowerShell...');
    if (process.platform !== 'win32') {
        console.warn('[LCU Creds] ⚠️ Método de búsqueda de credenciales solo disponible en Windows.');
        return null;
    }
    const command = "powershell.exe -NoProfile -NonInteractive -Command \"(Get-WmiObject Win32_Process -Filter \\\"Name='LeagueClientUx.exe'\\\").CommandLine\"";
    try {
        const { stdout } = await new Promise((resolve, reject) => {
            exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) return reject(error);
                if (stderr) console.warn(`[LCU Creds] PowerShell STDERR: ${stderr}`);
                resolve({ stdout, stderr });
            });
        });

        const fullCommandLine = stdout.trim();
        if (!fullCommandLine) {
            console.log('[LCU Creds] ℹ️ Proceso LeagueClientUx.exe no encontrado o sin CommandLine.');
            return null;
        }

        const appPortMatch = fullCommandLine.match(/--app-port=(\d+)/);
        const remotingAuthTokenMatch = fullCommandLine.match(/--remoting-auth-token=([\w-]+)/);
        const port = appPortMatch ? parseInt(appPortMatch[1], 10) : null;
        const password = remotingAuthTokenMatch ? remotingAuthTokenMatch[1] : null;

        if (port && password) {
            console.log('[LCU Creds] ✅ Credenciales LCU obtenidas con éxito.');
            return { port, password };
        } else {
            console.log('[LCU Creds] ⚠️ Proceso encontrado, pero no se pudieron extraer el puerto y el token.');
            return null;
        }
    } catch (e) {
        console.error(`[LCU Creds] ❌ Excepción durante la búsqueda de credenciales LCU: ${e.message}.`);
        return null;
    }
}

async function fetchLiveGameData() {
    const url = `https://127.0.0.1:2999/liveclientdata/allgamedata`;
    try {
        const response = await axios.get(url, { httpsAgent: lcuAgent, timeout: 2000 });
        if (response.status === 200 && response.data?.activePlayer) {
            console.log('[LiveClientData] ✅ Datos de partida en vivo obtenidos.');
            return response.data;
        }
        return null;
    } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
            console.log(`[LiveClientData] ℹ️ No se pudieron obtener datos de partida en vivo (Probablemente no estás en una). Error: ${error.message}`);
        }
        return null;
    }
}


async function pollLcuDataAndSend(initialRiotApiData, BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT, ipcSender) {
    let consolidatedData = { ...initialRiotApiData };
    let lcuModeActive = false;

    const creds = await readLoLCreds();
    if (creds?.port && creds?.password) {
        console.log(`[LCU POLLING] ✅ Conectando a LCU en puerto ${creds.port}...`);
        try {
            const token = Buffer.from(`riot:${creds.password}`).toString('base64');
            const LCU_BASE_URL = `https://127.0.0.1:${creds.port}`;
            const options = {
                headers: { 'Authorization': `Basic ${token}` },
                httpsAgent: lcuAgent,
                timeout: 3000,
            };

            const gameflowResponse = await axios.get(`${LCU_BASE_URL}/lol-gameflow/v1/session`, options);
            
            if (gameflowResponse.status === 200 && gameflowResponse.data?.phase) {
                const phase = gameflowResponse.data.phase;
                console.log(`[LCU POLLING] Fase del juego detectada: ${phase}`);
                
                if (['ChampSelect', 'InProgress'].includes(phase)) {
                    lcuModeActive = true;
                    const liveClientData = phase === 'InProgress' ? await fetchLiveGameData() : null;
                    
                    consolidatedData = {
                        ...consolidatedData,
                        mode: 'Realtime',
                        gameflow: gameflowResponse.data,
                        liveData: liveClientData || { status: 'NotAvailable', reason: 'Live client data no disponible (Vanguard activado o no en partida)' },
                    };
                    console.log(`[LCU POLLING] 🟢 LCU en fase activa (${phase}). Datos actualizados a modo Realtime.`);
                    // >>>>> LOG DE DATOS EN TIEMPO REAL AÑADIDO AQUÍ <<<<<<
                        if (phase === 'InProgress' && liveClientData?.activePlayer) {
                        const active = liveClientData.activePlayer;
                            
                            // 🔑 CORRECCIÓN: Usar acceso defensivo para CS.
                            const currentCS = active.cs ?? active.scores?.creepScore;
                            
                            console.log('--- LIVE CLIENT DATA ---');
                            console.log(`  Tiempo de Juego: ${liveClientData.gameData.gameTime} segundos`);
                            console.log(`  Jugador Activo: ${active.summonerName}`);
                            console.log(`  Stats: Oro=${Math.round(active.currentGold)}, CS=${currentCS}`);
                            console.log('--------------------------');
                        }
                        // >>>>> FIN LOG DE DATOS <<<<<<
                }
            }
        } catch (error) {
            // Un error aquí es normal si el cliente está abierto pero no en partida.
             if (error.response?.status !== 404) {
                 console.warn(`[LCU POLLING] ⚠️ No se pudo obtener la sesión de LCU. Error: ${error.message}`);
             } else {
                 console.log(`[LCU POLLING] ℹ️ No hay sesión de juego activa (404 esperado).`);
             }
        }
    } else {
        console.log('[LCU POLLING] ℹ️ Cliente de LoL no detectado. Saltando sondeo de LCU en este ciclo.');
    }

    if (!lcuModeActive) {
        consolidatedData.mode = 'Strategic_API_Profile';
    }

    ipcSender(consolidatedData);

    const userToken = store.get('userToken');
    if (userToken) {
        try {
            await axios.post(
                `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                consolidatedData,
                { headers: { 'Authorization': `Bearer ${userToken}` }, httpsAgent: lcuAgent, timeout: 5000 }
            );
            console.log(`[POLLING] [BACKEND SEND OK] Datos enviados al backend en modo: ${consolidatedData.mode}.`);
        } catch (backendError) {
            console.error(`[POLLING] [BACKEND SEND FAIL] Error al enviar datos al backend: ${backendError.message}`);
        }
    }
}

module.exports = {
    fetchRiotApiData,
    pollLcuDataAndSend
};