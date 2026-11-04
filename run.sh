#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

echo "=========================================================="
echo "  국군수송사령부 국군수송중앙교회 통합 사역 포털 서버 시작"
echo "  접속 주소: http://127.0.0.1:5001"
echo "  목회자/관리자 PIN: 1111"
echo "=========================================================="

./venv/bin/python app.py
