#!/bin/bash
# scripts/qa-motion-haptic.sh
# Protocolo QA Torneos · Fase 0 (Sanity de la capa base).
# Correr antes de cada release del módulo torneos.
set -e

echo "→ Buscando navigator.vibrate fuera de haptic.ts..."
HITS=$(grep -rn "navigator\.vibrate" src/ --include="*.ts" --include="*.tsx" | grep -v "lib/feedback/haptic.ts" || true)
if [ -n "$HITS" ]; then
  echo "❌ FAIL: navigator.vibrate fuera de haptic.ts:"
  echo "$HITS"
  exit 1
fi
echo "✓ navigator.vibrate centralizado"

echo "→ Verificando @keyframes en index.css..."
COUNT=$(grep -c "@keyframes" src/index.css)
if [ "$COUNT" -lt 8 ]; then
  echo "❌ FAIL: menos de 8 @keyframes en index.css (encontrados: $COUNT)"
  exit 1
fi
echo "✓ $COUNT @keyframes en index.css"

echo "→ Verificando @keyframes en componentes (deben estar centralizados)..."
COMP_KF=$(grep -rn "@keyframes" src/components/ || true)
if [ -n "$COMP_KF" ]; then
  echo "❌ FAIL: @keyframes encontrado en componentes (debe vivir en index.css):"
  echo "$COMP_KF"
  exit 1
fi
echo "✓ sin @keyframes en componentes"

echo "→ Verificando override de reduced-motion..."
if ! grep -q "prefers-reduced-motion: reduce" src/index.css; then
  echo "❌ FAIL: sin override @media (prefers-reduced-motion: reduce)"
  exit 1
fi
echo "✓ override presente"

echo "→ Buscando hex hardcoded fuera de tokens..."
HEX=$(grep -rn "#[0-9a-fA-F]\{6\}" src/components/tournaments src/components/feedback 2>/dev/null | grep -v "// allowed" || true)
if [ -n "$HEX" ]; then
  echo "⚠️  WARN: hex hardcoded encontrados (revisar manualmente):"
  echo "$HEX"
fi

echo "✅ Sanity checks pasados"