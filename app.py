import os
import io
import csv
import urllib.parse
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, send_from_directory, Response
from flask_cors import CORS
from database import get_db_connection, init_db
from gcalendar import generate_google_calendar_url, generate_ics_content

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# 초기 DB 세팅
init_db()

def check_admin(req):
    pin = req.headers.get('X-Admin-Pin') or req.args.get('pin')
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key = 'admin_pin'")
    row = c.fetchone()
    conn.close()
    expected_pin = row['value'] if row else '1111'
    return pin == expected_pin

# ==========================================
# PUBLIC API: 목회자 & 기본 설정
# ==========================================

@app.route('/api/pastors', methods=['GET'])
def get_pastors():
    conn = get_db_connection()
    pastors = conn.execute('SELECT * FROM pastors ORDER BY order_num ASC').fetchall()
    conn.close()
    return jsonify([dict(p) for p in pastors])

@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM settings WHERE key != 'admin_pin'").fetchall()
    conn.close()
    settings_dict = {row['key']: row['value'] for row in rows}
    return jsonify(settings_dict)

@app.route('/api/services', methods=['GET'])
def get_services():
    conn = get_db_connection()
    services = conn.execute('SELECT * FROM regular_services ORDER BY id ASC').fetchall()
    conn.close()
    return jsonify([dict(s) for s in services])

# ==========================================
# PUBLIC API: 행사 & 참가 접수
# ==========================================

