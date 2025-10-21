<template>
  <div class="modal" v-if="visible" @click.self="handleClose">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ title || '备注' }}</h3>
        <div class="header-actions">
          <button class="btn-secondary btn-sm" @click="handleEdit" v-if="showEditButton">编辑</button>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="markdown-content" v-html="parsedContent"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" @click="handleClose">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked'

export default {
  name: 'MarkdownViewer',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    content: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    showEditButton: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    parsedContent() {
      if (!this.content) return ''
      return marked(this.content)
    }
  },
  methods: {
    handleClose() {
      this.$emit('close')
    },
    handleEdit() {
      this.$emit('edit')
    }
  }
}
</script>

<style scoped>
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

.btn-sm {
  padding: 6px 12px;
  font-size: 14px;
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

.markdown-content {
  padding: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background-color: #f8f9fa;
  min-height: 100px;
}

/* Markdown内容样式 */
.markdown-content h1 {
  font-size: 24px;
  margin-bottom: 15px;
  color: #333;
}

.markdown-content h2 {
  font-size: 20px;
  margin-bottom: 10px;
  color: #444;
}

.markdown-content h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #555;
}

.markdown-content strong {
  font-weight: 600;
  color: #333;
}

.markdown-content em {
  font-style: italic;
}

.markdown-content a {
  color: #667eea;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.markdown-content ul,
.markdown-content ol {
  padding-left: 25px;
  margin-bottom: 15px;
}

.markdown-content li {
  margin-bottom: 5px;
}

.markdown-content blockquote {
  border-left: 4px solid #667eea;
  padding-left: 15px;
  color: #666;
  font-style: italic;
  margin: 15px 0;
}

.markdown-content code {
  background-color: #f1f1f1;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.9em;
}

.markdown-content pre {
  background-color: #f1f1f1;
  padding: 15px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 15px 0;
}

.markdown-content pre code {
  background-color: transparent;
  padding: 0;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 20px;
  }
  
  .modal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>