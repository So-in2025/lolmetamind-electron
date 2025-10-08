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
from typing import Optional, Union # 🚨 MEJORA: Import para type hinting

# ====================================================================
# CONFIGURACIÓN DEL MODELO Y CONSTANTES
# ====================================================================

# Se recomienda un modelo más actual si la calidad de la prosodia es clave.
# MODEL_ID = "lince-ai/whisper-large-v2-spanish-speech-synthesis" 
MODEL_ID: str = "facebook/mms-tts-spa"
DEVICE: str = "cuda" if torch.cuda.is_available() else "cpu"

# 🚨 MEJORA: Límite de caracteres para evitar errores de Out-of-Memory (OOM) o timeouts.
MAX_TEXT_LENGTH: int = 300 

# Variables globales para almacenar el modelo y evitar recargas
model: Optional[VitsModel] = None
tokenizer: Optional[AutoTokenizer] = None
SAMPLING_RATE: Optional[int] = None


# ====================================================================
# FUNCIÓN DE INICIALIZACIÓN (Carga el modelo una sola vez por proceso)
# ====================================================================
def initialize_model() -> None:
    """Carga el modelo y el tokenizer globalmente si aún no están cargados."""
    global model, tokenizer, SAMPLING_RATE
    if model is None:
        try:
            # 🚨 MEJORA: Usar print(file=sys.stderr) para logs más idiomáticos.
            print(f"[TTS INIT] Iniciando carga de modelo VITS/MMS-TTS en {DEVICE}...", file=sys.stderr)
            
            model = VitsModel.from_pretrained(MODEL_ID).to(DEVICE)
            tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            SAMPLING_RATE = model.config.sampling_rate
            
            print(f"[TTS INIT] ✅ Modelo cargado correctamente con Sampling Rate: {SAMPLING_RATE}.", file=sys.stderr)
            
        except RuntimeError as e:
            # 🚨 MEJORA: Captura de errores específicos de PyTorch (incluyendo OOM o problemas de CUDA).
            print(f"❌ ERROR CRÍTICO AL CARGAR MODELO (Runtime/Device): {e}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            # Captura de errores de otro tipo (e.g., descarga de modelo fallida)
            print(f"❌ ERROR CRÍTICO AL CARGAR MODELO (General): {e}", file=sys.stderr)
            sys.exit(1)

# ====================================================================
# FUNCIÓN DE GENERACIÓN DE AUDIO (MODIFICADA: A MEMORIA)
# ====================================================================
# 🚨 CAMBIO: Se eliminó el argumento 'output_path'
def generate_audio_local(text_to_speak: str) -> int:
    """Genera audio TTS localmente usando memoria y lo imprime codificado en Base64."""
    
    # 1. Asegurarse de que el modelo esté cargado
    initialize_model()

    if not text_to_speak or not text_to_speak.strip():
        print("❌ ERROR: Texto vacío o solo espacios.", file=sys.stderr)
        return 1
    
    # 🚨 MEJORA: Validación de longitud del texto para evitar OOM
    if len(text_to_speak) > MAX_TEXT_LENGTH:
        print(f"❌ ERROR: Texto demasiado largo ({len(text_to_speak)} chars). Máximo permitido: {MAX_TEXT_LENGTH} chars.", file=sys.stderr)
        return 1

    try:
        print(f"[TTS GEN] Tokenizando y generando audio para: {text_to_speak[:60]}...", file=sys.stderr)
        
        # Generación usando el modelo global
        inputs = tokenizer(text_to_speak, return_tensors="pt").to(DEVICE)
        
        with torch.no_grad():
            output = model(**inputs).waveform
        
        # Convertir y escalar el audio
        audio_data = output.cpu().numpy().squeeze()
        
        # 🚨 MEJORA CRÍTICA: Prevenir clipping. Se usa np.clip para forzar el rango a [-1.0, 1.0].
        audio_data_clamped = np.clip(audio_data, -1.0, 1.0)
        
        # Escalar a INT16 (formato estándar WAV)
        audio_data_int = (audio_data_clamped * 32767).astype(np.int16) 
        
        # 🚨 CAMBIO CRÍTICO: Usar un buffer en memoria para la salida WAV
        buffer = io.BytesIO()
        # Nota: SAMPLING_RATE ya está garantizado como int por initialize_model()
        wavfile.write(buffer, rate=SAMPLING_RATE, data=audio_data_int)
        buffer.seek(0) # Resetear la posición del buffer
        
        # 🚨 CRÍTICO: Codificar y enviar a stdout
        base64_audio = base64.b64encode(buffer.read()).decode('utf-8')
        sys.stdout.write(base64_audio)
        
        # 🟢 SOLUCIÓN AL TRUNCAMIENTO: Forzar el vaciado del buffer de salida.
        sys.stdout.flush() 

        print(f"[TTS GEN] ✅ Audio generado en memoria y enviado a stdout (Base64).", file=sys.stderr)
        return 0

    except Exception as e:
        print(f"❌ ERROR DE GENERACIÓN: {e}", file=sys.stderr)
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
        print("Uso: python hf_tts_api_generator.py '<texto>'", file=sys.stderr)
        print("Uso alternativo para precarga: python hf_tts_api_generator.py init", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1]
    
    # 🚨 CAMBIO: Se elimina el output_path del argumento
    sys.exit(generate_audio_local(text))
