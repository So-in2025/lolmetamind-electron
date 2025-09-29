// lol-client-api.js
// Este módulo es el núcleo de la recolección de datos, interactuando tanto con el
// League Client (LCU) localmente como con la API externa de Riot Games.
// Incluye un robusto modo de diagnóstico y una lógica de polling avanzada
// para enviar datos consolidados a tu backend para el análisis de la IA.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const Store = require('electron-store');
const LCUConnector = require('lcu-connector');

const store = new Store();
const connector = new LCUConnector();

// =========================================================================
//  CONFIGURACIÓN Y UTILIDADES GLOBALES
// =========================================================================

/**
 * Crea una pausa en la ejecución. Esencial para manejar los límites de velocidad de la API.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Mapeos de Región a Plataforma y a Routing Regional para las APIs de Riot
const REGION_MAPPING = {
    'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
    'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS', 
    'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'TR1': 'EUROPE', 'RU': 'EUROPE',
    'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA', 'SG2': 'ASIA', 'TH2': 'ASIA', 'TW2': 'asia', 'VN2': 'asia',
};

const FRIENDLY_TO_PLATFORM_ID = {
    'LAS': 'LA2', 'LAN': 'LA1', 'EUW': 'EUW1', 'EUNE': 'EUN1', 'BR': 'BR1', 
    'NA': 'NA1', 'OC': 'OC1', 'KR': 'KR',
};

// Agente HTTPS para ignorar certificados autofirmados (necesario para LCU y backend local)
const agent = new https.Agent({
  rejectUnauthorized: false,
});

let lcuCredentials = null;
let lastSentGameflowPhase = null;

// =========================================================================
//  LÓGICA DE CONEXIÓN AL LCU (LEAGUE CLIENT UPDATE)
// =========================================================================

connector.on('connect', (data) => {
  lcuCredentials = data;
  console.log('[LCU] ✅ Conectado al Cliente de LoL');
});

connector.on('disconnect', () => {
  lcuCredentials = null;
  console.log('[LCU] ❌ Desconectado del Cliente de LoL');
});

// Inicia el conector para que escuche al cliente de LoL
connector.start();


// =========================================================================
//  FUNCIÓN PRINCIPAL DE POLLING
// =========================================================================

/**
 * Función principal ejecutada en un intervalo desde main.js.
 * Recopila datos de LCU y/o Riot API y los envía al backend.
 * @param {string} BACKEND_BASE_URL - URL base del servidor backend.
 * @param {string} LIVE_GAME_UPDATE_ENDPOINT - Endpoint para enviar los datos de polling.
 */
