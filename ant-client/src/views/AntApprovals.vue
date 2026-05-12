<template>
  <div>
    <h2 style="margin-bottom:20px">注册审核</h2>

    <a-card>
      <a-table
        :data-source="pending"
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
            <a-button type="primary" size="small" @click="approve(record)" style="margin-right:8px">通过</a-button>
            <a-button danger size="small" @click="reject(record)">拒绝</a-button>
          </template>
        </template>
      </a-table>

      <div v-if="pending.length === 0 && !loading" style="text-align:center;padding:40px 0;color:#999">
        暂无待审核的注册申请
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const loading = ref(false)
const pending = ref<any[]>([])

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
  { title: '公司', dataIndex: 'company_name', key: 'company_name', width: 200 },
  { title: '角色', dataIndex: 'role', key: 'role', width: 120 },
  { title: '注册时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 160 },
]

onMounted(() => loadPending())

async function loadPending() {
  loading.value = true
  try {
    const res = await api.get('/auth/pending-registrations')
    pending.value = res.data.pending
  } catch (err: any) {
    message.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

function formatDate(date: string) {
  return date?.replace('T', ' ').substring(0, 19) || ''
}

async function approve(record: any) {
  try {
    await api.post(`/auth/approve/${record.id}`)
    message.success(`已通过 ${record.username}`)
    loadPending()
  } catch (err: any) {
    message.error(err.response?.data?.error || '操作失败')
  }
}

async function reject(record: any) {
  try {
    await api.post(`/auth/reject/${record.id}`)
    message.success(`已拒绝 ${record.username}`)
    loadPending()
  } catch (err: any) {
    message.error(err.response?.data?.error || '操作失败')
  }
}
</script>
