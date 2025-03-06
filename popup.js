document.addEventListener('DOMContentLoaded', function() {
  console.log("팝업 로드됨");
  
  // 팝업이 열릴 때 배지 제거
  chrome.action.setBadgeText({text: ""});

  // DOM 요소
  const minutesDisplay = document.getElementById('minutes');
  const secondsDisplay = document.getElementById('seconds');
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const pinButton = document.getElementById('pin-button');
  const minUpBtn = document.getElementById('min-up');
  const minDownBtn = document.getElementById('min-down');
  const secUpBtn = document.getElementById('sec-up');
  const secDownBtn = document.getElementById('sec-down');
  
  // 입력 모달 요소
  const minutesInputModal = document.getElementById('minutes-input-modal');
  const secondsInputModal = document.getElementById('seconds-input-modal');
  const minutesInput = document.getElementById('minutes-input');
  const secondsInput = document.getElementById('seconds-input');
  const minutesCancel = document.getElementById('minutes-cancel');
  const minutesConfirm = document.getElementById('minutes-confirm');
  const secondsCancel = document.getElementById('seconds-cancel');
  const secondsConfirm = document.getElementById('seconds-confirm');
  
  // 창 크기 고정 시도
  ensureWindowSize();
  
  // 상태 변수
  let minutes = 15;
  let seconds = 0;
  let totalSeconds = minutes * 60 + seconds;
  let initialTotalSeconds = totalSeconds;
  let timer;
  let isRunning = false;
  let isPinned = false;
  
  // 백그라운드 동기화 타이머
  let syncTimer;
  
  // 처음 로드될 때 백그라운드와 상태 동기화
  syncTimerWithBackground();
  
  // 초기 타이머 표시
  updateTimerDisplay();
  
  // 1초마다 백그라운드와 동기화
  syncTimer = setInterval(syncTimerWithBackground, 1000);
  
  // 창 크기 고정 함수
  function ensureWindowSize() {
    // 직접 HTML 요소에 크기 적용
    document.documentElement.style.width = '320px';
    document.documentElement.style.height = '480px';
    document.body.style.width = '320px';
    document.body.style.height = '480px';
    
    // 모바일 디바이스에서도 화면 크기 유지
    if (document.querySelector('meta[name="viewport"]')) {
      document.querySelector('meta[name="viewport"]').setAttribute(
        'content', 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }
    
    // 창 크기가 변경되는 경우 다시 적용
    window.addEventListener('resize', function() {
      document.documentElement.style.width = '320px';
      document.documentElement.style.height = '480px';
    });
  }
  
  // 타이머 표시 업데이트
  function updateTimerDisplay() {
    console.log("타이머 표시 업데이트:", minutes, seconds);
    minutesDisplay.textContent = String(minutes).padStart(2, '0');
    secondsDisplay.textContent = String(seconds).padStart(2, '0');
  }
  
  // 백그라운드에서 실시간으로 타이머 상태 가져오기
  function syncTimerWithBackground() {
    chrome.runtime.sendMessage({
      type: "getTimerState"
    }, function(response) {
      if (response && response.timerState) {
        const state = response.timerState;
        
        // 현재 타이머 업데이트 (백그라운드 시간 기준)
        if (state.isRunning) {
          // 현재 남은 시간 계산
          const now = Date.now();
          const remainingMs = Math.max(0, state.endTime - now);
          totalSeconds = Math.ceil(remainingMs / 1000);
          
          // 화면 업데이트
          minutes = Math.floor(totalSeconds / 60);
          seconds = totalSeconds % 60;
          updateTimerDisplay();
          
          // 색상 업데이트
          minutesDisplay.classList.add('text-red-500');
          secondsDisplay.classList.add('text-red-500');
          
          // 구분자 색상 업데이트
          const separators = document.querySelectorAll('.time-separator');
          if (separators && separators.length > 0) {
            separators.forEach(separator => {
              separator.classList.add('text-red-500');
            });
          }
          
          // 버튼 상태 업데이트
          startButton.innerHTML = '<div class="pause-icon"></div>';
          
          // 현재 실행 중이 아니라면 타이머 시작
          if (!isRunning) {
            isRunning = true;
            
            // 이미 실행 중인 타이머가 있다면 정리
            if (timer) {
              clearInterval(timer);
            }
            
            // 로컬 타이머 시작
            timer = setInterval(function() {
              if (totalSeconds <= 0) {
                clearInterval(timer);
                isRunning = false;
                startButton.innerHTML = '<div class="play-icon"></div>';
                
                // 색상 초기화
                minutesDisplay.classList.remove('text-red-500');
                secondsDisplay.classList.remove('text-red-500');
                
                const separators = document.querySelectorAll('.time-separator');
                if (separators && separators.length > 0) {
                  separators.forEach(separator => {
                    separator.classList.remove('text-red-500');
                  });
                }
                
                return;
              }
              
              totalSeconds--;
              minutes = Math.floor(totalSeconds / 60);
              seconds = totalSeconds % 60;
              updateTimerDisplay();
            }, 1000);
          }
        } else if (state.totalSeconds > 0) {
          // 타이머가 실행 중이 아니지만 값이 있는 경우
          totalSeconds = state.totalSeconds;
          initialTotalSeconds = state.initialTotalSeconds;
          
          // 화면 업데이트
          minutes = Math.floor(totalSeconds / 60);
          seconds = totalSeconds % 60;
          updateTimerDisplay();
          
          // 이미 실행 중인 타이머가 있다면 정리
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
          
          // 현재 실행 중이라면 상태 변경
          if (isRunning) {
            isRunning = false;
            startButton.innerHTML = '<div class="play-icon"></div>';
            
            // 색상 초기화
            minutesDisplay.classList.remove('text-red-500');
            secondsDisplay.classList.remove('text-red-500');
            
            const separators = document.querySelectorAll('.time-separator');
            if (separators && separators.length > 0) {
              separators.forEach(separator => {
                separator.classList.remove('text-red-500');
              });
            }
          }
        }
      }
    });
  }
  
  // 백그라운드에 타이머 상태 저장
  function saveTimerStateToBackground() {
    const timerState = {
      isRunning: isRunning,
      totalSeconds: totalSeconds,
      initialTotalSeconds: initialTotalSeconds,
      lastUpdated: Date.now()
    };
    
    // 실행 중인 경우 종료 시간 추가
    if (isRunning) {
      timerState.endTime = Date.now() + (totalSeconds * 1000);
    }
    
    // 백그라운드에 상태 저장 요청
    chrome.runtime.sendMessage({
      type: "saveTimerState",
      timerState: timerState
    }, function(response) {
      console.log('타이머 상태 저장 응답:', response);
    });
  }
  
  // 타이머 시작
  function startTimer() {
    if (isRunning) return;
    
    if (totalSeconds <= 0) {
      totalSeconds = minutes * 60;
      initialTotalSeconds = totalSeconds;
    }
    
    isRunning = true;
    
    // 버튼 아이콘 변경
    startButton.innerHTML = '<div class="pause-icon"></div>';
    
    // 텍스트 색상 빨간색으로 변경
    minutesDisplay.classList.add('text-red-500');
    secondsDisplay.classList.add('text-red-500');
    
    // 구분자도 빨간색으로 변경
    const separators = document.querySelectorAll('.time-separator');
    if (separators && separators.length > 0) {
      separators.forEach(separator => {
        separator.classList.add('text-red-500');
      });
    }
    
    // 타이머 상태 저장
    const timerState = {
      isRunning: true,
      totalSeconds: totalSeconds,
      initialTotalSeconds: initialTotalSeconds,
      lastUpdated: Date.now(),
      endTime: Date.now() + (totalSeconds * 1000)
    };
    
    // 백그라운드 타이머 시작 요청
    chrome.runtime.sendMessage({
      type: "startTimer",
      timerState: timerState
    }, function(response) {
      console.log('백그라운드 타이머 시작 응답:', response);
    });
    
    // 로컬 타이머도 시작
    timer = setInterval(function() {
      if (totalSeconds <= 0) {
        clearInterval(timer);
        isRunning = false;
        startButton.innerHTML = '<div class="play-icon"></div>';
        
        // 텍스트 색상 원래대로 변경
        minutesDisplay.classList.remove('text-red-500');
        secondsDisplay.classList.remove('text-red-500');
        
        // 구분자 색상도 원래대로 변경
        const separators = document.querySelectorAll('.time-separator');
        if (separators && separators.length > 0) {
          separators.forEach(separator => {
            separator.classList.remove('text-red-500');
          });
        }
        
        // 알림 요청 - 안정성을 위해 지연 실행
        setTimeout(() => {
          notifyUser();
        }, 100);
        return;
      }
      
      totalSeconds--;
      minutes = Math.floor(totalSeconds / 60);
      seconds = totalSeconds % 60;
      
      updateTimerDisplay();
    }, 1000);
  }
  
  // 타이머 일시정지
  function pauseTimer() {
    if (!isRunning) return;
    
    clearInterval(timer);
    isRunning = false;
    
    // 버튼 아이콘 변경
    startButton.innerHTML = '<div class="play-icon"></div>';
    
    // 텍스트 색상 원래대로 변경
    minutesDisplay.classList.remove('text-red-500');
    secondsDisplay.classList.remove('text-red-500');
    
    // 구분자 색상도 원래대로 변경
    const separators = document.querySelectorAll('.time-separator');
    if (separators && separators.length > 0) {
      separators.forEach(separator => {
        separator.classList.remove('text-red-500');
      });
    }
    
    // 타이머 상태 저장
    const timerState = {
      isRunning: false,
      totalSeconds: totalSeconds,
      initialTotalSeconds: initialTotalSeconds,
      lastUpdated: Date.now()
    };
    
    // 백그라운드 타이머 일시정지 요청
    chrome.runtime.sendMessage({
      type: "pauseTimer",
      timerState: timerState
    }, function(response) {
      console.log('백그라운드 타이머 일시정지 응답:', response);
    });
  }
  
  // 타이머 정지
  function stopTimer() {
    clearInterval(timer);
    isRunning = false;
    
    totalSeconds = initialTotalSeconds;
    minutes = Math.floor(totalSeconds / 60);
    seconds = 0;
    
    startButton.innerHTML = '<div class="play-icon"></div>';
    
    // 텍스트 색상 원래대로 변경
    minutesDisplay.classList.remove('text-red-500');
    secondsDisplay.classList.remove('text-red-500');
    
    // 구분자 색상도 원래대로 변경
    const separators = document.querySelectorAll('.time-separator');
    if (separators && separators.length > 0) {
      separators.forEach(separator => {
        separator.classList.remove('text-red-500');
      });
    }
    
    updateTimerDisplay();
    
    // 타이머 상태 저장
    const timerState = {
      isRunning: false,
      totalSeconds: totalSeconds,
      initialTotalSeconds: initialTotalSeconds,
      lastUpdated: Date.now()
    };
    
    // 백그라운드 타이머 리셋 요청
    chrome.runtime.sendMessage({
      type: "resetTimer",
      timerState: timerState
    }, function(response) {
      console.log('백그라운드 타이머 리셋 응답:', response);
    });
  }
  
  // 알림 기능
  function notifyUser() {
    console.log('팝업에서 알림 요청');
    chrome.runtime.sendMessage({
      type: "notification"
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('알림 요청 오류:', chrome.runtime.lastError);
        
        // 오류 발생 시 직접 알림 생성 시도
        try {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("images/icon128.png"),
            title: "Minimal Timer",
            message: "타이머가 종료되었습니다!",
            requireInteraction: true,
            priority: 2,
            silent: true,
            buttons: [
              { title: "확인" },
              { title: "5분 더" }
            ]
          });
        } catch (err) {
          console.error('직접 알림 생성 실패:', err);
        }
        return;
      }
      
      console.log('알림 요청 응답:', response);
    });
  }
  
  // 고정 창 토글
  function togglePin() {
    isPinned = !isPinned;
    
    if (isPinned) {
      document.body.classList.add('pinned');
      
      // 새 윈도우로 열기
      chrome.runtime.sendMessage({
        type: "createWindow"
      }, function(response) {
        console.log('창 생성 응답:', response);
      });
    } else {
      document.body.classList.remove('pinned');
    }
  }
  
  // 숫자 클릭 시 직접 입력 모달 표시
  minutesDisplay.addEventListener('click', function() {
    if (isRunning) return; // 타이머 작동 중에는 편집 불가
    
    minutesInput.value = minutes;
    minutesInputModal.style.display = 'flex';
    minutesInput.focus();
    minutesInput.select();
  });
  
  secondsDisplay.addEventListener('click', function() {
    if (isRunning) return; // 타이머 작동 중에는 편집 불가
    
    secondsInput.value = seconds;
    secondsInputModal.style.display = 'flex';
    secondsInput.focus();
    secondsInput.select();
  });
  
  // 모달 취소 버튼
  minutesCancel.addEventListener('click', function() {
    minutesInputModal.style.display = 'none';
  });
  
  secondsCancel.addEventListener('click', function() {
    secondsInputModal.style.display = 'none';
  });
  
  // 모달 확인 버튼
  minutesConfirm.addEventListener('click', function() {
    const newValue = parseInt(minutesInput.value);
    if (!isNaN(newValue) && newValue >= 0 && newValue <= 99) {
      minutes = newValue;
      totalSeconds = minutes * 60 + seconds;
      initialTotalSeconds = totalSeconds;
      updateTimerDisplay();
      
      // 백그라운드에 상태 저장
      saveTimerStateToBackground();
    }
    minutesInputModal.style.display = 'none';
  });
  
  secondsConfirm.addEventListener('click', function() {
    const newValue = parseInt(secondsInput.value);
    if (!isNaN(newValue) && newValue >= 0 && newValue <= 59) {
      seconds = newValue;
      totalSeconds = minutes * 60 + seconds;
      initialTotalSeconds = totalSeconds;
      updateTimerDisplay();
      
      // 백그라운드에 상태 저장
      saveTimerStateToBackground();
    }
    secondsInputModal.style.display = 'none';
  });
  
  // 모달 내 Enter 키 처리
  minutesInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      minutesConfirm.click();
    } else if (e.key === 'Escape') {
      minutesCancel.click();
    }
  });
  
  secondsInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      secondsConfirm.click();
    } else if (e.key === 'Escape') {
      secondsCancel.click();
    }
  });
  
  // 모달 외부 클릭 시 닫기
  window.addEventListener('click', function(e) {
    if (e.target === minutesInputModal) {
      minutesInputModal.style.display = 'none';
    }
    if (e.target === secondsInputModal) {
      secondsInputModal.style.display = 'none';
    }
  });
  
  // 이벤트 리스너
  startButton.addEventListener('click', function() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });
  
  stopButton.addEventListener('click', stopTimer);
  pinButton.addEventListener('click', togglePin);
  
  // 시간 조절 버튼
  minUpBtn.addEventListener('click', function() {
    console.log("분 증가 버튼 클릭");
    if (isRunning) return;
    minutes = Math.max(0, Math.min(99, minutes + 1));
    totalSeconds = minutes * 60 + seconds;
    initialTotalSeconds = totalSeconds;
    updateTimerDisplay();
    
    // 백그라운드에 상태 저장
    saveTimerStateToBackground();
  });
  
  minDownBtn.addEventListener('click', function() {
    console.log("분 감소 버튼 클릭");
    if (isRunning) return;
    minutes = Math.max(0, Math.min(99, minutes - 1));
    totalSeconds = minutes * 60 + seconds;
    initialTotalSeconds = totalSeconds;
    updateTimerDisplay();
    
    // 백그라운드에 상태 저장
    saveTimerStateToBackground();
  });
  
  secUpBtn.addEventListener('click', function() {
    console.log("초 증가 버튼 클릭");
    if (isRunning) return;
    seconds = Math.max(0, Math.min(59, seconds + 1));
    totalSeconds = minutes * 60 + seconds;
    initialTotalSeconds = totalSeconds;
    updateTimerDisplay();
    
    // 백그라운드에 상태 저장
    saveTimerStateToBackground();
  });
  
  secDownBtn.addEventListener('click', function() {
    console.log("초 감소 버튼 클릭");
    if (isRunning) return;
    seconds = Math.max(0, Math.min(59, seconds - 1));
    totalSeconds = minutes * 60 + seconds;
    initialTotalSeconds = totalSeconds;
    updateTimerDisplay();
    
    // 백그라운드에 상태 저장
    saveTimerStateToBackground();
  });
  
  // 키보드 이벤트
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowUp') {
      if (!isRunning) {
        minUpBtn.click();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (!isRunning) {
        minDownBtn.click();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (!isRunning) {
        secUpBtn.click();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      if (!isRunning) {
        secDownBtn.click();
      }
      e.preventDefault();
    } else if (e.key === ' ') {
      if (isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
      e.preventDefault();
    }
  });
  
  // 페이지 닫힐 때 동기화 타이머 정리
  window.addEventListener('beforeunload', function() {
    if (syncTimer) {
      clearInterval(syncTimer);
    }
    if (timer) {
      clearInterval(timer);
    }
    
    // 창을 닫기 전에 현재 상태 저장
    saveTimerStateToBackground();
  });
  
  // 초기화
  updateTimerDisplay();
});