// Vue应用入口文件
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

// 创建Vue应用实例
const app = createApp(App)

// 使用路由和状态管理
app.use(router)
app.use(store)

// 挂载应用
const vm = app.mount('#app')

// 为通知窗口提供延长时间的功能
// 在Electron环境中，这会被ipcRenderer调用
window.extendTaskTime = function(minutes) {
  // 通过Vuex action延长任务时间
  store.dispatch('extendTaskTime', minutes)
}

// 暴露Vue应用实例，用于与通知窗口通信
window.__VUE_APP__ = {
  extendTaskTime: function(minutes) {
    store.dispatch('extendTaskTime', minutes)
  },
  store: store,
  router: router
}