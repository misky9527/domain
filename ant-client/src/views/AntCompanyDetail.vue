<template>
  <div>
    <a-card>
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>
            <a-button type="link" @click="goBack" style="margin-right: 8px; padding: 0">
              <ArrowLeftOutlined />
            </a-button>
            公司用户管理 — {{ company?.name || '加载中...' }}
          </span>
          <a-button type="primary" size="small" @click="showCreateUserDialog = true">
            <template #icon><UserAddOutlined /></template>
            新建用户
          </a-button>
        </div>
      </template>

      <a-table
        :data-source="users"
        :columns="columns"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'super_admin' ? 'red' : (record.role === 'company_admin' ? 'orange' : 'blue')">
              {{ roleLabel(record.role) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'permissions'">
            <span v-if="record.role !== 'user' && record.role !== 'super_admin'" style="color: #999">全部权限</span>
            <a-tag v-else v-for="p in parsePerms(record.permissions)" :key="p" color="blue" style="margin: 1px">
              {{ permLabel(p) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="editUser(record)">编辑</a-button>
            <a-button
              v-if="record.role === 'user'"
              type="link"
              size="small"
              @click="editPermissions(record)"
            >权限设置</a-button>
            <a-button
              v-if="canDeleteUser(record)"
              type="link"
              danger
              size="small"
              @click="confirmDeleteUser(record)"
            >删除</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- Create user modal -->
    <a-modal
      v-model:open="showCreateUserDialog"
      title="新建用户"
      @ok="createUser"
      :confirm-loading="saving"
      ok-text="创建"
      :width="520"
    >
      <a-form :model="createUserForm" layout="vertical">
        <a-form-item label="用户名">
          <a-input v-model:value="createUserForm.username" placeholder="输入用户名" />
        </a-form-item>
        <a-form-item label="密码">
          <a-input-password v-model:value="createUserForm.password" placeholder="输入密码" />
        </a-form-item>
        <a-form-item label="角色">
          <a-radio-group v-model:value="createUserForm.role">
            <a-radio value="user">普通用户</a-radio>
            <a-radio v-if="isSuperAdmin" value="company_admin">公司管理员</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="createUserForm.role === 'user'" label="初始权限">
          <a-checkbox-group v-model:value="createUserForm.permissions">
            <a-checkbox v-for="p in allPermissions" :key="p.key" :value="p.key">{{ p.label }}</a-checkbox>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Edit permissions modal -->
    <a-modal
      v-model:open="showPermDialog"
      title="权限设置"
      @ok="savePermissions"
      :confirm-loading="saving"
      ok-text="保存"
      :width="520"
    >
      <p style="margin: 0 0 15px; color: #666">用户：{{ permEditUser?.username }}</p>
      <a-checkbox-group v-model:value="permEditUserPerms">
        <a-checkbox v-for="p in allPermissions" :key="p.key" :value="p.key">{{ p.label }}</a-checkbox>
      </a-checkbox-group>
    </a-modal>

    <!-- Edit user modal -->
    <a-modal
      v-model:open="showEditUserDialog"
      title="编辑用户"
      @ok="saveEditUser"
      :confirm-loading="saving"
      ok-text="保存"
      :width="520"
    >
      <a-form :model="editUserForm" layout="vertical">
        <a-form-item label="用户名">
          <a-input v-model:value="editUserForm.username" />
        </a-form-item>
        <a-form-item label="新密码（留空不修改）">
          <a-input-password v-model:value="editUserForm.password" placeholder="留空则不修改密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

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

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username', minWidth: 150 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120 },
  { title: '权限', dataIndex: 'permissions', key: 'permissions', minWidth: 250 },
  { title: '操作', key: 'action', width: 250 },
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
    message.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function createUser() {
  if (!createUserForm.value.username || !createUserForm.value.password) {
    message.warning('请填写用户名和密码')
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
    message.success('创建成功')
    showCreateUserDialog.value = false
    createUserForm.value = { username: '', password: '', role: 'user', permissions: [] }
    loadUsers()
  } catch (err: any) {
    message.error(err.response?.data?.error || '创建失败')
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
    message.success('权限更新成功')
    showPermDialog.value = false
    loadUsers()
  } catch (err: any) {
    message.error(err.response?.data?.error || '更新失败')
  } finally {
    saving.value = false
  }
}

function canDeleteUser(row: any) {
  if (isSuperAdmin.value) return true
  return row.role === 'user' && row.id !== user.value.id
}

// Edit user
const showEditUserDialog = ref(false)
const editUserForm = ref({ id: 0, username: "", password: "" })

function editUser(row: any) {
  editUserForm.value = { id: row.id, username: row.username, password: "" }
  showEditUserDialog.value = true
}

async function saveEditUser() {
  if (!editUserForm.value.username) {
    message.warning("用户名不能为空")
    return
  }
  saving.value = true
  try {
    await api.put("/companies/users/" + editUserForm.value.id, {
      username: editUserForm.value.username,
      password: editUserForm.value.password || undefined,
    })
    message.success("更新成功")
    showEditUserDialog.value = false
    loadUsers()
  } catch (err: any) {
    message.error(err.response?.data?.error || "更新失败")
  } finally {
    saving.value = false
  }
}

async function confirmDeleteUser(row: any) {
  Modal.confirm({
    title: "确认删除",
    content: "确定删除用户「" + row.username + "」？",
    okText: "删除",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      await api.delete("/companies/users/" + row.id)
      message.success("删除成功")
      loadUsers()
    },
  })
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
