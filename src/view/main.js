import { createApp } from 'vue'
import App from './App.vue'
// import router from './router'
import 'virtual:uno.css'

const app = createApp(App)

// app.use(router)

app.mount('#app')

window.MQ = MathQuill.getInterface(2)