async function fetchAndSendLcuData(BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT) {
    let lcuData = null;
    let riotApiData = null;
    let modeLog = 'Initial';

    const userToken = store.get('userToken');
    const summonerName = store.get('userSummonerName');
    const tagline = store.get('userTagline');
    const region = store.get('userRegion');
    const riotApiKey = store.get('riotApiKey');

    // --- PRIORIDAD 1: Intenta obtener datos de la LCU ---
    if (lcuCredentials) {
        modeLog = 'LCU_Live_Game';
        try {
            const lcuAxios = axios.create({
                baseURL: `https://127.0.0.1:${lcuCredentials.port}`,
                headers: { 'Authorization': `Basic ${Buffer.from(`riot:${lcuCredentials.password}`).toString('base64')}` },
                httpsAgent: agent,
            });

            // Se obtiene también la selección de campeones para análisis pre-partida
            const [sessionResponse, gameflowResponse, champSelectResponse] = await Promise.all([
                lcuAxios.get('/lol-gameflow/v1/session').catch(() => null),
                lcuAxios.get('/lol-gameflow/v1/gameflow-phase').catch(() => null),
                lcuAxios.get('/lol-champ-select/v1/session').catch(() => null),
            ]);

            if (sessionResponse && sessionResponse.data && sessionResponse.data.gameData) {
                lcuData = {
                    gameflow: gameflowResponse?.data || null,
                    session: sessionResponse.data,
                    champSelect: champSelectResponse?.data || null,
                };
            } else if (gameflowResponse && gameflowResponse.data) {
                lcuData = { 
                    gameflow: gameflowResponse.data, 
                    session: null,
                    champSelect: champSelectResponse?.data || null,
                };
            } else {
                console.log('[LCU POLLING] LCU abierto, pero estado no disponible. Pasando a Riot API.');
            }
        } catch (error) {
            console.error('[LCU POLLING] ❌ Error al obtener datos de LCU:', error.message);
        }
    }

    // --- PRIORIDAD 2: Si no hay partida en LCU, usa la API de Riot ---
    if (!lcuData?.session) {
        modeLog = 'Strategic_API_Profile';
        if (summonerName && tagline && region && riotApiKey) {
            try {
                const platformId = FRIENDLY_TO_PLATFORM_ID[region];
                const regionalRoute = REGION_MAPPING[platformId];
                const headers = { 'X-Riot-Token': riotApiKey };

                const accountResponse = await axios.get(`https://${regionalRoute}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagline}`, { headers });
                const puuid = accountResponse.data.puuid;

                // NOTA: El endpoint de league/v4 usa summonerId, no puuid. Se necesita una llamada previa.
                const summonerResponse = await axios.get(`https://${platformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
                const summonerId = summonerResponse.data.id;

                const [leagueData, masteryData, liveGameData, matchIdsData] = await Promise.all([
                     axios.get(`https://${platformId}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`, { headers }).catch(e => null),
                     axios.get(`https://${platformId}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`, { headers }).catch(e => null),
                     axios.get(`https://${platformId}.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${puuid}`, { headers }).catch(e => null),
                     axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=5`, { headers }).catch(e => null)
                ]);

                // --- AMPLIACIÓN ROBUSTA: Obtener detalles y timeline de TODAS las partidas recientes ---
                let detailedMatches = [];
                let matchTimelines = [];
                if (matchIdsData?.data && matchIdsData.data.length > 0) {
                    const matchDetailPromises = matchIdsData.data.map(matchId => 
                        axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}`, { headers }).catch(e => null)
                    );
                    const matchResults = await Promise.all(matchDetailPromises);
                    detailedMatches = matchResults.filter(Boolean).map(res => res.data);

                    const timelinePromises = matchIdsData.data.map(matchId =>
                        axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`, { headers }).catch(e => null)
                    );
                    const timelineResults = await Promise.all(timelinePromises);
                    matchTimelines = timelineResults.filter(Boolean).map(res => res.data);
                }
                
                riotApiData = {
                    summoner: summonerResponse?.data,
                    leagues: leagueData?.data,
                    masteries: masteryData?.data,
                    liveGame: liveGameData?.data,
                    matchHistory: detailedMatches,
                    matchTimelines: matchTimelines,
                };

            } catch (error) {
                console.error('[RIOT API] ❌ Error en el flujo:', error.response ? `Status ${error.response.status}` : error.message);
                if (error.response?.status === 403) {
                     console.error('[RIOT API] 🔑 ERROR 403: Revisa tu clave de API de Riot.');
                } else if (error.response?.status === 429) {
                    console.error('[RIOT API] RATE LIMIT: Demasiadas solicitudes. Esperando para reintentar...');
                    await delay(10000); // Espera 10 segundos antes del próximo ciclo de polling
                }
            }
        } else {
             console.log('[RIOT API] Faltan datos para usar la API de Riot.');
        }
    }

    // --- ENVÍO AL BACKEND ---
    const consolidatedData = {
        lcu: lcuData,
        riotApi: riotApiData,
        metaMindProfile: { summonerName, tagline, region } 
    };

    if (lcuData || riotApiData) {
        const currentPhase = lcuData?.gameflow;
        if (currentPhase && currentPhase === lastSentGameflowPhase && modeLog === 'LCU_Live_Game') {
            return; // Evita spam si el estado no cambia
        }
        lastSentGameflowPhase = currentPhase;
        
        console.log(`[POLLING] [SENT] Enviando datos al backend. Modo: ${modeLog}.`);
        
        const requestHeaders = { 
            'Content-Type': 'application/json',
            'Authorization': userToken ? `Bearer ${userToken}` : undefined 
        };
        
        try {
             const response = await axios.post(
                `${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`,
                consolidatedData, 
                { headers: requestHeaders, httpsAgent: agent, timeout: 20000 } // Timeout aumentado
            );

            console.log(`[POLLING] [OK] Envío a Backend exitoso. Status: ${response.status}.`);

        } catch (backendError) {
            console.error(`[POLLING] [FALLO CRÍTICO BACKEND] Error: ${backendError.message}`);
        }
    } else {
         console.log(`[POLLING] [ALERTA] No hay datos de LCU ni de Riot API para enviar.`);
    }
}


// =========================================================================
//  MODO DIAGNÓSTICO (LÓGICA ORIGINAL RESTAURADA Y COMPLETA)
// =========================================================================

/**
 * Ejecuta una serie de pruebas contra todos los endpoints de la API de Riot para verificar la conectividad.
 */
async function runDiagnostics(apiKey, summonerName, tagline, region) {
    console.log('\n\n======================================================');
    console.log(' MODO DIAGNÓSTICO DE RIOT API INICIADO');
    console.log('======================================================');
    
    if (!apiKey || !summonerName || !tagline || !region) {
        console.error('[DIAG] ❌ ERROR: Faltan datos (Clave API, Invocador, Tagline o Región).');
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

    // --- TEST 1: Account V1 (Obtener PUUID) ---
    console.log(`\n[TEST 1/10 - Account V1] 🔑 Buscando PUUID para ${summonerName}#${tagline}...`);
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

    // --- TEST 2: Summoner V4 (Obtener ID Cifrado) ---
    console.log('\n[TEST 2/10 - Summoner V4] 🔑 Buscando Summoner ID...');
    if (puuid) {
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, { headers });
            encryptedSummonerId = response.data.id;
            accountId = response.data.accountId;
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

    // --- TEST 3: League V4 (Ligas) ---
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

    // --- TEST 4: Mastery V4 (Maestrías) ---
    console.log('\n[TEST 4/10 - Mastery V4] 🏅 Buscando Maestrías de Campeón...');
    if (puuid) {
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
    
    // --- TEST 5: Status V4 (Estado del Servicio) ---
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
     
    // --- TEST 6: TFT League V1 ---
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
    
    // --- TEST 7: Match V5 (Historial) ---
    console.log('\n[TEST 7/10 - Match V5] 🚀 Buscando Historial de Partidas (Últimos 5 IDs)...');
    if (puuid) {
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

    // --- TEST 8: Match V5 (Timeline) ---
    if (matchIds.length > 0) {
        console.log(`\n[TEST 8/10 - Match V5] ➡️ Buscando Timeline para Match ID: ${matchIds[0]}...`);
        try {
            const response = await axios.get(`https://${regionalRoute}.api.riotgames.com/lol/match/v5/matches/${matchIds[0]}/timeline`, { headers });
            results['Match V5 (Timeline)'].status = '✅ ÉXITO: Timeline de Partida obtenida.';
            results['Match V5 (Timeline)'].data = 'Datos de Timeline omitidos por brevedad.';
        } catch (e) {
            results['Match V5 (Timeline)'].status = `❌ FALLO: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Match V5 (Timeline)'].status = '⏭️ SALTADO: Se requiere un Match ID.';
    }
    console.log(`[TEST 8/10] ${results['Match V5 (Timeline)'].status}`);

    await delay(200);

    // --- TEST 9: Challenges V1 ---
    console.log('\n[TEST 9/10 - Challenges V1] ➡️ Buscando Progreso de Desafíos...');
    if (puuid) {
        try {
            const response = await axios.get(`https://${platformId}.api.riotgames.com/lol/challenges/v1/player-data/${puuid}`, { headers });
            results['Challenges V1'].status = '✅ ÉXITO: Datos de Desafíos obtenidos.';
            results['Challenges V1'].data = 'Datos de Desafíos omitidos por brevedad.';
        } catch (e) {
            results['Challenges V1'].status = `❌ FALLO: Challenges V1. Status: ${e.response?.status || 'Error de Red'}`;
        }
    } else {
        results['Challenges V1'].status = '⏭️ SALTADO: Se requiere PUUID.';
    }
    console.log(`[TEST 9/10] ${results['Challenges V1'].status}`);

    await delay(200);
    
    // --- TEST 10: Spectator V5 ---
     console.log('\n[TEST 10/10 - Spectator V5] 👁️ Buscando Partida en Vivo...');
     if (puuid) {
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
    
    // --- RESUMEN FINAL ---
    console.log('\n\n--- RESUMEN FINAL DEL DIAGNÓSTICO (FALLOS) ---');
    let hasFailures = false;
    Object.entries(results).forEach(([api, result]) => {
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

// Exporta las funciones que main.js necesita
module.exports = {
  fetchAndSendLcuData,
  runDiagnostics,
};

