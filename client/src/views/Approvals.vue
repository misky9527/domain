<template>
  <div>
    <h2 style="margin-bottom:20px">注册审核</h2>

    <el-card>
      <el-table
        :data="pending"
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="company_name" label="公司" width="200" />
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="approve(row)" style="margin-right:8px">通过</el-button>
            <el-button type="danger" size="small" @click="reject(row)">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="pending.length === 0 && !loading" style="text-align:center;padding:40px 0;color:#999">
        暂无待审核的注册申请
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const pending = ref<any[]>([])

onMounted(() => loadPending())

async function loadPending() {
  loading.value = true
  try {
    const res = await api.get('/auth/pending-registrations')
    pending.value = res.data.pending
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败')
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
    ElMessage.success(`已通过 ${record.username}`)
    loadPending()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  }
}

async function reject(record: any) {
  try {
    await api.post(`/auth/reject/${record.id}`)
    ElMessage.success(`已拒绝 ${record.username}`)
    loadPending()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  }
}
</script>
