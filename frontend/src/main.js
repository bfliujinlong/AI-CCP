import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { initStorage } from './utils/db'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

// 初始化 IndexedDB 持久化存储（迁移 localStorage 旧数据）
initStorage().then(() => {
  app.mount('#app')
}).catch(() => {
  // 即使 IndexedDB 失败也正常挂载（降级到 localStorage）
  app.mount('#app')
})
