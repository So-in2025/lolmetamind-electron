// lol-client-api.js
// Versión parcheada: logs PRO-DEV, transición inmediata OFFLINE al salir de cola,
// smoothing configurable y getter sincrónico para credenciales LCU.
// Exporta: fetchRiotApiData, pollLcuDataAndSend, sendLcuCommand, getLcuCredentials

const axios = require('axios');
const https = require('https');
const Store = require('electron-store');
const { exec } = require('child_process');
const store = new Store();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// -------------------------
// Config / Mappings
// -------------------------
const REGION_MAPPING = {
  'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
  'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS',
  'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA',
};

const FRIENDLY_TO_PLATFORM_ID = {
  'LAS': 'LA2', 'LAN': 'LA1', 'EUW': 'EUW1', 'EUNE': 'EUN1', 'BR': 'BR1',
  'NA': 'NA1', 'OC': 'OC1', 'KR': 'KR',
};

// HTTPS Agent para LCU (ignorar certs locales)
const lcuAgent = new https.Agent({ rejectUnauthorized: false });

// -------------------------
// Estado módulo (persistente entre ciclos)
// -------------------------
let lastKnownGameFlowPhase = 'None';
let lastKnownLCUStatus = 'OFFLINE';
let lastReadCreds = null;             // { port, password } actualizado por readLoLCreds
let consecutiveLcuFailures = 0;
const MAX_LCU_FAILURES = 1;           // Ajustable: 0 = instant OFFLINE, >0 smoothing
// Nota: si querés "instantáneo" al salir de cola, pon MAX_LCU_FAILURES = 0

// -------------------------
// Helpers para lectura de LCU
// -------------------------
async function readLoLCreds() {
  console.log('[LCU Creds] Buscando credenciales del LCU a través de PowerShell...');
  if (process.platform !== 'win32') {
    console.warn('[LCU Creds] ⚠️ Método sólo disponible en Windows.');
    lastReadCreds = null;
    return null;
  }

  const command = "powershell.exe -NoProfile -NonInteractive -Command \"(Get-WmiObject Win32_Process -Filter \\\"Name='LeagueClientUx.exe'\\\").CommandLine\"";
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) console.warn('[LCU Creds] PowerShell STDERR:', stderr.trim());
        resolve({ stdout, stderr });
      });
    });

    const fullCommandLine = (stdout || '').trim();
    if (!fullCommandLine) {
      console.log('[LCU Creds] ℹ️ Proceso LeagueClientUx.exe no encontrado o sin CommandLine.');
      lastReadCreds = null;
      return null;
    }

    const appPortMatch = fullCommandLine.match(/--app-port=(\d+)/);
    const remotingAuthTokenMatch = fullCommandLine.match(/--remoting-auth-token=([\w-]+)/);
    const port = appPortMatch ? parseInt(appPortMatch[1], 10) : null;
    const password = remotingAuthTokenMatch ? remotingAuthTokenMatch[1] : null;

    if (port && password) {
      console.log('[LCU Creds] ✅ Credenciales LCU obtenidas con éxito.');
      lastReadCreds = { port, password };
      return lastReadCreds;
    } else {
      console.log('[LCU Creds] ⚠️ Proceso encontrado, pero no se pudieron extraer puerto/token.');
      lastReadCreds = null;
      return null;
    }
  } catch (e) {
    console.error('[LCU Creds] ❌ Excepción buscando credenciales LCU:', e.message);
    lastReadCreds = null;
    return null;
  }
}

// Getter sincrónico para main.js (para no romper llamadas existentes)
// Devuelve { port, password, token } o null
function getLcuCredentials() {
  if (!lastReadCreds) return null;
  const token = Buffer.from(`riot:${lastReadCreds.password}`).toString('base64');
  return { port: lastReadCreds.port, password: lastReadCreds.password, token };
}

