#!/bin/bash

# 모든 logos 서비스 시작
# Usage: ./scripts/start_all.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOGOS_ROOT="$(dirname "$PROJECT_DIR")"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             LogosAI 전체 서비스 시작                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# 1. ACP Server 확인 (이미 실행 중이어야 함)
echo "🤖 ACP Server 확인 중..."
if curl -s --max-time 3 http://localhost:8888/stream/multi 2>/dev/null | grep -q "query"; then
    echo "   ✅ ACP Server 실행 중"
else
    echo "   ⚠️  ACP Server가 실행되지 않았습니다."
    echo "   다음 명령으로 ACP Server를 먼저 시작하세요:"
    echo ""
    echo "   cd $LOGOS_ROOT/logosai/logosai/examples"
    echo "   python standalone_acp_server.py --enable-auto-agent-selection"
    echo ""
fi
echo ""

# 2. logos_api 시작
echo "⚙️  logos_api 시작 중..."
if [ -f "$LOGOS_ROOT/logos_api/scripts/start.sh" ]; then
    cd "$LOGOS_ROOT/logos_api"
    ./scripts/start.sh
else
    echo "   ❌ logos_api 시작 스크립트를 찾을 수 없습니다"
fi
echo ""

# 3. logos_web 시작
echo "🌐 logos_web 시작 중..."
cd "$PROJECT_DIR"
./scripts/start.sh
echo ""

# 상태 확인
sleep 2
echo ""
./scripts/status_all.sh
