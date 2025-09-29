// lol-client-api.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const Store = require('electron-store'); 
const store = new Store(); 

// 🔑 Helper function para crear un delay
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


// -----------------------------------------------------------
//  🚨 LÓGICA DE CONEXIÓN AL LCU (LEAGUE CLIENT UPDATE)
// -----------------------------------------------------------
const LCUConnector = require('lcu-connector');
const connector = new LCUConnector();
let lcuCredentials = null;

connector.on('connect', (data) => {
  lcuCredentials = data;
  console.log('[LCU] ✅ Conectado al Cliente de LoL');
});
connector.on('disconnect', () => {
  lcuCredentials = null;
  console.log('[LCU] ❌ Desconectado del Cliente de LoL');
});
connector.start();


// -----------------------------------------------------------
//  🔑 LÓGICA DE POLLING
// -----------------------------------------------------------

let lastSentGameflowPhase = null;

/**
 * 🚨 FUNCIÓN PRINCIPAL DE POLLING: Ejecutada en un intervalo desde main.js
 */
async function fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT) {
    let lcuData = null;
    let riotApiData = null;
    let modeLog = 'Initial'; // Para seguimiento

    const userToken = store.get('userToken'); // Token JWT del usuario de la app
    const summonerName = store.get('userSummonerName');
    const tagline = store.get('userTagline');
    const region = store.get('userRegion');
    const riotApiKey = store.get('riotApiKey');
    
    // -----------------------------------------------------------------
    //  PRIORIDAD 1: Intenta obtener datos de la LCU (Cliente abierto)
    // -----------------------------------------------------------------
    if (lcuCredentials) {
        modeLog = 'LCU_Live_Game';
        try {
            const lcuAxios = axios.create({
                baseURL: `https://127.0.0.1:${lcuCredentials.port}`,
                headers: { 'Authorization': `Basic ${Buffer.from(`riot:${lcuCredentials.password}`).toString('base64')}` },
                httpsAgent: lcuAgent,
            });

            const [sessionResponse, gameflowResponse] = await Promise.all([
                lcuAxios.get('/lol-gameflow/v1/session').catch(() => null),
                lcuAxios.get('/lol-gameflow/v1/gameflow-phase').catch(() => null),
            ]);
            
            // Si hay datos de sesión (partida en curso), los usamos
            if (sessionResponse && sessionResponse.data && sessionResponse.data.gameData) {
                lcuData = {
                    gameflow: gameflowResponse?.data || null,
                    session: sessionResponse.data,
                };
            } else if (gameflowResponse && gameflowResponse.data) {
                // Si no hay partida, al menos usamos el estado del cliente (ej. "Lobby", "Matchmaking")
                lcuData = { gameflow: gameflowResponse.data, session: null };
            } else {
                 console.log('[LCU POLLING] LCU abierto, pero estado no disponible. Pasando a Riot API (Prioridad 2).');
            }

        } catch (error) {
            console.error('[LCU POLLING] ❌ Error al obtener datos de LCU:', error.message);
        }
    }

    // -----------------------------------------------------------------
    //  PRIORIDAD 2: Si LCU falla o no está en partida, usa la API de Riot
    // -----------------------------------------------------------------
    if (!lcuData?.session) {
        modeLog = 'Strategic_API_Profile';
        if (summonerName && tagline && region && riotApiKey) {
            try {
                // 🔑 PASO 1: Obtener PUUID a partir del Riot ID (Nombre#Tag)
                const riotIdResponse = await axios.get(`https://${REGION_MAPPING[FRIENDLY_TO_PLATFORM_ID[region]]}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagline}`, {
                    headers: { 'X-Riot-Token': riotApiKey },
                });
                const puuid = riotIdResponse.data.puuid;

                // 🔑 PASO 2: Usar PUUID para obtener el resto de los datos
                const platformId = FRIENDLY_TO_PLATFORM_ID[region];
                
                // 🚨 EJECUCIÓN EN PARALELO de las llamadas a la Riot API
                const [summonerData, leagueData, masteryData, liveGameData] = await Promise.all([
                     axios.get(`https://${platformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers: { 'X-Riot-Token': riotApiKey } }).catch(e => { console.error('[RIOT API] Fallo al obtener Summoner Data:', e.response?.status); return null; }),
                     axios.get(`https://${platformId}.api.riotgames.com/lol/league/v4/entries/by-summoner/${puuid}`, { headers: { 'X-Riot-Token': riotApiKey } }).catch(e => { console.error('[RIOT API] Fallo al obtener League Data:', e.response?.status); return null; }),
                     axios.get(`https://${platformId}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`, { headers: { 'X-Riot-Token': riotApiKey } }).catch(e => { console.error('[RIOT API] Fallo al obtener Mastery Data:', e.response?.status); return null; }),
                     axios.get(`https://${platformId}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}`, { headers: { 'X-Riot-Token': riotApiKey } }).catch(e => { /*console.log('[RIOT API] No hay partida activa (404 esperado).');*/ return null; }),
                ]);

                // Construimos el objeto de datos de la Riot API
                riotApiData = {
                    summoner: summonerData?.data,
                    leagues: leagueData?.data,
                    masteries: masteryData?.data,
                    liveGame: liveGameData?.data,
                };

            } catch (error) {
                console.error('[RIOT API] ❌ Error en el flujo de la Riot API:', error.response ? `Status ${error.response.status}` : error.message);
                if (error.response?.status === 403) {
                     console.error('[RIOT API] 🔑 ERROR 403: Revisa tu clave de API de Riot. Puede que haya expirado o sea inválida.');
                }
            }
        } else {
             console.log('[RIOT API] Faltan datos (invocador/tag/región/clave) para usar la Riot API.');
        }
    }

    // -----------------------------------------------------------------
    //  ENVÍO AL BACKEND: Solo si hay datos nuevos o un cambio de estado
    // -----------------------------------------------------------------
    const consolidatedData = {
        lcu: lcuData,
        riotApi: riotApiData,
        // Incluye los datos del perfil de la app para que el backend sepa a quién asociarlos
        metaMindProfile: { summonerName, tagline, region } 
    };

    // Condición de envío: Hay datos de LCU o de Riot API
    if (lcuData || riotApiData) {
        
        // 🚨 Lógica para evitar spam: solo envía si el estado del juego ha cambiado
        const currentPhase = lcuData?.gameflow;
        if (currentPhase && currentPhase === lastSentGameflowPhase && modeLog === 'LCU_Live_Game') {
            // console.log(`[POLLING] [SKIP] Sin cambios en el estado del juego (${currentPhase}).`);
            return;
        }
        lastSentGameflowPhase = currentPhase;
        
        // --- LOGS DETALLADOS ---
        if (modeLog === 'LCU_Live_Game' && lcuData) {
            console.log(`[POLLING] [SENT] LCU Data. Mode: ${modeLog}. Phase: ${lcuData.gameflow.phase}.`);
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
// -------------------------------------------------------------------------------------------------------------------------------
// 🚨 MODO DIAGNÓSTICO: Ejecuta pruebas en todos los endpoints de la API de Riot.
// -------------------------------------------------------------------------------------------------------------------------------
async function runDiagnostics(apiKey, summonerName, tagline, region) {
    console.log('\n\n======================================================');
    console.log(' MODO DIAGNÓSTICO DE RIOT API INICIADO');
    console.log('======================================================');
    
    if (!apiKey || !summonerName || !tagline || !region) {
        console.error('[DIAG] ❌ ERROR: Faltan datos (Clave API, Invocador, Tagline o Región) para el diagnóstico.');
        return;
    }
    
    const headers = { 'X-Riot-Token': apiKey };
    const platformId = FRIENDLY_TO_PLATFORM_ID[region];
    const regionalRoute = REGION_MAPPING[platformId];
    
    let puuid = '';
    let encryptedSummonerId = '';
    let accountId = '';
    let matchIds = [];

    const results = {
        'Account V1': { status: 'PENDIENTE', data: null },
        'Summoner V4': { status: 'PENDIENTE', data: null },
        'League V4': { status: 'PENDIENTE', data: null },
        'Mastery V4': { status: 'PENDIENTE', data: null },
        'Status V4': { status: 'PENDIENTE', data: null },
        'TFT League V1': { status: 'PENDIENTE', data: null },
        'Match V5 (History)': { status: 'PENDIENTE', data: null },
        'Match V5 (Timeline)': { status: 'PENDIENTE', data: null },
        'Challenges V1': { status: 'PENDIENTE', data: null },
        'Spectator V5': { status: 'PENDIENTE', data: null },
    };

    // -------------------------------------------------
    //  TEST 1: Account V1 (Obtener PUUID) - CRÍTICO
    // -------------------------------------------------
    console.log('\n[TEST 1/10 - Account V1] 🔑 Buscando PUUID para ' + `${summonerName}#${tagline}` + '...');
    try {
        const response = await axios.get(`https://${regionalRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagline}`, { headers });
        puuid = response.data.puuid;
        results['Account V1'].status = `✅ ÉXITO: PUUID obtenido. (Routing: ${regionalRoute})`;
        results['Account V1'].data = response.data;
    } catch (e) {
        results['Account V1'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
    }
    console.log(`[TEST 1/10] ${results['Account V1'].status}`);
    if (!puuid) {
        console.error('[DIAG] 🛑 FALLO CRÍTICO: No se pudo obtener el PUUID. Las demás pruebas no pueden continuar.');
        return;
    }
    
    await delay(200);

    // -------------------------------------------------
    //  TEST 2: Summoner V4 (Obtener ID Cifrado)
    // -------------------------------------------------
    console.log('\n[TEST 2/10 - Summoner V4] 🔑 Buscando Summoner ID...');
    if (puuid) { // Asegurarse de tener PUUID
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
            encryptedSummonerId = response.data.id;
            accountId = response.data.accountId; // Guardar accountId si es necesario
            results['Summoner V4'].status = `✅ ÉXITO: Summoner ID cifrado obtenido. (Platform: ${platformId})`;
            results['Summoner V4'].data = response.data;
        } catch (e) {
            results['Summoner V4'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Summoner V4'].status = '⏭️ SALTADO: Se requiere PUUID.';
    }
    console.log(`[TEST 2/10] ${results['Summoner V4'].status}`);
    
    await delay(200);

    // -------------------------------------------------
    //  TEST 3: League V4 (Ligas)
    // -------------------------------------------------
    console.log('\n[TEST 3/10 - League V4] 🏆 Buscando Ligas del Invocador...');
    if (encryptedSummonerId) {
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`, { headers });
            results['League V4'].status = response.data.length > 0 ? '✅ ÉXITO: Datos de Ligas obtenidos.' : '⚠️ ADVERTENCIA: Respuesta vacía (Puede ser Unranked).';
            results['League V4'].data = response.data;
        } catch (e) {
            results['League V4'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['League V4'].status = '⏭️ SALTADO: Se requiere Summoner ID.';
    }
    console.log(`[TEST 3/10] ${results['League V4'].status}`);
    
    await delay(200);

    // -------------------------------------------------
    //  TEST 4: Mastery V4 (Maestrías)
    // -------------------------------------------------
    console.log('\n[TEST 4/10 - Mastery V4] 🏅 Buscando Maestrías de Campeón...');
    if (puuid) { // Mastery también puede usar PUUID
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`, { headers });
            results['Mastery V4'].status = response.data.length > 0 ? '✅ ÉXITO: Maestrías obtenidas.' : '⚠️ ADVERTENCIA: Respuesta vacía (Sin maestrías).';
            results['Mastery V4'].data = response.data;
        } catch (e) {
            results['Mastery V4'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Mastery V4'].status = '⏭️ SALTADO: Se requiere PUUID.';
    }
    console.log(`[TEST 4/10] ${results['Mastery V4'].status}`);
    
    await delay(200);
    
    // -------------------------------------------------
    //  TEST 5: Status V4 (Estado del Servicio)
    // -------------------------------------------------
    console.log('\n[TEST 5/10 - Status V4] ➡️ Buscando Estado del Servicio LoL...');
    try {
        const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/status/v4/platform-data`, { headers });
        results['Status V4'].status = `✅ ÉXITO: Estado del Servicio obtenido. (Status: ${response.status})`;
        results['Status V4'].data = response.data;
    } catch (e) {
        results['Status V4'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
    }
     console.log(`[TEST 5/10] ${results['Status V4'].status}`);
     
    await delay(200);
     
    // -------------------------------------------------
    //  TEST 6: TFT League V1
    // -------------------------------------------------
    console.log('\n[TEST 6/10 - TFT League V1] ♟️ Buscando Ligas de TFT...');
     if (encryptedSummonerId) {
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/tft/league/v1/entries/by-summoner/${encryptedSummonerId}`, { headers });
            results['TFT League V1'].status = response.data.length > 0 ? '✅ ÉXITO: Ligas de TFT obtenidas.' : '⚠️ ADVERTENCIA: Respuesta vacía (Unranked en TFT).';
            results['TFT League V1'].data = response.data;
        } catch (e) {
            results['TFT League V1'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['TFT League V1'].status = '⏭️ SALTADO: Se requiere Summoner ID.';
    }
    console.log(`[TEST 6/10] ${results['TFT League V1'].status}`);
    
    await delay(200);
    
    // -------------------------------------------------
    //  TEST 7: Match V5 (Historial)
    // -------------------------------------------------
    console.log('\n[TEST 7/10 - Match V5] 🚀 Buscando Historial de Partidas (Últimos 5 IDs)...');
    if (puuid) { // Match V5 requiere PUUID
        try {
            const response = await axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=5`, { headers });
            matchIds = response.data;
            results['Match V5 (History)'].status = matchIds.length > 0 ? `✅ ÉXITO: IDs de Partidas obtenidos (${matchIds.length} IDs).` : '⚠️ ADVERTENCIA: Sin partidas recientes.';
            results['Match V5 (History)'].data = response.data;
        } catch (e) {
            results['Match V5 (History)'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Match V5 (History)'].status = '⏭️ SALTADO: Se requiere PUUID.';
    }
    console.log(`[TEST 7/10] ${results['Match V5 (History)'].status}`);

    await delay(200);

    // -------------------------------------------------
    //  TEST 8: Match V5 (Timeline)
    // -------------------------------------------------
    if (matchIds.length > 0) {
        console.log(`\n[TEST 8/10 - Match V5] ➡️ Buscando Timeline para Match ID: ${matchIds[0]}...`);
        try {
            const response = await axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/${matchIds[0]}/timeline`, { headers });
            results['Match V5 (Timeline)'].status = '✅ ÉXITO: Timeline de Partida obtenida.';
            results['Match V5 (Timeline)'].data = 'Datos de Timeline omitidos por brevedad.'; // No guardar data completa por ser muy grande
        } catch (e) {
            results['Match V5 (Timeline)'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Match V5 (Timeline)'].status = '⏭️ SALTADO: Se requiere un Match ID.';
    }
    console.log(`[TEST 8/10] ${results['Match V5 (Timeline)'].status}`);

    await delay(200);

    // -------------------------------------------------
    //  TEST 9: Challenges V1
    // -------------------------------------------------
    console.log('\n[TEST 9/10 - Challenges V1] ➡️ Buscando Progreso de Desafíos...');
    if (puuid) { // Challenges V1 requiere PUUID
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/challenges/v1/player-data/${puuid}`, { headers });
            results['Challenges V1'].status = '✅ ÉXITO: Datos de Desafíos obtenidos.';
            results['Challenges V1'].data = 'Datos de Desafíos omitidos por brevedad.'; // Puede ser muy grande
        } catch (e) {
            results['Challenges V1'].status = `❌ FALLO: Challenges V1. Status: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Challenges V1'].status = '⏭️ SALTADO: Se requiere PUUID.';
    }
    console.log(`[TEST 9/10] ${results['Challenges V1'].status}`);

    await delay(200);
    
    // -------------------------------------------------
    //  TEST 10: Spectator V5
    // -------------------------------------------------
     console.log('\n[TEST 10/10 - Spectator V5] 👁️ Buscando Partida en Vivo...');
     if (puuid) { // Spectator V5 requiere PUUID
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}`, { headers });
            results['Spectator V5'].status = '✅ ÉXITO: Partida en vivo encontrada.';
            results['Spectator V5'].data = response.data;
        } catch (e) {
            if (e.response?.status === 404) {
                results['Spectator V5'].status = '✅ ÉXITO: No hay partida en vivo (Respuesta 404 esperada).';
            } else {
                results['Spectator V5'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
            }
        }
     } else {
        results['Spectator V5'].status = '⏭️ SALTADO: Se requiere PUUID.';
     }
    console.log(`[TEST 10/10] ${results['Spectator V5'].status}`);
    
    // -------------------------------------------------
    //  RESUMEN FINAL
    // -------------------------------------------------
    console.log('\n\n--- RESUMEN FINAL DEL DIAGNÓSTICO (FALLOS) ---');
    let hasFailures = false;
    Object.entries(results).forEach(([api, result]) => {
        // Consolidar mensajes de fallo y advertencia de manera más limpia
        if (result.status.includes('❌ FALLO')) {
            hasFailures = true;
            console.log(`[DIAG] ❌ ${api}: FALLÓ. Estado: ${result.status.replace('❌ FALLO: ', '')}`);
        } else if (result.status.includes('⚠️ ADVERTENCIA')) {
            console.log(`[DIAG] ⚠️ ${api}: ADVERTENCIA. Estado: ${result.status.replace('⚠️ ADVERTENCIA: ', '')}`);
        } else if (result.status.includes('🛑 FALLO CRÍTICO')) {
             hasFailures = true;
             console.log(`[DIAG] ${result.status}`);
        } else if (result.status.includes('⏭️ SALTADO')) {
            console.log(`[DIAG] ⏭️ ${api}: ${result.status.replace('⏭️ SALTADO: ', '')}`);
        }
    });

    if (!hasFailures) {
        console.log('[DIAG] ✅ ¡ÉXITO TOTAL! Todos los endpoints respondieron correctamente (o como se esperaba).');
    } else {
        console.log('\n[DIAG] Algunas pruebas fallaron o tuvieron advertencias. Revisa los logs detallados.');
    }
    console.log('------------------------------------------------');
}


// Exportar las funciones que main.js necesita
module.exports = {
  fetchAndSendLcuData,
  runDiagnostics,
};