// -------------------------
// Fetch PUUID / Perfil Riot (simplificado, robusto)
// -------------------------
async function fetchRiotApiData() {
  console.log('[RIOT API] Iniciando la batería de pruebas de la API de Riot...');

  const riotApiKey = store.get('riotApiKey');
  const platformRegion = store.get('userRegion');
  const summonerName = store.get('userSummonerName');
  const tagLine = store.get('userTagline');

  if (!riotApiKey || !platformRegion || !summonerName || !tagLine) {
    console.error('[RIOT API] ❌ Error de Store: faltan datos (Key/Region/Invocador).');
    return null;
  }

  const upperRegion = platformRegion.toUpperCase();
  const regionalRouting = REGION_MAPPING[upperRegion];
  if (!regionalRouting) {
    console.error(`[RIOT API] ❌ Región '${platformRegion}' no mapeada.`);
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
    error: undefined,
  };

  // Intentar IDs desde LCU primero (si está abierto)
  const creds = await readLoLCreds();
  if (creds) {
    try {
      const token = Buffer.from(`riot:${creds.password}`).toString('base64');
      const base = `https://127.0.0.1:${creds.port}`;
      const resp = await axios.get(`${base}/lol-summoner/v1/current-summoner`, { headers: { Authorization: `Basic ${token}` }, httpsAgent: lcuAgent, timeout: 3000 });
      if (resp.status === 200 && resp.data) {
        puuid = resp.data.puuid;
        encryptedSummonerId = resp.data.summonerId;
        console.log('[LCU MITIGATION] ✅ IDs obtenidos del cliente. PUUID:', puuid ? 'SÍ' : 'NO');
      }
    } catch (e) {
      console.warn('[LCU MITIGATION] ⚠️ No se pudo leer current-summoner desde LCU:', e.message);
    }
  }

  // Si no hay PUUID desde LCU, pedir a Riot Account V1
  if (!puuid) {
    try {
      console.log(`[TEST 1/3] 🔑 Buscando PUUID para ${summonerName}#${tagLine} en ${regionalRouting}...`);
      const accountResponse = await axios.get(
        `https://${regionalRouting.toLowerCase()}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagLine}`,
        { headers: { 'X-Riot-Token': riotApiKey }, timeout: 5000 }
      );
      puuid = accountResponse.data.puuid;
      console.log('[TEST 1/3] ✅ PUUID obtenido desde Riot Account V1.');
    } catch (error) {
      const status = error.response?.status;
      console.error('[TEST 1/3] ❌ Error obteniendo PUUID. Status:', status || 'Network', error.message);
      return { error: `Clave API inválida o Invocador/Tagline incorrecto (Status: ${status || 'Network'})` };
    }
  }

  await delay(200);
  console.log('[RIOT API] ✅ Batería de pruebas completada.');
  return { puuid, encryptedSummonerId, ...consolidatedData };
}

// -------------------------
// Live client data (in-game)
// -------------------------
async function fetchLiveGameData() {
  const url = `https://127.0.0.1:2999/liveclientdata/allgamedata`;
  try {
    const response = await axios.get(url, { httpsAgent: lcuAgent, timeout: 2000 });
    if (response.status === 200 && response.data?.activePlayer) {
      console.log('[LiveClientData] ✅ Datos en vivo obtenidos.');
      return response.data;
    }
    return null;
  } catch (error) {
    if (error.code !== 'ECONNREFUSED') {
      console.log('[LiveClientData] ℹ️ No se pudieron obtener datos en vivo:', error.message);
    }
    return null;
  }
}

