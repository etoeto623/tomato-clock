// 全局变量
let timer;
let remainingTime = 0;
let totalDuration = 0; // 记录总时长
let isRunning = false;
let isPaused = false;
let currentTask = null;
let taskStartTime = null;
let pausedAt = null; // 记录暂停时的时间戳
let elapsedTime = 0; // 已经过去的时间（毫秒）
let pauseHistory = []; // 记录暂停和恢复的历史
let isExtendedTask = false; // 标记是否为延长的任务
let originalTaskRecord = null; // 存储原始任务记录
let timerMode = 'countdown'; // 计时模式：'countdown'（倒计时）或'tracking'（正计时）

// 监听延长任务时间的消息
if (window.electronAPI) {
  window.electronAPI.onTaskTimeExtended((event, minutes) => {
    extendTaskTime(minutes);
  });
}

// DOM元素
const taskNameInput = document.getElementById('task-name');
const taskMinutesInput = document.getElementById('task-minutes');
const taskSecondsInput = document.getElementById('task-seconds');
const timeLeftDisplay = document.getElementById('time-left');
const currentTaskDisplay = document.getElementById('current-task');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const completeBtn = document.getElementById('complete-btn');
const stopBtn = document.getElementById('stop-btn');
const historyBtn = document.getElementById('history-btn');
const weekStatsBtn = document.getElementById('week-stats-btn');
const countdownModeRadio = document.querySelector('input[name="timerMode"][value="countdown"]');
const trackingModeRadio = document.querySelector('input[name="timerMode"][value="tracking"]');

// 初始化
window.addEventListener('DOMContentLoaded', () => {
  // 尝试恢复暂停的任务状态
  const pausedTaskState = localStorage.getItem('pausedTaskState');
  if (pausedTaskState) {
    try {
      const taskState = JSON.parse(pausedTaskState);
      currentTask = taskState.taskName;
      remainingTime = taskState.remainingTime;
      totalDuration = remainingTime; // 恢复总时长
      isRunning = true;
      isPaused = true;
      taskStartTime = new Date(taskState.taskStartTime);
      pausedAt = new Date().getTime(); // 设置当前时间为暂停时间
      
      // 更新显示
      timeLeftDisplay.textContent = formatTime(remainingTime);
      currentTaskDisplay.textContent = `已暂停: ${currentTask}`;
      taskNameInput.value = currentTask;
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      taskMinutesInput.value = minutes;
      taskSecondsInput.value = seconds;
      
      // 清除保存的状态
      localStorage.removeItem('pausedTaskState');
    } catch (error) {
      console.error('恢复暂停任务状态失败:', error);
    }
  }
  
  // 添加计时模式切换事件监听器
  countdownModeRadio.addEventListener('change', () => {
    if (countdownModeRadio.checked) {
      timerMode = 'countdown';
      // 启用时间输入
      taskMinutesInput.disabled = false;
      taskSecondsInput.disabled = false;
    }
  });
  
  trackingModeRadio.addEventListener('change', () => {
    if (trackingModeRadio.checked) {
      timerMode = 'tracking';
      // 禁用时间输入
      taskMinutesInput.disabled = true;
      taskSecondsInput.disabled = true;
    }
  });
  
  updateButtonStates();
});

// 更新按钮状态
function updateButtonStates() {
  startBtn.disabled = isRunning && !isPaused;
  pauseBtn.disabled = !isRunning || isPaused;
  resumeBtn.disabled = !isPaused;
  completeBtn.disabled = !isRunning; // 只有任务在执行或暂停时才能点击完成
  stopBtn.disabled = !isRunning;
  historyBtn.disabled = isRunning && !isPaused; // 任务正在进行时禁用历史按钮
  weekStatsBtn.disabled = isRunning && !isPaused; // 任务正在进行时禁用周统计按钮
}

// 格式化时间显示
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 开始计时
startBtn.addEventListener('click', startTimer);

