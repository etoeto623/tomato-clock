<template>
  <div class="task-item" @dblclick="$emit('edit')">
    <div class="task-info">
      <div class="task-name">
        {{ task.name }}
        <!-- 标签显示区域 - 移到任务名称后面 -->
        <div class="task-tags">
          <!-- 安全地显示标签，确保task.tags是数组 -->
          <span 
            v-for="(tag, index) in safeTags" 
            :key="index" 
            class="tag"
          >
            {{ tag }}
          </span>
        </div>
      </div>
      
      <div class="task-details">
        <span class="duration">{{ formatDuration(task.duration) }}</span>
        <span class="time-range">{{ formatDateTime(task.startTime) }} - {{ formatDateTime(task.completedAt) }}</span>
        <!-- 暂停记录切换按钮 -->
        <button 
          v-if="hasPauses"
          class="toggle-pauses-btn btn-sm"
          @click.stop="togglePauses"
        >
          {{ showPauses ? '隐藏暂停记录 ▲' : '显示暂停记录 ▼' }}
        </button>
      </div>
      <!-- 暂停记录详情 -->
      <div v-if="showPauses && hasPauses" class="pause-history">
        <h4>暂停记录:</h4>
        <div v-for="(pause, index) in task.pauses" :key="index" class="pause-item">
          <div class="pause-time">
            <span>{{ formatDateTime(pause.start) }}</span> - 
            <span>{{ formatDateTime(pause.end) }}</span>
          </div>
          <div class="pause-duration">
            持续: {{ calculatePauseDuration(pause) }}
          </div>
        </div>
        <div class="pause-summary">
          共 {{ task.pauses.length }} 次暂停，总暂停时长: {{ formatDuration(totalPauseDuration) }}
        </div>
      </div>
    </div>
    <div class="task-actions">
      <button 
        class="btn-secondary btn-sm"
        v-if="task.notes"
        @click.stop="$emit('view-notes')"
      >
        查看备注
      </button>
      <button 
        v-if="showDeleteButton"
        class="btn-danger btn-sm"
        @click.stop="$emit('delete')"
      >
        删除
      </button>
      <button 
        class="btn-primary btn-sm"
        @click.stop="openTagEditor"
      >
        标签
      </button>
    </div>
  </div>
  
  <!-- 标签编辑弹窗 -->
  <div v-if="showTagEditor" class="tag-editor-overlay" @click="closeTagEditor">
    <div class="tag-editor" @click.stop>
      <h3>编辑任务标签</h3>
      
      <!-- 当前标签 -->
      <div class="current-tags" v-if="editingTags && editingTags.length > 0">
        <span class="section-title">当前标签：</span>
        <span 
          v-for="(tag, index) in editingTags" 
          :key="index" 
          class="tag editable"
        >
          {{ tag }}
          <button 
            class="remove-tag-btn"
            @click="removeTag(index)"
          >
            ×
          </button>
        </span>
      </div>
      
      <!-- 标签输入框和建议列表 -->
      <div class="tag-input-wrapper">
        <input
          type="text"
          class="tag-input"
          v-model="newTag"
          placeholder="输入标签名称，按回车添加"
          @keydown.enter.prevent="handleEnterKey"
          @keydown.down.prevent="handleDownKey"
          @keydown.up.prevent="handleUpKey"
          @keydown.esc.prevent="handleEscapeKey"
          @input="handleInput"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          ref="tagInput"
        />
        <div 
          v-if="showSuggestions && filteredSuggestions && filteredSuggestions.length > 0"
          class="tag-suggestions"
        >
          <div
            v-for="(suggestion, index) in filteredSuggestions"
            :key="suggestion"
            :class="['suggestion-item', { 'selected': index === selectedSuggestionIndex }]"
            @mousedown.prevent="selectSuggestion(suggestion)"
          >
            {{ suggestion }}
          </div>
        </div>
      </div>
      
      <!-- 保存/取消按钮 -->
      <div class="tag-editor-actions">
        <button class="btn-secondary" @click="saveTags">保存</button>
        <button class="btn-default" @click="closeTagEditor">取消</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TaskItem',
  props: {
    task: {
      type: Object,
      required: true
    },
    showDeleteButton: {
      type: Boolean,
      default: false
    },
    showDateTimeRange: {
      type: Boolean,
      default: true
    }
  },
  emits: ['tags-updated', 'edit', 'view-notes', 'delete'],


  data() {
    return {
      showPauses: false,
      showTagEditor: false,
      editingTags: [], // 用于标签编辑器的临时标签数组
      newTag: '',
      allTags: [],
      filteredSuggestions: [],
      showSuggestions: false,
      selectedSuggestionIndex: -1 // 当前选中的建议索引
    }
  },
  
  watch: {
    // 监听任务变化，更新编辑中的标签
    task: {
      handler(newTask, oldTask) {
        this.editingTags = [...(newTask.tags || [])]
        console.log('任务数据变化', { 
          taskId: newTask.id, 
          oldTags: oldTask?.tags, 
          newTags: newTask.tags 
        })
      },
      deep: true,
      immediate: true
    },
    // 监听编辑标签数组变化
    editingTags: {
      handler(newTags) {
        console.log('编辑标签数组变化', { tags: newTags, count: newTags.length })
      },
      deep: true
    }
  },
  
  mounted() {
    // 组件挂载时获取所有标签
    this.fetchAllTags()
    // 添加调试信息
    console.log('TaskItem组件已挂载', { taskId: this.task.id, initialTags: this.task.tags })
  },
  computed: {
    hasPauses() {
      return this.task.pauses && this.task.pauses.length > 0
    },
    totalPauseDuration() {
      if (!this.hasPauses) return 0
      
      return this.task.pauses.reduce((total, pause) => {
        const pauseDuration = this.calculatePauseDurationInSeconds(pause)
        return total + pauseDuration
      }, 0)
    },
    // 安全的标签数组，确保始终返回有效数组
    safeTags() {
      console.log('计算safeTags', { rawTags: this.task.tags, isArray: Array.isArray(this.task.tags) })
      // 确保是数组且每个元素都是字符串
      const tags = Array.isArray(this.task.tags) ? this.task.tags : [];
      return tags.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
    }
  },
  methods: {
    // 获取所有标签
    async fetchAllTags() {
      console.log('开始获取所有标签')
      try {
        if (window.electronAPI) {
          console.log('调用electronAPI获取所有标签')
          const tags = await window.electronAPI.getAllTags()
          console.log('获取标签结果:', { rawResult: tags, count: (tags || []).length })
          this.allTags = tags || []
          
          // 如果没有获取到标签，添加一些默认标签用于测试
          if (this.allTags.length === 0) {
            console.log('未获取到标签，添加默认标签')
            this.allTags = ['工作', '学习', '生活', '娱乐', '开发', '设计', '测试', '运维']
          }
          
          console.log('标签数据已初始化:', { allTagsCount: this.allTags.length })
        } else {
          console.warn('Electron API不可用，使用默认标签')
          // 提供默认标签，确保在开发环境中也能测试标签联想功能
          this.allTags = ['工作', '学习', '生活', '娱乐', '开发', '设计', '测试', '运维']
        }
      } catch (error) {
        console.error('获取标签失败:', { error, message: error.message, stack: error.stack })
        // 出错时提供默认标签
        this.allTags = ['工作', '学习', '生活', '娱乐', '开发', '设计', '测试', '运维']
      }
    },
    
    // 处理输入框聚焦事件
    handleInputFocus() {
      console.log('标签输入框聚焦，检查是否显示建议')
      this.selectedSuggestionIndex = -1 // 重置选中索引
      if (this.newTag.trim() && this.filteredSuggestions && this.filteredSuggestions.length > 0) {
        this.showSuggestions = true
        console.log('聚焦时显示建议列表:', { suggestions: this.filteredSuggestions })
      }
    },
    
    // 处理输入框失焦
    handleInputBlur() {
      console.log('标签输入框失焦，延迟隐藏建议')
      // 延迟隐藏，给点击建议项留出时间
      setTimeout(() => {
        this.showSuggestions = false
        this.selectedSuggestionIndex = -1 // 重置选中索引
        console.log('建议列表已隐藏')
      }, 200)
    },
    
    // 处理输入事件
    handleInput() {
      this.selectedSuggestionIndex = -1 // 输入时重置选中索引
      this.filterSuggestions()
    },
    
    // 处理回车键
    handleEnterKey() {
      if (this.showSuggestions && this.selectedSuggestionIndex >= 0) {
        // 如果有选中的建议，选择该建议
        const selectedSuggestion = this.filteredSuggestions[this.selectedSuggestionIndex]
        this.selectSuggestion(selectedSuggestion)
      } else {
        // 否则添加当前输入的标签
        this.addTag()
      }
    },
    
    // 处理向下箭头键
    handleDownKey() {
      if (!this.showSuggestions || this.filteredSuggestions.length === 0) {
        return
      }
      
      this.selectedSuggestionIndex++
      if (this.selectedSuggestionIndex >= this.filteredSuggestions.length) {
        this.selectedSuggestionIndex = 0 // 循环到第一个
      }
      this.scrollToSelectedSuggestion()
    },
    
    // 处理向上箭头键
    handleUpKey() {
      if (!this.showSuggestions || this.filteredSuggestions.length === 0) {
        return
      }
      
      this.selectedSuggestionIndex--
      if (this.selectedSuggestionIndex < 0) {
        this.selectedSuggestionIndex = this.filteredSuggestions.length - 1 // 循环到最后一个
      }
      this.scrollToSelectedSuggestion()
    },
    
    // 处理ESC键
    handleEscapeKey() {
      this.showSuggestions = false
      this.selectedSuggestionIndex = -1
    },
    
    // 滚动到选中的建议项
    scrollToSelectedSuggestion() {
      this.$nextTick(() => {
        const suggestionsContainer = this.$el.querySelector('.tag-suggestions')
        const selectedItem = suggestionsContainer?.querySelector('.suggestion-item.selected')
        if (selectedItem && suggestionsContainer) {
          const containerRect = suggestionsContainer.getBoundingClientRect()
          const itemRect = selectedItem.getBoundingClientRect()
          
          // 如果选中项不在可见区域内，滚动到可见区域
          if (itemRect.top < containerRect.top) {
            selectedItem.scrollIntoView({ block: 'start', behavior: 'smooth' })
          } else if (itemRect.bottom > containerRect.bottom) {
            selectedItem.scrollIntoView({ block: 'end', behavior: 'smooth' })
          }
        }
      })
    },
    
    // 过滤标签建议
    filterSuggestions() {
      console.log('开始过滤标签建议')
      try {
        // 确保数据类型正确
        if (!Array.isArray(this.allTags)) {
          console.warn('allTags不是数组类型，使用默认值')
          this.allTags = ['工作', '学习', '生活', 'BugFix', '运维', '项目', '会议', '研究']
        }
        
        const inputValue = this.newTag?.trim() || ''
        console.log('过滤输入值:', inputValue)
        
        if (!inputValue) {
          this.filteredSuggestions = []
          this.showSuggestions = false
          console.log('输入为空，清空建议列表')
          return
        }
        
        // 过滤掉已在编辑标签列表中的标签，并按匹配度排序
        this.filteredSuggestions = this.allTags
          .filter(tag => {
            const tagExists = Array.isArray(this.editingTags) && this.editingTags.includes(tag)
            const matchesInput = tag.toLowerCase().includes(inputValue.toLowerCase())
            return !tagExists && matchesInput
          })
          .sort((a, b) => {
            const aIndex = a.toLowerCase().indexOf(inputValue.toLowerCase())
            const bIndex = b.toLowerCase().indexOf(inputValue.toLowerCase())
            return aIndex - bIndex
          })
        
        console.log('过滤后的建议列表:', { 
          suggestions: this.filteredSuggestions,
          count: this.filteredSuggestions.length,
          allTagsCount: this.allTags.length 
        })
        
        // 根据过滤结果决定是否显示建议列表
        this.showSuggestions = this.filteredSuggestions.length > 0
        console.log('是否显示建议列表:', this.showSuggestions)
      } catch (error) {
        console.error('过滤标签建议时出错:', error)
        this.filteredSuggestions = []
        this.showSuggestions = false
      }
    },
    
    // 选择建议标签
    selectSuggestion(suggestion) {
      console.log('选择标签建议:', suggestion)
      try {
        // 确保editingTags是数组
        if (!Array.isArray(this.editingTags)) {
          this.editingTags = []
          console.warn('editingTags不是数组，已初始化')
        }
        
        // 检查标签是否已存在
        if (!this.editingTags.includes(suggestion)) {
          this.editingTags.push(suggestion)
          console.log('添加选择的建议标签到编辑列表:', { 
            tag: suggestion,
            currentTags: this.editingTags 
          })
        } else {
          console.log('标签已存在于编辑列表中:', suggestion)
        }
        
        // 清空输入框并隐藏建议
        this.newTag = ''
        this.showSuggestions = false
        
        // 重新聚焦输入框
        this.$nextTick(() => {
          if (this.$refs.tagInput) {
            this.$refs.tagInput.focus()
            console.log('输入框已重新聚焦')
          }
        })
      } catch (error) {
        console.error('选择标签建议时出错:', error)
      }
    },

    // 打开标签编辑器
    openTagEditor() {
      console.log('打开标签编辑器', { taskId: this.task.id, currentTags: this.task.tags })
      // 确保创建的是纯数组，不受Vue响应式系统影响
      const currentTags = Array.isArray(this.task.tags) ? this.task.tags : []
      this.editingTags = [...currentTags]
      console.log('初始化编辑标签数组:', { editingTags: this.editingTags, length: this.editingTags.length })
      this.newTag = ''
      this.showTagEditor = true
      // 自动聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.tagInput) {
          console.log('标签输入框聚焦')
          this.$refs.tagInput.focus()
        }
      })
    },
    
    // 关闭标签编辑器
    closeTagEditor() {
      console.log('关闭标签编辑器')
      this.showTagEditor = false
      this.showSuggestions = false
      this.filteredSuggestions = []
      console.log('标签编辑器状态已重置')
    },
    
    // 添加标签
    addTag() {
      console.log('添加标签操作', { input: this.newTag, editingTags: this.editingTags })
      const tag = this.newTag.trim()
      
      // 确保editingTags始终是数组
      if (!Array.isArray(this.editingTags)) {
        this.editingTags = []
      }
      
      if (tag && !this.editingTags.includes(tag)) {
        console.log('添加新标签:', tag)
        this.editingTags.push(tag)
        console.log('添加后的编辑标签数组:', this.editingTags)
        this.newTag = ''
        this.showSuggestions = false
        
        // 更新所有标签列表，确保新标签也能在联想中显示
        if (!this.allTags.includes(tag)) {
          console.log('将新标签添加到全局标签列表', { tag })
          this.allTags.unshift(tag)
        }
      } else {
        console.log('标签添加被跳过', { tag, alreadyExists: this.editingTags?.includes(tag) })
      }
    },
    
    // 移除标签
    removeTag(index) {
      const removedTag = this.editingTags[index]
      console.log('移除标签操作', { index, tag: removedTag, beforeRemoval: [...this.editingTags] })
      this.editingTags.splice(index, 1)
      console.log('移除后的标签数组:', this.editingTags)
    },
    
    // 过滤标签建议
    filterSuggestions() {
      const query = this.newTag.toLowerCase().trim()
      console.log('过滤标签建议', { query, allTagsCount: this.allTags.length, currentTags: this.editingTags })
      
      // 确保allTags和editingTags是数组
      const allTags = Array.isArray(this.allTags) ? this.allTags : []
      const currentTags = Array.isArray(this.editingTags) ? this.editingTags : []
      
      if (query && allTags.length > 0) {
        // 过滤出包含查询内容且未在当前编辑标签中的标签
        this.filteredSuggestions = allTags.filter(tag => 
          tag && tag.toLowerCase().includes(query) && !currentTags.includes(tag)
        )
        console.log('标签过滤结果', { suggestionsCount: this.filteredSuggestions.length, suggestions: this.filteredSuggestions })
        
        // 只有当有建议时才显示
        this.showSuggestions = this.filteredSuggestions.length > 0
      } else {
        console.log('查询为空或没有可用标签，隐藏建议列表')
        this.showSuggestions = false
        this.filteredSuggestions = []
      }
    },
    
    // 选择建议的标签
    selectSuggestion(suggestion) {
      console.log('选择建议标签:', { suggestion, alreadyExists: this.editingTags.includes(suggestion) })
      if (!this.editingTags.includes(suggestion)) {
        this.editingTags.push(suggestion)
        console.log('添加建议标签后的数组:', this.editingTags)
      }
      this.newTag = ''
      this.showSuggestions = false
      
      // 保持输入框聚焦
      if (this.$refs.tagInput) {
        console.log('标签选择后重新聚焦输入框')
        this.$refs.tagInput.focus()
      }
    },

    // 保存标签
    async saveTags() {
      console.log('开始保存标签流程')
      try {
        // 首先确认编辑标签数组有效
        console.log('保存前编辑标签数组:', { editingTags: this.editingTags, type: Array.isArray(this.editingTags) ? 'array' : typeof this.editingTags })
        
        // 确保传递的是纯数据类型，避免序列化问题
        const taskId = this.task.id || this.task.index
        console.log('标签保存任务ID:', { taskId, originalTaskId: this.task.id, taskIndex: this.task.index })
        
        // 转换为纯字符串数组，确保没有Vue反应式属性
        const tagsToSave = Array.isArray(this.editingTags) 
          ? this.editingTags.map(tag => String(tag).trim()).filter(tag => tag.length > 0)
          : []
        console.log('处理后待保存标签数组:', { tags: tagsToSave, count: tagsToSave.length })
        
        // 如果没有electronAPI，尝试直接使用ipcRenderer
        let updateResult
        if (window.electronAPI) {
          console.log('使用electronAPI更新标签')
          updateResult = await window.electronAPI.updateTaskTags(taskId, tagsToSave)
        } else {
          console.log('electronAPI不可用，尝试使用直接IPC调用')
          const { ipcRenderer } = window.require('electron')
          updateResult = await ipcRenderer.invoke('update-task-tags', taskId, tagsToSave)
        }
        
        console.log('标签保存结果:', updateResult)
        
        // 直接赋值更新任务标签，使用JSON序列化/反序列化确保是纯对象
        const tagsJson = JSON.stringify(tagsToSave)
        this.task.tags = JSON.parse(tagsJson)
        console.log('更新后的任务标签:', { tags: this.task.tags, json: tagsJson })
        
        // 通知父组件标签已更新
        console.log('发送tags-updated事件到父组件')
        this.$emit('tags-updated', JSON.parse(tagsJson))
        
        // 关闭编辑器
        console.log('标签保存流程完成，关闭编辑器')
        this.closeTagEditor()
      } catch (error) {
        console.error('保存标签失败:', { error, taskId: this.task.id, attemptedTags: this.editingTags })
        console.error('错误详情:', error.message, error.stack)
        alert('保存标签失败，请重试')
      }
    },
    
    // 格式化持续时间 - 精确到秒
    formatDuration(seconds) {
      if (!seconds && seconds !== 0) return '0秒'
      
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const remainingSeconds = seconds % 60
      
      let result = ''
      if (hours > 0) {
        result += `${hours}小时`
      }
      if (minutes > 0) {
        result += `${minutes}分钟`
      }
      // 始终显示秒数
      result += `${remainingSeconds}秒`
      
      return result
    },
    
    // 格式化日期时间 - 使用yyyy-MM-dd HH:mm:ss格式
    formatDateTime(dateTime) {
      if (!dateTime) return ''
      
      const date = new Date(dateTime)
      if (isNaN(date.getTime())) return ''
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    },
    
    // 切换暂停记录显示状态
    togglePauses() {
      this.showPauses = !this.showPauses
    },
    
    // 计算单次暂停的持续时间
    calculatePauseDuration(pause) {
      const durationInSeconds = this.calculatePauseDurationInSeconds(pause)
      return this.formatDuration(durationInSeconds)
    },
    
    // 计算单次暂停的持续时间（秒）
    calculatePauseDurationInSeconds(pause) {
      if (!pause.start || !pause.end) return 0
      
      const startTime = new Date(pause.start).getTime()
      const endTime = new Date(pause.end).getTime()
      
      if (isNaN(startTime) || isNaN(endTime)) return 0
      
      return Math.floor((endTime - startTime) / 1000)
    }
  }
}
</script>

