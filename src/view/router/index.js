import { createRouter, createWebHistory } from 'vue-router'
import Graph from '../views/Graph/Graph.vue'

export const views = [
  {
    id: 'Graph',
    component: Graph
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: views.map(v => ({ path: `/${v.id}`, component: v.component })),
})

export default router
