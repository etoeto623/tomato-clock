<template>
  <div class="container">
    <div class="header">
      <h1>时光机</h1>
      <div class="header-buttons">
        <button 
          class="btn-secondary"
          :disabled="buttonStates.navigationDisabled"
          @click="navigateToHistory"
        >
          历史记录
        </button>
        <button 
          class="btn-secondary"
          :disabled="buttonStates.navigationDisabled"
          @click="navigateToWeekStats"
        >
          周统计
        </button>
      </div>
    </div>
    
    <div class="main-content">
      <!-- 左侧：任务设置 -->
      <div class="task-setup">
        <div class="form-group">
          <label for="task-name">任务名称</label>
          <input 
            type="text" 
            id="task-name"
            v-model="taskName"
            :disabled="isRunning && !isPaused"
            placeholder="输入任务名称"
          >
        </div>
        
        <div class="form-group" style="padding-top:13px">
          <label>计时模式</label>
          <div class="radio-group time-mode-container">
            <label class="time-mode">
              <input 
                type="radio" 
                name="timerMode" 
                value="countdown"
                v-model="timerMode"
                :disabled="isRunning"
              >
              <span class="radio-custom"></span>
              倒计时
            </label>
            <label class="time-mode">
              <input 
                type="radio" 
                name="timerMode" 
                value="tracking"
                v-model="timerMode"
                :disabled="isRunning"
              >
              <span class="radio-custom"></span>
              正计时
            </label>
          </div>
        </div>
        
        <div class="form-group" style="padding-top:13px;" v-if="timerMode === 'countdown'">
          <label>任务时长</label>
          <div class="time-input-group">
            <input 
              type="number" 
              id="task-minutes"
              v-model.number="taskMinutes"
              :disabled="isRunning || timerMode === 'tracking'"
              min="0"
              max="59"
              placeholder="分钟"
            >
            <input 
              type="number" 
              id="task-seconds"
              v-model.number="taskSeconds"
              :disabled="isRunning || timerMode === 'tracking'"
              min="0"
              max="59"
              placeholder="秒"
            >
          </div>
        </div>
        
        <!-- 快捷时间设置按钮 -->
        <div class="quick-time-buttons" v-if="timerMode === 'countdown'">
          <button 
            class="btn-secondary quick-time"
            v-for="time in quickTimes"
            :key="time.value"
            @click="setQuickTime(time.value)"
            :disabled="timerMode === 'stopwatch' || isRunning"
          >
            {{ time.label }}
          </button>
        </div>
      </div>
      
      <!-- 右侧：计时器显示 -->
      <div class="timer-display">
        <div class="timer-circle">
          <div class="time-left" style="font-variant-numeric: tabular-nums;">{{ formattedTimeLeft }}</div>
          <div class="current-task" v-if="currentTask">
            {{ isPaused ? '已暂停: ' : '当前任务: ' }}{{ currentTask }}
          </div>
          <div class="current-task" v-else-if="taskName.trim()">
            待开始任务: {{ taskName }}
          </div>
        </div>
        
        <div class="timer-controls">
          <button 
            class="btn-primary"
            :disabled="buttonStates.startDisabled"
            @click="handleStartOrResume"
          >
            {{ getStartButtonText() }}
          </button>
          <button 
            class="btn-secondary"
            :disabled="buttonStates.pauseDisabled"
            @click="pauseTimer"
          >
            暂停
          </button>
          <button 
            class="btn-primary"
            :disabled="buttonStates.completeDisabled"
            @click="completeTask"
          >
            完成
          </button>

        </div>
      </div>
    </div>
    
    <!-- 已移除内部弹窗，改为使用外部窗口显示通知 -->
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'

