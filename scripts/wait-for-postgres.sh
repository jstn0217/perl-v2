#!/bin/sh
set -eu

HOST="${DB_HOST:-postgres}"
PORT="${DB_PORT:-5432}"
TIMEOUT_SECONDS="${DB_WAIT_TIMEOUT_SECONDS:-60}"
START_TIME="$(date +%s)"

echo "Waiting for the database at ${HOST}:${PORT} ..."

while true; do
  if node -e "
    const net = require('net');
    const socket = net.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) });
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.end(); process.exit(0); });
    socket.on('timeout', () => { socket.destroy(); process.exit(1); });
    socket.on('error', () => process.exit(1));
  "; then
    echo "The database is reachable at ${HOST}:${PORT}."
    exit 0
  fi

  NOW="$(date +%s)"
  ELAPSED="$((NOW - START_TIME))"
  if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
    echo "Timed out waiting for the database after ${TIMEOUT_SECONDS}s." >&2
    exit 1
  fi

  sleep 2
done
