import torch
import os
import sys
from TTS.api import TTS

# ===================================================
# 🗣️ CONFIGURACIÓN DEL COACH MASCULINO ESPAÑOL
# ===================================================
MODELO_TTS = "tts_models/es/mai/vits" 
SPEAKER_ID = "p335" 
TEXTO_PRUEBA = "¡El entorno por fin está estable! Tu Coach Meta Mind está preparado para ofrecerte un análisis estratégico y crucial para la victoria."
IDIOMA = "es"
OUTPUT_DIR = "output_vits_coach_test"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "coach_audio_final.wav")
SPEED_RATE = 0.8
PITCH_RATE = 1.05  
# ===================================================

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[INFO] Usando dispositivo: {device.upper()}")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Carga del modelo (Esto debe resolver el KeyError 'vits') ---
try:
    print(f"[INFO] Cargando modelo VITS: {MODELO_TTS}")
    # Usamos la sintaxis directa con las versiones forzadas.
    tts = TTS(MODELO_TTS).to(device)
    
    # Selecciona el speaker
    if tts.is_multi_speaker and tts.speakers:
        if SPEAKER_ID not in tts.speakers:
             SPEAKER_ID = tts.speakers[0]
             print(f"[INFO] Advertencia: Usando el primer speaker disponible: {SPEAKER_ID}")

    print("✅ Modelo VITS cargado con éxito. Comenzando descarga de ~1GB.")

    # Generación de voz
    tts.tts_to_file(
        text=TEXTO_PRUEBA,
        speaker=SPEAKER_ID,
        language=IDIOMA,
        file_path=OUTPUT_FILE,
        speed=SPEED_RATE,  
        pitch=PITCH_RATE
    )
    
    print("-" * 50)
    print(f"🎉 ÉXITO: Archivo generado en: {os.path.abspath(OUTPUT_FILE)}")
    print("-" * 50)

except Exception as e:
    print("-" * 50)
    print(f"❌ ERROR CRÍTICO FINAL. El entorno no pudo cargar el modelo.")
    print(f"Detalle del error: {e}")
    print("La única solución restante es probar con una versión diferente de Python (3.10 o 3.9).")
    print("-" * 50)
    sys.exit(1)

