<template>
  <div class="container">
    <div class="header">
      <h1>任务历史</h1>
      <button class="btn-secondary" @click="goBack">返回计时器</button>
    </div>
    
    <div class="history-content">
      <div class="filters" v-if="taskHistory.length > 0">
        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery"
            placeholder="搜索任务名称..."
          >
        </div>
        <div class="filter-options">
          <select v-model="sortOrder" class="sort-select">
            <option value="newest">最新优先</option>
            <option value="oldest">最早优先</option>
          </select>
          <select v-model="timeRange" class="time-select">
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </select>
          <!-- 标签过滤下拉选择框 - 与时间过滤下拉框保持一致 -->
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
      </div>
      
      <div class="history-list" v-if="filteredTasks.length > 0">
        <TaskItem 
          v-for="task in filteredTasks" 
          :key="task.id"
          :task="task"
          :show-delete-button="true"
          @edit="openMarkdownEditor(task.id)"
          @view-notes="openMarkdownViewer(task.id)"
          @delete="confirmDeleteTask(task.id)"
        />
      </div>
      
      <div class="empty-state" v-else>
        <p>{{ taskHistory.length === 0 ? '暂无任务历史记录' : '没有找到匹配的任务' }}</p>
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
      :content="viewingTask?.notes || ''"
      :title="`${viewingTask?.name || ''} - 备注`"
      @close="handleCloseViewer"
      @edit="handleSwitchToEdit"
    />
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import TaskItem from '../components/TaskItem.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import MarkdownViewer from '../components/MarkdownViewer.vue'

