import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Timer',
    component: () => import('../views/TimerView.vue')
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryView.vue')
  },
  {
    path: '/week-stats',
    name: 'WeekStats',
    component: () => import('../views/WeekStatsView.vue')
  },
  {
    path: '/notification',
    name: 'Notification',
    component: () => import('../views/NotificationView.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router