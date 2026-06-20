import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
alert('POS WEB')
app.use(createPinia())
app.use(router)

app.mount('#app')
