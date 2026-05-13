<template>
  <div>
    <a-card>
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>公司管理</span>
          <a-button v-if="isSuperAdmin" type="primary" size="small" @click="showCreateDialog = true">
            <template #icon><PlusOutlined /></template>
            创建公司
          </a-button>
        </div>
      </template>

      <a-table
        :data-source="companies"
        :columns="columns"
        :loading="loading"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created_at'">
            {{ formatDate(record.created_at) }}
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="viewCompany(record)">用户管理</a-button>
            <a-button v-if="isSuperAdmin" type="link" size="small" @click="editCompany(record)">编辑</a-button>
            <a-button v-if="isSuperAdmin" type="link" danger size="small" @click="confirmDelete(record)">删除</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:open="showCreateDialog" title="创建公司" @ok="createCompany" :confirm-loading="saving" ok-text="创建">
      <a-form :model="companyForm" layout="vertical">
        <a-form-item label="公司名称"><a-input v-model:value="companyForm.name" placeholder="输入公司名称" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="showEditDialog" title="编辑公司" @ok="updateCompany" :confirm-loading="saving" ok-text="保存">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="公司名称"><a-input v-model:value="editForm.name" placeholder="输入公司名称" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { PlusOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const companies = ref([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const companyForm = ref({ name: '' })
const editForm = ref({ id: 0, name: '' })

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const isSuperAdmin = computed(() => user.value.role === 'super_admin')

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '公司名称', dataIndex: 'name', key: 'name', minWidth: 200 },
  { title: '域名数', dataIndex: 'domain_count', key: 'domain_count', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 300 },
]

onMounted(() => loadCompanies())

async function loadCompanies() {
  loading.value = true
  try {
    const res = await api.get('/companies')
    companies.value = res.data.companies
  } catch (err: any) { message.error(err.response?.data?.error || '加载失败') }
  finally { loading.value = false }
}

async function createCompany() {
  if (!companyForm.value.name) { message.warning('公司名称不能为空'); return }
  saving.value = true
  try {
    await api.post('/companies', { name: companyForm.value.name })
    message.success('创建成功')
    showCreateDialog.value = false
    companyForm.value.name = ''
    loadCompanies()
  } catch (err: any) { message.error(err.response?.data?.error || '创建失败') }
  finally { saving.value = false }
}

function editCompany(row: any) {
  editForm.value = { id: row.id, name: row.name }
  showEditDialog.value = true
}

async function updateCompany() {
  if (!editForm.value.name) { message.warning('公司名称不能为空'); return }
  saving.value = true
  try {
    await api.put(`/companies/${editForm.value.id}`, { name: editForm.value.name })
    message.success('更新成功')
    showEditDialog.value = false
    loadCompanies()
  } catch (err: any) { message.error(err.response?.data?.error || '更新失败') }
  finally { saving.value = false }
}

async function confirmDelete(row: any) {
  Modal.confirm({
    title: "确认删除",
    content: "确定删除公司「" + row.name + "」？此操作不可撤销。",
    okText: "删除",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      try {
        await api.delete("/companies/" + row.id)
        message.success("删除成功")
        loadCompanies()
      } catch (err: any) {
        message.error(err.response?.data?.error || '删除失败')
      }
    },
  })
}

function viewCompany(row: any) { router.push(`/companies/${row.id}`) }
function formatDate(date: string) { return date ? (date.split('T')[0] || date.substring(0, 10)) : '-' }
</script>
