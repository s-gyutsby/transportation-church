/**
 * 11th Division Church - Main Client Application
 */

const API_BASE = '/api';

// Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white';
  const icon = type === 'success' ? '✓' : '⚠️';

  toast.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium transform transition-all duration-300 opacity-0 translate-y-2 ${bgClass}`;
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 1. 목회자 프로필 로드
async function loadPastors() {
  try {
    const res = await fetch(`${API_BASE}/pastors`);
    const pastors = await res.json();
    const container = document.getElementById('pastors-list');
    if (!container) return;

    container.innerHTML = pastors.map(p => `
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover-card flex flex-col items-center text-center">
        <div class="w-28 h-28 mb-4 relative">
          <img src="${p.image_url}" alt="${p.name}" class="w-full h-full object-cover rounded-full shadow-inner" />
          <span class="absolute bottom-0 right-1 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold border-2 border-white">✝</span>
        </div>
        <h3 class="text-xl font-bold text-slate-900">${p.name}</h3>
        <p class="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mt-1 mb-2">${p.title}</p>
        <p class="text-xs text-slate-500 font-medium mb-3">${p.role}</p>
        
        <div class="w-full bg-amber-50/70 border border-amber-100 rounded-xl p-3 my-2 text-xs text-amber-900 italic">
          ${p.verse || ''}
        </div>

        <p class="text-xs text-slate-600 mt-2 leading-relaxed flex-grow text-left">
          ${p.greeting || ''}
        </p>

        <div class="mt-4 pt-3 border-t border-slate-100 w-full text-xs text-slate-400">
          ✉ ${p.email || ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load pastors', err);
  }
}

// 2. 정기 예배 및 특별 행사 로드
let allEvents = [];

