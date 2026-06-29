#!/usr/bin/env bash
# Démarre le Dashboard PSP Admin (Next.js — port 3001)
#
# Prérequis: Agrégateur sur le port 3000
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../scripts/lib/common.sh
source "$SCRIPT_DIR/../../../scripts/lib/common.sh"

agg_code=$(sl_diag_http "http://localhost:$SL_PORT_AGGREGATOR/health")
if [[ "$agg_code" != "200" ]]; then
    sl_warn "Agrégateur non actif (HTTP $agg_code) — lancez d'abord: apps/backend/start.sh"
fi

sl_start_psp_dashboard
sl_info "URL: http://localhost:$SL_PORT_PSP"