function startTimer() {
  const taskName = taskNameInput.value.trim();
  
  // 检查任务标题是否为空
  if (!taskName) {
    alert('请输入任务标题');
    return;
  }
  
  currentTask = taskName;
  taskStartTime = new Date();
  isRunning = true;
  isPaused = false;
  elapsedTime = 0;
  pauseHistory = []; // 重置暂停历史
  isExtendedTask = false; // 重置延长任务标记
  originalTaskRecord = null; // 重置原始任务记录
  
  if (timerMode === 'countdown') {
    // 倒计时模式逻辑
    const minutes = parseInt(taskMinutesInput.value) || 0;
    const seconds = parseInt(taskSecondsInput.value) || 0;
    
    if (minutes === 0 && seconds === 0) {
      alert('请设置有效的时间');
      return;
    }
    
    remainingTime = minutes * 60 + seconds;
    totalDuration = remainingTime; // 保存总时长
    
    // 更新显示
    timeLeftDisplay.textContent = formatTime(remainingTime);
    
    // 开始倒计时 - 使用Date.now()计算准确时间，避免setInterval被节流
    const startTime = taskStartTime.getTime();
    
    timer = setInterval(() => {
      if (!isPaused) {
        const currentTime = Date.now();
        elapsedTime = currentTime - startTime;
        remainingTime = Math.max(0, totalDuration - Math.floor(elapsedTime / 1000));
        
        timeLeftDisplay.textContent = formatTime(remainingTime);
        
        if (remainingTime <= 0) {
          clearInterval(timer);
          timerComplete();
        }
      }
    }, 1000);
  } else {
    // 追踪模式逻辑（正计时）
    remainingTime = 0; // 正计时从0开始
    
    // 更新显示
    timeLeftDisplay.textContent = formatTime(remainingTime);
    
    // 开始正计时 - 使用Date.now()计算准确时间，避免setInterval被节流
    const startTime = taskStartTime.getTime();
    
    timer = setInterval(() => {
      if (!isPaused) {
        const currentTime = Date.now();
        elapsedTime = currentTime - startTime;
        remainingTime = Math.floor(elapsedTime / 1000); // 正计时直接累加
        
        timeLeftDisplay.textContent = formatTime(remainingTime);
        // 正计时模式下不会自动结束，只能手动完成
      }
    }, 1000);
  }
  
  // 更新公共显示
  currentTaskDisplay.textContent = `正在进行: ${currentTask}`;
  updateButtonStates();
}

// 暂停计时
pauseBtn.addEventListener('click', pauseTimer);

function pauseTimer() {
  if (isRunning && !isPaused) {
    clearInterval(timer);
    isPaused = true;
    pausedAt = new Date().getTime(); // 记录暂停时间
    
    // 记录暂停事件
    pauseHistory.push({
      type: 'pause',
      timestamp: new Date().toISOString()
    });
    
    currentTaskDisplay.textContent = `已暂停: ${currentTask}`;
    updateButtonStates();
  }
}

// 继续计时
resumeBtn.addEventListener('click', resumeTimer);

function resumeTimer() {
  if (isPaused) {
    isPaused = false;
    
    // 记录恢复事件
    pauseHistory.push({
      type: 'resume',
      timestamp: new Date().toISOString()
    });
    
    currentTaskDisplay.textContent = `正在进行: ${currentTask}`;
    updateButtonStates();
    
    // 调整开始时间，考虑暂停期间的时间
    const pausedDuration = new Date().getTime() - pausedAt;
    taskStartTime = new Date(taskStartTime.getTime() + pausedDuration);
    const startTime = taskStartTime.getTime();
    
    if (timerMode === 'countdown') {
      // 倒计时模式的恢复逻辑 - 使用Date.now()计算准确时间
      timer = setInterval(() => {
        if (!isPaused) {
          const currentTime = Date.now();
          elapsedTime = currentTime - startTime;
          remainingTime = Math.max(0, totalDuration - Math.floor(elapsedTime / 1000));
          
          timeLeftDisplay.textContent = formatTime(remainingTime);
          
          if (remainingTime <= 0) {
            clearInterval(timer);
            timerComplete();
          }
        }
      }, 1000);
    } else {
      // 追踪模式的恢复逻辑 - 使用Date.now()计算准确时间
      timer = setInterval(() => {
        if (!isPaused) {
          const currentTime = Date.now();
          elapsedTime = currentTime - startTime;
          remainingTime = Math.floor(elapsedTime / 1000); // 正计时直接累加
          
          timeLeftDisplay.textContent = formatTime(remainingTime);
        }
      }, 1000);
    }
  }
}

// 完成任务
completeBtn.addEventListener('click', completeTask);

