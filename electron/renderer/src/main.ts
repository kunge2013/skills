// [AGC:FILE] tool=Cc author=fangkun date=2026-06-26
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus)
app.mount('#app')
