"use client"
import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';

export default function LoginScreen() {
    const { setIsAuthenticated, setProfile, setFlowState, AppFlowState } = useAppState();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        
        try {
            console.log('[AUTH FLOW] Solicitando ventana de autenticación a Electron...');
            const result = await window.electronAPI.signInGoogle();

            if (result.success) {
                console.log('[AUTH FLOW] Token recibido. Redirigiendo...');
                
                window.electronAPI.setSessionState({
                    isAuthenticated: true,
                    userToken: result.userToken,
                });
                
                setIsAuthenticated(true);

                if (result.isNewUser || !result.profileData) {
                    setFlowState(AppFlowState.ONBOARDING);
                } else {
                    setFlowState(AppFlowState.DASHBOARD);
                }
            } else {
                setError(`Fallo de autenticación: ${result.message}`);
                console.error('[AUTH FLOW] Error en el flujo de Electron:', result.message);
            }
        } catch (e) {
            setError('Error de comunicación durante la autenticación.');
            console.error('[AUTH FLOW] Error IPC/Catch:', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        // 🚨 Contenedor principal: Totalmente transparente y arrastrable
        <div 
            className="flex flex-col items-center justify-center h-screen w-full p-8" 
            style={{ 
                backgroundColor: 'transparent', 
                WebkitAppRegion: 'drag', // La ventana entera es arrastrable por el usuario
            }}
        >
            <div 
                 // 🚨 ESTILO ÉLITE: La caja de Login Flotante
                 className="p-10 bg-gray-900 bg-opacity-90 rounded-2xl shadow-2xl w-full max-w-md border-2 border-[#C5B58E] relative transition-all duration-500" 
                 style={{ 
                     backdropFilter: 'blur(10px)', 
                     boxShadow: '0 0 50px rgba(197, 181, 142, 0.4), 0 0 20px rgba(0, 0, 0, 0.7)',
                 }} 
            >
                
                {/* 🚨 CRÍTICO: Contenido Interactivo (Botón) debe tener WebkitAppRegion: 'no-drag' */}
                <div style={{ WebkitAppRegion: 'no-drag' }}>
                    
                    <div className="mb-8">
                        <h1 className="text-5xl font-bold text-[#C5B58E] mb-0.5 text-center tracking-widest uppercase font-sans">
                            META MIND
                        </h1>
                        <p className="text-sm text-gray-400 text-center tracking-widest uppercase">
                            Acceso de Coach Estratégico
                        </p>
                    </div>
                    
                    {/* BOTÓN DE LOGIN MEJORADO */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className={`w-full py-4 px-4 rounded-lg text-xl font-extrabold transition duration-300 transform hover:scale-[1.02] ${
                            loading 
                            ? 'bg-[#1E2A38] text-gray-500 cursor-not-allowed'
                            : 'bg-[#C5B58E] text-[#091018] hover:bg-[#A9976D] shadow-lg shadow-[#C5B58E]/40' 
                        } flex items-center justify-center space-x-3 uppercase`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-[#091018]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="ml-3">Cargando Módulos Estratégicos...</span>
                            </>
                        ) : (
                            <>
                                Iniciar Sesión con Google
                            </>
                        )}
                    </button>
                    
                    {error && <p className="text-red-400 text-sm mt-4 text-center p-2 bg-red-900 bg-opacity-30 rounded">{error}</p>}
                
                    <p className="text-xs text-gray-500 mt-6 text-center">
                        Utilizamos Google para asegurar su identidad.
                    </p>
                </div>
            </div>
        </div>
    );
}