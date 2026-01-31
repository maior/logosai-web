#!/bin/bash

# logos_web 전체 서비스 상태 확인
# Usage: ./scripts/status_all.sh

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             LogosAI 웹 서비스 상태 확인                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# logos_web (8010)
echo "🌐 logos_web (Frontend) - Port 8010"
echo "─────────────────────────────────────"
if curl -s --max-time 3 http://localhost:8010 > /dev/null 2>&1; then
    echo "   ✅ 상태: 정상"
    echo "   📍 URL: http://localhost:8010"
else
    echo "   ❌ 상태: 응답 없음"
fi
echo ""

# logos_api (8090)
echo "⚙️  logos_api (Backend) - Port 8090"
echo "─────────────────────────────────────"
HEALTH=$(curl -s --max-time 3 http://localhost:8090/health 2>/dev/null)
if [ -n "$HEALTH" ]; then
    echo "   ✅ 상태: 정상"
    echo "   📍 URL: http://localhost:8090"
    echo "   📖 Docs: http://localhost:8090/docs"
else
    echo "   ❌ 상태: 응답 없음"
fi
echo ""

# ACP Server (8888)
echo "🤖 ACP Server (Agent Runtime) - Port 8888"
echo "─────────────────────────────────────"
ACP_CHECK=$(curl -s --max-time 3 http://localhost:8888/stream/multi 2>/dev/null)
if echo "$ACP_CHECK" | grep -q "query"; then
    echo "   ✅ 상태: 정상"
    echo "   📍 URL: http://localhost:8888"
else
    echo "   ❌ 상태: 응답 없음"
fi
echo ""

# 연결 상태
echo "🔗 서비스 연결 상태"
echo "─────────────────────────────────────"
CHAT_HEALTH=$(curl -s --max-time 5 http://localhost:8090/api/v1/chat/health 2>/dev/null)
if [ -n "$CHAT_HEALTH" ]; then
    echo "   $CHAT_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"   Chat Service: {d.get('chat_service','?')}\"); print(f\"   ACP Server: {d.get('acp_server','?')}\")" 2>/dev/null || echo "   $CHAT_HEALTH"
fi
echo ""

# 요약
echo "═══════════════════════════════════════════════════════════════"
ALL_OK=true
curl -s --max-time 2 http://localhost:8010 > /dev/null 2>&1 || ALL_OK=false
curl -s --max-time 2 http://localhost:8090/health > /dev/null 2>&1 || ALL_OK=false
curl -s --max-time 2 http://localhost:8888/stream/multi 2>/dev/null | grep -q "query" || ALL_OK=false

if [ "$ALL_OK" = true ]; then
    echo "🎉 모든 서비스 정상 작동 중!"
    echo ""
    echo "👉 브라우저에서 http://localhost:8010 접속하세요"
else
    echo "⚠️  일부 서비스가 비정상입니다. 로그를 확인하세요."
fi
