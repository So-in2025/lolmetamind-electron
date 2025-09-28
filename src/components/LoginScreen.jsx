// src/components/LoginScreen.jsx
"use client"
import React, { useState, useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';

// --- CONFIGURACIÓN CRÍTICA DEL BACKEND (Mantenida) ---
const API_BASE_URL = 'http://localhost:3000/api/auth'; 
const API_ENDPOINTS = {
    LOGIN: `${API_BASE_URL}/login`,
    REGISTER: `${API_BASE_URL}/register`
};

// --- Componentes de Icono LoL Style (Iguales) ---
const LoginIcon = () => (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);
const RegisterIcon = () => (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM3 12h4a7 7 0 0110 0h4a7 7 0 01-10 0z" />
    </svg>
);
const CloseButton = () => (
    <button
        onClick={() => window.electronAPI ? window.electronAPI.closeWindow() : alert('Cerrar app (Electron no detectado)')} 
        className="close-button -webkit-app-region-no-drag transition-colors duration-200 absolute top-0 right-0 p-3 rounded hover:bg-lol-medium"
        title="Cerrar aplicación"
        style={{ zIndex: 10 }}
    >
        <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
    </button>
);


export default function LoginScreen() {
    const { setFlowState, AppFlowState, setUserData } = useAppState();
    
    // ESTADOS COMPLETOS
    const [isRegister, setIsRegister] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [summonerName, setSummonerName] = useState('');
    const [tagline, setTagline] = useState('');
    const [region, setRegion] = useState('LAS'); 
    const [zodiacSign, setZodiacSign] = useState('');
    const [favChamp1, setFavChamp1] = useState('');
    const [favChamp2, setFavChamp2] = useState('');
    const [favRole1, setFavRole1] = useState('MID'); 
    const [favRole2, setFavRole2] = useState('');
    const REGIONS = ['LAS', 'NA', 'EUW', 'EUNE', 'KR', 'BR'];
    const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
    const ZODIACS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];

    // LÓGICA DE VALIDACIÓN COMPLETA (Misma)
    const validateRegistrationFields = useCallback(() => {
        if (tagline.length < 3 || tagline.length > 5 || !/^[A-Za-z0-9]+$/.test(tagline)) {
            setError('Tagline inválido. Debe tener 3 a 5 caracteres alfanuméricos.');
            return false;
        }
        if (summonerName.length < 3 || summonerName.length > 16) {
            setError('Nombre de Invocador inválido. Debe tener entre 3 y 16 caracteres.');
            return false;
        }
        if (!region || !zodiacSign || !ROLES.includes(favRole1) || !favChamp1) {
             setError('Faltan campos obligatorios para el perfil.');
             return false;
        }
        if (!/^[A-Za-z\s]+$/.test(favChamp1)) {
             setError('Campeón Favorito 1 debe contener solo letras.');
             return false;
        }
        if (favChamp2 && !/^[A-Za-z\s]+$/.test(favChamp2)) {
             setError('Campeón Favorito 2 debe contener solo letras.');
             return false;
        }

        setError('');
        return true;
    }, [tagline, summonerName, region, zodiacSign, favChamp1, favRole1, favChamp2, ROLES]);
  

    // 🚨 handleSuccess: Dispara el IPC y luego cambia el estado.
    const handleSuccess = (token) => {
        const userProfile = { 
            username: username, 
            token: token,
            summonerName: summonerName, 
            tagline: tagline, 
            region: region,
        };

        // 1. 🔑 CLAVE: ENVIAR IPC CON DATOS REALES E INMEDIATOS ANTES DE CAMBIAR EL ESTADO.
        if (window.electronAPI && window.electronAPI.send) {
            window.electronAPI.send('user-logged-in', { 
                username: userProfile.username, 
                token: userProfile.token 
            });
            console.log(`[FRONTEND] IPC DISPARADO CON TOKEN VÁLIDO. Usuario: ${userProfile.username}`);
        }

        // 2. Actualizar el contexto.
        setUserData(userProfile);
        
        // 3. Cambiar el estado de flujo.
        setFlowState(AppFlowState.DASHBOARD);
        console.log(`[FRONTEND] Login exitoso. Contexto actualizado. Transición a Dashboard.`);
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        
        if (isRegister && !validateRegistrationFields()) {
            return;
        }

        setError('');
        setSuccessMessage(''); 
        setIsLoading(true);

        const url = isRegister ? API_ENDPOINTS.REGISTER : API_ENDPOINTS.LOGIN;
        
        let body = isRegister ? { username, password, summonerName, tagline, region, zodiacSign, favChamp1, favChamp2: favChamp2 || null, favRole1, favRole2: favRole2 || null,} : { username, password };

        try {
            console.log(`[FRONTEND] Enviando petición a ${url} con el usuario: ${username}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            
            const data = await response.json();

            if (!response.ok) {
                console.error('[FRONTEND] Error de la API:', data.message);
                const apiErrorMsg = data.message || `Error ${response.status}: Revisa tus credenciales.`;
                setError(apiErrorMsg);
                return;
            }

            if (isRegister) {
                console.log('[FRONTEND] Registro exitoso.');
                setSuccessMessage('¡Cuenta creada! Por favor, inicia sesión.');
                setIsRegister(false);
            } else if (data.token) {
                handleSuccess(data.token);
            }

        } catch (networkError) {
            console.error('[FRONTEND] Error de red:', networkError);
            setError('No se pudo conectar al servidor. Verifica el Backend.');
        } finally {
            setIsLoading(false);
        }
    };

    // LÓGICA DEL BOTÓN SALIR
    const handleExit = () => {
        if (window.electronAPI && window.electronAPI.closeWindow) {
            window.electronAPI.closeWindow();
        } else {
            alert('Función de cierre no detectada. Cerrando...');
        }
    };
    // --------------------------------------------------------
    

    const baseClasses = "flex-grow p-4 border-b-2 transition-colors duration-300 flex items-center justify-center cursor-pointer";
    const activeClasses = "border-lol-accent-gold text-lol-accent-gold font-bold";
    const inactiveClasses = "border-transparent text-gray-500 hover:text-lol-accent-gold/70";

    return (
        <div className="flex items-center justify-center h-screen bg-transparent backdrop-blur-sm relative">
            
            {/* CONTENEDOR PRINCIPAL: lol-frame aplica -webkit-app-region: drag */}
            <div className="w-[560px] lol-frame shadow-[0_0_50px_rgba(197,181,142,0.3)] rounded-lg overflow-hidden border border-lol-accent-gold/30" style={{ padding: '0px', backgroundColor: '#091018' }}>
                
                {/* 🚨 Cabecera de Pestañas: pt-2 (Espacio mínimo superior) */}
                <div className="flex text-sm font-lol-title border-b border-lol-accent-gold/20 -webkit-app-region-drag pt-2">
                    {/* INICIAR SESIÓN (Texto en una sola línea) */}
                    <div
                        className={`${baseClasses} ${!isRegister ? activeClasses + ' border-2 border-b-0 border-lol-accent-gold' : inactiveClasses} whitespace-nowrap -webkit-app-region-no-drag`} 
                        onClick={() => { setIsRegister(false); setError(''); }}
                        style={{marginTop: '-2px'}} 
                    >
                        <LoginIcon />
                        INICIAR SESIÓN
                    </div>
                    {/* REGISTRARSE (Texto en una sola línea) */}
                    <div
                        className={`${baseClasses} ${isRegister ? activeClasses + ' border-2 border-b-0 border-lol-accent-gold' : inactiveClasses} whitespace-nowrap -webkit-app-region-no-drag`} 
                        onClick={() => { setIsRegister(true); setError(''); }} 
                        style={{marginTop: '-2px'}} 
                    >
                        <RegisterIcon />
                        REGISTRARSE
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleAuth} className="p-8 space-y-3"> {/* 🚨 space-y-3 para reducir el espacio vertical */}
                    {/* MARGEN SUPERIOR REDUCIDO: mb-1 */}
                    <h2 className="text-2xl lol-title text-center mb-1 uppercase tracking-wider">
                        {!isRegister ? 'ACCESO AL NEXO' : 'REGISTRO DE INVOCADOR'}
                    </h2>
                    
                    {/* 🚨 SOLUCIÓN PARA EVITAR REDIMENSIONAMIENTO (Altura y Ancho fijos) */}
                    <div className="w-full flex items-center justify-center"> {/* 🚨 Reducción de h-10 a h-8 para ahorrar espacio */}
                        {/* CRÍTICO: max-w-full y truncate para que el mensaje no expanda el ancho */}
                        {error && (<div className="p-1 px-4 text-sm text-red-400 bg-red-900/40 border border-red-400 rounded -webkit-app-region-no-drag max-w-full truncate whitespace-nowrap">{error}</div>)}
                            {successMessage && (<div className="p-1 px-4 text-sm text-green-400 bg-green-900/40 border border-green-400 rounded -webkit-app-region-no-drag max-w-full truncate whitespace-nowrap">{successMessage}</div>)}
                    </div>

                    {/* CAMPOS DE ENTRADA (Todos deben ser -webkit-app-region-no-drag) */}
                    <div><input type="text" placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                    <div><input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                    
                    {/* CAMPOS ADICIONALES PARA REGISTRO */}
                    {isRegister && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div><input type="text" placeholder="Nombre de Invocador *" value={summonerName} onChange={(e) => setSummonerName(e.target.value)} required className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                                <div><input type="text" placeholder="Tagline (TAG) *" value={tagline} onChange={(e) => setTagline(e.target.value)} required className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <select value={region} onChange={(e) => setRegion(e.target.value)} required className="custom-select bg-lol-input-bg text-white rounded-sm -webkit-app-region-no-drag">
                                    <option value="">Región *</option>
                                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <select value={zodiacSign} onChange={(e) => setZodiacSign(e.target.value)} required className="custom-select bg-lol-input-bg text-white rounded-sm -webkit-app-region-no-drag">
                                    <option value="">Signo Zodiacal *</option>
                                    {ZODIACS.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><input type="text" placeholder="Campeón Favorito 1 *" value={favChamp1} onChange={(e) => setFavChamp1(e.target.value)} required className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                                <div><input type="text" placeholder="Campeón Favorito 2 (Opcional)" value={favChamp2} onChange={(e) => setFavChamp2(e.target.value)} className="w-full p-3 bg-lol-input-bg text-white border border-lol-accent-gold/40 focus:border-lol-highlight outline-none rounded-sm -webkit-app-region-no-drag" /></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <select value={favRole1} onChange={(e) => setFavRole1(e.target.value)} required className="custom-select bg-lol-input-bg text-white rounded-sm -webkit-app-region-no-drag">
                                    <option value="">Rol Favorito 1 *</option>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <select value={favRole2} onChange={(e) => setFavRole2(e.target.value)} className="custom-select bg-lol-input-bg text-white rounded-sm -webkit-app-region-no-drag">
                                    <option value="">Rol Favorito 2 (Opcional)</option>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    
                    {/* Botón de Acción */}
                    <button
                        type="submit"
                        disabled={isLoading || !username || !password || (isRegister && (!summonerName || !tagline || !region || !zodiacSign || !favChamp1 || !favRole1))}
                        className="w-full py-3 mt-4 text-lg font-bold uppercase tracking-wider lol-button-gold -webkit-app-region-no-drag"
                        style={{ color: 'white', backgroundColor: 'transparent' }} 
                    >
                        {isLoading 
                            ? (!isRegister ? 'AUTENTICANDO...' : 'CREANDO CUENTA...')
                            : (!isRegister ? 'INICIAR SESIÓN' : 'REGISTRARSE')
                        }
                    </button>

                    {/* Enlace de recuperación */}
                    {!isRegister && (
                        <div className="text-center text-xs pt-2">
                            <a href="#" className="text-gray-400 hover:text-lol-accent-gold transition-colors duration-200 -webkit-app-region-no-drag">¿Olvidaste tu contraseña de la Grieta?</a>
                        </div>
                    )}
                    
                    {/* 🚨 BOTÓN SALIR AÑADIDO ABAJO DEL TODO */}
                    <button
                        type="button"
                        onClick={handleExit}
                        className="w-full py-3 mt-4 text-sm font-bold uppercase tracking-wider text-gray-400 border border-lol-grey-dark/50 hover:border-lol-gold transition-colors duration-200 -webkit-app-region-no-drag"
                        style={{ backgroundColor: 'transparent' }} 
                    >
                        SALIR DE LA APLICACIÓN
                    </button>
                </form>

            </div>
        </div>
    );
}