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
            // 🚨 Llamada al proceso principal para iniciasr OAuth Web
            const result = await window.electronAPI.signInGoogle();

            if (result.success) {
                // Éxito: Guardamos el nuevo estado de sesión globalmente
                window.electronAPI.setSessionState({
                    isAuthenticated: true,
                    userToken: result.userToken,
                    // No necesitamos profileData aquí; lo obtendremos en el siguiente paso o desde el token.
                });
                
                setIsAuthenticated(true);

                // Decidir a dónde ir
                if (result.isNewUser || !result.profileData) {
                    setFlowState(AppFlowState.ONBOARDING);
                } else {
                    setFlowState(AppFlowState.DASHBOARD);
                }
            } else {
                setError(`Fallo de autenticación: ${result.message}`);
            }
        } catch (e) {
            setError('Error de comunicación durante la autenticación.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen w-full p-8 bg-[#091018] bg-cover bg-center" style={{ backgroundImage: "url('/img/background.webp')" }}>
            <div className="p-8 bg-black bg-opacity-70 rounded-xl shadow-2xl w-full max-w-sm border-2 border-[#1E2A38]">
                <h1 className="text-3xl font-bold text-[#C5B58E] mb-2 text-center">LolMetaMind</h1>
                <p className="text-sm text-gray-400 mb-6 text-center">Inicia sesión para activar tu Coach Estratégico.</p>
                
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-lg text-lg font-bold transition duration-300 ${
                        loading 
                        ? 'bg-[#1E2A38] text-gray-500 cursor-not-allowed'
                        : 'bg-[#C5B58E] text-[#091018] hover:bg-[#A9976D]'
                    } flex items-center justify-center`}
                >
                    {loading ? (
                        'Abriendo Ventana de Google...'
                    ) : (
                        <>
                            {/*  */}
                            Iniciar Sesión con Google
                        </>
                    )}
                </button>
                {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
            </div>
        </div>
    );
}