function completeTask() {
  if (isRunning) {
    clearInterval(timer);
    
    // 计算实际用时（分钟）
    const endTime = new Date();
    const durationMinutes = Math.round((endTime - taskStartTime) / (1000 * 60));
    
    // 创建任务记录，包含暂停历史
    const taskRecord = {
      name: currentTask,
      duration: durationMinutes,
      completedAt: endTime.toISOString(),
      startTime: taskStartTime.toISOString(),
      pauses: pauseHistory // 记录暂停和恢复的历史
    };
    
    // 保存原始任务记录（如果是首次完成）
    if (!isExtendedTask) {
      originalTaskRecord = taskRecord;
    }
    
    // 保存任务历史
    saveTaskRecord(taskRecord);
    
    // 显示通知
    if (window.electronAPI) {
      window.electronAPI.showNotification('番茄时钟', `${currentTask} 已完成！`);
    }
    
    // 重置状态
    isRunning = false;
    isPaused = false;
    remainingTime = 0;
    
    // 更新显示
    let displayTime = 0;
    if (timerMode === 'countdown') {
      const minutes = parseInt(taskMinutesInput.value) || 25;
      const seconds = parseInt(taskSecondsInput.value) || 0;
      displayTime = minutes * 60 + seconds;
    } else {
      displayTime = 0; // 追踪模式重置为0
    }
    
    timeLeftDisplay.textContent = formatTime(displayTime);
    currentTaskDisplay.textContent = '准备开始';
    updateButtonStates();
  }
}

// 停止计时
stopBtn.addEventListener('click', stopTimer);

function stopTimer() {
  if (isRunning) {
    clearInterval(timer);
    
    // 重置状态
    isRunning = false;
    isPaused = false;
    remainingTime = 0;
    pauseHistory = []; // 重置暂停历史
    isExtendedTask = false; // 重置延长任务标记
    originalTaskRecord = null; // 重置原始任务记录
    
    // 更新显示
    let displayTime = 0;
    if (timerMode === 'countdown') {
      const minutes = parseInt(taskMinutesInput.value) || 25;
      const seconds = parseInt(taskSecondsInput.value) || 0;
      displayTime = minutes * 60 + seconds;
    } else {
      displayTime = 0; // 追踪模式重置为0
    }
    
    timeLeftDisplay.textContent = formatTime(displayTime);
    currentTaskDisplay.textContent = '准备开始';
    updateButtonStates();
  }
}

// 计时完成
function timerComplete() {
  // 计算实际用时
  const endTime = new Date();
  
  // 如果是延长任务，我们需要特殊处理
  if (isExtendedTask && originalTaskRecord) {
    // 使用原始任务的开始时间，计算总时长
    const totalDurationMinutes = Math.round((endTime - new Date(originalTaskRecord.startTime)) / (1000 * 60));
    
    // 创建更新后的任务记录，合并暂停历史
    const combinedPauseHistory = [...originalTaskRecord.pauses, ...pauseHistory];
    
    const updatedTaskRecord = {
      name: currentTask,
      duration: totalDurationMinutes,
      completedAt: endTime.toISOString(),
      startTime: originalTaskRecord.startTime, // 使用原始开始时间
      pauses: combinedPauseHistory // 合并所有暂停历史
    };
    
    // 先删除原始任务记录
    deleteLastTaskRecord().then(() => {
      // 保存更新后的任务记录
      return saveTaskRecord(updatedTaskRecord);
    }).then(() => {
      // 显示通知
      if (window.electronAPI) {
        window.electronAPI.showNotification('番茄时钟', `${currentTask} 已完成！`);
        // 显示任务完成弹窗
        window.electronAPI.showTaskCompleteWindow(currentTask);
      }
    }).catch(error => {
      console.error('更新任务记录失败:', error);
    });
  } else {
    // 正常任务流程
    const durationMinutes = Math.round((endTime - taskStartTime) / (1000 * 60));
    
    // 创建任务记录，包含暂停历史
    const taskRecord = {
      name: currentTask,
      duration: durationMinutes,
      completedAt: endTime.toISOString(),
      startTime: taskStartTime.toISOString(),
      pauses: pauseHistory // 记录暂停和恢复的历史
    };
    
    // 保存原始任务记录（如果是首次完成）
    if (!isExtendedTask) {
      originalTaskRecord = taskRecord;
    }
    
    // 保存任务历史
    saveTaskRecord(taskRecord).then(() => {
      // 显示通知
      if (window.electronAPI) {
        window.electronAPI.showNotification('番茄时钟', `${currentTask} 已完成！`);
        // 显示任务完成弹窗
        window.electronAPI.showTaskCompleteWindow(currentTask);
      }
    });
  }
  
  // 重置状态
  isRunning = false;
  isPaused = false;
  remainingTime = 0;
  pauseHistory = []; // 重置暂停历史
  isExtendedTask = false; // 重置延长任务标记
  
  // 更新显示
    let displayTime = 0;
    if (timerMode === 'countdown') {
      const minutes = parseInt(taskMinutesInput.value) || 25;
      const seconds = parseInt(taskSecondsInput.value) || 0;
      displayTime = minutes * 60 + seconds;
    } else {
      displayTime = 0; // 追踪模式重置为0
    }
    
    timeLeftDisplay.textContent = formatTime(displayTime);
    currentTaskDisplay.textContent = '准备开始';
    updateButtonStates();
}

