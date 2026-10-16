#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
DURATION="${DURATION:-150}"

echo "==================================================="
echo "Starting StockPilot Load Test"
echo "Target Base URL: ${BASE_URL}"
echo "Duration:        ${DURATION} seconds"
echo "==================================================="

# 1. Once at start: create an item with unique SKU and issue stock
TIMESTAMP=$(date +%s)
SKU="LOAD-TEST-${TIMESTAMP}"
echo "[Init] Creating test item with SKU: ${SKU}"

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/items" \
  -H "Content-Type: application/json" \
  -d "{\"sku\":\"${SKU}\",\"name\":\"Load Test Bolt\",\"category\":\"Testing\",\"quantity\":100,\"reorder_level\":10,\"location\":\"Rack T-${TIMESTAMP}\"}" || true)

# Parse id using sed (without jq)
ITEM_ID=$(echo "${CREATE_RESPONSE}" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')

if [ -n "${ITEM_ID}" ]; then
  echo "[Init] Created item successfully with ID: ${ITEM_ID}"
  echo "[Init] Issuing stock to increment units_issued_total metric..."
  for i in 1 2 3 4 5; do
    curl -s -X POST "${BASE_URL}/api/items/${ITEM_ID}/issue" \
      -H "Content-Type: application/json" \
      -d '{"quantity":1}' > /dev/null || true
  done
  echo "[Init] Successfully issued stock 5 times."
else
  echo "[Warn] Could not extract item ID from create response. Response was: ${CREATE_RESPONSE}"
fi

# 2. Loop until DURATION elapses: sending ~100 requests across /api/items, /api/items/stats, /health
END_TIME=$((SECONDS + DURATION))
ROUND=1
TOTAL_REQUESTS=0

echo "[Load] Starting continuous traffic generation loop..."

while [ ${SECONDS} -lt ${END_TIME} ]; do
  REMAINING=$((END_TIME - SECONDS))
  echo "[Round ${ROUND}] Dispatching 100 requests with 4 concurrent workers (${REMAINING}s remaining)..."

  # Generate 100 request URLs (40x /api/items, 40x /api/items/stats, 20x /health)
  (
    for i in $(seq 1 40); do echo "${BASE_URL}/api/items"; done
    for i in $(seq 1 40); do echo "${BASE_URL}/api/items/stats"; done
    for i in $(seq 1 20); do echo "${BASE_URL}/health"; done
  ) | xargs -n 1 -P 4 curl -s -o /dev/null

  TOTAL_REQUESTS=$((TOTAL_REQUESTS + 100))
  ROUND=$((ROUND + 1))
  sleep 1
done

echo "==================================================="
echo "Load Test Completed Summary"
echo "Target Base URL:       ${BASE_URL}"
echo "Total Elapsed Time:    ${DURATION} seconds"
echo "Total Rounds:          $((ROUND - 1))"
echo "Total Requests Sent:   ~${TOTAL_REQUESTS}"
echo "==================================================="
