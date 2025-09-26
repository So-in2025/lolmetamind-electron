// lol-client-api.js

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Ruta común al lockfile del cliente de Riot (Windows es el más común)
const LOCKFILE_PATH = path.join(
  process.env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : ''),
  'Riot Games', 
  'League of Legends', 
  'lockfile'
);

/**
 * Lee el archivo lockfile para obtener el puerto y el token (password) del cliente LoL.
 * @returns {Promise<{port: number, password: string}|null>} Credenciales o null si no se encuentra.
 */
async function readLoLCreds() {
    try {
        if (!fs.existsSync(LOCKFILE_PATH)) {
            // Retorna null si el lockfile no existe (el cliente no está abierto o no hay partida)
            return null; 
        }

        const content = fs.readFileSync(LOCKFILE_PATH, 'utf-8');
        // Formato del lockfile: <nombre>:<pid>:<puerto>:<password>:<protocolo>
        const parts = content.split(':');

        if (parts.length < 5) return null;

        return {
            port: parseInt(parts[2], 10),
            password: parts[3],
        };

    } catch (e) {
        console.error('Error al leer lockfile:', e.message);
        return null;
    }
}

/**
 * Hace una petición a la API del Cliente LoL para obtener los datos de la partida en vivo.
 * @param {number} port - Puerto de la API.
 * @param {string} password - Token de autenticación (password).
 * @returns {Promise<object|null>} Datos del juego o null si no hay partida activa.
 */
async function fetchLiveGameData(port, password) {
    const authHeader = `Basic ${Buffer.from(`riot:${password}`).toString('base64')}`;
    const url = `https://127.0.0.1:${port}/liveclientdata/allgamedata`; 

    try {
        // Se usa un agente para ignorar el error de certificado SSL autofirmado del cliente LoL
        const agent = new https.Agent({ rejectUnauthorized: false });

        const response = await axios.get(url, {
            headers: {
                'Authorization': authHeader,
            },
            httpsAgent: agent,
            timeout: 5000,
        });

        if (response.status === 200 && response.data && response.data.activePlayer) {
            // Devuelve los datos si la respuesta es exitosa y contiene datos de la partida
            return response.data;
        }

        return null;

    } catch (error) {
        // Maneja errores de conexión o si la partida no está activa (generalmente 404)
        if (error.response?.status === 404) {
             console.log('API Client: Endpoint encontrado, pero no hay datos de partida activa (404).');
        } else {
             console.error('API Client Error:', error.message);
        }
        return null;
    }
}

module.exports = { readLoLCreds, fetchLiveGameData };