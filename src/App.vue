<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

#app {
  width: 100%;
  max-width: 1000px;
}

.container {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  padding: 40px;
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

h1 {
  color: #667eea;
  font-size: 2.5rem;
  font-weight: 700;
}

.main-content {
  display: flex;
  gap: 40px;
  align-items: flex-start;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #5a67d8;
  transform: translateY(-2px);
}

.btn-secondary {
  background-color: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #cbd5e0;
}

.btn-danger {
  background-color: #f56565;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #e53e3e;
}
/* 全局滚动条样式 */
html {
  /* Firefox滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #667eea #f8f9fa;
}

/* Chrome, Edge, Safari 滚动条样式 */
html::-webkit-scrollbar {
  width: 3px;
}

html::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 10px;
}

html::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 10px;
  transition: background 0.3s ease;
}

html::-webkit-scrollbar-thumb:hover {
  background: #5a67d8;
}
</style>