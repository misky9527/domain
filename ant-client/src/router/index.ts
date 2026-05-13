import { createRouter, createWebHashHistory } from 'vue-router'
import AntLayout from '../views/AntLayout.vue'
import AntLogin from '../views/AntLogin.vue'
import AntRegister from '../views/AntRegister.vue'
import AntDashboard from '../views/AntDashboard.vue'
import AntDomainDetail from '../views/AntDomainDetail.vue'
import AntAddDomain from '../views/AntAddDomain.vue'
import AntBatchAdd from '../views/AntBatchAdd.vue'
import AntGroups from '../views/AntGroups.vue'
import AntSettings from '../views/AntSettings.vue'
import AntCompanies from '../views/AntCompanies.vue'
import AntCompanyDetail from '../views/AntCompanyDetail.vue'

import AntApprovals from '../views/AntApprovals.vue'
import AntDnsProviders from '../views/AntDnsProviders.vue'
import AntOrphans from '../views/AntOrphans.vue'
import AntOperationLogs from '../views/AntOperationLogs.vue'

const routes = [
  { path: '/login', component: AntLogin, name: 'Login' },
  { path: '/register', component: AntRegister, name: 'Register' },
  {
    path: '/',
    component: AntLayout,
    children: [
      { path: '', component: AntDashboard, name: 'Dashboard', meta: { requiresAuth: true } },
      { path: 'domains/:id', component: AntDomainDetail, name: 'DomainDetail', meta: { requiresAuth: true } },
      { path: 'domains/add', component: AntAddDomain, name: 'AddDomain', meta: { requiresAuth: true } },
      { path: 'domains/batch', component: AntBatchAdd, name: 'BatchAdd', meta: { requiresAuth: true } },
      { path: 'groups', component: AntGroups, name: 'Groups', meta: { requiresAuth: true } },
      { path: 'settings', component: AntSettings, name: 'Settings', meta: { requiresAuth: true } },
      { path: 'companies', component: AntCompanies, name: 'Companies', meta: { requiresAuth: true } },
      { path: 'companies/:id', component: AntCompanyDetail, name: 'CompanyDetail', meta: { requiresAuth: true } },
      { path: 'approvals', component: AntApprovals, name: 'Approvals', meta: { requiresAuth: true } },
      { path: 'dns-providers', component: AntDnsProviders, name: 'DnsProviders', meta: { requiresAuth: true } },
      { path: 'settings/orphans', component: AntOrphans, name: 'Orphans', meta: { requiresAuth: true } },
      { path: 'settings/logs', component: AntOperationLogs, name: 'OperationLogs', meta: { requiresAuth: true } },
    ],
  },
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
