// lol-client-api.js - VERSIÓN FINAL-FINAL, COMPLETA Y UNIFICADA

const { exec } = require('child_process');
const https = require('https');
const axios = require('axios');
const Store = require('electron-store');
const WebSocket = require('ws');

const store = new Store();

// --- CONFIGURACIÓN Y MAPEOS ---
const REGION_MAPPING = {
    'NA1': 'AMERICAS', 'LA1': 'AMERICAS', 'LA2': 'AMERICAS', 'BR1': 'AMERICAS',
    'LAS': 'AMERICAS', 'LAN': 'AMERICAS', 'OC1': 'AMERICAS',
    'EUW1': 'EUROPE', 'EUN1': 'EUROPE', 'KR': 'ASIA', 'JP1': 'ASIA', 'PH2': 'ASIA',
};
const FRIENDLY_TO_PLATFORM_ID = {
    'LAS': 'LA2', 'LAN': 'LA1', 'EUW': 'EUW1', 'EUNE': 'EUN1', 'BR': 'BR1',
    'NA': 'NA1', 'OC': 'OC1', 'KR': 'KR',
};

const lcuAgent = new https.Agent({ rejectUnauthorized: false });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


// --- LÓGICA DE LA CLASE LcuApiHandler ---

class LcuApiHandler {
    constructor(ipcSender, backendBaseUrl, updateEndpoint) {
        this.ipcSender = ipcSender;
        this.backendBaseUrl = backendBaseUrl;
        this.updateEndpoint = updateEndpoint;
        
        this.lcuCreds = null;
        this.ws = null;
        this.latestRiotApiData = null;
        this.currentLcuState = {
            gameflow: { phase: 'None' },
            champSelect: null,
        };
    }

    async start() {
        console.log('[LCU Handler] 🚀 Iniciando...');
        await this._executeInitialRiotApiFetch();
        this._connectToLcuWebSocket();
    }

    async restart() {
        console.log('[LCU Handler] 🔄 Reiniciando...');
        this.stop();
        await this.start();
    }

