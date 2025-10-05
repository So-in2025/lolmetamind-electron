import requests
import sys
import os

# ====================================================================
# CONFIGURACIÓN DEL MODELO Y TOKEN
# ====================================================================

API_TOKEN = os.environ.get("HUGGING_FACE_TOKEN", "").strip()

# 🔊 Modelo TTS público y activo en español
API_URL = "https://api-inference.huggingface.co/models/facebook/mms-tts-spa"

# ====================================================================
# FUNCIÓN DE LLAMADA A LA API
# ====================================================================

def generate_audio(text_to_speak, output_path):
    """Llama a la API de Hugging Face y guarda el audio WAV."""
    
    if not API_TOKEN:
        sys.stderr.write("❌ ERROR: Token de Hugging Face no configurado.\n")
        return 1

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    payload = {"inputs": text_to_speak}

    try:
        sys.stderr.write(f"[HF_API] Solicitando audio TTS para: {text_to_speak[:60]}...\n")
        response = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()

        # Guardar el audio recibido
        with open(output_path, "wb") as f:
            f.write(response.content)

        sys.stderr.write(f"[HF_API] ✅ Audio generado correctamente: {output_path}\n")
        return 0

    except requests.exceptions.RequestException as e:
        sys.stderr.write(f"❌ ERROR API: {e}\n")
        if hasattr(e, "response") and e.response is not None:
            sys.stderr.write(f"⚠️ Código de estado: {e.response.status_code}\n")
            if e.response.status_code == 503:
                sys.stderr.write("El modelo está cargándose. Reintento necesario.\n")
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stderr.write("Uso: python tts_hf.py '<texto>' '<ruta_salida.wav>'\n")
        sys.exit(1)

    text = sys.argv[1]
    output_path = sys.argv[2]
    sys.exit(generate_audio(text, output_path))
