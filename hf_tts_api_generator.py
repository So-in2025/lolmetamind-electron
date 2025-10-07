import sys
import os
import torch
import scipy.io.wavfile as wavfile
import numpy as np
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
# FUNCIÓN DE GENERACIÓN DE AUDIO
# ====================================================================
def generate_audio_local(text_to_speak, output_path):
    """Genera audio TTS localmente usando la librería Hugging Face Transformers."""
    
    # 1. Asegurarse de que el modelo esté cargado (la carga real solo ocurre la primera vez)
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
        
        # Convertir y guardar el audio WAV
        audio_data = output.cpu().numpy().squeeze()
        # Escalar a INT16 (formato estándar WAV)
        audio_data_int = (audio_data * 32767).astype(np.int16) 
        
        wavfile.write(output_path, rate=SAMPLING_RATE, data=audio_data_int)

        sys.stderr.write(f"[TTS GEN] ✅ Audio guardado correctamente en: {output_path}\n")
        return 0

    except Exception as e:
        sys.stderr.write(f"❌ ERROR DE GENERACIÓN: {e}\n")
        return 1

# ====================================================================
# PUNTO DE ENTRADA PRINCIPAL
# ====================================================================
if __name__ == "__main__":
    # OPTIMIZACIÓN: Añadimos un modo 'init' para pre-cargar el modelo sin generar audio.
    # Esto se llama desde main.js cuando la app de Electron arranca.
    if len(sys.argv) == 2 and sys.argv[1] == 'init':
        initialize_model()
        sys.exit(0)

    # Validación de argumentos para la generación de audio
    if len(sys.argv) < 3:
        sys.stderr.write("Uso: python hf_tts_api_generator.py '<texto>' '<ruta_salida.wav>'\n")
        sys.stderr.write("Uso alternativo para precarga: python hf_tts_api_generator.py init\n")
        sys.exit(1)

    text = sys.argv[1]
    output_path = sys.argv[2]
    
    # El modelo se inicializará automáticamente si no fue pre-cargado
    sys.exit(generate_audio_local(text, output_path))