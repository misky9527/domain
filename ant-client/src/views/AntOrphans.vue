<template>
  <div>
    <a-card>
      <template #title>
        <span>孤悬用户管理</span>
      </template>

      <a-table
        :data-source="orphans"
        :columns="columns"
        :loading="loading"
        :pagination="{ pageSize: 20, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` }"
        row-key="id"
        :expandable="{ expandedRowRender, rowExpandable: (r: any) => r.domains && r.domains.length > 0 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created_at'">
            {{ formatDate(record.created_at) }}
          </template>
          <template v-if="column.key === 'domain_count'">
            <a-tag :color="record.domain_count > 0 ? 'blue' : 'default'">{{ record.domain_count }}</a-tag>
          </template>
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'company_admin' ? 'orange' : 'blue'">
              {{ record.role === 'company_admin' ? '公司管理员' : '普通用户' }}
            </a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="showAssignDialog(record)">分配公司</a-button>
            <a-button type="link" danger size="small" @click="confirmDelete(record)">删除</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="showAssign" title="分配公司" @ok="assignCompany" :confirm-loading="assigning" ok-text="分配">
      <a-form layout="vertical">
        <a-form-item label="目标用户">
          <a-input :value="selectedUser?.username" disabled />
        </a-form-item>
        <a-form-item label="选择公司">
          <a-select
            v-model:value="assignForm.company_id"
            placeholder="请选择目标公司"
            style="width: 100%"
            :loading="loadingCompanies"
          >
            <a-select-option v-for="c in companies" :key="c.id" :value="c.id">
              {{ c.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import api from '../utils/axios'
import { message, Modal, Table, Tag } from 'ant-design-vue'

const loading = ref(false)
const orphans = ref([])
const selectedUser = ref<any>(null)
const showAssign = ref(false)
const assignForm = ref({ company_id: undefined })
const assigning = ref(false)
const companies = ref<any[]>([])
const loadingCompanies = ref(false)

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username', key: 'username', minWidth: 150 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120 },
  { title: '域名数', dataIndex: 'domain_count', key: 'domain_count', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 200 },
]

onMounted(() => loadOrphans())

async function loadOrphans() {
  loading.value = true
  try {
    const res = await api.get('/admin/orphans')
    orphans.value = res.data.orphans
  } catch (err: any) {
    message.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadCompanies() {
  loadingCompanies.value = true
  try {
    const res = await api.get('/companies')
    companies.value = res.data.companies
  } catch {
    // ignore
  } finally {
    loadingCompanies.value = false
  }
}

function expandedRowRender(record: any) {
  if (!record.domains || record.domains.length === 0) return null
  const domainColumns = [
    { title: '域名', dataIndex: 'name', key: 'name' },
    { title: '注册商', dataIndex: 'registrar', key: 'registrar' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at' },
  ]
  return h('div', [
    h('h4', { style: { marginBottom: '8px' } }, '域名列表：'),
    h(Table, {
      'data-source': record.domains,
      columns: domainColumns,
      pagination: false,
      'row-key': 'id',
      size: 'small',
    }),
  ])
}

function showAssignDialog(user: any) {
  selectedUser.value = user
  assignForm.value = { company_id: undefined }
  loadCompanies()
  showAssign.value = true
}

async function assignCompany() {
  if (!assignForm.value.company_id) {
    message.warning('请选择目标公司')
    return
  }
  assigning.value = true
  try {
    await api.post(`/admin/orphans/${selectedUser.value.id}/assign`, { company_id: assignForm.value.company_id })
    message.success('分配成功')
    showAssign.value = false
    loadOrphans()
  } catch (err: any) {
    message.error(err.response?.data?.error || '分配失败')
  } finally {
    assigning.value = false
  }
}

function confirmDelete(user: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除用户「${user.username}」及其关联的 ${user.domain_count} 个域名？此操作不可撤销。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await api.delete(`/admin/orphans/${user.id}`)
        message.success('删除成功')
        loadOrphans()
      } catch (err: any) {
        message.error(err.response?.data?.error || '删除失败')
      }
    },
  })
}

function formatDate(date: string) {
  return date ? (date.split('T')[0] || date.substring(0, 10)) : '-'
}
</script>
