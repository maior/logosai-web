#!/bin/bash

# logos_web 상태 확인 스크립트
# Usage: ./scripts/status.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/logs/logos_web.pid"
PORT=8010

echo "📊 logos_web 상태 확인"
echo "========================"

# PID 파일 확인
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ 상태: 실행 중"
        echo "   PID: $PID"
    else
        echo "⚠️  상태: PID 파일 있으나 프로세스 없음"
        rm -f "$PID_FILE"
    fi
else
    echo "❌ 상태: PID 파일 없음"
fi

# 포트 확인
echo ""
echo "🔌 포트 $PORT 상태:"
if lsof -i :$PORT > /dev/null 2>&1; then
    lsof -i :$PORT | head -5
else
    echo "   사용 중인 프로세스 없음"
fi

# Health check
echo ""
echo "🏥 Health Check:"
if curl -s --max-time 3 http://localhost:$PORT > /dev/null 2>&1; then
    echo "   ✅ http://localhost:$PORT 응답 정상"
else
    echo "   ❌ http://localhost:$PORT 응답 없음"
fi

# 관련 서비스 상태
echo ""
echo "📡 관련 서비스 상태:"

# logos_api (8090)
if curl -s --max-time 3 http://localhost:8090/health > /dev/null 2>&1; then
    echo "   ✅ logos_api (8090): 정상"
else
    echo "   ❌ logos_api (8090): 응답 없음"
fi

# ACP Server (8888)
if curl -s --max-time 3 http://localhost:8888/stream/multi 2>/dev/null | grep -q "query"; then
    echo "   ✅ ACP Server (8888): 정상"
else
    echo "   ❌ ACP Server (8888): 응답 없음"
fi

# 최근 로그
echo ""
echo "📝 최근 로그 (마지막 10줄):"
if [ -f "$PROJECT_DIR/logs/logos_web.log" ]; then
    tail -10 "$PROJECT_DIR/logs/logos_web.log"
else
    echo "   로그 파일 없음"
fi
