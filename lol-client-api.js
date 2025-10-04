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


  async function pollLcuDataAndSend(initialRiotApiData, BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT, ipcSender, overlaySender) {
    console.log('\n--- INICIO DE CICLO DE POLLING ---');
    let consolidatedData = { ...initialRiotApiData };
    let lcuModeActive = false;

    const creds = await readLoLCreds();
    if (creds?.port && creds?.password) {
        console.log(`[POLLING] Credenciales encontradas. Intentando conectar a LCU en puerto ${creds.port}...`);
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
                console.log(`[POLLING] Fase detectada: ${phase}`);

                const activePhases = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'InProgress'];

                if (activePhases.includes(phase)) {
                    lcuModeActive = true;
                    console.log(`[POLLING] Fase activa detectada (${phase}). Entrando en modo Realtime.`);
                    
                    // LÓGICA CLAVE: Obtener datos de partida en vivo si está en InProgress
                    const liveClientData = phase === 'InProgress' ? await fetchLiveGameData() : null;

                    consolidatedData = {
                        ...consolidatedData,
                        mode: 'Realtime',
                        gameflow: gameflowResponse.data, 
                        liveData: liveClientData || { status: 'NotAvailable', reason: 'Live client data no disponible' },
                    };

                    if (phase === 'InProgress' && liveClientData?.activePlayer) {
                        const active = liveClientData.activePlayer;
                        // Corrección: Usar liveClientData.activePlayer.scores.creepScore si .cs no existe
                        const currentCS = active.scores?.creepScore ?? active.cs; 

                        console.log('--- DETALLES LIVE GAME ---');
                        console.log(`  -> Tiempo: ${liveClientData.gameData.gameTime}s`);
                        console.log(`  -> Jugador: ${active.summonerName}`);
                        console.log(`  -> Oro=${Math.round(active.currentGold)}, CS=${currentCS}`);
                        console.log('--------------------------');
                    }
                }
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.warn(`[POLLING] ⚠️  No se pudo obtener sesión de LCU. Error: ${error.message}`);
            }
        }
    } else {
        console.log('[POLLING] ℹ️ Cliente de LoL no detectado en este ciclo.');
    }

    if (!lcuModeActive) {
        consolidatedData.mode = 'Strategic_API_Profile';
    }
    console.log(`[POLLING] Modo final determinado: ${consolidatedData.mode}`);

    // --- Envío de datos al Dashboard ---
    if (ipcSender) {
        console.log('[POLLING] Enviando datos al DASHBOARD...');
        ipcSender(consolidatedData);
    } else {
        console.warn('[POLLING] ⚠️  No se pudo enviar datos al Dashboard (ipcSender no válido).');
    }

    // 🚨 CORRECCIÓN CLAVE: INCLUIR LIVE DATA EN EL PAYLOAD DEL OVERLAY
    const gameFlowPhase = consolidatedData.gameflow?.phase || 'None';
    const overlayPayload = {
        lcuStatus: lcuModeActive ? 'ONLINE' : 'OFFLINE',
        gamePhase: lcuModeActive ? gameFlowPhase : 'None',
        draftData: gameFlowPhase === 'ChampSelect' ? consolidatedData.gameflow : null,
        // 💎 INGREDIENTE FALTANTE: liveData (solo si estamos en partida)
        liveData: gameFlowPhase === 'InProgress' ? consolidatedData.liveData : null, 
    };

    if (overlaySender) {
        console.log('[POLLING] Enviando datos al OVERLAY:', overlayPayload);
        overlaySender(overlayPayload);
    } else {
        console.warn('[POLLING] ⚠️  No se pudo enviar datos al Overlay (overlaySender no válido).');
    }

    // --- Envío de datos al Backend ---
    const userToken = store.get('userToken');
    if (userToken) {
        try {
            await axios.post(
                `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                consolidatedData,
                { headers: { 'Authorization': `Bearer ${userToken}` }, httpsAgent: lcuAgent, timeout: 5000 }
            );
        } catch (backendError) {
            console.error(`[POLLING] ❌ ERROR al enviar datos al backend: ${backendError.message}`);
        }
    } else {
        console.warn('[POLLING] ⚠️ No se encontró userToken para enviar datos al backend.');
    }
    console.log('--- FIN DE CICLO DE POLLING ---\n');
}

/**
 * Función genérica para enviar comandos (POST/PUT) al LCU.
 * Esta función es llamada desde main.js (via IPC handle).
 * @param {object} creds - Credenciales LCU (port, token).
 * @param {string} method - Método HTTP (POST, PUT, DELETE).
 * @param {string} endpoint - /lol-perks/v1/pages o similar.
 * @param {object} payload - Cuerpo de la solicitud.
 */
async function sendLcuCommand(creds, method, endpoint, payload) {
    if (!creds || !creds.port || !creds.token) {
        throw new Error("LCU Offline o credenciales no disponibles.");
    }

    const url = `https://127.0.0.1:${creds.port}${endpoint}`;
    
    // Utiliza su axios y su agente HTTPS (lcuAgent)
    const response = await axios({
        method: method,
        url: url,
        headers: { 
            'Authorization': `Basic ${creds.token}`,
            'Content-Type': 'application/json'
        },
        data: payload,
        httpsAgent: lcuAgent, // Su agente HTTPS existente
        timeout: 5000 
    });
    
    // Devuelve el resultado. La LCU a menudo devuelve 204 (No Content)
    return response.data; 
}


module.exports = {
    fetchRiotApiData,
    pollLcuDataAndSend,
    sendLcuCommand
};