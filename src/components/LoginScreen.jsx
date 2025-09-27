// Ruta: src/components/AuthScreen.jsx
'use client';
import React, { useState } from 'react';
import { FaUser, FaLock, FaEnvelope, FaStar, FaGamepad, FaMapPin, FaAngleDown } from 'react-icons/fa';
import { useAppState } from '@/context/AppStateContext'; 

// Listas de datos para el formulario de registro (perfil IA)
const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const ZODIAC_SIGNS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
const RIOT_REGIONS = ['LAS', 'LAN', 'NA', 'EUW', 'EUNE', 'KR', 'JP']; 

export default function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Usamos useAppState para acceder a la función de establecer sesión.
  const { setUserSession } = useAppState(); 

  // CRÍTICO: La URL base de tu backend donde se despliegan las APIs
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000/api/auth'; 

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const endpoint = isRegister ? `${BACKEND_URL}/register` : `${BACKEND_URL}/login`;
    
    const dataToSend = isRegister ? {
        ...formData,
        role1: formData.role1 || '',
        role2: formData.role2 || '',
        champion1: formData.champion1 || '',
        champion2: formData.champion2 || '',
    } : formData;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegister) {
            alert('Registro exitoso. Por favor, inicia sesión.');
            setIsRegister(false);
            setFormData({}); // Limpiar formulario
        } else {
            // LOGIN EXITOSO: Llama a la función del contexto para guardar la sesión
            // Esto dispara el evento IPC 'user-logged-in' a main.js
            setUserSession(data.user.id, data.user.username);
        }
      } else {
        setError(data.message || `Error en ${isRegister ? 'Registro' : 'Login'}.`);
      }
    } catch (err) {
      console.error("Error de conexión:", err);
      setError('Error de conexión con el servidor. Verifica que el backend esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ name, icon: Icon, type = 'text', placeholder, required = true, isSelect = false, options = [] }) => (
    <div className="flex items-center bg-lol-blue-medium p-3 rounded-md border border-lol-gold-dark">
      <Icon className="text-lol-gold-light mr-3 flex-shrink-0" />
      {isSelect ? (
        <>
          <select 
            name={name} 
            value={formData[name] || ''} 
            onChange={handleChange} 
            required={required}
            className="w-full bg-transparent focus:outline-none text-lol-gold-light"
          >
            <option value="">{placeholder}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <FaAngleDown className="text-lol-gold-light ml-2" />
        </>
      ) : (
        <input
          type={type}
          name={name}
          placeholder={placeholder}
          value={formData[name] || ''}
          onChange={handleChange}
          required={required}
          className="w-full bg-transparent focus:outline-none text-lol-gold-light"
        />
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-lol-blue-dark/90 p-8 shadow-xl border-2 border-lol-gold-dark rounded-xl -webkit-app-region-drag">
      <h2 className="text-3xl font-display font-bold text-lol-gold text-center mb-6">
        {isRegister ? 'REGISTRO (Perfil IA)' : 'INICIAR SESIÓN'}
      </h2>

      {error && <p className="text-red-500 text-center mb-4 bg-red-900/50 p-2 rounded">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 -webkit-app-region-no-drag">
        {/* CAMPOS BASE (Login/Registro) */}
        <InputField name="username" icon={FaUser} placeholder="Nombre de Usuario (Login)" />
        <InputField name="email" icon={FaEnvelope} type="email" placeholder="Email" required={isRegister} />
        <InputField name="password" icon={FaLock} type="password" placeholder="Contraseña" />

        {/* CAMPOS ADICIONALES DE REGISTRO / PERFIL IA */}
        {isRegister && (
          <>
            <h3 className="text-lg font-display text-lol-blue-accent pt-4 border-t border-lol-gold-dark/50">Datos Esenciales para MetaMind</h3>
            
            <InputField name="zodiacSign" icon={FaStar} placeholder="-- Signo Zodiacal (Requerido) --" isSelect options={ZODIAC_SIGNS} />

            <div className="grid grid-cols-2 gap-2">
                <InputField name="riotName" icon={FaGamepad} placeholder="Riot Name (Ej. Summoner)" />
                <InputField name="riotTagline" icon={FaMapPin} placeholder="Tagline (Ej. #LAS)" />
            </div>
            
            <InputField name="region" icon={FaMapPin} placeholder="-- Región Riot --" isSelect options={RIOT_REGIONS} />

            {/* Roles Preferidos */}
            <div className="grid grid-cols-2 gap-2">
                <InputField name="role1" icon={FaStar} placeholder="-- Rol Preferido 1 --" isSelect options={ROLES} />
                <InputField name="role2" icon={FaStar} placeholder="-- Rol Preferido 2 (Opcional) --" isSelect options={ROLES} required={false} />
            </div>
            
            {/* Campeones Preferidos */}
            <div className="grid grid-cols-2 gap-2">
                <InputField name="champion1" icon={FaGamepad} placeholder="Campeón Favorito 1" />
                <InputField name="champion2" icon={FaGamepad} placeholder="Campeón Favorito 2 (Opcional)" required={false} />
            </div>
          </>
        )}

        <button type="submit" disabled={loading} className="w-full bg-lol-gold hover:bg-lol-gold-light text-lol-blue-dark font-bold py-3 rounded-md transition-colors disabled:opacity-50">
          {loading ? 'Cargando...' : isRegister ? 'REGISTRARME' : 'INICIAR SESIÓN'}
        </button>
      </form>
      
      <p className="mt-4 text-center text-sm text-lol-gold-light/70">
        {isRegister ? '¿Ya tienes una cuenta?' : '¿Necesitas una cuenta?'} 
        <button 
          type="button" 
          onClick={() => setIsRegister(!isRegister)} 
          className="text-lol-blue-accent hover:text-lol-gold-light ml-1 font-bold"
        >
          {isRegister ? 'Inicia Sesión' : 'Regístrate'}
        </button>
      </p>
    </div>
  );
}