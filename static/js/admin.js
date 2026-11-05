/**
 * 11th Division Church - Admin Portal Script
 */

let adminPin = sessionStorage.getItem('11div_admin_pin') || '';

function getAdminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Pin': adminPin
  };
}

function openAdminAuthModal() {
  if (adminPin) {
    showAdminDashboard();
  } else {
    document.getElementById('admin-login-modal').classList.remove('hidden');
  }
}

function closeAdminAuthModal() {
  document.getElementById('admin-login-modal').classList.add('hidden');
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('admin-pin-input').value.trim();

  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'PIN 번호 오류');

    adminPin = pin;
    sessionStorage.setItem('11div_admin_pin', pin);
    closeAdminAuthModal();
    showToast('관리자 인증에 성공했습니다.');
    showAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showAdminDashboard() {
  document.getElementById('admin-dashboard-view')?.classList.remove('hidden');
  document.getElementById('main-public-view')?.classList.add('hidden');
  document.getElementById('private-lock-view')?.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadAdminStats();
  switchAdminTab('counsel');
}

function closeAdminDashboard() {
  document.getElementById('admin-dashboard-view')?.classList.add('hidden');
  const lockView = document.getElementById('private-lock-view');
  if (lockView) {
    lockView.classList.remove('hidden');
  } else {
    document.getElementById('main-public-view')?.classList.remove('hidden');
  }
}

async function handlePrivateUnlock(e) {
  e.preventDefault();
  const pin = document.getElementById('private-pin-input').value.trim();

  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'PIN 번호가 일치하지 않습니다.');

    adminPin = pin;
    sessionStorage.setItem('11div_admin_pin', pin);
    showToast('관리자 인증에 성공했습니다.');
    showAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function adminLogout() {
  adminPin = '';
  sessionStorage.removeItem('11div_admin_pin');
  closeAdminDashboard();
  showToast('관리자 로그아웃 되었습니다.');
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', { headers: getAdminHeaders() });
    if (res.status === 401) {
      adminLogout();
      return;
    }
    const data = await res.json();
    document.getElementById('stat-pending-counsel').textContent = data.pending_counselings;
    document.getElementById('stat-confirmed-counsel').textContent = data.confirmed_counselings;
    document.getElementById('stat-pending-visit').textContent = data.pending_visitations;
    document.getElementById('stat-approved-visit').textContent = data.approved_visitations;
    document.getElementById('stat-new-donations').textContent = data.new_donations;
  } catch (err) {
    console.error('Failed to load admin stats', err);
  }
}

// 탭 전환
function switchAdminTab(tabName) {
  const tabs = ['counsel', 'visit', 'event', 'donation', 'slots'];
  tabs.forEach(t => {
    const btn = document.getElementById(`adm-tab-btn-${t}`);
    const sec = document.getElementById(`adm-sec-${t}`);
    if (t === tabName) {
      btn?.classList.add('bg-blue-600', 'text-white');
      btn?.classList.remove('bg-white', 'text-slate-700');
      sec?.classList.remove('hidden');
    } else {
      btn?.classList.remove('bg-blue-600', 'text-white');
      btn?.classList.add('bg-white', 'text-slate-700');
      sec?.classList.add('hidden');
    }
  });

  if (tabName === 'counsel') loadAdminCounselings();
  if (tabName === 'visit') loadAdminVisitations();
  if (tabName === 'event') loadAdminEvents();
  if (tabName === 'donation') loadAdminDonations();
  if (tabName === 'slots') loadAdminSlots();
}

