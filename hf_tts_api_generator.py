# so-in2025/lolmetamind-electron/lolmetamind-electron-0544ff2629c04497534e891234a018ee815c1dd7/hf_tts_api_generator.py
import sys
import os
import torch
import scipy.io.wavfile as wavfile
import numpy as np
# 🚨 PRO-DEV: Imports para manejo de datos en memoria y codificación Base64
import io
import base64
from transformers import VitsModel, AutoTokenizer

# ====================================================================
# CONFIGURACIÓN DEL MODELO
# ====================================================================

# Se recomienda un modelo más actual si la calidad de la prosodia es clave.
# MODEL_ID = "lince-ai/whisper-large-v2-spanish-speech-synthesis" 
MODEL_ID = "facebook/mms-tts-spa"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Variables globales para almacenar el modelo y evitar recargas
model = None
tokenizer = None
SAMPLING_RATE = None


# ====================================================================
# FUNCIÓN DE INICIALIZACIÓN (Carga el modelo una sola vez por proceso)
# ====================================================================
def initialize_model():
    """Carga el modelo y el tokenizer globalmente si aún no están cargados."""
    global model, tokenizer, SAMPLING_RATE
    if model is None:
        try:
            sys.stderr.write(f"[TTS INIT] Iniciando carga de modelo VITS/MMS-TTS en {DEVICE}...\n")
            model = VitsModel.from_pretrained(MODEL_ID).to(DEVICE)
            tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            SAMPLING_RATE = model.config.sampling_rate
            sys.stderr.write(f"[TTS INIT] ✅ Modelo cargado correctamente con Sampling Rate: {SAMPLING_RATE}.\n")
        except Exception as e:
            sys.stderr.write(f"❌ ERROR CRÍTICO AL CARGAR MODELO: {e}\n")
            sys.exit(1)

# ====================================================================
# FUNCIÓN DE GENERACIÓN DE AUDIO (MODIFICADA: A MEMORIA)
# ====================================================================
# 🚨 CAMBIO: Se eliminó el argumento 'output_path'
def generate_audio_local(text_to_speak):
    """Genera audio TTS localmente usando memoria y lo imprime codificado en Base64."""
    
    # 1. Asegurarse de que el modelo esté cargado
    initialize_model()

    if not text_to_speak or not text_to_speak.strip():
        sys.stderr.write("❌ ERROR: Texto vacío o solo espacios.\n")
        return 1

    try:
        sys.stderr.write(f"[TTS GEN] Tokenizando y generando audio para: {text_to_speak[:60]}...\n")
        
        # Generación usando el modelo global
        inputs = tokenizer(text_to_speak, return_tensors="pt").to(DEVICE)
        
        with torch.no_grad():
            output = model(**inputs).waveform
        
        # Convertir y escalar el audio
        audio_data = output.cpu().numpy().squeeze()
        # Escalar a INT16 (formato estándar WAV)
        audio_data_int = (audio_data * 32767).astype(np.int16) 
        
        # 🚨 CAMBIO CRÍTICO: Usar un buffer en memoria para la salida WAV
        buffer = io.BytesIO()
        wavfile.write(buffer, rate=SAMPLING_RATE, data=audio_data_int)
        buffer.seek(0) # Resetear la posición del buffer
        
        # 🚨 CRÍTICO: Codificar y enviar a stdout
        base64_audio = base64.b64encode(buffer.read()).decode('utf-8')
        sys.stdout.write(base64_audio)

        sys.stderr.write(f"[TTS GEN] ✅ Audio generado en memoria y enviado a stdout (Base64).\n") # 🚨 LOG ACTUALIZADO
        return 0

    except Exception as e:
        sys.stderr.write(f"❌ ERROR DE GENERACIÓN: {e}\n")
        return 1

# ====================================================================
# PUNTO DE ENTRADA PRINCIPAL (MODIFICADO)
# ====================================================================
if __name__ == "__main__":
    # OPTIMIZACIÓN: Añadimos un modo 'init' para pre-cargar el modelo sin generar audio.
    # Esto se llama desde main.js cuando la app de Electron arranca.
    if len(sys.argv) == 2 and sys.argv[1] == 'init':
        initialize_model()
        sys.exit(0)

    # Validación de argumentos para la generación de audio
    # 🚨 CAMBIO: Solo se necesita un argumento (el texto)
    if len(sys.argv) < 2:
        sys.stderr.write("Uso: python hf_tts_api_generator.py '<texto>'\n")
        sys.stderr.write("Uso alternativo para precarga: python hf_tts_api_generator.py init\n")
        sys.exit(1)

    text = sys.argv[1]
    
    # 🚨 CAMBIO: Se elimina el output_path del argumento
    sys.exit(generate_audio_local(text))