export default {
  name: 'TimerView',
  data() {
    return {
      taskName: '',
      taskMinutes: 25,
      taskSeconds: 0,
      quickTimes: [
        { label: '25分钟', value: 25 * 60 },
        { label: '30分钟', value: 30 * 60 },
        { label: '45分钟', value: 45 * 60 },
        { label: '60分钟', value: 60 * 60 }
      ],
      isAutoCompleted: false
    }
  },
  computed: {
    ...mapState([
      'remainingTime',
      'totalDuration',
      'isRunning',
      'isPaused',
      'currentTask'
    ]),
    ...mapGetters([
      'formattedTimeLeft',
      'buttonStates'
    ]),
    // 为timerMode添加getter和setter实现双向绑定
    timerMode: {
      get() {
        return this.$store.state.timerMode
      },
      set(value) {
        this.$store.commit('SET_TIMER_MODE', value)
      }
    }
  },
  mounted() {
    // 尝试恢复暂停的任务状态
    this.restorePausedTaskState()
    
    // 检查是否有待处理的通知（当窗口从非激活状态恢复时）
    this.checkPendingNotification()
    
    // 监听窗口可见性变化，当窗口变为可见时检查待处理通知
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('窗口变为可见，检查待处理通知')
        this.checkPendingNotification()
      }
    })
    
    // 初始化计时器组件，优先使用Electron API获取当前活动屏幕信息
    console.log('初始化计时器组件，优先使用Electron API获取当前活动屏幕信息');
    
    // 监听延长任务时间的消息
    if (window.electronAPI) {
      window.electronAPI.onTaskTimeExtended((event, minutes) => {
        this.extendTaskTime(minutes)
      })
    }
  },
  beforeUnmount() {
    // 清除计时器
    if (this.$store.state.timer) {
      clearInterval(this.$store.state.timer)
    }
  },
  methods: {
      ...mapActions([
      'pauseTimer',
      'resumeTimer',
      'stopTimer',
      'startTimer',
      'setTimerMode'
    ]),
    
    // 暂停计时器
    pauseTimer() {
      // 清除定时器
      if (this.$store.state.timer) {
        clearInterval(this.$store.state.timer)
        this.$store.commit('SET_TIMER', null)
      }
      
      // 保存当前剩余时间到store，用于恢复时重新初始化
      this.$store.commit('SET_REMAINING_TIME', this.remainingTime)
      
      this.$store.dispatch('pauseTimer')
    },
    
    // 设置快捷时间
    setQuickTime(totalSeconds) {
      this.taskMinutes = Math.floor(totalSeconds / 60)
      this.taskSeconds = totalSeconds % 60
    },
    
    // 恢复计时器并重新初始化
    resumeTimerWithValidation() {
      console.log('resumeTimerWithValidation called')
      // 恢复计时器（这会更新elapsedTime但不重置它）
      this.resumeTimer()
      // 重新初始化计时器间隔
      this.startTimerInterval()
    },
    
    // 开始计时器并添加验证逻辑
    async startTimerWithValidation() {
      console.log('startTimerWithValidation called, timerMode:', this.timerMode)
      if (!this.taskName.trim()) {
        alert('请输入任务名称')
        return
      }
      
      let minutes = this.taskMinutes || 0
      let seconds = this.taskSeconds || 0
      
      if (this.timerMode === 'tracking') {
        // 正计时模式 - 从0开始
        minutes = 0
        seconds = 0
        console.log('正计时模式，设置分钟和秒为0')
      }
      
      console.log('调用startTimer，参数:', { taskName: this.taskName, minutes, seconds, timerMode: this.timerMode })
      await this.startTimer({
        taskName: this.taskName,
        minutes,
        seconds,
        timerMode: this.timerMode
      })
      
      // 立即启动计时器间隔
      console.log('调用startTimerInterval')
      this.startTimerInterval()
    },
    
    // 启动计时器间隔
    startTimerInterval() {
      console.log('startTimerInterval called, timerMode:', this.timerMode)
      // 清除可能存在的旧计时器
      if (this.$store.state.timer) {
        clearInterval(this.$store.state.timer)
        console.log('已清除旧计时器')
      }
      
      // 确保remainingTime初始化为0（如果是NaN或无效值）
      if (isNaN(this.remainingTime)) {
        console.log('remainingTime为NaN，初始化为0')
        this.$store.commit('SET_REMAINING_TIME', 0)
      }
      
      // 对于恢复状态和首次启动状态的处理
      const isPaused = this.$store.state.isPaused
      const isResuming = isPaused || (this.$store.state.elapsedTime > 0)
      
      console.log('计时器模式:', this.timerMode, '是否暂停:', isPaused, '是否恢复:', isResuming, 
                 'elapsedTime:', this.$store.state.elapsedTime, 'remainingTime:', this.remainingTime)
      
      // 对于恢复状态，使用当前remainingTime作为基准
      let initialRemainingTime = this.remainingTime || 0
      
      // 如果不是恢复状态且是倒计时模式，使用任务设置的总时间
      if (!isResuming && this.timerMode === 'countdown') {
        const totalSecondsSet = (this.taskMinutes || 0) * 60 + (this.taskSeconds || 0)
        initialRemainingTime = totalSecondsSet
        console.log('倒计时首次启动，使用任务设置的总时间:', initialRemainingTime)
      }
      
      // 记录当前时间作为计时器开始的基准
      let timerStartTime = Date.now()
      
      // 对于正计时模式，如果是恢复状态，需要调整初始时间
      let accumulatedSeconds = 0
      if (isResuming && this.timerMode === 'tracking') {
        accumulatedSeconds = this.remainingTime || 0
        console.log('正计时恢复状态，累计秒数:', accumulatedSeconds)
      }
      
      const timer = setInterval(() => {
        // 使用基于时间戳的计算方式，避免浏览器节流影响
        const now = Date.now()
        const elapsedSeconds = Math.floor((now - timerStartTime) / 1000)
        
        console.log('计时器间隔执行, timerMode:', this.timerMode, 'elapsedSeconds:', elapsedSeconds)
        
        if (this.timerMode === 'countdown') {
          // 倒计时模式 - 直接使用当前remainingTime（在pauseTimer中已保存）
          const remainingSeconds = Math.max(0, initialRemainingTime - elapsedSeconds)
          
          console.log('倒计时模式，初始剩余时间:', initialRemainingTime, '已过时间:', elapsedSeconds, '当前剩余时间:', remainingSeconds)
          
          if (remainingSeconds <= 0) {
            // 时间已到0，先确保剩余时间设置为0
            this.$store.commit('SET_REMAINING_TIME', 0)
            
            // 计算准确的完成时间
            const completionTime = new Date()
            console.log('时间已到0，准确完成时间:', completionTime, '调用handleTimerComplete')
            
            // 记录准确的完成时间到store
            this.$store.commit('SET_TASK_COMPLETION_TIME', completionTime.toISOString())
            
            clearInterval(timer)
            this.handleTimerComplete()
            return
          }
          
          this.$store.commit('SET_REMAINING_TIME', remainingSeconds)
        } else {
          // 正计时模式 - 使用累计时间 + 新经过的时间
          const totalSeconds = accumulatedSeconds + elapsedSeconds
          
          console.log('正计时模式，累计秒数:', accumulatedSeconds, '新经过时间:', elapsedSeconds, '总时间:', totalSeconds)
          
          this.$store.commit('SET_REMAINING_TIME', totalSeconds)
          this.$store.commit('SET_TOTAL_DURATION', totalSeconds)
          this.$store.commit('SET_ELAPSED_TIME', totalSeconds * 1000) // 转换为毫秒以便store正确处理
        }
      }, 1000)
      
      this.$store.commit('SET_TIMER', timer)
      console.log('已设置新计时器')
    },
    
    // 完成任务
    completeTask() {
      console.log('completeTask called, isAutoCompleted:', this.isAutoCompleted)
      // 清除计时器
      if (this.$store.state.timer) {
        clearInterval(this.$store.state.timer)
        this.$store.commit('SET_TIMER', null)
      }
      
      // 对于倒计时模式，计算实际使用的时间
      if (this.timerMode === 'countdown' && this.isRunning) {
        const totalSecondsSet = (this.taskMinutes || 0) * 60 + (this.taskSeconds || 0)
        const remainingSeconds = this.remainingTime || 0
        
        // 计算实际使用的时间（总设置时间减去剩余时间）
        // 当remainingSeconds为0或1时，表示计时器已完成，实际用时就是总设置时间
        const actualDuration = remainingSeconds <= 1 ? totalSecondsSet : (totalSecondsSet - remainingSeconds)
        
        console.log('倒计时模式完成任务 - 总设置时间:', totalSecondsSet, '剩余时间:', remainingSeconds, '实际用时:', actualDuration)
        
        // 更新实际持续时间到store
        if (actualDuration > 0) {
          this.$store.commit('SET_TOTAL_DURATION', actualDuration)
        }
      }
      
      // 调用Vuex的completeTask action完成任务
      this.$store.dispatch('completeTask')
    },
    
    // 处理计时器完成
    async handleTimerComplete() {
      console.log('handleTimerComplete called')
      // 标记为自动完成
      this.isAutoCompleted = true
      console.log('isAutoCompleted set to:', this.isAutoCompleted)
      
      // 保存当前任务名称，以防在completeTask后被重置
      const taskNameForNotification = this.currentTask || '任务'
      console.log('准备显示通知，任务名称:', taskNameForNotification)
      
      // 保存通知信息到localStorage，以便在窗口激活时显示
      localStorage.setItem('pendingNotification', JSON.stringify({
        taskName: taskNameForNotification,
        timestamp: Date.now()
      }));
      console.log('已将通知信息保存到localStorage:', taskNameForNotification);
      
      // 尝试打开通知窗口
      try {
        // 使用localStorage传递任务名称，这比URL参数更可靠
        localStorage.setItem('notificationTaskName', taskNameForNotification);
        console.log('已将任务名称保存到localStorage:', taskNameForNotification);
        
        // 简化URL，不需要传递参数
        const notificationUrl = '#/notification';
        const fullUrl = `${window.location.origin}${notificationUrl}`;
        
        console.log('构造的通知URL:', fullUrl);
        
        // 计算通知窗口尺寸
        const notificationWidth = 350;
        const notificationHeight = 300;
        
        // 获取用户当前活动屏幕的信息
        let notificationLeft, notificationTop;
        
        // 优先使用Electron API获取当前活动屏幕信息
        if (window.electronAPI?.getPrimaryDisplay) {
          try {
            // 注意：getPrimaryDisplay是异步方法，需要使用await
            const screenInfo = await window.electronAPI.getPrimaryDisplay();
            console.log('通过Electron API获取的活动屏幕信息:', screenInfo);
            
            // 计算屏幕中央位置
            notificationLeft = screenInfo.bounds.x + (screenInfo.bounds.width / 2) - (notificationWidth / 2);
            notificationTop = screenInfo.bounds.y + (screenInfo.bounds.height / 2) - (notificationHeight / 2);
            console.log('使用Electron API获取的活动屏幕中央位置:', { left: notificationLeft, top: notificationTop });
          } catch (error) {
            console.error('获取Electron屏幕信息失败:', error);
            // 降级到浏览器API
            notificationLeft = window.screenLeft + (window.screen.availWidth / 2) - (notificationWidth / 2);
            notificationTop = window.screenTop + (window.screen.availHeight / 2) - (notificationHeight / 2);
            console.log('降级到浏览器API获取的屏幕中央位置:', { left: notificationLeft, top: notificationTop });
          }
        } else {
          // 降级方案：使用浏览器API获取当前屏幕信息
          notificationLeft = window.screenLeft + (window.screen.availWidth / 2) - (notificationWidth / 2);
          notificationTop = window.screenTop + (window.screen.availHeight / 2) - (notificationHeight / 2);
          console.log('使用浏览器API获取的屏幕中央位置:', { left: notificationLeft, top: notificationTop });
        }
        
        console.log('计算的通知窗口位置:', { left: notificationLeft, top: notificationTop });
        
        // 调整窗口参数，确保在Electron中正确显示，并设置位置
        const windowFeatures = `width=${notificationWidth},height=${notificationHeight},left=${notificationLeft},top=${notificationTop},frame=no,titlebar=no,alwaysOnTop=yes,menubar=no,toolbar=no,status=no`;
        
        // 使用window.open打开无边框窗口
        const notificationWindow = window.open(notificationUrl, 'taskNotification', windowFeatures);
        
        // 清除localStorage中的任务名称，以防下次使用旧值
        setTimeout(() => {
          localStorage.removeItem('notificationTaskName');
          console.log('已清除localStorage中的任务名称');
        }, 5000);
        
        if (!notificationWindow) {
          console.warn('无法打开通知窗口，可能被浏览器阻止，将在窗口激活时显示通知')
          // 窗口被阻止时，使用备用方案
          this.showNotificationWhenActive(taskNameForNotification)
        } else {
          console.log('通知窗口已成功打开')
          // 移除强制刷新，避免CSS和组件状态丢失
          // 增加延迟以确保组件完全加载
          setTimeout(() => {
            if (!notificationWindow.closed) {
              console.log('通知窗口已加载完成')
              // 成功打开窗口后清除待处理通知
              localStorage.removeItem('pendingNotification');
            }
          }, 500)
        }
      } catch (error) {
        console.error('打开通知窗口失败:', error)
        // 降级方案：在窗口激活时显示通知
        this.showNotificationWhenActive(taskNameForNotification)
      }
      
      // 调用completeTask来完成任务并重置状态
      this.completeTask()
    },
    
    // 当窗口激活时显示通知
    showNotificationWhenActive(taskName) {
      console.log('设置窗口激活时显示通知:', taskName)
      // 如果Electron API可用，立即显示通知
      if (window.electronAPI?.showNotification) {
        window.electronAPI.showNotification('番茄钟已完成', `任务 "${taskName}" 已完成`)
      }
      // 浏览器会在窗口激活时自动检查pendingNotification并显示通知
    },
    
    // 检查待处理的通知
    async checkPendingNotification() {
      try {
        const pendingNotification = localStorage.getItem('pendingNotification')
        if (pendingNotification) {
          const notificationData = JSON.parse(pendingNotification)
          const timeDiff = Date.now() - notificationData.timestamp
          
          // 只处理最近5分钟内的通知（避免显示过期的通知）
          if (timeDiff < 5 * 60 * 1000) {
            console.log('发现待处理通知:', notificationData.taskName)
            
            // 尝试打开通知窗口
            try {
              // 计算通知窗口尺寸
              const notificationWidth = 350;
              const notificationHeight = 300;
              
              // 获取用户当前活动屏幕的信息
                let notificationLeft, notificationTop;
                
                // 优先使用Electron API获取当前活动屏幕信息
                if (window.electronAPI?.getCurrentScreenInfo) {
                  try {
                    // 注意：getCurrentScreenInfo是异步方法，需要使用await
                    const screenInfo = await window.electronAPI.getCurrentScreenInfo();
                    console.log('通过Electron API获取的活动屏幕信息:', screenInfo);
                    
                    // 计算屏幕中央位置
                    notificationLeft = screenInfo.bounds.x + (screenInfo.bounds.width / 2) - (notificationWidth / 2);
                    notificationTop = screenInfo.bounds.y + (screenInfo.bounds.height / 2) - (notificationHeight / 2);
                    console.log('使用Electron API获取的活动屏幕中央位置:', { left: notificationLeft, top: notificationTop });
                  } catch (error) {
                    console.error('获取Electron屏幕信息失败:', error);
                    // 降级到浏览器API
                    notificationLeft = window.screenLeft + (window.screen.availWidth / 2) - (notificationWidth / 2);
                    notificationTop = window.screenTop + (window.screen.availHeight / 2) - (notificationHeight / 2);
                    console.log('降级到浏览器API获取的屏幕中央位置:', { left: notificationLeft, top: notificationTop });
                  }
                } else {
                  // 降级方案：使用浏览器API获取当前屏幕信息
                  notificationLeft = window.screenLeft + (window.screen.availWidth / 2) - (notificationWidth / 2);
                  notificationTop = window.screenTop + (window.screen.availHeight / 2) - (notificationHeight / 2);
                  console.log('使用浏览器API获取的屏幕中央位置:', { left: notificationLeft, top: notificationTop });
                }
              
              console.log('计算的待处理通知窗口位置:', { left: notificationLeft, top: notificationTop });
              
              // 调整窗口参数，确保在Electron中正确显示，并设置位置
              const windowFeatures = `width=${notificationWidth},height=${notificationHeight},left=${notificationLeft},top=${notificationTop},frame=no,titlebar=no,alwaysOnTop=yes,menubar=no,toolbar=no,status=no`;
              const notificationWindow = window.open('#/notification', 'taskNotification', windowFeatures);
              
              if (notificationWindow) {
                // 设置任务名称到localStorage供通知窗口使用
                localStorage.setItem('notificationTaskName', notificationData.taskName);
                
                // 清除待处理通知
                localStorage.removeItem('pendingNotification');
                
                // 延迟清除任务名称
                setTimeout(() => {
                  localStorage.removeItem('notificationTaskName');
                }, 5000);
                
                console.log('待处理通知窗口已打开')
              } else {
                console.warn('无法打开待处理通知窗口')
                // 如果仍然无法打开窗口，使用Electron通知
                if (window.electronAPI?.showNotification) {
                  window.electronAPI.showNotification('番茄钟已完成', `任务 "${notificationData.taskName}" 已完成`)
                  localStorage.removeItem('pendingNotification');
                }
              }
            } catch (error) {
              console.error('打开待处理通知窗口失败:', error)
              // 降级使用Electron通知
              if (window.electronAPI?.showNotification) {
                window.electronAPI.showNotification('番茄钟已完成', `任务 "${notificationData.taskName}" 已完成`)
                localStorage.removeItem('pendingNotification');
              }
            }
          } else {
            console.log('待处理通知已过期，清除之')
            localStorage.removeItem('pendingNotification');
          }
        }
      } catch (error) {
        console.error('检查待处理通知失败:', error)
        localStorage.removeItem('pendingNotification');
      }
    },
    
    // 延长任务时间
    extendTaskTime(minutes) {
      const additionalSeconds = minutes * 60
      this.$store.commit('SET_REMAINING_TIME', this.remainingTime + additionalSeconds)
      this.$store.commit('SET_TOTAL_DURATION', this.totalDuration + additionalSeconds)
    },
    
    // 恢复暂停的任务状态
    restorePausedTaskState() {
      const pausedTaskState = localStorage.getItem('pausedTaskState')
      if (pausedTaskState) {
        try {
          const taskState = JSON.parse(pausedTaskState)
          this.taskName = taskState.taskName
          this.taskMinutes = Math.floor(taskState.remainingTime / 60)
          this.taskSeconds = taskState.remainingTime % 60
          
          // 清除保存的状态
          localStorage.removeItem('pausedTaskState')
        } catch (error) {
          console.error('恢复暂停任务状态失败:', error)
        }
      }
    },
    
    // 导航到历史记录页面
    navigateToHistory() {
      this.$router.push('/history')
    },
    
    // 导航到周统计页面
    navigateToWeekStats() {
      this.$router.push('/week-stats')
    },
    
    // 处理开始或继续操作
    handleStartOrResume() {
      if (this.isPaused) {
        // 恢复计时器并重新初始化计时器间隔
        this.resumeTimerWithValidation()
      } else {
        this.startTimerWithValidation()
      }
    },
    
    // 获取开始按钮的文本
    getStartButtonText() {
      if (this.isPaused) {
        return '继续'
      } else if (this.currentTask) {
        return '开始'
      } else {
        return '开始'
      }
    }
  },
  watch: {
    // 监听暂停状态变化，保存到localStorage
    isPaused(newVal) {
      if (newVal && this.isRunning) {
        const pausedTaskState = {
          taskName: this.currentTask,
          remainingTime: this.remainingTime,
          taskStartTime: this.$store.state.taskStartTime
        }
        localStorage.setItem('pausedTaskState', JSON.stringify(pausedTaskState))
      }
    }
  }
}
</script>

