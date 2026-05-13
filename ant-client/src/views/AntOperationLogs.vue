<template>
  <div>
    <a-card>
      <template #title>
        <span>操作日志</span>
      </template>

      <template #extra>
        <div style="display: flex; gap: 8px">
          <a-select v-model:value="filterAction" placeholder="操作类型" style="width: 120px" allowClear @change="loadLogs">
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="create">创建</a-select-option>
            <a-select-option value="update">修改</a-select-option>
            <a-select-option value="delete">删除</a-select-option>
          </a-select>
          <a-select v-model:value="filterTargetType" placeholder="目标类型" style="width: 120px" allowClear @change="loadLogs">
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="company">公司</a-select-option>
            <a-select-option value="user">用户</a-select-option>
            <a-select-option value="domain">域名</a-select-option>
            <a-select-option value="group">分组</a-select-option>
            <a-select-option value="dns_provider">DNS 服务商</a-select-option>
          </a-select>
        </div>
      </template>

      <a-table
        :data-source="logs"
        :columns="columns"
        :loading="loading"
        :pagination="{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
          onChange: (p: number, ps: number) => { page = p; pageSize = ps; loadLogs(); },
        }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created_at'">
            {{ formatDateTime(record.created_at) }}
          </template>
          <template v-if="column.key === 'action'">
            <a-tag :color="record.action === 'create' ? 'green' : (record.action === 'update' ? 'blue' : 'red')">
              {{ record.action === 'create' ? '创建' : (record.action === 'update' ? '修改' : '删除') }}
            </a-tag>
          </template>
          <template v-if="column.key === 'target_type'">
            <a-tag>{{ targetTypeLabel(record.target_type) }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const loading = ref(false)
const logs = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const filterAction = ref(undefined)
const filterTargetType = ref(undefined)

const columns = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作用户', dataIndex: 'username', key: 'username', width: 120 },
  { title: '操作类型', dataIndex: 'action', key: 'action', width: 100 },
  { title: '目标类型', dataIndex: 'target_type', key: 'target_type', width: 100 },
  { title: '目标名称', dataIndex: 'target_name', key: 'target_name', minWidth: 150 },
  { title: '详情', dataIndex: 'details', key: 'details', minWidth: 200 },
]

function targetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    company: '公司',
    user: '用户',
    domain: '域名',
    group: '分组',
    dns_provider: 'DNS 服务商',
  }
  return labels[type] || type
}

onMounted(() => loadLogs())

async function loadLogs() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: pageSize.value }
    if (filterAction.value) params.action = filterAction.value
    if (filterTargetType.value) params.target_type = filterTargetType.value
    const res = await api.get('/admin/logs', { params })
    logs.value = res.data.logs
    total.value = res.data.total
  } catch (err: any) {
    message.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

function formatDateTime(date: string) {
  if (!date) return '-'
  return date.replace('T', ' ').substring(0, 19)
}
</script>
