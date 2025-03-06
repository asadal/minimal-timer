// 백그라운드 타이머 관리
let timerState = {
  isRunning: false,
  totalSeconds: 15 * 60,  // 기본값 15분
  initialTotalSeconds: 15 * 60,
  lastUpdated: Date.now(),
  endTime: 0
};

let timerInterval = null;
let lastNotificationId = null;

// 초기화: 저장된 타이머 상태 로드
chrome.storage.local.get('timer', function(data) {
  console.log('로드된 타이머 상태:', data.timer);
  
  if (data.timer && data.timer.isRunning) {
    timerState = data.timer;
    
    // 서비스 워커가 재시작된 경우 타이머 복원
    const now = Date.now();
    if (timerState.endTime > now) {
      startBackgroundTimer();
    } else if (timerState.isRunning) {
      // 종료 시간이 지났지만 타이머가 실행 중인 상태라면 알림 표시
      timerState.isRunning = false;
      timerState.totalSeconds = 0;
      chrome.storage.local.set({ timer: timerState });
      showNotification();
    }
  }
});

// 백그라운드 타이머 시작
function startBackgroundTimer() {
  // 이미 실행 중인 타이머가 있으면 정지
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // 기존 알람 제거
  chrome.alarms.clear("timerAlarm");
  
  console.log('백그라운드 타이머 시작:', timerState);
  
  // 현재 시간과 종료 시간 계산
  const now = Date.now();
  
  // 종료 시간이 설정되지 않았다면 설정
  if (!timerState.endTime || timerState.endTime <= now) {
    timerState.endTime = now + (timerState.totalSeconds * 1000);
  }
  
  // 알람 생성 - 타이머가 완료될 때 정확히 발생
  const minutesUntilEnd = Math.max(0, (timerState.endTime - now) / 1000 / 60);
  chrome.alarms.create("timerAlarm", { delayInMinutes: minutesUntilEnd });
  console.log('알람 설정:', minutesUntilEnd, '분 후 실행');
  
  // UI 업데이트를 위한 interval (UI 업데이트는 있어도 Alarm이 주 역할)
  timerInterval = setInterval(function() {
    const currentTime = Date.now();
    const remainingMs = Math.max(0, timerState.endTime - currentTime);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    
    console.log('타이머 체크:', remainingSeconds, '초 남음');
    
    // 상태 업데이트
    timerState.totalSeconds = remainingSeconds;
    timerState.lastUpdated = currentTime;
    
    // 상태 저장
    chrome.storage.local.set({ timer: timerState });
    
    // 남은 시간이 없으면 interval 정지 (알람이 알림을 처리)
    if (remainingSeconds <= 0) {
      console.log('타이머 종료! (interval에서 감지)');
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

// 알림 표시 함수
function showNotification() {
  console.log('알림 표시 시도');
  
  // Chrome의 알림 API를 사용해 알림 표시
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("images/icon128.png"),
    title: "Minimal Timer",
    message: "타이머가 종료되었습니다!",
    requireInteraction: true,  // 사용자가 직접 닫을 때까지 유지
    priority: 2,               // 최대 우선순위 (0-2)
    silent: false,             // 소리 재생
    buttons: [                 // 버튼 추가
      { title: "확인" },
      { title: "5분 더" }
    ]
  }, function(notificationId) {
    console.log('알림 생성됨:', notificationId);
    
    // 알림 ID 저장
    lastNotificationId = notificationId;
  });
}

// 알림 버튼 클릭 처리
chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
  console.log('알림 버튼 클릭:', notificationId, buttonIndex);
  
  if (notificationId === lastNotificationId) {
    if (buttonIndex === 0) {
      // "확인" 버튼 - 알림 닫기
      chrome.notifications.clear(notificationId);
    } else if (buttonIndex === 1) {
      // "5분 더" 버튼 - 5분 추가 타이머 시작
      timerState.isRunning = true;
      timerState.totalSeconds = 5 * 60; // 5분
      timerState.initialTotalSeconds = 5 * 60;
      timerState.lastUpdated = Date.now();
      timerState.endTime = Date.now() + (5 * 60 * 1000);
      
      // 타이머 시작
      startBackgroundTimer();
      
      // 알림 닫기
      chrome.notifications.clear(notificationId);
    }
  }
});

// 알림 클릭 처리
chrome.notifications.onClicked.addListener(function(notificationId) {
  console.log('알림 클릭됨:', notificationId);
  
  // 알림 닫기
  chrome.notifications.clear(notificationId);
});

// 메시지 리스너
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('메시지 수신:', request);
  
  if (request.type === "startTimer") {
    // 타이머 시작 메시지
    timerState = request.timerState;
    startBackgroundTimer();
    sendResponse({ success: true });
  } 
  else if (request.type === "pauseTimer") {
    // 타이머 일시정지 메시지
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // 알람 제거
    chrome.alarms.clear("timerAlarm");
    
    timerState = request.timerState;
    timerState.isRunning = false;
    chrome.storage.local.set({ timer: timerState });
    sendResponse({ success: true });
  } 
  else if (request.type === "resetTimer") {
    // 타이머 리셋 메시지
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    // 알람 제거
    chrome.alarms.clear("timerAlarm");
    
    timerState = request.timerState;
    timerState.isRunning = false;
    chrome.storage.local.set({ timer: timerState });
    sendResponse({ success: true });
  } 
  else if (request.type === "getTimerState") {
    // 현재 타이머 상태 요청
    sendResponse({ timerState: timerState });
  }
  else if (request.type === "saveTimerState") {
    // 타이머 상태 저장
    timerState = request.timerState;
    chrome.storage.local.set({ timer: timerState });
    sendResponse({ success: true });
  }
  else if (request.type === "notification") {
    // 알림 요청
    showNotification();
    sendResponse({ success: true });
  } 
  else if (request.type === "createWindow") {
    // 새 창 생성 요청
    chrome.windows.create({
      url: "popup.html",
      type: "popup",
      width: 320,
      height: 480,
      focused: true,
      left: 100,
      top: 100
    }, function(window) {
      if (window) {
        chrome.windows.update(window.id, {
          width: 320,
          height: 480
        });
      }
      sendResponse({ success: true });
    });
    return true; // 비동기 응답을 위해 true 반환
  }
  
  // 비동기 응답이 필요하지 않은 경우 여기서는 true를 반환하지 않음
});

// 알람 이벤트 리스너
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === "timerAlarm") {
    console.log('알람 발생: 타이머 종료!');
    
    // 타이머 상태 업데이트
    timerState.isRunning = false;
    timerState.totalSeconds = 0;
    
    // 상태 저장
    chrome.storage.local.set({ timer: timerState });
    
    // 인터벌이 아직 실행 중이면 정지
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // 알림 표시
    showNotification();
  }
});

// 스토리지 변경 감지
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.timer) {
    const newTimerState = changes.timer.newValue;
    console.log('타이머 상태 변경:', newTimerState);
    
    // 백그라운드 타이머 상태 업데이트
    if (newTimerState && newTimerState.isRunning && !timerInterval) {
      timerState = newTimerState;
      startBackgroundTimer();
    }
  }
});