<style scoped>
/* 左侧：任务设置 */
.task-setup {
  flex: 1;
  min-width: 300px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
}

input[type="text"],
input[type="number"] {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 10px;
  font-size: 16px;
  transition: border-color 0.3s;
}

input[type="text"]:focus,
input[type="number"]:focus {
  outline: none;
  border-color: #667eea;
}

.time-input-group {
  display: flex;
  gap: 10px;
}

.quick-time-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.quick-time {
  padding: 8px 12px;
  font-size: 14px;
}

/* 自定义单选框样式 */
.radio-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.radio-group label {
  display: flex;
  align-items: center;
  font-weight: normal;
  cursor: pointer;
  white-space: nowrap;
  margin: 0;
}

.radio-group input[type="radio"] {
  position: absolute;
  opacity: 0;
}

.radio-group .radio-custom {
  position: relative;
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border: 2px solid #ddd;
  border-radius: 50%;
  background-color: white;
  transition: all 0.3s ease;
}

.radio-group input[type="radio"]:checked + .radio-custom {
  border-color: #667eea;
  background-color: #667eea;
}

.radio-group input[type="radio"]:checked + .radio-custom::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: white;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 右侧：计时器显示 */
.timer-display {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
}

.timer-circle {
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
  position: relative;
}

.time-left {
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
}