<style scoped>
.task-item {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: background-color 0.2s ease;
}

.task-item:hover {
  background-color: #e9ecef;
}

.task-info {
  flex: 1;
  min-width: 0; /* 防止flex子元素溢出 */
}

.task-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 标签样式 */
.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background-color: #e3f2fd;
  color: #1565c0;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag.editable {
  background-color: #bbdefb;
}

.task-details {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.duration {
  color: #1a73e8; /* 蓝色系字体 */
  font-weight: 500;
}

.time-range {
  color: #666;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 13px;
  border-radius: 4px;
  white-space: nowrap;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-default {
  background-color: #f8f9fa;
  color: #333;
  border: 1px solid #dee2e6;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.btn-default:hover {
  background-color: #e9ecef;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.btn-danger:hover {
  background-color: #c82333;
}

/* 暂停记录相关样式 */
.toggle-pauses-btn {
  background-color: transparent;
  color: #1a73e8;
  border: 1px solid #1a73e8;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-pauses-btn:hover {
  background-color: #1a73e8;
  color: white;
}

.pause-history {
  margin-top: 10px;
  padding: 10px;
  background-color: #f0f7ff;
  border-radius: 6px;
  font-size: 13px;
}

.pause-history h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 14px;
}

.pause-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid #e0e0e0;
}

.pause-item:last-of-type {
  border-bottom: none;
}

.pause-time {
  color: #555;
}

.pause-duration {
  color: #1a73e8;
  font-weight: 500;
}

/* 标签编辑器样式 */
.tag-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.tag-editor {
  background-color: white;
  border-radius: 8px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.tag-editor h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 18px;
}

.current-tags {
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-weight: 500;
  color: #666;
  font-size: 14px;
}

.remove-tag-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.remove-tag-btn:hover {
  background-color: #f44336;
  color: white;
}

.tag-input-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.tag-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.tag-input:focus {
  border-color: #007bff;
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.suggestion-item {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.2s ease;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.suggestion-item.selected {
  background-color: #e3f2fd;
  color: #1565c0;
  font-weight: 500;
}

.tag-editor-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.pause-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ddd;
  font-weight: 500;
  color: #666;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .task-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .task-actions {
    margin-left: 0;
    margin-top: 10px;
  }
  
  .task-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .pause-item {
    flex-direction: column;
    gap: 2px;
  }
}
</style>