// 1. 상담 관리
async function loadAdminCounselings() {
  const tbody = document.getElementById('admin-counseling-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">데이터를 불러오는 중입니다...</td></tr>`;

  try {
    const res = await fetch('/api/admin/counselings', { headers: getAdminHeaders() });
    const list = await res.json();

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">신청된 상담 내역이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(c => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 text-xs">
        <td class="py-3 px-3">
          <span class="font-bold text-slate-900">${c.counsel_date}</span><br>
          <span class="text-blue-600 font-semibold">${c.counsel_time}</span>
        </td>
        <td class="py-3 px-3">
          <span class="font-semibold text-slate-800">${c.applicant_name}</span>
          ${c.is_anonymous ? '<span class="text-[10px] bg-slate-200 text-slate-700 px-1 rounded ml-1">가명</span>' : ''}
          <div class="text-[11px] text-slate-500">${c.rank || ''} ${c.unit || ''}</div>
          <div class="text-[11px] text-slate-400">📞 ${c.phone}</div>
        </td>
        <td class="py-3 px-3">
          <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">${c.category}</span>
          <p class="text-slate-500 mt-1 max-w-xs truncate" title="${c.topic || ''}">${c.topic || '내용 없음'}</p>
        </td>
        <td class="py-3 px-3">
          <select onchange="updateCounselStatus(${c.id}, this.value)" class="text-xs border rounded-lg p-1 font-semibold ${
            c.status === 'CONFIRMED' ? 'border-blue-400 text-blue-700 bg-blue-50' : 
            c.status === 'COMPLETED' ? 'border-emerald-400 text-emerald-700 bg-emerald-50' :
            c.status === 'CANCELLED' ? 'border-slate-300 text-slate-400' : 'border-amber-400 text-amber-700 bg-amber-50'
          }">
            <option value="PENDING" ${c.status === 'PENDING' ? 'selected' : ''}>대기중</option>
            <option value="CONFIRMED" ${c.status === 'CONFIRMED' ? 'selected' : ''}>일정 확정</option>
            <option value="COMPLETED" ${c.status === 'COMPLETED' ? 'selected' : ''}>상담 완료</option>
            <option value="CANCELLED" ${c.status === 'CANCELLED' ? 'selected' : ''}>취소됨</option>
          </select>
        </td>
        <td class="py-3 px-3">
          <button onclick="openGoogleCalendarForCounseling(${c.id})" class="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-lg text-slate-700 font-medium transition-smooth shadow-xs">
            <span>📅 구글캘린더 추가</span>
          </button>
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1">
            <input type="text" id="pastor-note-${c.id}" value="${c.pastor_notes || ''}" placeholder="목사님 비공개 메모" class="text-xs border rounded-lg px-2 py-1 w-36">
            <button onclick="savePastorNote(${c.id})" class="px-2 py-1 bg-slate-800 text-white rounded text-[11px] hover:bg-slate-700">저장</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load admin counselings', err);
  }
}