// 延长任务时间函数
function extendTaskTime(minutes) {
  // 标记为延长任务
  isExtendedTask = true;
  
  // 重置任务状态为运行中
  isRunning = true;
  isPaused = false;
  
  // 记录延长时间点，但保留原始开始时间用于任务记录
  const extendTimePoint = new Date();
  
  // 记录延长事件
  pauseHistory.push({
    type: 'extend',
    timestamp: extendTimePoint.toISOString()
  });
  
  if (timerMode === 'countdown') {
    // 倒计时模式延长逻辑
    remainingTime = minutes * 60; // 转换为秒
    totalDuration = remainingTime;
    
    // 更新显示
    timeLeftDisplay.textContent = formatTime(remainingTime);
    
    // 开始新的倒计时
    const startTime = extendTimePoint.getTime();
    
    timer = setInterval(() => {
      if (!isPaused) {
        const currentTime = new Date().getTime();
        elapsedTime = currentTime - startTime;
        remainingTime = Math.max(0, totalDuration - Math.floor(elapsedTime / 1000));
        
        timeLeftDisplay.textContent = formatTime(remainingTime);
        
        if (remainingTime <= 0) {
          clearInterval(timer);
          timerComplete();
        }
      }
    }, 1000);
  } else {
    // 追踪模式延长逻辑 - 实际上不需要延长，继续计时即可
    // 更新显示
    timeLeftDisplay.textContent = formatTime(remainingTime);
    
    // 继续正计时
    const startTime = extendTimePoint.getTime();
    const currentElapsedTime = remainingTime; // 当前已计时的秒数
    
    timer = setInterval(() => {
      if (!isPaused) {
        const currentTime = new Date().getTime();
        elapsedTime = currentTime - startTime;
        remainingTime = currentElapsedTime + Math.floor(elapsedTime / 1000); // 累加当前时间和新增时间
        
        timeLeftDisplay.textContent = formatTime(remainingTime);
      }
    }, 1000);
  }
  
  currentTaskDisplay.textContent = `延长任务: ${currentTask}`;
  updateButtonStates();
}

// 保存任务记录
async function saveTaskRecord(taskRecord) {
  try {
    await window.electronAPI.saveTaskHistory(taskRecord);
    return true;
  } catch (error) {
    console.error('保存任务记录失败:', error);
    return false;
  }
}

// 删除最后一条任务记录（用于延长任务时合并记录）
async function deleteLastTaskRecord() {
  try {
    const history = await window.electronAPI.getTaskHistory();
    if (history && history.length > 0) {
      const lastIndex = history.length - 1;
      await window.electronAPI.deleteTask(lastIndex);
    }
    return true;
  } catch (error) {
    console.error('删除最后一条任务记录失败:', error);
    return false;
  }
}

// 历史按钮事件
historyBtn.addEventListener('click', () => {
  // 如果任务处于暂停状态，保存状态
  if (isPaused) {
    const pausedTaskState = {
      taskName: currentTask,
      remainingTime: remainingTime,
      taskStartTime: taskStartTime.toISOString()
    };
    localStorage.setItem('pausedTaskState', JSON.stringify(pausedTaskState));
  }
  window.location.href = 'history.html';
});

// 周统计按钮事件
weekStatsBtn.addEventListener('click', () => {
  // 如果任务处于暂停状态，保存状态
  if (isPaused) {
    const pausedTaskState = {
      taskName: currentTask,
      remainingTime: remainingTime,
      taskStartTime: taskStartTime.toISOString()
    };
    localStorage.setItem('pausedTaskState', JSON.stringify(pausedTaskState));
  }
  window.location.href = 'week-stats.html';
});