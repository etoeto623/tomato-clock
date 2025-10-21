import { createStore } from 'vuex'

export default createStore({
  state: {
    // 计时器相关状态
    timer: null,
    remainingTime: 0,
    totalDuration: 0,
    isRunning: false,
    isPaused: false,
    currentTask: null,
    taskStartTime: null,
    pausedAt: null,
    elapsedTime: 0,
    pauseHistory: [],
    isExtendedTask: false,
    originalTaskRecord: null,
    timerMode: 'countdown',
    taskCompletionTime: null,
    
    // 任务历史
    taskHistory: [],
    
    // 周统计数据
    weekStats: {
      totalDuration: 0,
      taskCount: 0,
      dailyStats: []
    }
  },
  
  mutations: {
    // 计时器相关mutations
    SET_TIMER(state, timer) {
      state.timer = timer
    },
    SET_REMAINING_TIME(state, time) {
      state.remainingTime = time
    },
    SET_TOTAL_DURATION(state, duration) {
      state.totalDuration = duration
    },
    SET_IS_RUNNING(state, isRunning) {
      state.isRunning = isRunning
    },
    SET_IS_PAUSED(state, isPaused) {
      state.isPaused = isPaused
    },
    SET_CURRENT_TASK(state, task) {
      state.currentTask = task
    },
    SET_TASK_START_TIME(state, time) {
      state.taskStartTime = time
    },
    SET_PAUSED_AT(state, time) {
      state.pausedAt = time
    },
    SET_ELAPSED_TIME(state, time) {
      state.elapsedTime = time
    },
    SET_PAUSE_HISTORY(state, history) {
      state.pauseHistory = history
    },
    ADD_PAUSE_RECORD(state, record) {
      state.pauseHistory.push(record)
    },
    SET_IS_EXTENDED_TASK(state, isExtended) {
      state.isExtendedTask = isExtended
    },
    SET_ORIGINAL_TASK_RECORD(state, record) {
      state.originalTaskRecord = record
    },
    SET_TIMER_MODE(state, mode) {
      state.timerMode = mode
    },
    SET_TASK_COMPLETION_TIME(state, completionTime) {
      state.taskCompletionTime = completionTime
    },
    
    // 任务历史相关mutations
    SET_TASK_HISTORY(state, history) {
      state.taskHistory = history
    },
    ADD_TASK_RECORD(state, record) {
      state.taskHistory.unshift(record)
    },
    UPDATE_TASK_NOTES(state, { id, notes }) {
      const task = state.taskHistory.find(t => t.id === id)
      if (task) {
        task.notes = notes
      }
    },
    DELETE_TASK_RECORD(state, id) {
      state.taskHistory = state.taskHistory.filter(t => t.id !== id)
    },
    
    // 周统计相关mutations
    SET_WEEK_STATS(state, stats) {
      state.weekStats = stats
    },
    
    // 重置计时器状态
    RESET_TIMER_STATE(state) {
      state.timer = null
      state.remainingTime = 0
      state.totalDuration = 0
      state.isRunning = false
      state.isPaused = false
      state.currentTask = null
      state.taskStartTime = null
      state.pausedAt = null
      state.elapsedTime = 0
      state.pauseHistory = []
      state.isExtendedTask = false
      state.originalTaskRecord = null
      state.taskCompletionTime = null
    }
  },
  
  actions: {
    // 开始计时器
    startTimer({ commit, state }, { taskName, totalDuration, remainingTime, timerMode, minutes, seconds }) {
      // 支持两种调用方式：新版本(totalDuration, remainingTime)和老版本(minutes, seconds)
      let finalTotalDuration = totalDuration;
      let finalRemainingTime = remainingTime;
      
      // 如果提供了minutes和seconds参数，使用它们计算时长
      if (typeof minutes !== 'undefined' && typeof seconds !== 'undefined') {
        finalTotalDuration = minutes * 60 + seconds;
        finalRemainingTime = finalTotalDuration;
      }
      
      // 设置计时器状态
      commit('SET_TOTAL_DURATION', finalTotalDuration)
      commit('SET_REMAINING_TIME', finalRemainingTime)
      commit('SET_CURRENT_TASK', taskName)
      commit('SET_TASK_START_TIME', new Date())
      commit('SET_IS_RUNNING', true)
      commit('SET_IS_PAUSED', false)
      
      // 如果提供了timerMode参数，则更新它
      if (typeof timerMode !== 'undefined') {
        commit('SET_TIMER_MODE', timerMode)
      }
    },
    
    // 暂停计时器
    pauseTimer({ commit, state }) {
      const pauseStartTime = new Date()
      commit('SET_IS_PAUSED', true)
      commit('SET_PAUSED_AT', pauseStartTime.getTime())
      
      // 创建暂停记录并添加到历史中（使用指定格式）
      const pauseRecord = {
        type: 'pause',
        start: pauseStartTime,
        end: null
      }
      commit('ADD_PAUSE_RECORD', pauseRecord)
    },
    
    // 恢复计时器
    resumeTimer({ commit, state }) {
      if (state.pauseHistory.length > 0) {
        const pauseEndTime = new Date()
        
        // 更新最后一条暂停记录
        const updatedPauseHistory = [...state.pauseHistory]
        const lastPauseIndex = updatedPauseHistory.length - 1
        updatedPauseHistory[lastPauseIndex] = {
          ...updatedPauseHistory[lastPauseIndex],
          end: pauseEndTime
        }
        commit('SET_PAUSE_HISTORY', updatedPauseHistory)
      }
      
      // 对于正计时模式，不将暂停时间累加到elapsedTime中
      // 对于倒计时模式，可以累加以保持总用时统计，但不影响剩余时间计算
      if (state.timerMode === 'tracking') {
        // 正计时模式：不增加暂停时间，保持elapsedTime不变
        console.log('正计时模式恢复，不增加暂停时间')
      } else {
        // 倒计时模式：累加暂停时间用于统计
        const pauseDuration = new Date().getTime() - state.pausedAt
        commit('SET_ELAPSED_TIME', state.elapsedTime + pauseDuration)
        console.log('倒计时模式恢复，暂停时间累加到elapsedTime:', pauseDuration)
      }
      
      commit('SET_IS_PAUSED', false)
      commit('SET_PAUSED_AT', null)
      
      // 重置任务开始时间为当前时间，确保恢复后计时准确
      commit('SET_TASK_START_TIME', new Date())
    },
    
    // 完成任务
    async completeTask({ commit, state, dispatch }) {
      console.log('开始完成任务流程');
      
      // 先清除计时器，确保计时完全停止
      if (state.timer) {
        console.log('清除计时器');
        clearInterval(state.timer);
      }
      
      // 确保所有暂停记录都有结束时间
      const finalPauseHistory = state.pauseHistory.map(pause => {
        // 如果有暂停记录没有结束时间（可能是用户暂停后直接完成任务）
        if (pause.end === null) {
          const endTime = new Date();
          return {
            ...pause,
            end: endTime
          };
        }
        return pause;
      });
      
      // 确保pauseHistory中的所有Date对象也被转换为ISO字符串
      const serializedPauseHistory = finalPauseHistory.map(pause => ({
        ...pause,
        start: pause.start instanceof Date ? pause.start.toISOString() : pause.start,
        end: pause.end instanceof Date ? pause.end.toISOString() : pause.end
      }));
      
      // 构建完全可序列化的任务记录对象
      // 使用准确的完成时间（如果存在），否则使用当前时间
      const completionTime = state.taskCompletionTime ? new Date(state.taskCompletionTime) : new Date()
      const taskRecord = {
        name: state.currentTask,
        duration: state.totalDuration,
        completedAt: completionTime.toISOString(),
        startTime: state.taskStartTime instanceof Date ? state.taskStartTime.toISOString() : state.taskStartTime,
        pauses: serializedPauseHistory,
        notes: ''
      }
      console.log('任务记录创建完成:', taskRecord);
      
      // 保存到数据库
      try {
        console.log('检查electronAPI是否可用:', window.electronAPI?.saveTaskHistory !== undefined);
        if (window.electronAPI?.saveTaskHistory) {
          console.log('调用saveTaskHistory保存任务');
          const result = await window.electronAPI.saveTaskHistory(JSON.parse(JSON.stringify(taskRecord)));
          console.log('saveTaskHistory调用结果:', result);
        }
        console.log('添加任务记录到本地状态');
        commit('ADD_TASK_RECORD', taskRecord);
        console.log('任务完成流程结束');
      } catch (error) {
        console.error('保存任务失败:', error);
      }
      
      // 重置计时器状态
      commit('RESET_TIMER_STATE')
    },
    
    // 停止任务
    stopTimer({ commit, state }) {
      // 先清除计时器
      if (state.timer) {
        clearInterval(state.timer)
      }
      // 再重置状态
      commit('RESET_TIMER_STATE')
    },
    
    // 加载任务历史
    async loadTaskHistory({ commit }) {
      try {
        if (window.electronAPI?.getTaskHistory) {
          const history = await window.electronAPI.getTaskHistory()
          commit('SET_TASK_HISTORY', history)
        }
      } catch (error) {
        console.error('加载任务历史失败:', error)
      }
    },
    
    // 更新任务备注
    async updateTaskNotes({ commit }, { id, notes }) {
      try {
        if (window.electronAPI?.updateTaskNotes) {
          await window.electronAPI.updateTaskNotes(id, notes)
        }
        commit('UPDATE_TASK_NOTES', { id, notes })
      } catch (error) {
        console.error('更新任务备注失败:', error)
      }
    },
    
    // 删除任务记录
    async deleteTaskRecord({ commit }, id) {
      try {
        if (window.electronAPI?.deleteTask) {
          await window.electronAPI.deleteTask(id)
        }
        commit('DELETE_TASK_RECORD', id)
      } catch (error) {
        console.error('删除任务失败:', error)
      }
    },
    
    // 加载周统计数据
    async loadWeekStats({ commit }, { startDate, endDate }) {
      try {
        if (window.electronAPI?.getWeekStats) {
          const stats = await window.electronAPI.getWeekStats(startDate, endDate)
          commit('SET_WEEK_STATS', stats)
        }
      } catch (error) {
        console.error('加载周统计失败:', error)
      }
    },
    
    // 延长任务时间
    extendTaskTime({ commit, state }, minutes) {
      console.log("vue store extendTaskTime", minutes)
      const extensionSeconds = minutes * 60
      const newTotalDuration = state.totalDuration + extensionSeconds
      const newRemainingTime = state.remainingTime + extensionSeconds
      
      commit('SET_TOTAL_DURATION', newTotalDuration)
      commit('SET_REMAINING_TIME', newRemainingTime)
      commit('SET_IS_EXTENDED_TASK', true)
    }
  },
  
  getters: {
    // 格式化时间显示
    formattedTimeLeft: (state) => {
      // 确保remainingTime是有效的数字，如果无效则设为0
      const time = isNaN(state.remainingTime) || state.remainingTime < 0 ? 0 : state.remainingTime;
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60); // 确保秒数也是整数
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
    
    // 获取按钮状态
    buttonStates: (state) => ({
      startDisabled: state.isRunning && !state.isPaused,
      pauseDisabled: !state.isRunning || state.isPaused,
      completeDisabled: !state.isRunning,
      stopDisabled: !state.isRunning,
      navigationDisabled: state.isRunning && !state.isPaused
    })
  }
})