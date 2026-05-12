import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Dashboard from '../views/Dashboard.vue'
import DomainDetail from '../views/DomainDetail.vue'
import AddDomain from '../views/AddDomain.vue'
import BatchAdd from '../views/BatchAdd.vue'
import Groups from '../views/Groups.vue'
import Settings from '../views/Settings.vue'
import Companies from '../views/Companies.vue'
import CompanyDetail from '../views/CompanyDetail.vue'
import Approvals from '../views/Approvals.vue'

const routes = [
  { path: '/login', component: Login, name: 'Login' },
  { path: '/register', component: Register, name: 'Register' },
  { path: '/', component: Dashboard, name: 'Dashboard', meta: { requiresAuth: true } },
  { path: '/domains/:id', component: DomainDetail, name: 'DomainDetail', meta: { requiresAuth: true } },
  { path: '/domains/add', component: AddDomain, name: 'AddDomain', meta: { requiresAuth: true } },
  { path: '/domains/batch', component: BatchAdd, name: 'BatchAdd', meta: { requiresAuth: true } },
  { path: '/groups', component: Groups, name: 'Groups', meta: { requiresAuth: true } },
  { path: '/settings', component: Settings, name: 'Settings', meta: { requiresAuth: true } },
  { path: '/companies', component: Companies, name: 'Companies', meta: { requiresAuth: true } },
  { path: '/companies/:id', component: CompanyDetail, name: 'CompanyDetail', meta: { requiresAuth: true } },
  { path: '/approvals', component: Approvals, name: 'Approvals', meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
