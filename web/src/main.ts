import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import i18n, { elementPlusLocales } from './i18n'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus, { locale: elementPlusLocales[i18n.global.locale.value] })
app.use(i18n)
app.mount('#app')
