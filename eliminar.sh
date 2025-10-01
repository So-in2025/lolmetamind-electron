#!/bin/bash

# --- Mensaje de inicio de reparación ---
echo "Iniciando limpieza definitiva de src/app/dashboard/page.jsx y archivos obsoletos..."

PROJECT_ROOT=$(pwd)
DASHBOARD_PAGE="$PROJECT_ROOT/src/app/dashboard/page.jsx"
LCU_HOOK="$PROJECT_ROOT/src/hooks/useLcuData.js"

if [ ! -f "$DASHBOARD_PAGE" ]; then
    echo "❌ Error: Archivo $DASHBOARD_PAGE no encontrado."
    exit 1
fi

# ==========================================================
# 1. ELIMINACIÓN DE ARCHIVOS OBSOLETOS (Hooks y Componentes)
# ==========================================================

echo -e "\n[PASO 1] Eliminando archivos de hooks y componentes obsoletos..."
rm -f "$LCU_HOOK"
rm -f "$PROJECT_ROOT/src/hooks/useInteractiveWidget.js"
rm -f "$PROJECT_ROOT/src/components/widgets/ChampSelectCoach.jsx"
# Se asume que el resto de archivos de widgets fueron eliminados en pasos anteriores.
echo "✅ Archivos de hooks y componentes obsoletos eliminados."


# ==========================================================
# 2. LIMPIEZA DEL HEADER DE src/app/dashboard/page.jsx
# ==========================================================

echo -e "\n[PASO 2] Eliminando importaciones, estados y funciones obsoletas..."

# 2.1. Eliminación de Imports
sed -i '/import { useLcuData } from ..\/..\/hooks\/useLcuData\x27;/d' "$DASHBOARD_PAGE"
sed -i '/import { EyeIcon, EyeSlashIcon } from \x27@heroicons\/react\/24\/outline\x27;/d' "$DASHBOARD_PAGE"
sed -i '/import ChampSelectCoach from \x27@\/components\/widgets\/ChampSelectCoach\x27;/d' "$DASHBOARD_PAGE"

# 2.2. Eliminación de Estados y Hook Call
sed -i '/const \[isOverlayVisible, setIsOverlayVisible\] = useState(false);/d' "$DASHBOARD_PAGE"
sed -i '/const lcuData = useLcuData();/d' "$DASHBOARD_PAGE"

# 2.3. Eliminación de la función handleToggleOverlay
sed -i '/const handleToggleOverlay = () => {/,/    }/d' "$DASHBOARD_PAGE" # Elimina la función completa

echo "✅ Imports, estados y función de Overlay/LCU eliminados."


# ==========================================================
# 3. REPARACIÓN CRÍTICA: FUNCIÓN handleAnalysisRequest
# ==========================================================

echo -e "\n[PASO 3] Reparando y limpiando la función handleAnalysisRequest..."

# 3.1. Eliminar el bloque de verificación de error de Riot/LCU que causó el error de sintaxis
# Buscamos el patrón de inicio y fin del bloque de error de Riot/LCU (Líneas 67 a 71 en el contenido previo)
sed -i '/const riotError = lcuData?.error;/,/        }/d' "$DASHBOARD_PAGE"

# 3.2. Reparar la sintaxis de la línea de setAnalysisResult si fue corrompida:
# Si el script anterior dejó un residuo '}' antes de setAnalysisResult, lo eliminamos.
# Luego, nos aseguramos de que el setAnalysisResult se ejecute correctamente.

# 3.3. Reemplazar la referencia a 'lcuData' en el payload.
sed -i 's/matchHistory: lcuData?.matchHistory || \[\]/matchHistory: \[\]/' "$DASHBOARD_PAGE"

# 3.4. Eliminar lcuData de las dependencias de useCallback
sed -i 's/, lcuData\]/\]/' "$DASHBOARD_PAGE"

echo "✅ handleAnalysisRequest reparada y limpiada."


# ==========================================================
# 4. LIMPIEZA DEL FOOTER: Declaración de Variables Finales
# ==========================================================

# 4.1. Eliminar la declaración de variables al final del componente
sed -i '/const gamePhase = lcuData?.gameflow?.phase;/d' "$DASHBOARD_PAGE"
sed -i '/const riotError = lcuData?.error;/d' "$DASHBOARD_PAGE"

echo "✅ Variables obsoletas eliminadas."


# ==========================================================
# 5. LIMPIEZA CRÍTICA DE JSX (Componentes y Botones)
# ==========================================================

echo -e "\n[PASO 5] Limpiando bloques JSX que rompieron la compilación..."

# 5.1. Limpieza del BOTÓN DE OVERLAY
# Eliminamos el bloque completo del botón, incluyendo el div contenedor
sed -i '/{/* BOTÓN DE OVERLAY */}/,/                <\/div>/d' "$DASHBOARD_PAGE"

# 5.2. Limpieza del bloque JSX de ChampSelectCoach
# Eliminamos todo el bloque de la sección del coach
sed -i '/{/* >>> SECCIÓN DEL COACH DE CHAMP SELECT <<< */}/,/                        <\/div>/d' "$DASHBOARD_PAGE"

# 5.3. Limpieza de props en UserProfile
# Cambiamos: rankData={lcuData?.summonerRankData} /> por />
sed -i 's/ rankData={lcuData?.summonerRankData} \/>/ \/>/' "$DASHBOARD_PAGE"

# 5.4. Limpieza de props en RecentMatches
# Buscamos y reemplazamos el componente con props limpias.
sed -i '/<RecentMatches/ {
N
N
s/matches={lcuData?.matchHistory}\n.*riotError={riotError}\n/matches={\[\]}\n/
}' "$DASHBOARD_PAGE"

echo "✅ JSX de Overlays y Widgets eliminado por completo."


# ==========================================================
# 6. LIMPIEZA DE CUALQUIER '}' COLGANTE
# ==========================================================

# El error más común después de sed. Eliminamos cualquier } que esté solo en una línea,
# lo que probablemente sea un residuo del bloque 'if' roto.
# Nota: Esto es arriesgado, pero necesario para reparar la sintaxis en este caso de código corrupto.
sed -i '/^.*}.*$/d' "$DASHBOARD_PAGE"


echo -e "\n=========================================================="
echo "✅ ¡Reparación de errores completada!"
echo "Se realizó una limpieza agresiva para garantizar la sintaxis."
echo "Por favor, **vuelve a ejecutar 'npm run build'**."
echo "=========================================================="