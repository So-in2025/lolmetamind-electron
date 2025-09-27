"use client"
import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';

const ZODIAC_SIGNS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
const POSITIONS = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];
const REGIONS = ['NA1', 'EUW1', 'KR', 'LA1', 'LA2']; // Ejemplo de regiones

export default function OnboardingForm() {
    const { goToDashboard } = useAppState();
    const [formData, setFormData] = useState({
        summonerName: '',
        tagline: '',
        zodiacSign: '',
        region: 'LA2',
        positions: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePositionToggle = (position) => {
        setFormData(prev => {
            const newPositions = prev.positions.includes(position)
                ? prev.positions.filter(p => p !== position)
                : [...prev.positions, position];
            return { ...prev, positions: newPositions.slice(0, 2) }; // Limita a 2 posiciones
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (formData.positions.length === 0) {
            setError('Selecciona al menos una posición.');
            return;
        }

        setLoading(true);

        try {
            // 🚨 Envío al proceso principal (main.js) para análisis y guardado
            const result = await window.electronAPI.setSummonerProfile(formData);

            if (result.success) {
                // Si el backend procesa todo, pasamos al dashboard
                goToDashboard();
            } else {
                setError(`Error en el servidor: ${result.message}`);
            }
        } catch (e) {
            setError('Fallo de comunicación al configurar el perfil.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-8 bg-[#091018] bg-cover bg-center" style={{ backgroundImage: "url('/img/hero-bg.webp')" }}>
            <div className="p-8 bg-black bg-opacity-80 rounded-xl shadow-2xl w-full max-w-lg border-2 border-[#1E2A38]">
                <h1 className="text-3xl font-bold text-[#C5B58E] mb-2 text-center">Configuración Estratégica</h1>
                <p className="text-sm text-gray-400 mb-6 text-center">Completa los datos para iniciar tu análisis Hyper-Completo.</p>
                
                {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Nombre de Invocador y Tagline */}
                        <input name="summonerName" value={formData.summonerName} onChange={handleChange} placeholder="Nombre de Invocador" required 
                               className="bg-[#1E2A38] text-white p-3 rounded-lg border border-[#3A475C] focus:ring-[#C5B58E] focus:border-[#C5B58E]" />
                        <input name="tagline" value={formData.tagline} onChange={handleChange} placeholder="Tagline (ej: #LA1)" required 
                               className="bg-[#1E2A38] text-white p-3 rounded-lg border border-[#3A475C] focus:ring-[#C5B58E] focus:border-[#C5B58E]" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {/* Región */}
                        <select name="region" value={formData.region} onChange={handleChange} required
                                className="bg-[#1E2A38] text-white p-3 rounded-lg border border-[#3A475C] focus:ring-[#C5B58E] focus:border-[#C5B58E] appearance-none">
                            <option value="" disabled>Selecciona Región</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        
                        {/* Signo Zodiacal */}
                        <select name="zodiacSign" value={formData.zodiacSign} onChange={handleChange} required
                                className="bg-[#1E2A38] text-white p-3 rounded-lg border border-[#3A475C] focus:ring-[#C5B58E] focus:border-[#C5B58E] appearance-none">
                            <option value="" disabled>Selecciona Signo Zodiacal</option>
                            {ZODIAC_SIGNS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="pt-2">
                        <label className="block text-gray-300 mb-2">Posiciones Preferidas (Máx. 2):</label>
                        <div className="flex gap-3 justify-center">
                            {POSITIONS.map(pos => (
                                <button
                                    key={pos}
                                    type="button"
                                    onClick={() => handlePositionToggle(pos)}
                                    className={`py-2 px-4 rounded-full text-sm font-semibold transition duration-200 ${
                                        formData.positions.includes(pos)
                                            ? 'bg-[#C5B58E] text-[#091018]'
                                            : 'bg-[#1E2A38] text-gray-400 hover:bg-[#3A475C]'
                                    }`}
                                >
                                    {pos}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 px-4 rounded-lg text-lg font-bold mt-6 transition duration-300 ${
                            loading 
                            ? 'bg-[#1E2A38] text-gray-500 cursor-not-allowed'
                            : 'bg-[#C5B58E] text-[#091018] hover:bg-[#A9976D]'
                        }`}
                    >
                        {loading ? 'Procesando Análisis Inicial...' : 'Finalizar Configuración e Ir al Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}