export default {
  name: 'HistoryView',
  components: {
    TaskItem,
    MarkdownEditor,
    MarkdownViewer
  },
  data() {
    return {
        searchQuery: '',
        sortOrder: 'newest',
        timeRange: 'all',
        showEditor: false,
        showViewer: false,
        currentTaskId: null,
        editorContent: '',
        selectedTag: ''
      }
  },
  computed: {
    ...mapState(['taskHistory']),
    
    // 获取所有可用的唯一标签列表
    allAvailableTags() {
      const tagsSet = new Set()
      
      // 遍历所有任务，收集所有唯一标签
      this.taskHistory.forEach(task => {
        if (Array.isArray(task.tags) && task.tags.length > 0) {
          task.tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              tagsSet.add(tag)
            }
          })
        }
      })
      
      // 转换为数组并排序
      return Array.from(tagsSet).sort()
    },
    
    // 过滤后的任务列表
    filteredTasks() {
      let tasks = [...this.taskHistory]
      
      // 搜索过滤
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        tasks = tasks.filter(task => task.name.toLowerCase().includes(query))
      }
      
      // 标签过滤 - 与时间过滤保持一致的单选逻辑
      if (this.selectedTag) {
        tasks = tasks.filter(task => {
          // 确保任务有标签数组
          const taskTags = Array.isArray(task.tags) ? task.tags : []
          // 检查任务标签中是否包含所选标签
          return taskTags.includes(this.selectedTag)
        })
      }
      
      // 时间范围过滤
      if (this.timeRange !== 'all') {
        const now = new Date()
        let startDate
        
        switch (this.timeRange) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            const day = now.getDay() || 7
            startDate = new Date(now.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
            startDate.setHours(0, 0, 0, 0)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
        }
        
        // 同时尝试两种可能的字段名（completedAt和completed_at）以提高兼容性
        tasks = tasks.filter(task => {
          const taskDate = new Date(task.completedAt || task.completed_at)
          return !isNaN(taskDate.getTime()) && taskDate >= startDate
        })
      }
      
      // 排序 - 使用兼容的字段名
      tasks.sort((a, b) => {
        const dateA = new Date(a.completedAt || a.completed_at).getTime()
        const dateB = new Date(b.completedAt || b.completed_at).getTime()
        return this.sortOrder === 'newest' ? dateB - dateA : dateA - dateB
      })
      
      return tasks
    },
    
    // 当前编辑的任务
    editingTask() {
      return this.taskHistory.find(task => task.id === this.currentTaskId)
    },
    
    // 当前查看的任务
    viewingTask() {
      return this.taskHistory.find(task => task.id === this.currentTaskId)
    }
  },
  mounted() {
    this.loadTaskHistory()
  },
  methods: {
    ...mapActions(['loadTaskHistory', 'deleteTaskRecord', 'updateTaskNotes']),
    
    // 格式化时长（保留此方法以兼容其他地方的使用）
    formatDuration(seconds) {
      // 正确地将秒数转换为分钟和秒
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = seconds % 60
      if (remainingSeconds > 0) {
        return `${minutes}分钟${remainingSeconds}秒`
      }
      return `${minutes}分钟`
    },
    
    // 格式化日期时间（保留此方法以兼容其他地方的使用）
    formatDateTime(dateTime) {
      if (!dateTime) return ''
      
      const date = new Date(dateTime)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      
      if (isToday) {
        // 如果是今天，只显示时间
        return date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      } else {
        // 否则显示日期和时间
        return date.toLocaleString('zh-CN', { 
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
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
        await this.deleteTaskRecord(id)
        // 可以添加成功提示
      } catch (error) {
        console.error('删除任务失败:', error)
        alert('删除任务失败')
      }
    },
    
    // Markdown相关方法
    openMarkdownEditor(id) {
      this.currentTaskId = id
      const task = this.taskHistory.find(t => t.id === id)
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
    
    // 清除选中的标签功能已通过下拉框的空选项实现，无需单独按钮
    // 如需快速清除，用户可以直接在下拉框中选择"全部标签"选项
    
    // 返回计时器页面
    goBack() {
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.history-content {
  width: 100%;
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.search-box input {
  padding: 10px 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  width: 300px;
}

.filter-options {
  display: flex;
  gap: 15px;
  align-items: center;
}

.sort-select,
.time-select {
  padding: 10px 15px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  background-color: white;
  cursor: pointer;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.task-item {
  background-color: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
  margin-bottom: -5px;
  cursor: pointer;
}

.task-item:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
  transform: translateY(-2px);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.task-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  flex: 1;
  margin-right: 15px;
}

.task-actions {
  display: flex;
  gap: 10px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 14px;
}

.task-info {
  display: flex;
  gap: 20px;
  color: #666;
  font-size: 14px;
}

.duration {
  font-weight: 500;
  color: #667eea;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 18px;
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
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box input {
    width: 100%;
  }
  
  .filter-options {
    justify-content: space-between;
  }
  
  .task-header {
    flex-direction: column;
    gap: 15px;
  }
  
  .task-actions {
    width: 100%;
    justify-content: flex-end;
  }
  }

  /* 标签选择下拉框样式 - 与其他过滤条件保持一致 */
  .tag-select {
    padding: 10px 15px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    background-color: white;
    cursor: pointer;
    min-width: 150px;
    height: 44px; /* 与其他选择框高度保持一致 */
    vertical-align: middle;
  }
  
  .clear-tags-btn {
    padding: 10px 15px;
    background-color: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    height: 44px; /* 与其他过滤条件高度保持一致 */
    display: flex;
    align-items: center;
  }
  
  .clear-tags-btn:hover {
    background-color: #5a67d8;
  }
  
  /* 多选下拉框的样式优化 - 保持与其他选择框一致的视觉效果 */
  select[multiple] {
    height: 44px; /* 固定高度与其他选择框保持一致 */
    padding: 10px 15px;
    overflow-y: auto;
    vertical-align: middle;
  }
  
  select[multiple]:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
  
  /* 确保在移动设备上显示正常 */
  @media (max-width: 768px) {
    .filter-options {
      flex-wrap: wrap;
    }
    
    .tag-select {
      width: 100%;
      margin-top: 10px;
    }
    
    .clear-tags-btn {
      width: 100%;
      margin-top: 10px;
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