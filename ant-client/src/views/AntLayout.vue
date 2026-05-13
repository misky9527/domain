<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        borderRadiusLG: 8,
      },
    }"
  >
    <a-layout style="height: 100vh">
      <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible width="220" theme="dark">
        <div class="ant-logo">
          <svg v-if="!collapsed" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right: 10px">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <span v-if="!collapsed" style="color:#fff;font-size:16px;font-weight:600">DomainManage</span>
        </div>

        <a-menu :selected-keys="[currentRoute]" mode="inline" theme="dark" @click="handleMenuClick">
          <a-menu-item key="/"><DashboardOutlined /><span>总览</span></a-menu-item>
          <a-menu-item key="/groups"><FolderOutlined /><span>分组管理</span></a-menu-item>
          <a-menu-item v-if="isAdmin" key="/companies"><BankOutlined /><span>公司管理</span></a-menu-item>
          <a-menu-item v-if="isSuperAdmin" key="/approvals"><CheckCircleOutlined /><span>注册审核</span></a-menu-item>
          <a-menu-item v-if="isSuperAdmin" key="/dns-providers"><GlobalOutlined /><span>DNS 服务商</span></a-menu-item>
          <a-menu-item key="/settings"><SettingOutlined /><span>设置维护</span></a-menu-item>
        </a-menu>
      </a-layout-sider>

      <a-layout style="overflow-y: auto">
        <a-layout-header style="height:48px;line-height:48px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;background:#fff">
          <div style="display:flex;align-items:center">
            <MenuUnfoldOutlined v-if="collapsed" class="trigger" @click="collapsed = !collapsed" />
            <MenuFoldOutlined v-else class="trigger" @click="collapsed = !collapsed" />
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <a-tag v-if="isAdmin" color="orange" style="margin:0">管理</a-tag>
            <a-dropdown>
              <a class="user-dropdown" @click.prevent>
                <UserOutlined style="font-size:14px" />
                {{ user?.username || '用户' }}
                <DownOutlined style="font-size:10px" />
              </a>
              <template #overlay>
                <a-menu @click="handleUserCommand">
                  <a-menu-item key="logout"><LogoutOutlined /> 退出登录</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </a-layout-header>

        <div :style="{ padding: '0 8px' }">
          <a-tabs
            v-model:activeKey="activeTabKey"
            type="editable-card"
            hideAdd
            size="small"
            @tabClick="onTabClick"
            @edit="onTabEdit"
          >
            <a-tab-pane
              v-for="tab in tabs"
              :key="tab.key"
              :tab="tab.title"
              :closable="tab.closable"
            />
          </a-tabs>
        </div>

        <a-layout-content :style="{ padding: '20px', minHeight: 'calc(100vh - 48px - 48px)' }">
          <router-view v-slot="{ Component }">
            <keep-alive :include="cachedComponents">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref, watch, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DashboardOutlined, FolderOutlined,
  SettingOutlined, BankOutlined, MenuUnfoldOutlined, MenuFoldOutlined,
  UserOutlined, DownOutlined, LogoutOutlined, CheckCircleOutlined, GlobalOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const activeTabKey = ref('/')
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))

const tabTitles: Record<string, string> = {
  '/': '总览',
  '/domains/add': '添加域名',
  '/domains/batch': '批量导入',
  '/groups': '分组管理',
  '/settings': '设置维护',
  '/companies': '公司管理',
  '/approvals': '注册审核',
  '/dns-providers': 'DNS 服务商',
  '/settings/orphans': '孤悬用户管理',
  '/settings/logs': '操作日志',
}

function getTabTitle(path: string): string {
  if (tabTitles[path]) return tabTitles[path]
  if (path.startsWith('/domains/') && path !== '/domains/add' && path !== '/domains/batch') {
    return path.replace('/domains/', '域名: ')
  }
  if (path.startsWith('/companies/') && path !== '/companies') {
    return '公司详情'
  }
  return path
}

const tabs = reactive<Array<{ key: string; title: string; closable: boolean }>>([
  { key: '/', title: '总览', closable: false },
])

const cachedComponents = computed(() => {
  return tabs.filter(t => t.closable).map(t => {
    const name = componentNames[t.key]
    return name || ''
  }).filter(Boolean)
})

const componentNames: Record<string, string> = {
  '/': 'AntDashboard',
  '/domains/add': 'AntAddDomain',
  '/domains/batch': 'AntBatchAdd',
  '/groups': 'AntGroups',
  '/settings': 'AntSettings',
  '/companies': 'AntCompanies',
  '/approvals': 'AntApprovals',
}

const currentRoute = computed(() => route.path)

const isAdmin = computed(() => ['super_admin', 'company_admin'].includes(user.value.role))
const isSuperAdmin = computed(() => user.value.role === 'super_admin')

watch(() => route.path, (newPath) => {
  if (newPath === '/login' || newPath === '/register') return
  const existing = tabs.find(t => t.key === newPath)
  if (!existing) {
    tabs.push({
      key: newPath,
      title: getTabTitle(newPath),
      closable: newPath !== '/',
    })
  }
  activeTabKey.value = newPath
}, { immediate: true })

function handleMenuClick(info: any) {
  router.push(info.key)
}

function onTabClick(key: string) {
  router.push(key)
}

function onTabEdit(key: string | number, action: 'add' | 'remove') {
  if (action === 'remove') {
    const idx = tabs.findIndex(t => t.key === key)
    if (idx === -1) return
    tabs.splice(idx, 1)
    if (activeTabKey.value === key) {
      const nextTab = tabs[Math.min(idx, tabs.length - 1)]
      router.push(nextTab ? nextTab.key : '/')
    }
  }
}

function handleUserCommand(info: any) {
  if (info.key === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }
}
</script>

<style scoped>
.ant-logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.trigger {
  font-size: 18px;
  cursor: pointer;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  cursor: pointer;
}

.user-dropdown:hover {
  color: #1677ff;
}
</style>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
