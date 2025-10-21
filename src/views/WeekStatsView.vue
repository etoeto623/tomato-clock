<template>
  <div class="container">
    <div class="header">
      <h1>周统计</h1>
      <div class="header-actions">
        <div class="week-navigation">
          <button class="btn-secondary btn-sm" @click="goToPreviousWeek">&lt; 上一周</button>
          <span class="week-label">{{ currentWeekLabel }}</span>
          <button class="btn-secondary btn-sm" @click="goToNextWeek" :disabled="isCurrentWeek">下一周 &gt;</button>
        </div>
        <button class="btn-secondary" @click="goBack">返回计时器</button>
      </div>
    </div>
    
    <div class="stats-content">
      <!-- 统计概览 -->
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-value">{{ formattedTotalDuration }}</div>
          <div class="stat-label">总时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ filteredStats.taskCount }}项</div>
          <div class="stat-label">任务数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ averageDuration }}</div>
          <div class="stat-label">平均时长</div>
        </div>
      </div>
      
      <!-- 图表区域 -->
      <div class="charts-container">
        <div class="chart-section">
          <h3>每日任务时长分布</h3>
          <canvas id="dayDistributionChart"></canvas>
        </div>
        <div class="chart-section">
          <h3>每小时任务时长分布</h3>
          <canvas id="trendChart"></canvas>
        </div>
      </div>
      
      <!-- 任务列表 -->
      <div class="week-tasks">
        <div class="task-filters">
          <h3>本周任务</h3>
          <select 
            v-model="selectedTag" 
            class="tag-select"
            placeholder="选择标签过滤"
          >
            <option value="">全部标签</option>
            <option v-for="tag in allAvailableTags" :key="tag" :value="tag">
              {{ tag }}
            </option>
          </select>
        </div>
        <div class="task-groups">
          <div v-for="(tasks, date) in groupedTasks" :key="date" class="task-group">
            <div class="group-header">
              <span class="date-label">{{ formatGroupDate(date) }}</span>
              <span class="date-total">{{ formatGroupTotal(tasks) }}</span>
              <button class="toggle-btn" @click="toggleGroup(date)">
                {{ expandedGroups[date] ? '收起' : '展开' }}
              </button>
            </div>
            <transition name="slide-down">
              <div class="group-content" v-if="expandedGroups[date]">
                <TaskItem 
                  v-for="task in tasks" 
                  :key="task.id"
                  :task="task"
                  :show-delete-button="true"
                  @edit="openMarkdownEditor(task.id)"
                  @view-notes="openMarkdownViewer(task.id)"
                  @delete="confirmDeleteTask(task.id)"
                />
              </div>
            </transition>
          </div>
          <div class="empty-state" v-if="Object.keys(groupedTasks).length === 0">
            <p>本周暂无任务记录</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Markdown编辑器组件 -->
    <MarkdownEditor
      :visible="showEditor"
      :content="editorContent"
      :title="`${editingTask?.name || ''} - 编辑备注`"
      @save="handleSaveNotes"
      @cancel="handleCancelEdit"
    />
    
    <!-- Markdown查看器组件 -->
    <MarkdownViewer
      :visible="showViewer"
      :content="viewingTask && viewingTask.notes || ''"
        :title="`${(viewingTask && viewingTask.name) || ''} - 备注`"
      @close="handleCloseViewer"
      @edit="handleSwitchToEdit"
    />
  </div>
</template>

<style scoped>
/* 展开折叠动画效果 */
  .slide-down-enter-active,
  .slide-down-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-height: 1000px; /* 设置一个足够大的值 */
    overflow: hidden;
  }

.slide-down-enter,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-enter-to,
.slide-down-leave {
  max-height: 1000px;
  opacity: 1;
  transform: translateY(0);
}

/* 确保内容在动画过程中不会溢出 */
.group-content {
  overflow: hidden;
}
</style>

<script>
import { mapState, mapActions } from 'vuex'
import TaskItem from '../components/TaskItem.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'
import Chart from 'chart.js/auto'

