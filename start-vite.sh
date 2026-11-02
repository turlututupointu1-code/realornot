#!/bin/bash
cd "$(dirname "$0")"

EXISTING_PID=$(pgrep -f "$(pwd)/node_modules/.bin/vite")

if [ -n "$EXISTING_PID" ]; then
  echo "=== Un serveur Vite tourne déjà (PID $EXISTING_PID), fermeture... ==="
  kill $EXISTING_PID
  sleep 1
  if kill -0 $EXISTING_PID 2>/dev/null; then
    kill -9 $EXISTING_PID
  fi
  echo "Ancien serveur fermé."
fi

echo "=== Démarrage de Vite ==="
npm run dev
