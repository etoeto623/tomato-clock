<template>
  <div class="modal" v-if="visible" @click.self="handleCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ title || '编辑备注' }}</h3>
        <button class="close-btn" @click="handleCancel">&times;</button>
      </div>
      <div class="modal-body">
        <textarea 
          v-model="localContent"
          class="markdown-editor"
          placeholder="使用Markdown格式编写备注..."
        ></textarea>
        <div class="editor-actions">
          <label>
            <input type="checkbox" v-model="showPreview">
            实时预览
          </label>
        </div>
        <div class="markdown-preview" v-if="showPreview" v-html="parsedContent"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" @click="handleCancel">取消</button>
        <button class="btn-primary" @click="handleSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked'

export default {
  name: 'MarkdownEditor',
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
    }
  },
  data() {
    return {
      localContent: '',
      showPreview: false
    }
  },
  computed: {
    parsedContent() {
      if (!this.localContent) return ''
      return marked(this.localContent)
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.localContent = this.content
      }
    },
    content(newVal) {
      if (this.visible) {
        this.localContent = newVal
      }
    }
  },
  methods: {
    handleSave() {
      this.$emit('save', this.localContent)
    },
    handleCancel() {
      this.$emit('cancel')
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

.markdown-preview {
  margin-top: 15px;
  padding: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background-color: #f8f9fa;
  min-height: 100px;
}

/* Markdown预览样式 */
.markdown-preview h1 {
  font-size: 24px;
  margin-bottom: 15px;
  color: #333;
}

.markdown-preview h2 {
  font-size: 20px;
  margin-bottom: 10px;
  color: #444;
}

.markdown-preview h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #555;
}

.markdown-preview strong {
  font-weight: 600;
  color: #333;
}

.markdown-preview em {
  font-style: italic;
}

.markdown-preview a {
  color: #667eea;
  text-decoration: none;
}

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

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    margin: 20px;
  }
  
  .markdown-editor {
    font-size: 14px;
  }
}
</style>