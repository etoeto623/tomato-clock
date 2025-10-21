const { contextBridge, ipcRenderer, screen } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 显示通知
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),
  
  // 显示任务完成弹窗
  showTaskCompleteWindow: (taskName) => ipcRenderer.send('show-task-complete-window', taskName),
  
  // 关闭通知窗口
  closeNotification: () => ipcRenderer.send('close-notification'),
  
  // 保存任务历史
  saveTaskHistory: (task) => ipcRenderer.invoke('save-task-history', task),
  
  // 获取任务历史
  getTaskHistory: () => ipcRenderer.invoke('get-task-history'),
  
  // 清除任务历史
  clearTaskHistory: () => ipcRenderer.invoke('clear-task-history'),
  
  // 删除单个任务
  deleteTask: (taskIndex) => ipcRenderer.invoke('delete-task', taskIndex),
  
  // 更新任务备注
  updateTaskNotes: (taskId, notes) => ipcRenderer.invoke('update-task-notes', taskId, notes),
  
  // 延长任务时间
  extendTaskTime: (minutes) => ipcRenderer.send('extend-task-time', minutes),
  
  // 监听任务时间延长
  onTaskTimeExtended: (callback) => ipcRenderer.on('task-time-extended', callback),
  
  // 获取指定日期范围的任务
  getTasksByDateRange: (startDate, endDate) => ipcRenderer.invoke('get-tasks-by-date-range', startDate, endDate),
  
  // 获取周统计数据
  getWeekStats: (startDate, endDate) => ipcRenderer.invoke('get-week-stats', startDate, endDate),
  
  // 获取所有标签
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),
  
  // 更新任务标签
  updateTaskTags: (taskId, tags) => ipcRenderer.invoke('update-task-tags', taskId, tags),

  getPrimaryDisplay: () => ipcRenderer.invoke('getPrimaryDisplay'),
});