async function updateCounselStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/counselings/${id}`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('상태 변경 실패');
    showToast(`상담 상태가 '${newStatus}'(으)로 변경되었습니다.`);
    loadAdminStats();
    loadAdminCounselings();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function savePastorNote(id) {
  const note = document.getElementById(`pastor-note-${id}`).value.trim();
  try {
    const res = await fetch(`/api/admin/counselings/${id}`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ pastor_notes: note })
    });
    if (!res.ok) throw new Error('메모 저장 실패');
    showToast('목사님 비공개 메모가 저장되었습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function openGoogleCalendarForCounseling(id) {
  try {
    const res = await fetch(`/api/admin/counselings/${id}/gcal`, { headers: getAdminHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '생성 실패');

    window.open(data.google_calendar_url, '_blank');
    showToast('구글 캘린더 등록 창이 열렸습니다. 저장 버튼을 눌러주세요.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 2. 위문 신청 관리 (중복 방지 컨트롤)
async function loadAdminVisitations() {
  const tbody = document.getElementById('admin-visitation-tbody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">데이터를 불러오는 중입니다...</td></tr>`;

  try {
    const res = await fetch('/api/admin/visitations', { headers: getAdminHeaders() });
    const list = await res.json();

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">위문 신청 내역이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(v => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 text-xs">
        <td class="py-3 px-3">
          <span class="font-bold text-slate-900">${v.visit_date}</span>
          <div class="text-[11px] text-blue-600 font-semibold">${v.service_type}</div>
        </td>
        <td class="py-3 px-3">
          <span class="font-bold text-slate-800 text-sm">${v.group_name}</span>
          <div class="text-slate-500">대표: ${v.representative_name} (${v.contact_phone})</div>
          <div class="text-[11px] text-slate-400">인원: ${v.visitor_count}명 | 차량: ${v.vehicle_count}대</div>
        </td>
        <td class="py-3 px-3 max-w-xs">
          <div class="bg-amber-50 text-amber-900 p-2 rounded-lg text-[11px]">
            <strong>🎁 간식/위문품:</strong> ${v.refreshment_details || '없음'}
          </div>
          <p class="text-slate-500 mt-1 truncate" title="${v.request_details || ''}">요청: ${v.request_details || '없음'}</p>
        </td>
        <td class="py-3 px-3">
          ${v.status === 'APPROVED' ? '<span class="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md">승인완료 (슬롯 마감)</span>' :
            v.status === 'REJECTED' ? '<span class="bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-md">반려됨</span>' :
            '<span class="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-md">접수 대기</span>'}
        </td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-1.5">
            ${v.status !== 'APPROVED' ? `
              <button onclick="updateVisitationStatus(${v.id}, 'APPROVED')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-smooth">
                승인 (슬롯 닫기)
              </button>
            ` : `
              <button onclick="updateVisitationStatus(${v.id}, 'PENDING')" class="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
                승인 취소
              </button>
            `}
            ${v.status !== 'REJECTED' ? `
              <button onclick="updateVisitationStatus(${v.id}, 'REJECTED')" class="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                반려
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load admin visitations', err);
  }
}

async function updateVisitationStatus(id, newStatus) {
  if (newStatus === 'APPROVED') {
    if (!confirm('이 위문 일정을 승인하시겠습니까?\n승인 시 해당 주말 날짜는 즉시 [예약 마감]되어 다른 단체의 중복 접수가 차단됩니다.')) return;
  }

  try {
    const res = await fetch(`/api/admin/visitations/${id}`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '처리 실패');

    showToast(`위문 신청 상태가 '${newStatus}'(으)로 갱신되었습니다.`);
    loadAdminStats();
    loadAdminVisitations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 3. 행사 & 참가자 관리 및 CSV 엑셀 다운로드
async function loadAdminEvents() {
  const container = document.getElementById('admin-events-list-container');
  try {
    const res = await fetch('/api/events');
    const events = await res.json();

    container.innerHTML = events.map(e => `
      <div class="border border-slate-200 rounded-xl p-5 bg-white mb-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <span class="text-xs font-bold px-2 py-0.5 rounded ${e.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${e.status}</span>
            <h4 class="text-base font-bold text-slate-900 inline ml-2">${e.title}</h4>
            <span class="text-xs text-slate-400 ml-2">(${e.date_info})</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">참가자 ${e.current_capacity} / ${e.max_capacity}명</span>
            <button onclick="downloadEventCsv(${e.id})" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-smooth">
              📥 엑셀(CSV) 다운로드
            </button>
            <button onclick="viewEventRegistrations(${e.id}, '${e.title}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium">
              명단 보기
            </button>
          </div>
        </div>
        <div id="event-regs-detail-${e.id}" class="hidden mt-4 pt-4 border-t border-slate-100"></div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load admin events', err);
  }
}

function downloadEventCsv(eventId) {
  window.location.href = `/api/admin/events/${eventId}/registrations/csv?pin=${encodeURIComponent(adminPin)}`;
}

async function viewEventRegistrations(eventId, eventTitle) {
  const container = document.getElementById(`event-regs-detail-${eventId}`);
  if (!container.classList.contains('hidden')) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `<p class="text-xs text-slate-400 py-2">참가자 명단을 조회 중입니다...</p>`;

  try {
    const res = await fetch(`/api/admin/events/${eventId}/registrations`, { headers: getAdminHeaders() });
    const regs = await res.json();

    if (regs.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 py-2">아직 접수된 참가자가 없습니다.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-600 border-b">
              <th class="p-2">순번</th>
              <th class="p-2">소속</th>
              <th class="p-2">계급</th>
              <th class="p-2">성명</th>
              <th class="p-2">연락처</th>
              <th class="p-2">식사</th>
              <th class="p-2">신청일시</th>
            </tr>
          </thead>
          <tbody>
            ${regs.map((r, i) => `
              <tr class="border-b border-slate-100">
                <td class="p-2 font-semibold text-slate-400">${i + 1}</td>
                <td class="p-2 font-medium">${r.unit || '-'}</td>
                <td class="p-2">${r.rank || '-'}</td>
                <td class="p-2 font-bold text-slate-900">${r.name}</td>
                <td class="p-2 text-slate-600">${r.phone}</td>
                <td class="p-2">${r.meal_included ? '<span class="text-emerald-600 font-bold">포함</span>' : '<span class="text-slate-400">미포함</span>'}</td>
                <td class="p-2 text-slate-400">${r.created_at}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-xs text-red-500 py-2">${err.message}</p>`;
  }
}

// 4. 후원 내역 관리
async function loadAdminDonations() {
  const tbody = document.getElementById('admin-donation-tbody');
  try {
    const res = await fetch('/api/admin/donations', { headers: getAdminHeaders() });
    const list = await res.json();

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">접수된 후원 통보 내역이 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(d => `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 text-xs">
        <td class="py-3 px-3 font-semibold text-slate-900">${d.deposit_date}</td>
        <td class="py-3 px-3">
          <span class="font-bold text-slate-800 text-sm">${d.donor_name}</span>
          <div class="text-[11px] text-slate-400">📞 ${d.phone || '-'}</div>
        </td>
        <td class="py-3 px-3 font-bold text-blue-700">
          ${d.amount > 0 ? d.amount.toLocaleString() + '원' : '비공개'}
        </td>
        <td class="py-3 px-3">
          <span class="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-medium">${d.purpose}</span>
          <p class="text-slate-500 mt-1 italic">${d.prayer_request ? '🙏 ' + d.prayer_request : ''}</p>
        </td>
        <td class="py-3 px-3">
          ${d.is_checked ? '<span class="text-emerald-600 font-bold">확인완료</span>' : '<span class="text-amber-600 font-bold">신규</span>'}
        </td>
        <td class="py-3 px-3">
          ${!d.is_checked ? `
            <button onclick="checkDonationItem(${d.id})" class="px-2.5 py-1 bg-slate-800 text-white rounded text-xs hover:bg-slate-700">확인</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load admin donations', err);
  }
}

async function checkDonationItem(id) {
  try {
    const res = await fetch(`/api/admin/donations/${id}/check`, {
      method: 'PATCH',
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('처리 실패');
    showToast('후원 내역 확인이 완료되었습니다.');
    loadAdminStats();
    loadAdminDonations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 5. 목사님 상담 가능 요일 및 시간대 설정 (Availability Slots)
async function loadAdminSlots() {
  const container = document.getElementById('admin-slots-list');
  try {
    const res = await fetch('/api/admin/slots', { headers: getAdminHeaders() });
    const slots = await res.json();

    container.innerHTML = slots.map(s => `
      <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
        <div class="flex items-center gap-3">
          <input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="toggleSlotActive(${s.id}, this.checked)" class="w-4 h-4 text-blue-600 rounded">
          <span class="font-bold text-slate-800 text-sm">${s.day_of_week}</span>
          <span class="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-mono font-semibold">${s.time_slot}</span>
        </div>
        <button onclick="deleteSlot(${s.id})" class="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1">삭제</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load slots', err);
  }
}

async function handleAddSlot(e) {
  e.preventDefault();
  const day = document.getElementById('new-slot-day').value;
  const time = document.getElementById('new-slot-time').value.trim();

  if (!time) {
    showToast('시간대를 입력해주세요. (예: 14:00~14:50)', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/slots', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ day_of_week: day, time_slot: time })
    });
    if (!res.ok) throw new Error('슬롯 추가 실패');

    showToast('상담 가능 시간대가 추가되었습니다.');
    document.getElementById('new-slot-time').value = '';
    loadAdminSlots();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleSlotActive(slotId, isActive) {
  try {
    await fetch(`/api/admin/slots/${slotId}`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
      body: JSON.stringify({ is_active: isActive })
    });
    showToast('상태가 업데이트되었습니다.');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSlot(slotId) {
  if (!confirm('이 시간대 슬롯을 삭제하시겠습니까?')) return;
  try {
    await fetch(`/api/admin/slots/${slotId}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    showToast('슬롯이 삭제되었습니다.');
    loadAdminSlots();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('form-admin-login')?.addEventListener('submit', handleAdminLogin);
  document.getElementById('form-private-unlock')?.addEventListener('submit', handlePrivateUnlock);
  document.getElementById('form-add-slot')?.addEventListener('submit', handleAddSlot);
});