// -------------------------
// Polling LCU -> Dashboard & Overlay
// - Detecta transiciones ONLINE->OFFLINE y OFFLINE->ONLINE
// - Envía OFFLINE inmediato al overlay cuando detecta salida de fase activa
// - Usa lastKnown* para evitar perder la última fase conocida
// -------------------------
async function pollLcuDataAndSend(initialRiotApiData, BACKEND_BASE_URL, LIVE_GAME_UPDATE_ENDPOINT, ipcSender, overlaySender) {
  console.log('\n--- INICIO DE CICLO DE POLLING ---');
  let consolidatedData = { ...initialRiotApiData };
  let lcuModeActive = false;
  let foundCreds = false;
  let gameflowResponse = null;
  let treatAsImmediateOffline = false; // flag para enviar OFFLINE inmediato si detectamos transición

  // 1) Leer credenciales (actualiza lastReadCreds)
  const creds = await readLoLCreds();
  if (creds?.port && creds?.password) {
    foundCreds = true;
    console.log(`[POLLING] Credenciales encontradas. Intentando conectar a LCU en puerto ${creds.port}...`);

    const token = Buffer.from(`riot:${creds.password}`).toString('base64');
    const LCU_BASE_URL = `https://127.0.0.1:${creds.port}`;
    const options = { headers: { 'Authorization': `Basic ${token}` }, httpsAgent: lcuAgent, timeout: 3000 };

    // Intentos con pequeño backoff para evitar marcar OFFLINE por fallo transitorio
    const MAX_ATTEMPTS = 2;
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      try {
        console.log(`[POLLING] Intento ${attempt}/${MAX_ATTEMPTS} para /lol-gameflow/v1/session`);
        const resp = await axios.get(`${LCU_BASE_URL}/lol-gameflow/v1/session`, options);
        gameflowResponse = resp;
        if (resp.status === 200 && resp.data) {
          // Si viene phase válida la consideramos candidata a ONLINE (evaluación abajo según activePhases)
          console.log('[POLLING] Respuesta gameflow recibida:', resp.data.phase || 'NO-PHASE');
        }
        break;
      } catch (err) {
        console.warn(`[POLLING] Intento ${attempt} falló: ${err.message}`);
        if (attempt < MAX_ATTEMPTS) await delay(150);
        else console.warn('[POLLING] Todos los intentos para gameflow fallaron.');
      }
    }

    // Procesar gameflow si vino
    if (gameflowResponse?.status === 200 && gameflowResponse.data?.phase) {
      const phase = gameflowResponse.data.phase;
      console.log(`[POLLING] Fase detectada: ${phase}`);
      const activePhases = ['Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect', 'InProgress'];

      if (activePhases.includes(phase)) {
        // Fase activa -> marcar ONLINE y obtener liveData si corresponde
        lcuModeActive = true;
        console.log(`[POLLING] Fase activa (${phase}). Entrando en modo Realtime.`);

        const liveClientData = (phase === 'InProgress') ? await fetchLiveGameData().catch(e => {
          console.warn('[POLLING] fetchLiveGameData fallo:', e?.message);
          return null;
        }) : null;

        consolidatedData = {
          ...consolidatedData,
          mode: 'Realtime',
          gameflow: gameflowResponse.data,
          liveData: liveClientData || { status: 'NotAvailable', reason: 'Live client data no disponible' },
        };

        // Actualizamos memoria de último estado
        lastKnownGameFlowPhase = phase;
        lastKnownLCUStatus = 'ONLINE';
        consecutiveLcuFailures = 0;
      } else {
        // Gameflow presente pero fase no considerada "activa".
        // Esto puede indicar transición fuera de cola (Ready -> None) o pantalla intermedia.
        // Si antes estábamos ONLINE, tratamos esto como salida inmediata y forzamos OFFLINE en overlay.
        console.log(`[POLLING] Gameflow presente pero fase NO activa: ${phase}`);
        consolidatedData.mode = 'Realtime';
        consolidatedData.gameflow = gameflowResponse.data;
        // Si veníamos ONLINE, forzamos envío inmediato de OFFLINE al overlay (transición)
        if (lastKnownLCUStatus === 'ONLINE') {
          console.log('[POLLING] Detectada transición desde ONLINE a fase no-activa. FORZANDO overlay OFFLINE inmediato.');
          treatAsImmediateOffline = true;
        }
        // Mantenemos lastKnown* (no sobreescribimos con fase menor)
        consecutiveLcuFailures = 0;
      }
    } else {
      // No obtuvimos gameflow válido: tratar según tipo de error (conn refused -> probable cierre)
      // Si no se obtuvo y antes estábamos ONLINE, forzamos OFFLINE inmediato
      console.log('[POLLING] No se obtuvo gameflow válido en este ciclo.');
      if (lastKnownLCUStatus === 'ONLINE') {
        console.log('[POLLING] Veníamos ONLINE pero ahora no hay gameflow -> FORZAR OFFLINE inmediato.');
        treatAsImmediateOffline = true;
      }
      // Incrementar contador de fallos solo si sí había credenciales detectadas
      // (esto da smoothing si MAX_LCU_FAILURES > 0)
      consecutiveLcuFailures++;
      console.log(`[POLLING] Incrementando consecutiveLcuFailures a ${consecutiveLcuFailures}`);
    }
  } else {
    // No hay credenciales -> cliente no abierto/instanciado
    console.log('[POLLING] ℹ️ Cliente de LoL no detectado en este ciclo (no se encontraron credenciales).');
    // Si antes estábamos ONLINE, forzamos OFFLINE inmediato
    if (lastKnownLCUStatus === 'ONLINE') {
      console.log('[POLLING] Veníamos ONLINE pero LCU no existe -> FORZAR OFFLINE inmediato.');
      treatAsImmediateOffline = true;
    }
    // Resetear contador: ausencia de cliente no es "fallo de conexión" del cliente en ejecución
    consecutiveLcuFailures = 0;
  }

  // Evaluación final consideredOnline:
  // - Si detectamos treatAsImmediateOffline lo forzamos a false
  const smoothingAllowsOnline = consecutiveLcuFailures <= MAX_LCU_FAILURES;
  const consideredOnline = (!treatAsImmediateOffline) && (lcuModeActive || smoothingAllowsOnline);

  // Ajustar modo del consolidatedData
  consolidatedData.mode = consideredOnline ? (consolidatedData.mode || 'Realtime') : 'Strategic_API_Profile';
  console.log(`[POLLING] Modo final: ${consolidatedData.mode} (lcuModeActive=${lcuModeActive}, consecutiveFailures=${consecutiveLcuFailures}, treatImmediateOffline=${treatAsImmediateOffline})`);

  // Enviar al Dashboard (IPC principal)
  if (ipcSender) {
    try {
      console.log('[POLLING] Enviando datos al DASHBOARD...');
      ipcSender(consolidatedData);
    } catch (err) {
      console.warn('[POLLING] Error enviando al Dashboard:', err.message);
    }
  } else {
    console.warn('[POLLING] ⚠️ ipcSender no válido.');
  }

  // Preparar payload para overlay: usar lastKnownGameFlowPhase como fallback
  const gameFlowPhase = consolidatedData.gameflow?.phase || lastKnownGameFlowPhase || 'None';
  const overlayPayload = {
    LCU_STATUS: consideredOnline ? 'ONLINE' : 'OFFLINE',
    lcuStatus: consideredOnline ? 'ONLINE' : 'OFFLINE', // legacy
    gamePhase: consideredOnline ? (gameFlowPhase || 'Unknown') : 'None',
    draftData: (gameFlowPhase === 'ChampSelect') ? (consolidatedData.gameflow || null) : null,
    liveData: (gameFlowPhase === 'InProgress') ? (consolidatedData.liveData || null) : null,
  };

  // Si detectamos una transición forzada a OFFLINE la enviamos inmediatamente
  if (overlaySender) {
    if (!consideredOnline && (treatAsImmediateOffline || lastKnownLCUStatus === 'ONLINE')) {
      console.log('[POLLING] (IMMEDIATE) Enviando payload OFFLINE al OVERLAY:', overlayPayload);
      try {
        overlaySender(overlayPayload);
      } catch (err) {
        console.error('[POLLING] Error enviando overlay immediate:', err.message);
      }
    } else {
      console.log('[POLLING] Enviando payload al OVERLAY:', overlayPayload);
      try {
        overlaySender(overlayPayload);
      } catch (err) {
        console.error('[POLLING] Error enviando overlay:', err.message);
      }
    }
  } else {
    console.warn('[POLLING] ⚠️ overlaySender no válido.');
  }

  // Persistir al backend si hay userToken
  const userToken = store.get('userToken');
  if (userToken) {
    try {
      await axios.post(`${BACKEND_BASE_URL}${LIVE_GAME_UPDATE_ENDPOINT}`, consolidatedData, {
        headers: { 'Authorization': `Bearer ${userToken}` }, httpsAgent: lcuAgent, timeout: 5000
      });
    } catch (backendError) {
      console.error('[POLLING] ❌ Error enviando datos al backend:', backendError.message);
    }
  } else {
    console.log('[POLLING] ⚠️ No hay userToken para enviar al backend.');
  }

  // Actualizar memoria para el próximo ciclo
  lastKnownGameFlowPhase = overlayPayload.gamePhase === 'None' ? lastKnownGameFlowPhase : overlayPayload.gamePhase;
  lastKnownLCUStatus = overlayPayload.LCU_STATUS;

  console.log('--- FIN DE CICLO DE POLLING ---\n');
}

// -------------------------
// sendLcuCommand: envío genérico al LCU
// - Acepta creds con token o con password (genera token si hace falta)
// -------------------------
async function sendLcuCommand(creds, method, endpoint, payload) {
  // creds: { port, token } o { port, password }
  if (!creds || !creds.port) throw new Error('LCU Offline o credenciales no disponibles.');

  const token = creds.token || (creds.password ? Buffer.from(`riot:${creds.password}`).toString('base64') : null);
  if (!token) throw new Error('Token LCU no disponible en credenciales.');

  const url = `https://127.0.0.1:${creds.port}${endpoint}`;
  const response = await axios({
    method,
    url,
    headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' },
    data: payload,
    httpsAgent: lcuAgent,
    timeout: 5000
  });

  // usualmente LCU devuelve 204 No Content -> response.data puede ser undefined
  return response.data;
}

// -------------------------
// Exports
// -------------------------
module.exports = {
  fetchRiotApiData,
  pollLcuDataAndSend,
  sendLcuCommand,
  getLcuCredentials,
};