@app.route('/api/events', methods=['GET'])
def get_events():
    conn = get_db_connection()
    events = conn.execute('SELECT * FROM events ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(e) for e in events])

@app.route('/api/events/<int:event_id>/register', methods=['POST'])
def register_event(event_id):
    data = request.json or {}
    unit = data.get('unit', '').strip()
    rank = data.get('rank', '').strip()
    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    meal = int(data.get('meal_included', 1))
    memo = data.get('memo', '').strip()

    if not name or not phone:
        return jsonify({'error': '성명과 연락처는 필수 입력 항목입니다.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # 이벤트 상태 확인
    event = cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone()
    if not event:
        conn.close()
        return jsonify({'error': '존재하지 않는 행사입니다.'}), 404

    if event['status'] == 'CLOSED' or event['current_capacity'] >= event['max_capacity']:
        conn.close()
        return jsonify({'error': '죄송합니다. 정원이 마감되었거나 종료된 행사입니다.'}), 400

    # 등록
    cursor.execute('''
    INSERT INTO event_registrations (event_id, unit, rank, name, phone, meal_included, memo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (event_id, unit, rank, name, phone, meal, memo))

    # 인원수 증가
    new_count = event['current_capacity'] + 1
    new_status = 'CLOSED' if new_count >= event['max_capacity'] else 'OPEN'
    cursor.execute('''
    UPDATE events SET current_capacity = ?, status = ? WHERE id = ?
    ''', (new_count, new_status, event_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'{name} 성도님의 참가 접수가 정상 완료되었습니다!'})

# ==========================================
# PUBLIC API: 1:1 상담 예약
# ==========================================

@app.route('/api/counseling/slots', methods=['GET'])
def get_counseling_slots():
    """목사님이 설정한 상담 가능 요일 및 시간대와 향후 4주간의 추천 일자 목록 반환"""
    conn = get_db_connection()
    slots = conn.execute('SELECT * FROM counseling_slots WHERE is_active = 1 ORDER BY id ASC').fetchall()
    conn.close()

    # 요일 매핑 (0: 월 ~ 6: 일)
    day_map = {'월요일': 0, '화요일': 1, '수요일': 2, '목요일': 3, '금요일': 4, '토요일': 5, '일요일': 6}
    
    # 향후 4주(28일) 내에 활성화된 요일 날짜들 생성
    today = datetime.now()
    available_dates = []
    
    active_days = set()
    for s in slots:
        if s['day_of_week'] in day_map:
            active_days.add(day_map[s['day_of_week']])

    for offset in range(1, 30):
        target_date = today + timedelta(days=offset)
        if target_date.weekday() in active_days:
            # 해당 요일에 해당하는 슬롯들
            day_str = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'][target_date.weekday()]
            day_slots = [s['time_slot'] for s in slots if s['day_of_week'] == day_str]
            available_dates.append({
                'date': target_date.strftime('%Y-%m-%d'),
                'display': f"{target_date.strftime('%m월 %d일')} ({day_str[0]})",
                'day_of_week': day_str,
                'slots': day_slots
            })

    return jsonify({
        'slots_config': [dict(s) for s in slots],
        'available_dates': available_dates
    })

@app.route('/api/counseling/apply', methods=['POST'])
def apply_counseling():
    data = request.json or {}
    name = data.get('applicant_name', '').strip()
    is_anon = 1 if data.get('is_anonymous') else 0
    unit = data.get('unit', '').strip()
    rank = data.get('rank', '').strip()
    phone = data.get('phone', '').strip()
    passcode = data.get('passcode', '').strip()
    counsel_date = data.get('counsel_date', '').strip()
    counsel_time = data.get('counsel_time', '').strip()
    category = data.get('category', '기타').strip()
    topic = data.get('topic', '').strip()

    if not name or not phone or not counsel_date or not counsel_time or not passcode:
        return jsonify({'error': '필수 항목(이름/가명, 연락처, 희망일시, 조회용 비밀번호 4자리)을 모두 입력해주세요.'}), 400

    if len(passcode) != 4 or not passcode.isdigit():
        return jsonify({'error': '비밀번호는 숫자 4자리로 입력해주세요.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO counseling_appointments 
    (applicant_name, is_anonymous, unit, rank, phone, passcode, counsel_date, counsel_time, category, topic, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    ''', (name, is_anon, unit, rank, phone, passcode, counsel_date, counsel_time, category, topic))
    
    app_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'appointment_id': app_id,
        'message': '상담 신청이 완료되었습니다. 목사님께서 일정 확인 후 확정 연락을 드립니다.'
    })

@app.route('/api/counseling/check', methods=['POST'])
def check_counseling():
    """신청자가 본인의 전화번호와 4자리 비밀번호로 비밀 상담 상태를 조회"""
    data = request.json or {}
    phone = data.get('phone', '').strip().replace('-', '')
    passcode = data.get('passcode', '').strip()

    if not phone or not passcode:
        return jsonify({'error': '연락처와 비밀번호를 입력해주세요.'}), 400

    conn = get_db_connection()
    rows = conn.execute('''
    SELECT id, applicant_name, counsel_date, counsel_time, category, status, created_at
    FROM counseling_appointments
    WHERE REPLACE(phone, '-', '') = ? AND passcode = ?
    ORDER BY id DESC
    ''', (phone, passcode)).fetchall()
    conn.close()

    if not rows:
        return jsonify({'error': '일치하는 상담 신청 내역을 찾을 수 없습니다. 연락처와 4자리 비밀번호를 다시 확인해주세요.'}), 404

    results = []
    for r in rows:
        results.append({
            'id': r['id'],
            'applicant_name': r['applicant_name'],
            'counsel_date': r['counsel_date'],
            'counsel_time': r['counsel_time'],
            'category': r['category'],
            'status': r['status'],
            'created_at': r['created_at']
        })

    return jsonify({'success': True, 'appointments': results})

# ==========================================
# PUBLIC API: 주말 위문 신청 (중복 방지 시스템)
# ==========================================

@app.route('/api/visitations/calendar', methods=['GET'])
def get_visitation_calendar():
    """향후 8주간의 주말(토/일) 날짜별 위문 현황 반환 (중복 신청 방지)"""
    conn = get_db_connection()
    existing_visitations = conn.execute('''
    SELECT visit_date, service_type, group_name, status
    FROM visitations
    WHERE visit_date >= DATE('now')
    ''').fetchall()
    conn.close()

    booked_map = {row['visit_date']: dict(row) for row in existing_visitations}

    today = datetime.now()
    weekend_slots = []

    # 앞으로 8주간 주말(토요일, 일요일) 탐색
    for i in range(1, 60):
        d = today + timedelta(days=i)
        if d.weekday() in [5, 6]: # 토(5), 일(6)
            date_str = d.strftime('%Y-%m-%d')
            day_name = '토요일' if d.weekday() == 5 else '주일'
            
            slot_info = {
                'date': date_str,
                'display': f"{d.strftime('%m월 %d일')} ({day_name})",
                'day_name': day_name,
                'status': 'AVAILABLE', # AVAILABLE, PENDING, APPROVED(마감)
                'group_name': None,
                'service_type': None
            }

            if date_str in booked_map:
                v = booked_map[date_str]
                slot_info['status'] = v['status'] # PENDING 또는 APPROVED
                if v['status'] == 'APPROVED':
                    slot_info['group_name'] = v['group_name']
                    slot_info['service_type'] = v['service_type']

            weekend_slots.append(slot_info)

    return jsonify(weekend_slots)

@app.route('/api/visitations/apply', methods=['POST'])
def apply_visitation():
    data = request.json or {}
    visit_date = data.get('visit_date', '').strip()
    service_type = data.get('service_type', '주일 2부 (11:00)').strip()
    group_name = data.get('group_name', '').strip()
    rep_name = data.get('representative_name', '').strip()
    phone = data.get('contact_phone', '').strip()
    visitor_count = int(data.get('visitor_count', 10))
    vehicle_count = int(data.get('vehicle_count', 1))
    refreshments = data.get('refreshment_details', '').strip()
    requests = data.get('request_details', '').strip()

    if not visit_date or not group_name or not rep_name or not phone:
        return jsonify({'error': '방문 일자, 단체명, 대표자 성함, 연락처는 필수 입력 항목입니다.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # 이미 승인(APPROVED)된 날짜인지 엄격히 확인 (중복 방지 핵심)
    existing = cursor.execute('SELECT * FROM visitations WHERE visit_date = ?', (visit_date,)).fetchone()
    if existing and existing['status'] == 'APPROVED':
        conn.close()
        return jsonify({'error': f'{visit_date}은 이미 다른 위문팀의 일정이 확정되어 있습니다. 다른 날짜를 선택해주세요.'}), 400

    try:
        if existing and existing['status'] in ['PENDING', 'REJECTED']:
            cursor.execute('''
            UPDATE visitations SET
                service_type = ?, group_name = ?, representative_name = ?, contact_phone = ?,
                visitor_count = ?, vehicle_count = ?, refreshment_details = ?, request_details = ?,
                status = 'PENDING', created_at = CURRENT_TIMESTAMP
            WHERE visit_date = ?
            ''', (service_type, group_name, rep_name, phone, visitor_count, vehicle_count, refreshments, requests, visit_date))
        else:
            cursor.execute('''
            INSERT INTO visitations 
            (visit_date, service_type, group_name, representative_name, contact_phone, visitor_count, vehicle_count, refreshment_details, request_details, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
            ''', (visit_date, service_type, group_name, rep_name, phone, visitor_count, vehicle_count, refreshments, requests))
        
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({'error': f'신청 처리 중 오류가 발생했습니다: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f'{visit_date} 위문 신청서가 접수되었습니다. 목사님께서 확인 후 일정을 확정해 드립니다.'
    })

# ==========================================
# PUBLIC API: 후원 계좌 및 통보
# ==========================================

@app.route('/api/donations/info', methods=['GET'])
def get_donation_info():
    conn = get_db_connection()
    settings = conn.execute("SELECT key, value FROM settings WHERE key IN ('bank_name', 'bank_account', 'bank_holder')").fetchall()
    conn.close()
    res = {row['key']: row['value'] for row in settings}
    return jsonify(res)

@app.route('/api/donations/notify', methods=['POST'])
def notify_donation():
    """후원자가 입금 후 '후원 통보'를 작성하면 목사님 관리자 패널로 즉시 전달"""
    data = request.json or {}
    donor_name = data.get('donor_name', '').strip()
    amount = int(data.get('amount', 0)) if data.get('amount') else 0
    purpose = data.get('purpose', '장병 간식 후원').strip()
    deposit_date = data.get('deposit_date', datetime.now().strftime('%Y-%m-%d')).strip()
    phone = data.get('phone', '').strip()
    prayer_request = data.get('prayer_request', '').strip()

    if not donor_name:
        return jsonify({'error': '후원자 성함(또는 단체명)을 입력해주세요.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO donations (donor_name, amount, purpose, deposit_date, phone, prayer_request)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (donor_name, amount, purpose, deposit_date, phone, prayer_request))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': '소중한 후원 통보가 접수되었습니다. 화랑 장병들을 위한 귀한 사역에 큰 힘이 됩니다. 진심으로 감사드립니다!'
    })

# ==========================================
# ADMIN API: 관리자 전용 대시보드 및 조작
# ==========================================

@app.route('/api/admin/verify', methods=['POST'])
def verify_admin_pin():
    pin = (request.json or {}).get('pin', '')
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = 'admin_pin'").fetchone()
    conn.close()
    expected = row['value'] if row else '1111'
    if pin == expected:
        return jsonify({'success': True, 'token': pin})
    return jsonify({'success': False, 'error': '관리자 비밀번호(PIN)가 일치하지 않습니다.'}), 401

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    pending_counselings = conn.execute("SELECT COUNT(*) FROM counseling_appointments WHERE status = 'PENDING'").fetchone()[0]
    confirmed_counselings = conn.execute("SELECT COUNT(*) FROM counseling_appointments WHERE status = 'CONFIRMED'").fetchone()[0]
    pending_visitations = conn.execute("SELECT COUNT(*) FROM visitations WHERE status = 'PENDING'").fetchone()[0]
    approved_visitations = conn.execute("SELECT COUNT(*) FROM visitations WHERE status = 'APPROVED'").fetchone()[0]
    new_donations = conn.execute("SELECT COUNT(*) FROM donations WHERE is_checked = 0").fetchone()[0]
    conn.close()

    return jsonify({
        'pending_counselings': pending_counselings,
        'confirmed_counselings': confirmed_counselings,
        'pending_visitations': pending_visitations,
        'approved_visitations': approved_visitations,
        'new_donations': new_donations
    })

# 관리자: 상담 목록 및 처리
@app.route('/api/admin/counselings', methods=['GET'])
def get_admin_counselings():
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    counselings = conn.execute('''
    SELECT * FROM counseling_appointments ORDER BY counsel_date DESC, counsel_time ASC
    ''').fetchall()
    conn.close()
    return jsonify([dict(c) for c in counselings])

@app.route('/api/admin/counselings/<int:id>', methods=['PATCH'])
def update_admin_counseling(id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    data = request.json or {}
    status = data.get('status')
    notes = data.get('pastor_notes')

    conn = get_db_connection()
    cursor = conn.cursor()
    
    if status and notes is not None:
        cursor.execute('UPDATE counseling_appointments SET status = ?, pastor_notes = ? WHERE id = ?', (status, notes, id))
    elif status:
        cursor.execute('UPDATE counseling_appointments SET status = ? WHERE id = ?', (status, id))
    elif notes is not None:
        cursor.execute('UPDATE counseling_appointments SET pastor_notes = ? WHERE id = ?', (notes, id))

    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/admin/counselings/<int:id>/gcal', methods=['GET'])
def get_counseling_gcal_link(id):
    """구글 캘린더 원클릭 추가 URL 생성 및 반환"""
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    c = conn.execute('SELECT * FROM counseling_appointments WHERE id = ?', (id,)).fetchone()
    conn.close()

    if not c:
        return jsonify({'error': '상담 내역을 찾을 수 없습니다.'}), 404

    # counsel_time: '14:00~14:50'
    time_parts = c['counsel_time'].split('~')
    start_time_str = time_parts[0].strip() if len(time_parts) > 0 else "14:00"
    end_time_str = time_parts[1].strip() if len(time_parts) > 1 else "14:50"

    start_dt = f"{c['counsel_date']} {start_time_str}"
    end_dt = f"{c['counsel_date']} {end_time_str}"

    title = f"신앙·마음 상담: {c['applicant_name']} ({c['category']})"
    details = f"신청자: {c['applicant_name']}\n연락처: {c['phone']}\n고민분야: {c['category']}\n사전메모: {c['topic'] or '없음'}\n목사님 메모: {c['pastor_notes'] or '없음'}"

    gcal_url = generate_google_calendar_url(title, start_dt, end_dt, details)
    return jsonify({'success': True, 'google_calendar_url': gcal_url})

# 관리자: 상담 슬롯 관리
@app.route('/api/admin/slots', methods=['GET', 'POST'])
def manage_slots():
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        slots = cursor.execute('SELECT * FROM counseling_slots ORDER BY id ASC').fetchall()
        conn.close()
        return jsonify([dict(s) for s in slots])

    if request.method == 'POST':
        data = request.json or {}
        day = data.get('day_of_week')
        slot = data.get('time_slot')
        if not day or not slot:
            conn.close()
            return jsonify({'error': '요일과 시간대를 입력해주세요.'}), 400
        cursor.execute('INSERT INTO counseling_slots (day_of_week, time_slot, is_active) VALUES (?, ?, 1)', (day, slot))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

@app.route('/api/admin/slots/<int:slot_id>', methods=['DELETE', 'PATCH'])
def update_or_delete_slot(slot_id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'DELETE':
        cursor.execute('DELETE FROM counseling_slots WHERE id = ?', (slot_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    if request.method == 'PATCH':
        data = request.json or {}
        is_active = data.get('is_active')
        if is_active is not None:
            cursor.execute('UPDATE counseling_slots SET is_active = ? WHERE id = ?', (1 if is_active else 0, slot_id))
            conn.commit()
        conn.close()
        return jsonify({'success': True})

# 관리자: 위문 신청 목록 & 승인/반려 (중복 방지 컨트롤 타워)
@app.route('/api/admin/visitations', methods=['GET'])
def get_admin_visitations():
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    visitations = conn.execute('SELECT * FROM visitations ORDER BY visit_date ASC').fetchall()
    conn.close()
    return jsonify([dict(v) for v in visitations])

@app.route('/api/admin/visitations/<int:id>', methods=['PATCH'])
def update_admin_visitation(id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    data = request.json or {}
    status = data.get('status') # APPROVED, REJECTED, PENDING
    notes = data.get('approval_notes', '')

    conn = get_db_connection()
    cursor = conn.cursor()

    # 만약 승인(APPROVED) 처리하는 경우, 동일한 날짜에 다른 APPROVED 건이 있는지 검증
    target = cursor.execute('SELECT * FROM visitations WHERE id = ?', (id,)).fetchone()
    if not target:
        conn.close()
        return jsonify({'error': '항목을 찾을 수 없습니다.'}), 404

    if status == 'APPROVED':
        conflict = cursor.execute('''
        SELECT * FROM visitations WHERE visit_date = ? AND id != ? AND status = 'APPROVED'
        ''', (target['visit_date'], id)).fetchone()
        if conflict:
            conn.close()
            return jsonify({'error': f"이미 {conflict['group_name']} 단체의 일정이 승인되어 있습니다. 중복 승인은 불가합니다."}), 400

    cursor.execute('''
    UPDATE visitations SET status = ?, approval_notes = ? WHERE id = ?
    ''', (status, notes, id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'status': status})

# 관리자: 행사 신청자 목록 조회 & CSV 엑셀 다운로드
@app.route('/api/admin/events/<int:event_id>/registrations', methods=['GET'])
def get_event_registrations(event_id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    regs = conn.execute('''
    SELECT * FROM event_registrations WHERE event_id = ? ORDER BY id DESC
    ''', (event_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in regs])

@app.route('/api/admin/events/<int:event_id>/registrations/csv', methods=['GET'])
def export_event_registrations_csv(event_id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    event = conn.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone()
    regs = conn.execute('SELECT * FROM event_registrations WHERE event_id = ? ORDER BY id ASC', (event_id,)).fetchall()
    conn.close()

    if not event:
        return "Not found", 404

    # CSV 출력 (UTF-8 with BOM for Excel compatibility)
    output = io.StringIO()
    # Write UTF-8 BOM
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['순번', '소속 부대', '계급', '성명', '연락처', '식사 여부', '신청 일시', '비고/메모'])

    for idx, r in enumerate(regs, start=1):
        writer.writerow([
            idx,
            r['unit'],
            r['rank'],
            r['name'],
            r['phone'],
            '식사 포함' if r['meal_included'] == 1 else '식사 미포함',
            r['created_at'],
            r['memo'] or ''
        ])

    csv_data = output.getvalue()
    filename = f"국군수송중앙교회_{event['title'][:15]}_참석명단.csv"
    
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment;filename*=UTF-8''{urllib.parse.quote(filename)}"}
    )

# 관리자: 후원 통보 내역 조회 및 확인 처리
@app.route('/api/admin/donations', methods=['GET'])
def get_admin_donations():
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    donations = conn.execute('SELECT * FROM donations ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(d) for d in donations])

@app.route('/api/admin/donations/<int:id>/check', methods=['PATCH'])
def check_donation(id):
    if not check_admin(request):
        return jsonify({'error': '인증 실패'}), 401

    conn = get_db_connection()
    conn.execute('UPDATE donations SET is_checked = 1 WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==========================================
# PAGE ROUTE
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting 11th Division Church Portal at http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
