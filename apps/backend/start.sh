#!/usr/bin/env bash
# Démarre l'Agrégateur de Paiement (Express — port 3000)
#
# Usage:
#   ./start.sh           # mode standard
#   ./start.sh --verify  # démarre puis vérifie /health
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../../scripts/lib/common.sh
source "$SCRIPT_DIR/../../../scripts/lib/common.sh"

VERIFY=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --verify) VERIFY=1 ;;
        -h|--help)
            echo "Usage: $0 [--verify]"
            exit 0 ;;
        *) echo "Option inconnue: $1"; exit 1 ;;
    esac
    shift
done

sl_info "Vérification des dépendances infra..."
mysqladmin ping &>/dev/null || { sl_warn "MariaDB down — lancez: scripts/start-mariadb.sh"; }
redis-cli -p "$SL_PORT_REDIS" ping &>/dev/null || { sl_warn "Redis down — lancez: scripts/start-redis.sh"; }

sl_start_aggregator "dev"

if [[ "$VERIFY" == "1" ]]; then
    sl_info "Attente health check..."
    if sl_wait_for_url "Aggregator" "http://localhost:$SL_PORT_AGGREGATOR/health" 30 2; then
        sl_ok "Agrégateur opérationnel"
    else
        sl_fail "Agrégateur non accessible — tail -f $SL_LOG_DIR/aggregator.log"
        exit 1
    fi
fi