async function loadServicesAndEvents() {
  try {
    // 정기 예배
    const resServices = await fetch(`${API_BASE}/services`);
    const services = await resServices.json();
    const servicesContainer = document.getElementById('regular-services-list');
    if (servicesContainer) {
      servicesContainer.innerHTML = services.map(s => `
        <div class="p-5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 transition-smooth">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">${s.day_of_week}</span>
              <h4 class="text-base font-bold text-slate-900 mt-2">${s.title}</h4>
            </div>
            <span class="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">${s.time_slot}</span>
          </div>
          <div class="mt-3 text-xs text-slate-500 space-y-1">
            <p>📍 <strong>장소:</strong> ${s.location}</p>
            <p>👥 <strong>대상:</strong> ${s.target_group}</p>
            <p class="text-slate-600 pt-1">${s.description || ''}</p>
          </div>
        </div>
      `).join('');
    }

    // 특별 행사
    const resEvents = await fetch(`${API_BASE}/events`);
    allEvents = await resEvents.json();
    const eventsContainer = document.getElementById('special-events-list');
    if (eventsContainer) {
      eventsContainer.innerHTML = allEvents.map(e => {
        const isClosed = e.status === 'CLOSED' || e.current_capacity >= e.max_capacity;
        const percent = Math.min(100, Math.round((e.current_capacity / e.max_capacity) * 100));
        
        return `
          <div class="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-300 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold px-2.5 py-1 rounded-md ${isClosed ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}">
                  ${isClosed ? '마감됨' : '신청 가능'}
                </span>
                <span class="text-xs text-slate-400 font-medium">마감: ~${e.deadline}</span>
              </div>
              <h4 class="text-lg font-bold text-slate-900 mb-2 leading-snug">${e.title}</h4>
              <p class="text-xs text-slate-600 mb-4 leading-relaxed line-clamp-2">${e.description}</p>
              
              <div class="space-y-1 text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-xl">
                <p>🗓 <strong>일시:</strong> ${e.date_info}</p>
                <p>📍 <strong>장소:</strong> ${e.location}</p>
              </div>

              <!-- 접수 진행바 -->
              <div class="mb-4">
                <div class="flex justify-between text-xs font-semibold mb-1">
                  <span class="text-slate-600">접수 인원</span>
                  <span class="${isClosed ? 'text-red-500' : 'text-blue-600'}">${e.current_capacity} / ${e.max_capacity}명 (${percent}%)</span>
                </div>
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div class="h-full ${isClosed ? 'bg-slate-400' : 'bg-blue-600'} transition-all duration-500" style="width: ${percent}%"></div>
                </div>
              </div>
            </div>

            <button 
              onclick="openEventModal(${e.id})"
              ${isClosed ? 'disabled' : ''}
              class="w-full py-2.5 rounded-xl font-bold text-sm transition-smooth ${
                isClosed 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-900 hover:bg-blue-600 text-white shadow-sm'
              }">
              ${isClosed ? '정원 마감' : '참여 신청하기 →'}
            </button>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load services & events', err);
  }
}

// 행사 신청 모달 열기
function openEventModal(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;

  document.getElementById('event-modal-id').value = event.id;
  document.getElementById('event-modal-title').textContent = event.title;
  document.getElementById('event-modal-desc').textContent = `${event.date_info} | ${event.location}`;
  document.getElementById('event-register-modal').classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('event-register-modal').classList.add('hidden');
}

// 행사 신청 제출
async function handleEventRegisterSubmit(e) {
  e.preventDefault();
  const eventId = document.getElementById('event-modal-id').value;
  const unit = document.getElementById('event-reg-unit').value.trim();
  const rank = document.getElementById('event-reg-rank').value.trim();
  const name = document.getElementById('event-reg-name').value.trim();
  const phone = document.getElementById('event-reg-phone').value.trim();
  const meal = document.getElementById('event-reg-meal').checked ? 1 : 0;
  const memo = document.getElementById('event-reg-memo').value.trim();

  if (!name || !phone) {
    showToast('성명과 연락처를 입력해주세요.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/events/${eventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit, rank, name, phone, meal_included: meal, memo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '접수 실패');

    showToast(data.message || '참가 신청이 완료되었습니다!');
    closeEventModal();
    loadServicesAndEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 3. 1:1 상담 예약 로드 & 날짜 슬롯 선택
let counselingAvailableDates = [];

async function loadCounselingSlots() {
  try {
    const res = await fetch(`${API_BASE}/counseling/slots`);
    const data = await res.json();
    counselingAvailableDates = data.available_dates || [];

    const dateSelect = document.getElementById('counsel-date-select');
    if (!dateSelect) return;

    if (counselingAvailableDates.length === 0) {
      dateSelect.innerHTML = `<option value="">상담 가능한 일정이 준비 중입니다.</option>`;
      return;
    }

    dateSelect.innerHTML = `
      <option value="">희망 상담 날짜를 선택해주세요</option>
      ${counselingAvailableDates.map((d, idx) => `
        <option value="${d.date}" data-idx="${idx}">${d.display}</option>
      `).join('')}
    `;

    dateSelect.addEventListener('change', function() {
      const selectedDate = this.value;
      const targetObj = counselingAvailableDates.find(d => d.date === selectedDate);
      const slotContainer = document.getElementById('counsel-slots-container');

      if (!targetObj || targetObj.slots.length === 0) {
        slotContainer.innerHTML = `<p class="text-xs text-slate-400 py-2">날짜를 먼저 선택하시면 가능한 시간대가 표시됩니다.</p>`;
        return;
      }

      slotContainer.innerHTML = targetObj.slots.map(slot => `
        <label class="cursor-pointer border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-blue-500 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50/50 transition-smooth">
          <div class="flex items-center gap-2.5">
            <input type="radio" name="counsel_time_slot" value="${slot}" required class="text-blue-600 focus:ring-blue-500 w-4 h-4">
            <span class="text-sm font-semibold text-slate-800">${slot}</span>
          </div>
          <span class="text-xs text-blue-600 font-medium">선택 가능</span>
        </label>
      `).join('');
    });
  } catch (err) {
    console.error('Failed to load counseling slots', err);
  }
}

// 상담 신청 제출
async function handleCounselingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('counsel-name').value.trim();
  const isAnon = document.getElementById('counsel-anon').checked;
  const unit = document.getElementById('counsel-unit').value.trim();
  const rank = document.getElementById('counsel-rank').value.trim();
  const phone = document.getElementById('counsel-phone').value.trim();
  const passcode = document.getElementById('counsel-passcode').value.trim();
  const counselDate = document.getElementById('counsel-date-select').value;
  const selectedSlotEl = document.querySelector('input[name="counsel_time_slot"]:checked');
  const category = document.getElementById('counsel-category').value;
  const topic = document.getElementById('counsel-topic').value.trim();

  if (!selectedSlotEl) {
    showToast('희망 상담 시간대를 선택해주세요.', 'error');
    return;
  }
  if (!passcode || passcode.length !== 4 || isNaN(passcode)) {
    showToast('비밀번호는 숫자 4자리로 입력해주세요.', 'error');
    return;
  }

  const counselTime = selectedSlotEl.value;

  try {
    const res = await fetch(`${API_BASE}/counseling/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicant_name: name,
        is_anonymous: isAnon,
        unit, rank, phone, passcode,
        counsel_date: counselDate,
        counsel_time: counselTime,
        category, topic
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '신청 실패');

    // 성공 안내 팝업 및 구글 캘린더 안내
    showCounselingSuccessModal(name, counselDate, counselTime, passcode);
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showCounselingSuccessModal(name, date, time, passcode) {
  const modal = document.getElementById('counsel-success-modal');
  document.getElementById('counsel-success-summary').textContent = `${date} ${time} | 신청자: ${name}`;
  document.getElementById('counsel-success-passcode').textContent = passcode;
  modal.classList.remove('hidden');
}

function closeCounselingSuccessModal() {
  document.getElementById('counsel-success-modal').classList.add('hidden');
}

// 신청 내역 비밀 조회
async function handleCheckCounseling(e) {
  e.preventDefault();
  const phone = document.getElementById('check-phone').value.trim();
  const passcode = document.getElementById('check-passcode').value.trim();

  const resultContainer = document.getElementById('check-result-container');
  resultContainer.innerHTML = `<p class="text-center text-xs text-slate-400 py-4">조회 중입니다...</p>`;

  try {
    const res = await fetch(`${API_BASE}/counseling/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, passcode })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '조회 실패');

    const statusBadge = (s) => {
      if (s === 'PENDING') return '<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md font-bold">접수 대기 (목사님 확인 중)</span>';
      if (s === 'CONFIRMED') return '<span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-md font-bold">상담 확정 (교회 상담실)</span>';
      if (s === 'COMPLETED') return '<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-md font-bold">상담 완료</span>';
      return '<span class="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-md font-bold">취소됨</span>';
    };

    resultContainer.innerHTML = data.appointments.map(app => `
      <div class="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
        <div class="flex items-center justify-between border-b pb-2">
          <span class="font-bold text-slate-900 text-sm">일시: ${app.counsel_date} ${app.counsel_time}</span>
          ${statusBadge(app.status)}
        </div>
        <p><strong>신청자명:</strong> ${app.applicant_name} | <strong>분야:</strong> ${app.category}</p>
        <p class="text-slate-400">신청일시: ${app.created_at}</p>
      </div>
    `).join('');
  } catch (err) {
    resultContainer.innerHTML = `<div class="p-4 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">${err.message}</div>`;
  }
}

// 4. 주말 위문 방문 신청 (중복 방지 캘린더)
let weekendSlotsData = [];

async function loadVisitationCalendar() {
  try {
    const res = await fetch(`${API_BASE}/visitations/calendar`);
    weekendSlotsData = await res.json();
    const container = document.getElementById('visitation-slots-grid');
    if (!container) return;

    container.innerHTML = weekendSlotsData.map(slot => {
      const isApproved = slot.status === 'APPROVED';
      const isPending = slot.status === 'PENDING';
      const isAvailable = slot.status === 'AVAILABLE';

      let statusBadge = '';
      let borderClass = 'border-slate-200';
      let actionBtn = '';

      if (isApproved) {
        borderClass = 'border-red-200 bg-red-50/40';
        statusBadge = `<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">예약 마감 (${slot.group_name || '방문 확정'})</span>`;
        actionBtn = `<span class="text-xs text-slate-400 font-medium">중복 접수 불가</span>`;
      } else if (isPending) {
        borderClass = 'border-amber-200 bg-amber-50/40';
        statusBadge = `<span class="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">일정 조율 중</span>`;
        actionBtn = `<button onclick="selectVisitationDate('${slot.date}')" class="text-xs font-bold text-amber-700 underline">신청 접수 가능</button>`;
      } else {
        borderClass = 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-500';
        statusBadge = `<span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span> 신청 가능</span>`;
        actionBtn = `<button onclick="selectVisitationDate('${slot.date}')" class="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition-smooth">이 날짜로 신청 →</button>`;
      }

      return `
        <div class="p-4 rounded-xl border ${borderClass} transition-smooth flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold text-slate-900">${slot.display}</span>
              ${statusBadge}
            </div>
            <p class="text-xs text-slate-500 mb-2">
              ${isApproved ? `확정: ${slot.group_name} (${slot.service_type || '예배 참석'})` : '주일 1부(09:30) / 주일 2부(11:00)'}
            </p>
          </div>
          <div class="pt-2 border-t border-slate-100 flex justify-end">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load visitation calendar', err);
  }
}

function selectVisitationDate(dateStr) {
  const dateInput = document.getElementById('visit-date');
  if (dateInput) {
    dateInput.value = dateStr;
    dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`${dateStr} 날짜가 선택되었습니다. 아래 신청서를 작성해주세요.`);
  }
}

// 위문 신청 제출
async function handleVisitationSubmit(e) {
  e.preventDefault();
  const visitDate = document.getElementById('visit-date').value.trim();
  const serviceType = document.getElementById('visit-service-type').value;
  const groupName = document.getElementById('visit-group-name').value.trim();
  const repName = document.getElementById('visit-rep-name').value.trim();
  const phone = document.getElementById('visit-phone').value.trim();
  const visitorCount = parseInt(document.getElementById('visit-count').value || '10');
  const vehicleCount = parseInt(document.getElementById('visit-vehicles').value || '1');
  const refreshments = document.getElementById('visit-refreshments').value.trim();
  const requests = document.getElementById('visit-requests').value.trim();

  if (!visitDate || !groupName || !repName || !phone) {
    showToast('필수 항목을 모두 입력해주세요.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/visitations/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visit_date: visitDate,
        service_type: serviceType,
        group_name: groupName,
        representative_name: repName,
        contact_phone: phone,
        visitor_count: visitorCount,
        vehicle_count: vehicleCount,
        refreshment_details: refreshments,
        request_details: requests
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '신청 실패');

    showToast(data.message || '위문 신청서가 성공적으로 접수되었습니다!');
    e.target.reset();
    loadVisitationCalendar();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 5. 후원 계좌 복사 & 통보
function copyBankAccount() {
  const accountText = document.getElementById('bank-account-number').textContent.trim();
  navigator.clipboard.writeText(accountText).then(() => {
    showToast(`우리은행 계좌번호(${accountText})가 복사되었습니다!`);
  }).catch(() => {
    showToast('복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
  });
}

async function handleDonationNotifySubmit(e) {
  e.preventDefault();
  const donorName = document.getElementById('donor-name').value.trim();
  const amount = document.getElementById('donor-amount').value.trim();
  const purpose = document.getElementById('donor-purpose').value;
  const date = document.getElementById('donor-date').value;
  const phone = document.getElementById('donor-phone').value.trim();
  const prayer = document.getElementById('donor-prayer').value.trim();

  if (!donorName) {
    showToast('후원자 성함을 입력해주세요.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/donations/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor_name: donorName,
        amount: amount ? parseInt(amount.replace(/,/g, '')) : 0,
        purpose,
        deposit_date: date,
        phone,
        prayer_request: prayer
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '통보 실패');

    showToast(data.message);
    e.target.reset();
    document.getElementById('donor-date').valueAsDate = new Date();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 6. 탭 전환
function initTabs() {
  // 메인 행사 탭
  const tabRegular = document.getElementById('tab-btn-regular');
  const tabSpecial = document.getElementById('tab-btn-special');
  const viewRegular = document.getElementById('view-regular-services');
  const viewSpecial = document.getElementById('view-special-events');

  if (tabRegular && tabSpecial) {
    tabRegular.addEventListener('click', () => {
      tabRegular.classList.add('tab-active');
      tabSpecial.classList.remove('tab-active');
      viewRegular.classList.remove('hidden');
      viewSpecial.classList.add('hidden');
    });

    tabSpecial.addEventListener('click', () => {
      tabSpecial.classList.add('tab-active');
      tabRegular.classList.remove('tab-active');
      viewSpecial.classList.remove('hidden');
      viewRegular.classList.add('hidden');
    });
  }

  // 상담 탭 (예약 vs 조회)
  const tabApply = document.getElementById('tab-counsel-apply');
  const tabCheck = document.getElementById('tab-counsel-check');
  const formApply = document.getElementById('form-counsel-apply');
  const formCheck = document.getElementById('form-counsel-check');

  if (tabApply && tabCheck) {
    tabApply.addEventListener('click', () => {
      tabApply.classList.add('tab-active');
      tabCheck.classList.remove('tab-active');
      formApply.classList.remove('hidden');
      formCheck.classList.add('hidden');
    });

    tabCheck.addEventListener('click', () => {
      tabCheck.classList.add('tab-active');
      tabApply.classList.remove('tab-active');
      formCheck.classList.remove('hidden');
      formApply.classList.add('hidden');
    });
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadPastors();
  loadServicesAndEvents();
  loadCounselingSlots();
  loadVisitationCalendar();
  initTabs();

  // 날짜 기본값
  const todayStr = new Date().toISOString().split('T')[0];
  const donorDateEl = document.getElementById('donor-date');
  if (donorDateEl) donorDateEl.value = todayStr;

  // 이벤트 바인딩
  document.getElementById('form-event-register')?.addEventListener('submit', handleEventRegisterSubmit);
  document.getElementById('form-counseling-apply')?.addEventListener('submit', handleCounselingSubmit);
  document.getElementById('form-counseling-check-submit')?.addEventListener('submit', handleCheckCounseling);
  document.getElementById('form-visitation-apply')?.addEventListener('submit', handleVisitationSubmit);
  document.getElementById('form-donation-notify')?.addEventListener('submit', handleDonationNotifySubmit);
});
