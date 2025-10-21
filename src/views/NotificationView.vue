<template>
  <div class="notification-container">
    <div class="container animate">
      <div class="icon">✓</div>
      <h1>{{ taskName }}</h1>
      <p>恭喜您完成了任务！</p>
      <div class="button-group">
        <!-- <button @click="extendTaskTime" class="button">延长5分钟</button> -->
        <button @click="closeWindow" class="button">完成</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NotificationView',
  data() {
    return {
      taskName: '任务已完成',
      currentUrl: window.location.href
    }
  },
  mounted() {
    // 保存当前URL
    this.currentUrl = window.location.href;
    console.log('NotificationView mounted, 当前URL:', this.currentUrl);
    
    // 从localStorage中获取任务名称
    this.getTaskNameFromLocalStorage();
    
    // 增加一个延迟检查，确保localStorage中的值已经被设置
    setTimeout(() => {
      this.getTaskNameFromLocalStorage();
    }, 300);
    
    // 再尝试一次，确保获取到值
    setTimeout(() => {
      this.getTaskNameFromLocalStorage();
    }, 1000);
  },
  methods: {
    // 从localStorage获取任务名称
    getTaskNameFromLocalStorage() {
      try {
        const taskName = localStorage.getItem('notificationTaskName');
        if (taskName) {
          this.taskName = taskName;
          console.log('从localStorage成功获取任务名称:', this.taskName);
          return true;
        } else {
          console.log('localStorage中未找到任务名称');
        }
      } catch (e) {
        console.error('从localStorage获取任务名称失败:', e);
      }
      return false;
    },
      
    // 测试设置任务名称
    testSetTaskName() {
      this.taskName = '测试任务名称';
      console.log('测试设置任务名称:', this.taskName);
    },
      
    // 延长时间方法
    extendTaskTime() {
      console.log('延长任务时间被调用');
      // 在Vue应用中，我们会通过electronAPI或window.opener与主Vue应用通信
      if (window.electronAPI) {
        window.electronAPI.extendTaskTime(5); // 延长5分钟
        window.electronAPI.closeNotification();
      } else if (window.opener && window.opener.__VUE_APP__) {
        // 与主Vue应用通信
        window.opener.__VUE_APP__.extendTaskTime(5);
        // window.close();
      } else if (window.opener && typeof window.opener.extendTaskTime === 'function') {
        // 兼容旧的调用方式
        window.opener.extendTaskTime(5);
        window.close();
      } else {
        window.close();
      }
    },
    
    // 关闭窗口方法
    closeWindow() {
      console.log('关闭窗口被调用');
      if (window.electronAPI) {
        window.electronAPI.closeNotification();
      } else {
        window.close();
      }
    }
  }
}
</script>

<style scoped>
.notification-container {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #4caf50;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  user-select: none;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  /* 确保窗口不会出现滚动条 */
  overflow-x: hidden;
  overflow-y: hidden;
  position: fixed;
  top: 0;
  left: 0;
}
.container {
  padding: 20px 20px 60px 20px;
  width: 100%;
  max-width: 300px;
  background-color: inherit;
  box-shadow: none;
  color: white;
}
.icon {
  font-size: 64px;
  margin-bottom: 16px;
}
h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}
p {
  margin: 0 0 20px 0;
  font-size: 16px;
  opacity: 0.9;
}
.button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 2px solid white;
  color: white;
  padding: 10px 20px;
  font-size: 16px;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;
}
.button:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}
.button:active {
  transform: scale(0.98);
}
.button-group {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate {
  animation: fadeIn 0.5s ease-out;
}
</style>