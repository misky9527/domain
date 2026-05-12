<template>
  <el-container v-if="showLayout" style="height: 100vh">
    <el-aside width="220px" style="background: #304156; height: 100vh; overflow-y: auto">
      <div class="sidebar-logo">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-right:8px; vertical-align: middle">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        DomainManage
      </div>
      <el-menu
        :default-active="currentRoute"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        style="border-right: none"
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>总览</span>
        </el-menu-item>
        <el-menu-item index="/groups">
          <el-icon><FolderOpened /></el-icon>
          <span>分组管理</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
        <el-menu-item v-if="isAdmin" index="/companies">
          <el-icon><OfficeBuilding /></el-icon>
          <span>公司管理</span>
        </el-menu-item>
        <el-menu-item v-if="isSuperAdmin" index="/approvals">
          <el-icon><Check /></el-icon>
          <span>注册审核</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #fff; border-bottom: 1px solid #e6e6e6; display: flex; align-items: center; justify-content: flex-end; padding: 0 20px; height: 60px">
        <el-dropdown @command="handleCommand">
          <span style="cursor: pointer; color: #333">
            <el-icon size="18"><User /></el-icon> {{ user?.username || '用户' }}
            <el-tag v-if="isAdmin" size="small" type="warning" style="margin-left: 5px">管理</el-tag>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main style="background: #f0f2f5; padding: 20px">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
  <router-view v-else />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DataAnalysis,
  FolderOpened,
  Setting,
  User,
  OfficeBuilding,
  Check,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))

const showLayout = computed(() => {
  return !['Login', 'Register'].includes(route.name as string)
})

const currentRoute = computed(() => route.path)

const isAdmin = computed(() => {
  return ['super_admin', 'company_admin'].includes(user.value.role)
})

const isSuperAdmin = computed(() => {
  return user.value.role === 'super_admin'
})

function handleCommand(command: string) {
  if (command === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }
}
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.el-menu-item.is-active {
  background-color: rgba(64, 158, 255, 0.2) !important;
}
.sidebar-logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
</style>
