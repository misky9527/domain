<template>
  <div>
    <el-card>
      <div slot="header" style="display: flex; justify-content: space-between; align-items: center">
        <span>
          <el-button text @click="goBack" style="margin-right: 10px">&larr; 返回</el-button>
          公司用户管理 — {{ company?.name || '加载中...' }}
        </span>
        <el-button type="primary" size="small" @click="showCreateUserDialog = true">新建用户</el-button>
      </div>

      <el-table :data="users" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'company_admin' ? 'warning' : 'info'" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限" min-width="250">
          <template #default="{ row }">
            <span v-if="row.role !== 'user'" style="color: #999">全部权限</span>
            <el-tag v-else v-for="p in parsePerms(row.permissions)" :key="p" size="small" style="margin: 1px">
              {{ permLabel(p) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="{ row }">
            <el-button
              v-if="row.role === 'user'"
              size="small" type="primary" link
              @click="editPermissions(row)"
            >权限设置</el-button>
            <el-button
              v-if="canDeleteUser(row)"
              size="small" type="danger" link
              @click="confirmDeleteUser(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create user dialog -->
    <el-dialog v-model="showCreateUserDialog" title="新建用户" width="500px">
      <el-form :model="createUserForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="createUserForm.username" placeholder="输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="createUserForm.password" type="password" placeholder="输入密码" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="createUserForm.role">
            <el-radio value="user">普通用户</el-radio>
            <el-radio v-if="isSuperAdmin" value="company_admin">公司管理员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="createUserForm.role === 'user'" label="初始权限">
          <el-checkbox-group v-model="createUserForm.permissions">
            <el-checkbox v-for="p in allPermissions" :key="p.key" :label="p.key">{{ p.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateUserDialog = false">取消</el-button>
        <el-button type="primary" @click="createUser" :loading="saving">创建</el-button>
      </template>
    </el-dialog>

    <!-- Edit permissions dialog -->
    <el-dialog v-model="showPermDialog" title="权限设置" width="500px">
      <p style="margin: 0 0 15px; color: #666">用户：{{ permEditUser?.username }}</p>
      <el-checkbox-group v-model="permEditUserPerms">
        <el-checkbox v-for="p in allPermissions" :key="p.key" :label="p.key">{{ p.label }}</el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="showPermDialog = false">取消</el-button>
        <el-button type="primary" @click="savePermissions" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const companyId = Number(route.params.id)

const loading = ref(false)
const saving = ref(false)
const company = ref<any>(null)
const users = ref<any[]>([])

const showCreateUserDialog = ref(false)
const createUserForm = ref({ username: '', password: '', role: 'user', permissions: [] as string[] })

const showPermDialog = ref(false)
const permEditUser = ref<any>(null)
const permEditUserPerms = ref<string[]>([])

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const isSuperAdmin = computed(() => user.value.role === 'super_admin')

const allPermissions = [
  { key: 'domain:view', label: '查看域名' },
  { key: 'domain:add', label: '添加域名' },
  { key: 'domain:edit', label: '编辑域名' },
  { key: 'domain:delete', label: '删除域名' },
  { key: 'domain:refresh-dns', label: '刷新 DNS' },
  { key: 'domain:refresh-ssl', label: '刷新 SSL' },
  { key: 'user:view', label: '查看用户' },
  { key: 'setting:telegram', label: 'TG 通知配置' },
]

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const res = await api.get(`/companies/${companyId}/users`)
    company.value = res.data.company
    users.value = res.data.users
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function createUser() {
  if (!createUserForm.value.username || !createUserForm.value.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  saving.value = true
  try {
    await api.post(`/companies/${companyId}/users`, {
      username: createUserForm.value.username,
      password: createUserForm.value.password,
      role: createUserForm.value.role,
      permissions: createUserForm.value.role === 'user' ? createUserForm.value.permissions : [],
    })
    ElMessage.success('创建成功')
    showCreateUserDialog.value = false
    createUserForm.value = { username: '', password: '', role: 'user', permissions: [] }
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '创建失败')
  } finally {
    saving.value = false
  }
}

function editPermissions(row: any) {
  permEditUser.value = row
  permEditUserPerms.value = parsePerms(row.permissions)
  showPermDialog.value = true
}

async function savePermissions() {
  saving.value = true
  try {
    await api.put(`/companies/users/${permEditUser.value.id}/permissions`, {
      permissions: permEditUserPerms.value,
    })
    ElMessage.success('权限更新成功')
    showPermDialog.value = false
    loadUsers()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '更新失败')
  } finally {
    saving.value = false
  }
}

function canDeleteUser(row: any) {
  if (isSuperAdmin.value) return true
  // company_admin can only delete regular users
  return row.role === 'user' && row.id !== user.value.id
}

async function confirmDeleteUser(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」？`, '确认', { type: 'warning' })
    await api.delete(`/companies/users/${row.id}`)
    ElMessage.success('删除成功')
    loadUsers()
  } catch {}
}

function goBack() {
  router.push('/companies')
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    'super_admin': '超级管理员',
    'company_admin': '公司管理员',
    'user': '普通用户',
  }
  return labels[role] || role
}

function permLabel(perm: string) {
  const p = allPermissions.find(p => p.key === perm)
  return p ? p.label : perm
}

function parsePerms(perms: string | null | string[]): string[] {
  if (!perms) return []
  if (Array.isArray(perms)) return perms
  try {
    return JSON.parse(perms)
  } catch {
    return []
  }
}
</script>
