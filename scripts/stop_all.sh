#!/bin/bash

# 모든 logos 서비스 중지
# Usage: ./scripts/stop_all.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOGOS_ROOT="$(dirname "$PROJECT_DIR")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             LogosAI 전체 서비스 중지                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. logos_web 중지
echo "🌐 logos_web 중지 중..."
cd "$PROJECT_DIR"
./scripts/stop.sh
echo ""

# 2. logos_api 중지
echo "⚙️  logos_api 중지 중..."
if [ -f "$LOGOS_ROOT/logos_api/scripts/stop.sh" ]; then
    cd "$LOGOS_ROOT/logos_api"
    ./scripts/stop.sh
else
    echo "   logos_api 중지 스크립트 없음, pkill 사용"
    pkill -f "uvicorn.*8090" 2>/dev/null
fi
echo ""

echo "✅ 서비스 중지 완료"
echo ""
echo "⚠️  ACP Server는 별도로 중지해야 합니다:"
echo "   pkill -f standalone_acp_server"