.current-task {
  margin-top: 10px;
  font-size: 1rem;
  text-align: center;
  padding: 0 20px;
}

.timer-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.time-mode-container {
  display: flex;
  gap: 10px;
}

.time-mode {
  flex: 1;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .timer-circle {
    width: 250px;
    height: 250px;
  }
  
  .time-left {
    font-size: 3rem;
  }
  
  .timer-controls {
    flex-direction: column;
    width: 100%;
  }
  
  .timer-controls button {
    width: 100%;
  }
  
  .header {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
  
  .notification-window {
    width: 90%;
    max-width: 300px;
  }
}

/* 外部通知窗口样式已移至notification.html */

/* 全局滚动条样式 - 影响整个页面窗口 */
:deep(html) {
  /* Firefox滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #667eea #f8f9fa;
}

/* Chrome, Edge, Safari 滚动条样式 */
:deep(html::-webkit-scrollbar) {
  width: 3px;
}

:deep(html::-webkit-scrollbar-track) {
  background: #f8f9fa;
  border-radius: 10px;
}

:deep(html::-webkit-scrollbar-thumb) {
  background: #667eea;
  border-radius: 10px;
  transition: background 0.3s ease;
}

:deep(html::-webkit-scrollbar-thumb:hover) {
  background: #5a67d8;
}
</style>