"""
Database configuration and initial seed data for 국군수송중앙교회 (국군수송사령부)
"""
import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'church.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(force_reseed=False):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 목회자 프로필 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS pastors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        role TEXT NOT NULL,
        verse TEXT,
        greeting TEXT,
        image_url TEXT,
        email TEXT,
        order_num INTEGER DEFAULT 0
    )
    ''')

    # 2. 정기 예배 및 모임 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS regular_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        day_of_week TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        location TEXT NOT NULL,
        target_group TEXT NOT NULL,
        description TEXT
    )
    ''')

    # 3. 특별 행사 및 교육 접수 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        date_info TEXT NOT NULL,
        location TEXT NOT NULL,
        max_capacity INTEGER DEFAULT 50,
        current_capacity INTEGER DEFAULT 0,
        deadline TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'OPEN'
    )
    ''')

    # 4. 행사 참가 신청자 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS event_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        unit TEXT NOT NULL,
        rank TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        meal_included INTEGER DEFAULT 1,
        memo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id)
    )
    ''')

    # 5. 상담 가능 시간 설정 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS counseling_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
    )
    ''')

    # 6. 상담 신청 내역 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS counseling_appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_name TEXT NOT NULL,
        is_anonymous INTEGER DEFAULT 0,
        unit TEXT,
        rank TEXT,
        phone TEXT NOT NULL,
        passcode TEXT NOT NULL,
        counsel_date TEXT NOT NULL,
        counsel_time TEXT NOT NULL,
        category TEXT NOT NULL,
        topic TEXT,
        status TEXT DEFAULT 'PENDING',
        pastor_notes TEXT,
        gcal_synced INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 7. 주말 위문 방문 신청 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS visitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_date TEXT NOT NULL UNIQUE,
        service_type TEXT NOT NULL,
        group_name TEXT NOT NULL,
        representative_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        visitor_count INTEGER NOT NULL,
        vehicle_count INTEGER DEFAULT 1,
        refreshment_details TEXT,
        request_details TEXT,
        status TEXT DEFAULT 'PENDING',
        approval_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 8. 후원 계좌 통보 및 약정 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_name TEXT NOT NULL,
        amount INTEGER,
        purpose TEXT NOT NULL,
        deposit_date TEXT NOT NULL,
        phone TEXT,
        prayer_request TEXT,
        is_checked INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 9. 사이트 기본 설정
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    conn.commit()

    if force_reseed:
        cursor.execute('DELETE FROM pastors')
        cursor.execute('DELETE FROM regular_services')
        cursor.execute('DELETE FROM events')
        cursor.execute('DELETE FROM settings')
        seed_data(cursor)
        conn.commit()
    else:
        cursor.execute('SELECT COUNT(*) FROM pastors')
        if cursor.fetchone()[0] == 0:
            seed_data(cursor)
            conn.commit()

    conn.close()

def seed_data(cursor):
    # 1. 국군수송중앙교회 목회자 3인 프로필
    pastors = [
        (
            '김요한 목사',
            '담임 군종목사 (소령)',
            '국군수송중앙교회 총괄 및 수송사령부 장병 심리·신앙 상담',
            '“여호와는 나의 목자시니 내게 부족함이 없으리로다 (시 23:1)”',
            '국군수송사령부 육·해·공 모든 수송 장병과 군 가족들이 하나님의 은혜 안에서 안전하게 임무를 완수하고, 평안한 군생활을 누리도록 늘 곁에서 기도하고 섬기겠습니다.',
            '/static/images/pastor1.svg',
            'pastor.kim@transcom.mil.kr',
            1
        ),
        (
            '이바울 목사',
            '부목사 (대위)',
            '주일 예배 찬양 사역 및 청년 수송 장병 영성 지도',
            '“비전이 있는 백성은 결코 지치지 아니하느니라 (잠 29:18)”',
            '전국 각지에서 수송 임무를 감당하는 청년 장병들이 주일마다 예배를 통해 영적 충전과 참된 쉼을 얻을 수 있도록 뜨겁게 찬양하고 격려합니다.',
            '/static/images/pastor2.svg',
            'pastor.lee@transcom.mil.kr',
            2
        ),
        (
            '박사무엘 목사',
            '교육 및 위문 협력 목사',
            '수송 장병 세례 교육 및 전국 교회 위문·후원 총괄',
            '“내가 네 길을 가르쳐 보이고 너를 주목하여 훈계하리로다 (시 32:8)”',
            '수송사령부를 찾아주시는 전국 선교단체와 교회의 따뜻한 위문 발걸음을 정성껏 맞이하고, 장병들의 세례 교육과 신앙 성장을 지도합니다.',
            '/static/images/pastor3.svg',
            'pastor.park@transcom.mil.kr',
            3
        )
    ]
    cursor.executemany('''
    INSERT INTO pastors (name, title, role, verse, greeting, image_url, email, order_num)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', pastors)

    # 2. 정기 예배 및 모임
    services = [
        ('주일 대예배 (1부)', '매주 주일', '오전 09:30', '국군수송중앙교회 본당 2층', '전 수송 장병 및 군 가족', '장병 중심의 활기찬 찬양과 복음 말씀 예배'),
        ('주일 은혜예배 (2부)', '매주 주일', '오전 11:00', '국군수송중앙교회 본당 2층', '간부, 군 가족 및 외부 위문팀', '영적 회복과 헌신을 위한 온 세대 연합 예배'),
        ('수요 영성 기도회', '매주 수요일', '저녁 19:30', '본당 1층 소예배실', '찬양대 및 기도를 사모하는 장병', '한 주간의 고된 수송 임무 속에서 영혼을 치유하는 중보기도회'),
        ('새벽 날개 기도회', '월~금', '오전 06:00', '본당 1층 소예배실', '누구나 참여 가능', '하루의 안전 수송과 평안을 구하는 새벽 묵상'),
        ('토요 수송 비전 성경공부', '매주 토요일', '오후 14:00', '교육관 1층 나눔방', '세례 희망자 및 청년부', '초신자를 위한 알기 쉬운 성경 개론 및 친교 모임')
    ]
    cursor.executemany('''
    INSERT INTO regular_services (title, day_of_week, time_slot, location, target_group, description)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', services)

    # 3. 특별 행사 및 교육
    events = [
        (
            '2026 전반기 국군수송사령부 장병 세례(침례)식',
            '세례/신앙',
            '2026년 11월 29일(일) 11:00',
            '국군수송중앙교회 본당 2층',
            60,
            28,
            '2026-11-25',
            '세례를 통해 주님의 자녀로 거듭나는 복된 예식입니다. 세례자 전원에게 성경책, 고급 십자가 목걸이, 특별 축하 선물이 증정됩니다.',
            'OPEN'
        ),
        (
            '동계 수송 장병 영성 수련회 & 찬양 콘서트',
            '수련회/집회',
            '2026년 12월 19일(토) 13:00~18:00',
            '국군수송중앙교회 본당 및 교육관',
            120,
            92,
            '2026-12-15',
            '외부 초청 찬양사역팀의 콘서트 및 활기찬 레크리에이션, 따뜻한 뷔페 특식과 경품 추첨이 준비되어 있습니다.',
            'OPEN'
        ),
        (
            '2026 청년 군종병 및 찬양팀(악기/보컬/방송) 모집',
            '사역자 모집',
            '상시 모집 (선발 인터뷰 개별 안내)',
            '교회 방송실 및 찬양대실',
            15,
            8,
            '2026-11-30',
            '국군수송중앙교회 예배를 기쁨으로 섬길 건반, 드럼, 기타, 보컬 및 음향/영상 엔지니어 군종병을 모집합니다.',
            'OPEN'
        )
    ]
    cursor.executemany('''
    INSERT INTO events (title, category, date_info, location, max_capacity, current_capacity, deadline, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', events)

    # 4. 상담 가능 시간대 초기 슬롯 설정 (기존 슬롯 없으면 생성)
    cursor.execute('SELECT COUNT(*) FROM counseling_slots')
    if cursor.fetchone()[0] == 0:
        slots = [
            ('화요일', '14:00~14:50', 1),
            ('화요일', '15:00~15:50', 1),
            ('화요일', '16:00~16:50', 1),
            ('목요일', '14:00~14:50', 1),
            ('목요일', '15:00~15:50', 1),
            ('목요일', '16:00~16:50', 1),
            ('토요일', '10:00~10:50', 1),
            ('토요일', '11:00~11:50', 1),
            ('토요일', '14:00~14:50', 1)
        ]
        cursor.executemany('''
        INSERT INTO counseling_slots (day_of_week, time_slot, is_active)
        VALUES (?, ?, ?)
        ''', slots)

    # 5. 설정값
    settings = [
        ('bank_name', '우리은행'),
        ('bank_account', '1002-111-884400'),
        ('bank_holder', '국군수송중앙교회 (김요한)'),
        ('church_phone', '053-850-1114'),
        ('church_address', '경상북도 경산시 하양읍 (국군수송사령부 국군수송중앙교회)'),
        ('pastor_calendar_id', 'chaplain.transcom@gmail.com'),
        ('admin_pin', '1111')
    ]
    cursor.executemany('''
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    ''', settings)

if __name__ == '__main__':
    init_db(force_reseed=True)
    print("Database reseeded for 국군수송중앙교회 successfully at:", DB_PATH)