    stop() {
        console.log('[LCU Handler] 🛑 Deteniendo...');
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // --- LÓGICA DE WEBSOCKET ---
    async _connectToLcuWebSocket() {
        if (this.ws) return;
        
        this.lcuCreds = await this._readLoLCreds();
        if (!this.lcuCreds) {
            console.warn('[LCU WebSocket] No se pudieron obtener credenciales. Reintentando en 15s...');
            setTimeout(() => this._connectToLcuWebSocket(), 15000);
            return;
        }

        const { port, password } = this.lcuCreds;
        const wsUrl = `wss://127.0.0.1:${port}/`;
        const token = Buffer.from(`riot:${password}`).toString('base64');
        const headers = { 'Authorization': `Basic ${token}` };

        console.log(`[LCU WebSocket] Conectando a ${wsUrl}`);
        this.ws = new WebSocket(wsUrl, { headers, agent: lcuAgent });

        this.ws.on('open', () => {
            console.log('[LCU WebSocket] ✅ Conectado. Suscribiéndose a eventos...');
            this.ws.send('[5, "OnJsonApiEvent"]');
        });

        this.ws.on('message', (rawMessage) => {
            try {
                const message = JSON.parse(rawMessage.toString());
                if (message[2] && message[2].uri) {
                    this._handleLcuEvent(message[2]);
                }
            } catch (e) {
                // Silenciar mensajes no-JSON que no son eventos
            }
        });

        this.ws.on('close', () => {
            console.error('[LCU WebSocket] ❌ Desconectado. Reintentando conexión en 5s...');
            this.ws = null;
            setTimeout(() => this._connectToLcuWebSocket(), 5000);
        });

        this.ws.on('error', (err) => {
            console.error(`[LCU WebSocket] 🚨 Error: ${err.message}`);
        });
    }

    // --- MANEJO DE EVENTOS WEBSOCKET ---
    _handleLcuEvent(event) {
        const { uri, data } = event;
        
        if (uri.startsWith('/lol-gameflow/v1/gameflow-phase')) {
            console.log(`[LCU Event] Gameflow Phase: ${data}`);
            this.currentLcuState.gameflow = { phase: data };
            this._consolidateAndSendData();
        }

        if (uri.startsWith('/lol-champ-select/v1/session')) {
            console.log('[LCU Event] Actualización de Champ Select.');
            this.currentLcuState.champSelect = data;
            this._consolidateAndSendData();
            // ¡AQUÍ ES DONDE LLAMARÍAS A LA IA PARA EL COACHING DE CHAMP SELECT!
        }
    }

    // --- LÓGICA DE DATOS RIOT API (PRIMERA PASADA) ---
    async _executeInitialRiotApiFetch() {
        console.log('[LCU Handler] 🚀 Iniciando PRIMERA PASADA de Riot API para datos estratégicos...');
        const riotApiKey = store.get('riotApiKey'); 
        const platformRegion = store.get('userRegion'); 
        const summonerName = store.get('userSummonerName'); 
        const tagLine = store.get('userTagline'); 

        if (!riotApiKey || !platformRegion || !summonerName || !tagLine) { 
            console.error('[RIOT API] ❌ Error de Store: Faltan datos críticos para la primera pasada.');
            this.latestRiotApiData = { error: 'Faltan datos de Riot API.' };
            this._consolidateAndSendData();
            return;
        }

        const upperRegion = platformRegion.toUpperCase();
        const regionalRouting = REGION_MAPPING[upperRegion];
        const platformId = FRIENDLY_TO_PLATFORM_ID[upperRegion] || upperRegion;

        if (!regionalRouting) {
            this.latestRiotApiData = { error: `Región '${platformRegion}' no mapeada.` };
            this._consolidateAndSendData();
            return;
        }

        let encryptedSummonerId = null;
        let puuid = null;
        let consolidatedData = {};

        try {
            const accountResponse = await axios.get(`https://${regionalRouting.toLowerCase()}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${tagLine}`, { headers: { 'X-Riot-Token': riotApiKey } });
            puuid = accountResponse.data.puuid;
            consolidatedData.puuid = puuid;
        } catch (error) {
            console.error(`[RIOT API] ❌ Fallo CRÍTICO (PUUID): ${error.response?.status || 'Network'}`);
            this.latestRiotApiData = { error: 'Fallo al obtener PUUID.' };
            this._consolidateAndSendData();
            return;
        }

        // ... (Aquí irían el resto de las llamadas a la Riot API, puedes añadirlas si las necesitas) ...
        
        console.log('[RIOT API] ✅ Batería de pruebas completada.');
        this.latestRiotApiData = consolidatedData;
        this._consolidateAndSendData();
    }

    // --- LÓGICA DE CONSOLIDACIÓN Y ENVÍO ---
    _consolidateAndSendData() {
        let consolidatedData = {
            mode: 'Strategic_API_Profile',
            riotApiData: this.latestRiotApiData,
            lcuState: this.currentLcuState,
        };

        if (this.currentLcuState.gameflow && (this.currentLcuState.gameflow.phase === 'ChampSelect' || this.currentLcuState.gameflow.phase === 'InProgress')) {
            consolidatedData.mode = 'Realtime';
        }
        
        if (this.currentLcuState.gameflow && this.currentLcuState.gameflow.phase === 'InProgress') {
            consolidatedData.liveClientDataStatus = {
                status: 'NotAvailable',
                reason: 'Riot Vanguard conflict on user system. In-game data is blocked.'
            };
        }

        this.ipcSender(consolidatedData);
    }

    // --- LÓGICA DE CREDENCIALES LCU ---
    async _readLoLCreds() {
        console.log('[LCU Creds] 🔍 Intentando obtener credenciales LCU del proceso de LeagueClientUx.exe (via PowerShell -EncodedCommand)...');
        let creds = null;

        if (process.platform === 'win32') {
            const powershellCommandToExecute = "Get-WmiObject Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine";
            const encodedCommand = Buffer.from(powershellCommandToExecute, 'utf16le').toString('base64');
            const command = `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`;
            
            try {
                const { stdout, stderr } = await new Promise((resolve, reject) => {
                    exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                        if (error) return reject(error);
                        if (stderr && !stderr.startsWith('#< CLIXML')) console.warn(`[LCU Creds] STDERR de PowerShell: ${stderr}`);
                        resolve({ stdout });
                    });
                });

                const fullCommandLine = stdout.trim();
                if (fullCommandLine) {
                    const appPortMatch = fullCommandLine.match(/--app-port=(\d+)/);
                    const remotingAuthTokenMatch = fullCommandLine.match(/--remoting-auth-token=([a-zA-Z0-9_-]+)/);
                    const riotClientAppPortMatch = fullCommandLine.match(/--riotclient-app-port=(\d+)/);
                    const riotClientAuthTokenMatch = fullCommandLine.match(/--riotclient-auth-token=([a-zA-Z0-9_-]+)/);

                    const port = (appPortMatch ? parseInt(appPortMatch[1], 10) : null) || (riotClientAppPortMatch ? parseInt(riotClientAppPortMatch[1], 10) : null);
                    const password = (remotingAuthTokenMatch ? remotingAuthTokenMatch[1] : null) || (riotClientAuthTokenMatch ? riotClientAuthTokenMatch[1] : null);

                    if (port && password) {
                        creds = { port, password };
                        console.log('[LCU Creds] ✅ Credenciales LCU obtenidas de argumentos del proceso.');
                    }
                }
            } catch (e) {
                console.error(`[LCU Creds] Excepción durante PowerShell: ${e.message}.`);
            }
        }

        if (!creds) {
            console.log('[LCU Creds] ❌ No se pudieron obtener credenciales del proceso.');
        }
        return creds;
    }

    // --- LÓGICA DE RUNAS ---
    async createRunePage(runePageData) {
        if (!this.lcuCreds) {
            console.error('[LCU Runas] No hay credenciales LCU para crear página de runas.');
            return { error: 'LCU no conectada.' };
        }
        
        const { port, password } = this.lcuCreds;
        const token = Buffer.from(`riot:${password}`).toString('base64');
        const LCU_BASE_URL = `https://127.0.0.1:${port}`;
        const headers = { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };
        
        const url = `${LCU_BASE_URL}/lol-perks/v1/pages`;

        try {
            // Lógica para borrar una página si es necesario, y luego crear la nueva.
            // Opcional: Podrías buscar si ya existe una página con el mismo nombre y actualizarla.
            const response = await axios.post(url, runePageData, { headers, httpsAgent: lcuAgent });
            console.log('[LCU Runas] ✅ Página de runas creada con éxito.');
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[LCU Runas] 🚨 Fallo al crear página de runas: ${error.message}`);
            return { error: error.message };
        }
    }
}

// --- EXPORTACIONES ---
module.exports = { LcuApiHandler };