export default {
  name: 'WeekStatsView',
  components: {
    TaskItem,
    MarkdownEditor,
    MarkdownViewer
  },
  data() {
    return {
      currentWeekStart: null,
      currentWeekEnd: null,
      dayDistributionChart: null,
      trendChart: null,
      expandedGroups: {},
      showEditor: false,
      showViewer: false,
      currentTaskId: null,
      editorContent: '',
      weekTasks: [],
      selectedTag: '' // 选中的标签用于过滤
    }
  },
  computed: {
    ...mapState(['weekStats']),
    
    // 判断当前是否为本周
    isCurrentWeek() {
      if (!this.currentWeekStart) return false
      
      // 创建本周的开始日期用于比较
      const now = new Date()
      const day = now.getDay() || 7
      const diff = now.getDate() - day + 1
      const thisWeekStart = new Date(now)
      thisWeekStart.setDate(diff)
      thisWeekStart.setHours(0, 0, 0, 0)
      
      // 比较当前周的开始日期是否与本周的开始日期相同
      return this.currentWeekStart.toDateString() === thisWeekStart.toDateString()
    },
    
    // 当前周标签
    currentWeekLabel() {
      if (!this.currentWeekStart || !this.currentWeekEnd) return ''
      
      const startMonth = this.currentWeekStart.getMonth() + 1
      const startDay = this.currentWeekStart.getDate()
      const endMonth = this.currentWeekEnd.getMonth() + 1
      const endDay = this.currentWeekEnd.getDate()
      
      return `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`
    },
    
    // 过滤后的任务列表
    filteredTasks() {
      if (!this.selectedTag) {
        return this.weekTasks
      }
      
      return this.weekTasks.filter(task => {
        try {
          const tags = task.tags || 
                      (task.parsedTags && Array.isArray(task.parsedTags) ? task.parsedTags : [])
          if (Array.isArray(tags)) {
            return tags.some(tag => tag === this.selectedTag)
          }
          return false
        } catch (e) {
          console.error('过滤任务标签时出错:', e)
          return false
        }
      })
    },
    
    // 过滤后的统计数据
    filteredStats() {
      let totalDuration = 0
      let taskCount = 0
      
      this.filteredTasks.forEach(task => {
        try {
          // 累加任务时长
          if (task.duration && typeof task.duration === 'number') {
            totalDuration += task.duration
          } else if (task.startTime && task.completedAt) {
            const startTime = new Date(task.startTime).getTime()
            const endTime = new Date(task.completedAt).getTime()
            if (!isNaN(startTime) && !isNaN(endTime)) {
              let pauseDuration = 0
              if (task.pauses && Array.isArray(task.pauses)) {
                pauseDuration = task.pauses.reduce((total, pause) => {
                  const pauseStart = new Date(pause.start).getTime()
                  const pauseEnd = new Date(pause.end).getTime()
                  if (!isNaN(pauseStart) && !isNaN(pauseEnd)) {
                    return total + (pauseEnd - pauseStart)
                  }
                  return total
                }, 0)
              }
              totalDuration += Math.floor((endTime - startTime - pauseDuration) / 1000)
            }
          }
          taskCount++
        } catch (e) {
          console.error('计算任务统计数据时出错:', e)
        }
      })
      
      return {
        totalDuration,
        taskCount
      }
    },
    
    // 格式化总时长（基于过滤后的数据）
    formattedTotalDuration() {
      const hours = Math.floor(this.filteredStats.totalDuration / 3600)
      const minutes = Math.floor((this.filteredStats.totalDuration % 3600) / 60)
      
      if (hours > 0) {
        return `${hours}小时${minutes}分钟`
      }
      return `${minutes}分钟`
    },
    
    // 平均时长（基于过滤后的数据）
    averageDuration() {
      if (this.filteredStats.taskCount === 0) return '0分钟'
      
      const avgMinutes = Math.floor(this.filteredStats.totalDuration / this.filteredStats.taskCount / 60)
      return `${avgMinutes}分钟`
    },
    
    // 获取所有可用的标签
    allAvailableTags() {
      const tagsSet = new Set()
      this.weekTasks.forEach(task => {
        try {
          // 支持多种标签格式：tags数组或解析后的标签
          const tags = task.tags || 
                      (task.parsedTags && Array.isArray(task.parsedTags) ? task.parsedTags : [])
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagsSet.add(tag)
              }
            })
          }
        } catch (e) {
          console.error('提取标签时出错:', e)
        }
      })
      return Array.from(tagsSet).sort()
    },
    
    // 按日期分组的任务（带标签过滤）
    groupedTasks() {
      const groups = {}
      
      this.weekTasks.forEach((task, index) => {
        try {
          // 标签过滤
          if (this.selectedTag) {
            let hasMatchingTag = false
            const tags = task.tags || 
                        (task.parsedTags && Array.isArray(task.parsedTags) ? task.parsedTags : [])
            if (Array.isArray(tags)) {
              hasMatchingTag = tags.some(tag => tag === this.selectedTag)
            }
            if (!hasMatchingTag) {
              return // 跳过不符合标签过滤条件的任务
            }
          }
          
          // 确保completedAt或completed_at存在且有效
          const dateStr = task.completedAt || task.completed_at
          if (!dateStr) {
            console.warn(`任务${index}没有有效的完成时间`)
            return
          }
          
          const taskDate = new Date(dateStr)
          // 检查日期是否有效
          if (isNaN(taskDate.getTime())) {
            console.warn(`任务${index}的日期无效:`, dateStr)
            return
          }
          
          // 使用YYYY-MM-DD格式作为分组键，确保正确按天分组
          const date = taskDate.toISOString().split('T')[0]
          if (!groups[date]) {
            groups[date] = []
          }
          groups[date].push(task)
        } catch (e) {
          console.error(`处理任务${index}时出错:`, e)
        }
      })
      
      // 按日期排序
      const sortedGroups = {}
      Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        sortedGroups[date] = groups[date]
      })
      
      return sortedGroups
    },
    
    // 当前编辑的任务
    editingTask() {
      return this.weekTasks.find(task => task.id === this.currentTaskId)
    },
    
    // 当前查看的任务
    viewingTask() {
        return this.weekTasks.find(task => task.id === this.currentTaskId)
     },
    
    // 格式化日期时间为YYYY-MM-DD HH:mm:ss格式
    formatDateTime(dateString) {
      if (!dateString) return ''
      
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return ''
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    },
  },
  // 监听selectedTag变化，更新图表和统计数据
  watch: {
    selectedTag: {
      handler() {
        // 延迟执行，确保filteredTasks计算属性已更新
        this.$nextTick(() => {
          setTimeout(() => {
            this.generateDayDistributionChart()
            this.generateTrendChart()
          }, 0)
        })
      },
      immediate: false
    }
  },
  mounted() {
    this.setCurrentWeek()
    this.loadWeekData()
  },
  beforeUnmount() {
    // 销毁图表实例
    if (this.dayDistributionChart) {
      try {
        this.dayDistributionChart.destroy()
      } catch (e) {
        console.warn('销毁dayDistributionChart失败:', e)
      }
      this.dayDistributionChart = null
    }
    if (this.trendChart) {
      try {
        this.trendChart.destroy()
      } catch (e) {
        console.warn('销毁trendChart失败:', e)
      }
      this.trendChart = null
    }
  },
  methods: {
    ...mapActions(['loadWeekStats', 'updateTaskNotes', 'loadTaskHistory', 'deleteTaskRecord']),
    
    // 初始化展开状态
    initializeExpandedGroups() {
      console.log('开始初始化展开状态')
      const todayDate = new Date().toISOString().split('T')[0]
      const newExpandedGroups = {}
      
      // 为每个分组日期设置展开状态 - 默认全部折叠
      Object.keys(this.groupedTasks).forEach(date => {
        newExpandedGroups[date] = false
        console.log(`初始化分组${date}的展开状态为: false`)
      })
      
      // 使用新对象替换，确保响应式更新
      this.expandedGroups = { ...newExpandedGroups }
      console.log('初始化后的展开状态对象:', this.expandedGroups)
    },
    
    // 确认删除任务
    confirmDeleteTask(id) {
      if (confirm('确定要删除这个任务记录吗？')) {
        this.deleteTask(id)
      }
    },
    
    // 删除任务
    async deleteTask(id) {
      try {
        // 保存当前展开状态，确保删除后不改变
        const currentExpandedState = { ...this.expandedGroups }
        
        // 执行删除操作
        await this.deleteTaskRecord(id)
        
        // 直接从本地任务列表中过滤掉已删除的任务，而不是重新加载整个数据
        this.weekTasks = this.weekTasks.filter(task => task.id !== id)
        
        // 恢复展开状态
        this.expandedGroups = currentExpandedState
        
        // 重新生成图表以反映数据变化
        this.generateDayDistributionChart()
        this.generateTrendChart()
        
        // 通知用户删除成功
        console.log('任务删除成功')
      } catch (error) {
        console.error('删除任务失败:', error)
        alert('删除任务失败')
      }
    },
    
    // 设置当前周
    setCurrentWeek() {
      const now = new Date()
      const day = now.getDay() || 7
      const diff = now.getDate() - day + 1
      
      // 先设置日期，再创建新的Date对象，避免引用问题
      const startDate = new Date(now)
      startDate.setDate(diff)
      startDate.setHours(0, 0, 0, 0)
      this.currentWeekStart = startDate
      
      this.currentWeekEnd = new Date(this.currentWeekStart)
      this.currentWeekEnd.setDate(this.currentWeekEnd.getDate() + 6)
      this.currentWeekEnd.setHours(23, 59, 59, 999)
    },
    
    // 加载周数据
    async loadWeekData() {
      try {
        // 重置任务列表和展开状态
        this.weekTasks = []
        this.expandedGroups = {}
        
        console.log(`开始加载周数据，时间范围: ${this.currentWeekStart.toISOString()} 到 ${this.currentWeekEnd.toISOString()}`)
        
        // 加载周统计数据
        try {
          await this.loadWeekStats({
            startDate: this.currentWeekStart.toISOString(),
            endDate: this.currentWeekEnd.toISOString()
          })
          console.log('周统计数据加载成功')
        } catch (statsError) {
          console.error('加载周统计数据失败:', statsError)
        }
        
        // 主要数据获取路径：尝试直接从Vuex获取任务历史
        try {
          // 尝试通过mapActions加载任务历史
          if (this.loadTaskHistory) {
            await this.loadTaskHistory()
            console.log('已调用loadTaskHistory action')
          }
        } catch (actionError) {
          console.log('loadTaskHistory action不存在或调用失败，继续使用现有store数据')
        }
        
        // 从Vuex store获取任务数据
        if (this.$store.state.taskHistory && Array.isArray(this.$store.state.taskHistory)) {
          console.log('store中任务总数:', this.$store.state.taskHistory.length)
          
          // 从store中过滤出指定日期范围内的任务
          this.weekTasks = this.$store.state.taskHistory.filter(task => {
            try {
              // 确保completedAt或completed_at存在且有效
              const dateStr = task.completedAt || task.completed_at
              if (!dateStr) return false
              
              const taskDate = new Date(dateStr)
              // 检查日期是否有效
              if (isNaN(taskDate.getTime())) return false
              
              // 严格比较日期范围
              return taskDate >= this.currentWeekStart && taskDate <= this.currentWeekEnd
            } catch (e) {
              console.error('过滤任务时出错:', e)
              return false
            }
          })
          console.log('过滤后周任务数量:', this.weekTasks.length)
        } else {
          console.warn('store中的taskHistory不存在或不是数组')
        }
        
        // 如果从store没有获取到数据，尝试备选方案
        if (this.weekTasks.length === 0) {
          console.log('从store未获取到任务，尝试备选数据获取方式')
          
          // 尝试所有可能的API，而不是互斥的if-else
          const apiAttempts = [
            {
              name: 'Electron API',
              api: window.electronAPI?.getTasksByDateRange
            },
            {
              name: 'dbService',
              api: window.dbService?.getTasksByDateRange
            },
            {
              name: 'preload API',
              api: window.api?.getTasksByDateRange
            }
          ]
          
          for (const attempt of apiAttempts) {
            if (attempt.api) {
              try {
                console.log(`尝试从${attempt.name}获取任务数据`)
                const tasks = await attempt.api(
                  this.currentWeekStart.toISOString(),
                  this.currentWeekEnd.toISOString()
                )
                
                if (tasks && Array.isArray(tasks) && tasks.length > 0) {
                  this.weekTasks = tasks
                  console.log(`从${attempt.name}成功加载任务数量:`, tasks.length)
                  break // 获取到数据后停止尝试
                }
              } catch (e) {
                console.error(`${attempt.name}获取任务失败:`, e)
              }
            }
          }
        }
        
        // 检查是否有本地存储的数据可以使用
        if (this.weekTasks.length === 0) {
          try {
            const storedTasks = localStorage.getItem('taskHistory')
            if (storedTasks) {
              const parsedTasks = JSON.parse(storedTasks)
              if (Array.isArray(parsedTasks)) {
                this.weekTasks = parsedTasks.filter(task => {
                  const dateStr = task.completedAt || task.completed_at
                  if (!dateStr) return false
                  
                  const taskDate = new Date(dateStr)
                  if (isNaN(taskDate.getTime())) return false
                  
                  return taskDate >= this.currentWeekStart && taskDate <= this.currentWeekEnd
                })
                console.log('从localStorage加载任务数量:', this.weekTasks.length)
              }
            }
          } catch (e) {
            console.error('从localStorage获取任务失败:', e)
          }
        }
        
        // 确保weekTasks始终是数组
        if (!Array.isArray(this.weekTasks)) {
          this.weekTasks = []
          console.warn('weekTasks不是数组，已重置为空数组')
        }
        
        console.log('最终周任务数量:', this.weekTasks.length)
        
        // 初始化展开状态（在数据加载完成后）
        this.$nextTick(() => {
          this.initializeExpandedGroups()
          
          // 在展开状态初始化完成后立即生成图表
          // 添加短暂延迟确保所有DOM元素完全就绪
          setTimeout(() => {
            this.generateDayDistributionChart()
            this.generateTrendChart()
          }, 50)
        })
      } catch (error) {
        console.error('加载周数据失败:', error)
        // 显示用户友好的错误提示
        alert('加载周数据时发生错误，请刷新页面重试')
      }
    },
    
    // 切换到上一周
    goToPreviousWeek() {
      const newStart = new Date(this.currentWeekStart)
      newStart.setDate(newStart.getDate() - 7)
      this.currentWeekStart = newStart
      
      const newEnd = new Date(this.currentWeekEnd)
      newEnd.setDate(newEnd.getDate() - 7)
      this.currentWeekEnd = newEnd
      
      this.loadWeekData()
    },
    
    // 切换到下一周
    goToNextWeek() {
      const newStart = new Date(this.currentWeekStart)
      newStart.setDate(newStart.getDate() + 7)
      this.currentWeekStart = newStart
      
      const newEnd = new Date(this.currentWeekEnd)
      newEnd.setDate(newEnd.getDate() + 7)
      this.currentWeekEnd = newEnd
      
      // 不能查看未来的周
      const now = new Date()
      if (this.currentWeekStart > now) {
        this.goToCurrentWeek()
        return
      }
      
      this.loadWeekData()
    },
    
    // 返回当前周
    goToCurrentWeek() {
      this.setCurrentWeek()
      this.loadWeekData()
    },
    
    // 生成每日时长分布图表
    generateDayDistributionChart() {
      try {
        // 先销毁旧图表（无论ctx是否存在）
        if (this.dayDistributionChart) {
          try {
            this.dayDistributionChart.destroy()
          } catch (destroyError) {
            console.warn('销毁旧图表失败:', destroyError)
          }
          this.dayDistributionChart = null
        }
        
        // 获取Canvas元素并检查
        const canvas = document.getElementById('dayDistributionChart')
        if (!canvas) {
          console.warn('找不到dayDistributionChart的Canvas元素')
          return
        }
        
        // 尝试获取2D上下文
        const context = canvas.getContext('2d')
        if (!context) {
          console.warn('无法获取dayDistributionChart的2D上下文')
          return
        }
        
        // 清除画布
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        const dayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        const dayData = new Array(7).fill(0)
        
        // 统计每天的任务时长（使用过滤后的数据）
        this.filteredTasks.forEach(task => {
          try {
            const dayIndex = new Date(task.completedAt || task.completed_at).getDay() || 7
            dayData[dayIndex - 1] += task.duration
          } catch (e) {
            console.warn('处理任务日期时出错:', e)
          }
        })
        
        // 转换为小时
        const hourData = dayData.map(seconds => (seconds / 3600).toFixed(1))
        
        // 添加防抖机制，确保在下一个事件循环中创建图表
        setTimeout(() => {
          // 再次检查Canvas元素和上下文是否仍然有效
          const freshCanvas = document.getElementById('dayDistributionChart')
          if (!freshCanvas) {
            console.warn('找不到dayDistributionChart的Canvas元素（延迟检查）')
            return
          }
          
          const freshContext = freshCanvas.getContext('2d')
          if (!freshContext) {
            console.warn('无法获取dayDistributionChart的2D上下文（延迟检查）')
            return
          }
          
          // 确保Canvas尺寸正确
          if (freshCanvas.width === 0 || freshCanvas.height === 0) {
            console.warn('Canvas尺寸无效')
            return
          }
          
          // 创建新图表
          try {
            this.dayDistributionChart = new Chart(freshContext, {
              type: 'bar',
              data: {
                labels: dayLabels,
                datasets: [{
                  label: '任务时长（小时）',
                  data: hourData,
                  backgroundColor: 'rgba(102, 126, 234, 0.6)',
                  borderColor: 'rgba(102, 126, 234, 1)',
                  borderWidth: 2,
                  borderRadius: 8
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    enabled: true,
                    callbacks: {
                      label: function(context) {
                        return context.dataset.label + ': ' + context.raw + 'h'
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return value + 'h'
                      }
                    }
                  }
                }
              }
            })
          } catch (chartError) {
            console.error('创建dayDistributionChart失败:', chartError)
            this.dayDistributionChart = null
          }
        }, 0)
      } catch (error) {
        console.error('生成每日分布图失败:', error)
        // 确保错误不会阻止应用继续运行
        this.dayDistributionChart = null
      }
    },
    
    // 生成每小时任务时长分布图表
    generateTrendChart() {
      try {
        // 先销毁旧图表（无论ctx是否存在）
        if (this.trendChart) {
          try {
            this.trendChart.destroy()
          } catch (destroyError) {
            console.warn('销毁旧图表失败:', destroyError)
          }
          this.trendChart = null
        }
        
        // 获取Canvas元素并检查
        const canvas = document.getElementById('trendChart')
        if (!canvas) {
          console.warn('找不到trendChart的Canvas元素')
          return
        }
        
        // 尝试获取2D上下文
        const context = canvas.getContext('2d')
        if (!context) {
          console.warn('无法获取trendChart的2D上下文')
          return
        }
        
        // 清除画布
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        // 创建24小时的数据数组
        const hourLabels = Array.from({length: 24}, (_, i) => `${i}时`)
        const hourData = new Array(24).fill(0)
        
        // 统计每个小时的任务时长（考虑实际时间分布和排除暂停时间，使用过滤后的数据）
        this.filteredTasks.forEach(task => {
          try {
            // 获取任务开始和结束时间
            const startTime = new Date(task.startTime).getTime()
            const endTime = new Date(task.completedAt).getTime()
            
            if (!isNaN(startTime) && !isNaN(endTime)) {
              // 计算任务的有效运行时间（排除暂停时间）
              let pauseDuration = 0
              if (task.pauses && Array.isArray(task.pauses)) {
                pauseDuration = task.pauses.reduce((total, pause) => {
                  const pauseStart = new Date(pause.start).getTime()
                  const pauseEnd = new Date(pause.end).getTime()
                  if (!isNaN(pauseStart) && !isNaN(pauseEnd)) {
                    return total + (pauseEnd - pauseStart)
                  }
                  return total
                }, 0)
              }
              
              // 获取任务的实际运行时间段（不包括暂停）
              // 构建一个包含运行和暂停时间区间的数组
              const timeIntervals = []
              let currentRunStart = startTime
              
              // 如果有暂停记录，按时间顺序处理
              if (task.pauses && Array.isArray(task.pauses)) {
                // 按开始时间排序暂停记录
                const sortedPauses = [...task.pauses].sort((a, b) => 
                  new Date(a.start).getTime() - new Date(b.start).getTime()
                )
                
                // 处理每个暂停区间
                sortedPauses.forEach(pause => {
                  const pauseStart = new Date(pause.start).getTime()
                  const pauseEnd = new Date(pause.end).getTime()
                  
                  if (!isNaN(pauseStart) && !isNaN(pauseEnd) && pauseStart >= startTime && pauseEnd <= endTime) {
                    // 添加暂停前的运行时间
                    if (pauseStart > currentRunStart) {
                      timeIntervals.push({
                        start: currentRunStart,
                        end: pauseStart,
                        isPaused: false
                      })
                    }
                    // 更新下一个运行时间的起始点
                    currentRunStart = pauseEnd
                  }
                })
              }
              
              // 添加最后一个运行时间段
              if (currentRunStart < endTime) {
                timeIntervals.push({
                  start: currentRunStart,
                  end: endTime,
                  isPaused: false
                })
              }
              
              // 处理每个运行时间段，计算每个小时的分布
              timeIntervals.forEach(interval => {
                if (!interval.isPaused) {
                  let currentTime = interval.start
                  
                  // 遍历时间段内的每个小时
                  while (currentTime < interval.end) {
                    // 获取当前时间所在的小时
                    const currentHour = new Date(currentTime).getHours()
                    // 计算当前小时的结束时间
                    const nextHour = new Date(currentTime)
                    nextHour.setHours(currentHour + 1, 0, 0, 0)
                    
                    // 确定当前小时内的实际运行时长
                    const hourEnd = Math.min(nextHour.getTime(), interval.end)
                    const hourDuration = hourEnd - currentTime
                    
                    // 转换为秒并累加到对应小时
                    hourData[currentHour] += Math.floor(hourDuration / 1000)
                    
                    // 移动到下一个小时
                    currentTime = nextHour.getTime()
                  }
                }
              })
            }
          } catch (e) {
            console.warn('统计小时数据时出错:', e)
          }
        })
      
      // 转换为分钟（更直观的显示单位）
        const minuteData = hourData.map(seconds => (seconds / 60).toFixed(1))
        
        // 添加防抖机制，确保在下一个事件循环中创建图表
        setTimeout(() => {
          // 再次检查Canvas元素和上下文是否仍然有效
          const freshCanvas = document.getElementById('trendChart')
          if (!freshCanvas) {
            console.warn('找不到trendChart的Canvas元素（延迟检查）')
            return
          }
          
          const freshContext = freshCanvas.getContext('2d')
          if (!freshContext) {
            console.warn('无法获取trendChart的2D上下文（延迟检查）')
            return
          }
          
          // 确保Canvas尺寸正确
          if (freshCanvas.width === 0 || freshCanvas.height === 0) {
            console.warn('Canvas尺寸无效')
            return
          }
          
          // 创建新图表
          try {
            this.trendChart = new Chart(freshContext, {
              type: 'bar',
              data: {
                labels: hourLabels,
                datasets: [{
                  label: '任务时长（分钟）',
                  data: minuteData,
                  backgroundColor: 'rgba(118, 75, 162, 0.6)',
                  borderColor: 'rgba(118, 75, 162, 1)',
                  borderWidth: 2,
                  borderRadius: 6
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  tooltip: {
                    enabled: true,
                    callbacks: {
                      label: function(context) {
                        return context.dataset.label + ': ' + context.raw + 'm'
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return value + 'm'
                      }
                    }
                  }
                }
              }
            })
          } catch (chartError) {
            console.error('创建trendChart失败:', chartError)
            this.trendChart = null
          }
        }, 0)
      } catch (error) {
        console.error('生成趋势图失败:', error)
        // 确保错误不会阻止应用继续运行
        this.trendChart = null
      }
    },
    
    // 格式化时长
    formatDuration(seconds) {
      // 正确地将秒数转换为分钟和秒
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      
      if (remainingSeconds > 0) {
        return `${minutes}分钟${remainingSeconds}秒`
      }
      return `${minutes}分钟`
    },
    
    // 格式化分组日期
    formatGroupDate(date) {
      // 格式化日期为更友好的显示格式
      const d = new Date(date)
      if (isNaN(d.getTime())) return date
      
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    },
    
    // 格式化分组总时长
    formatGroupTotal(tasks) {
      const totalSeconds = tasks.reduce((sum, task) => sum + task.duration, 0)
      return this.formatDuration(totalSeconds)
    },
    
    // 切换分组展开/收起
    toggleGroup(date) {
      console.log(`切换分组展开状态: ${date}, 当前状态: ${this.expandedGroups[date]}`)
      // 获取当前状态，如果未定义则默认为false
      const currentState = this.expandedGroups[date] || false
      // 使用展开运算符创建新对象，确保响应式更新
      this.expandedGroups = {
        ...this.expandedGroups,
        [date]: !currentState
      }
      console.log(`切换后状态: ${this.expandedGroups[date]}`)
    },
    
    // Markdown相关方法
    openMarkdownEditor(id) {
      this.currentTaskId = id
      const task = this.weekTasks.find(t => t.id === id)
      this.editorContent = task?.notes || ''
      this.showEditor = true
      this.showViewer = false
    },
    
    openMarkdownViewer(id) {
      this.currentTaskId = id
      this.showViewer = true
      this.showEditor = false
    },
    
    async handleSaveNotes(content) {
      if (this.currentTaskId !== null) {
        try {
          await this.updateTaskNotes({
            id: this.currentTaskId,
            notes: content
          })
          
          // 更新本地任务列表
          const taskIndex = this.weekTasks.findIndex(t => t.id === this.currentTaskId)
          if (taskIndex !== -1) {
            // 创建新数组，确保响应式更新
            const newWeekTasks = [...this.weekTasks]
            newWeekTasks[taskIndex] = {
              ...this.weekTasks[taskIndex],
              notes: content
            }
            this.weekTasks = newWeekTasks
          }
          
          this.showEditor = false
        } catch (error) {
          console.error('保存备注失败:', error)
          alert('保存备注失败')
        }
      }
    },
    
    handleCancelEdit() {
      this.showEditor = false
    },
    
    handleCloseViewer() {
      this.showViewer = false
    },
    
    handleSwitchToEdit() {
      const task = this.viewingTask
      this.editorContent = task?.notes || ''
      this.showViewer = false
      this.showEditor = true
    },
    
    // 返回计时器页面
    goBack() {
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
}

.header-actions {
  display: flex;
  gap: 20px;
  align-items: center;
}

.week-navigation {
  display: flex;
  align-items: center;
  gap: 15px;
}

.week-label {
  font-weight: 600;
  color: #667eea;
  min-width: 150px;
  text-align: center;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* 统计概览 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 25px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 10px;
}

.stat-label {
  font-size: 1rem;
  opacity: 0.9;
}

/* 图表区域 */
.charts-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.chart-section {
  background-color: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
  border: 1px solid #e9ecef;
}

.chart-section h3 {
  margin-bottom: 20px;
  color: #333;
  font-size: 18px;
}

.chart-section canvas {
  max-height: 300px;
}

/* 任务列表 */
.week-tasks h3 {
  margin-bottom: 20px;
  color: #333;
  font-size: 20px;
}

.task-filters {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .task-filters h3 {
      margin: 0;
      font-size: 1.5rem;
      color: #4a5568;
    }
    
    .tag-select {
      padding: 8px 15px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 16px;
      background-color: white;
      cursor: pointer;
      min-width: 150px;
      transition: border-color 0.3s ease;
    }
    
    .tag-select:focus {
      border-color: #667eea;
      outline: none;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }
    
    .task-groups {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 0;
    }

.task-group {
  background-color: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #e9ecef;
  cursor: pointer;
}

.date-label {
  font-weight: 600;
  color: #495057;
}

.date-total {
  color: #667eea;
  font-weight: 500;
}

.toggle-btn {
  padding: 5px 15px;
  font-size: 14px;
}

.group-content {
  padding: 10px 20px 20px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin-bottom: 10px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  transition: all 0.2s;
  cursor: pointer;
}

.task-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.task-item:last-child {
  margin-bottom: 0;
}

.task-info {
  flex: 1;
  margin-right: 15px;
}

.task-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
}

.task-time {
  font-size: 14px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 18px;
  background-color: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

/* 模态框样式 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.markdown-editor {
  width: 100%;
  min-height: 300px;
  padding: 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  font-family: 'Monaco', 'Consolas', monospace;
  resize: vertical;
}

.editor-actions {
  margin: 15px 0;
  display: flex;
  justify-content: flex-end;
}

.markdown-preview,
.markdown-content {
  margin-top: 15px;
  padding: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background-color: #f8f9fa;
  min-height: 100px;
}

/* Markdown内容样式 */
.markdown-content h1,
.markdown-preview h1 {
  font-size: 24px;
  margin-bottom: 15px;
  color: #333;
}

.markdown-content h2,
.markdown-preview h2 {
  font-size: 20px;
  margin-bottom: 10px;
  color: #444;
}

.markdown-content h3,
.markdown-preview h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #555;
}

.markdown-content strong,
.markdown-preview strong {
  font-weight: 600;
  color: #333;
}

.markdown-content em,
.markdown-preview em {
  font-style: italic;
}

.markdown-content a,
.markdown-preview a {
  color: #667eea;
  text-decoration: none;
}

.markdown-content a:hover,
.markdown-preview a:hover {
  text-decoration: underline;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 768px) {
    .charts-container {
      grid-template-columns: 1fr;
    }
    
    .stats-overview {
      grid-template-columns: 1fr;
    }
    
    .header {
      flex-direction: column;
      align-items: stretch;
    }
    
    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }
    
    .week-navigation {
      justify-content: center;
    }
    
    .task-filters {
      flex-direction: column;
      align-items: stretch;
      gap: 15px;
    }
    
    .tag-select {
      width: 100%;
    }
    
    .task-item {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
    
    .task-actions {
      align-self: flex-end;
    }
  }

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