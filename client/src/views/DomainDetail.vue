<template>
  <div>
    <el-button style="margin-bottom: 15px" @click="$router.push('/')">← 返回</el-button>
    <el-card v-if="domain" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 18px; font-weight: bold">{{ domain.name }}</span>
          <div>
            <el-button size="small" @click="editMode = !editMode">{{ editMode ? '取消编辑' : '编辑' }}</el-button>
            <el-button size="small" type="danger" @click="deleteDomain">删除</el-button>
          </div>
        </div>
      </template>

      <!-- Edit form -->
      <el-form v-if="editMode" :model="editForm" label-width="120px">
        <el-form-item label="注册商">
          <el-input v-model="editForm.registrar" />
        </el-form-item>
        <el-form-item label="注册时间">
          <el-input v-model="editForm.registration_date" />
        </el-form-item>
        <el-form-item label="到期时间">
          <el-input v-model="editForm.expiration_date" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="editForm.purpose" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="editForm.tags" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="editForm.group_id" clearable style="width: 100%">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveEdit">保存</el-button>
        </el-form-item>
      </el-form>

      <!-- Info display -->
      <el-descriptions v-else :column="2" border>
        <el-descriptions-item label="注册商">{{ domain.registrar || '-' }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ domain.registration_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="到期时间">{{ domain.expiration_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用途">{{ domain.purpose || '-' }}</el-descriptions-item>
        <el-descriptions-item label="标签">{{ domain.tags || '-' }}</el-descriptions-item>
        <el-descriptions-item label="分组">{{ domain.group_name || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- DNS Records -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>DNS 记录</span>
          <el-button size="small" @click="refreshDns" :loading="dnsLoading">刷新</el-button>
        </div>
      </template>
      <el-table v-if="dnsRecords.length > 0" :data="dnsRecords" size="small">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="type" label="类型" width="80" />
        <el-table-column prop="TTL" label="TTL" width="80" />
        <el-table-column prop="data" label="数据" />
      </el-table>
      <el-empty v-else description="暂无 DNS 记录" />
    </el-card>

    <!-- SSL Info -->
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>SSL 信息</span>
          <el-button size="small" @click="refreshSsl" :loading="sslLoading">刷新</el-button>
        </div>
      </template>
      <el-descriptions v-if="sslInfo" :column="2" border>
        <el-descriptions-item label="颁发者">{{ sslInfo.issuer || '-' }}</el-descriptions-item>
        <el-descriptions-item label="到期时间">{{ sslInfo.expiry || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="sslInfo.valid ? 'success' : 'danger'">{{ sslInfo.valid ? '有效' : '无效/已过期' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="剩余天数">{{ sslInfo.days_remaining }} 天</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无 SSL 信息" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const domain = ref<any>(null)
const groups = ref([])
const editMode = ref(false)
const dnsRecords = ref([])
const dnsLoading = ref(false)
const sslInfo = ref<any>(null)
const sslLoading = ref(false)

const editForm = reactive({
  registrar: '',
  registration_date: '',
  expiration_date: '',
  purpose: '',
  tags: '',
  group_id: null,
})

onMounted(async () => {
  try {
    const res = await api.get(`/domains/${route.params.id}`)
    domain.value = res.data.domain
    Object.assign(editForm, res.data.domain)
  } catch {
    ElMessage.error('加载域名信息失败')
    router.push('/')
  }

  try {
    const res = await api.get('/groups')
    groups.value = res.data.groups
  } catch {}

  refreshDns()
  refreshSsl()
})

async function saveEdit() {
  try {
    await api.put(`/domains/${route.params.id}`, editForm)
    ElMessage.success('保存成功')
    const res = await api.get(`/domains/${route.params.id}`)
    domain.value = res.data.domain
    editMode.value = false
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  }
}

async function refreshDns() {
  dnsLoading.value = true
  try {
    const res = await api.get(`/domains/${route.params.id}/dns`)
    dnsRecords.value = res.data.records
  } catch {} finally {
    dnsLoading.value = false
  }
}

async function refreshSsl() {
  sslLoading.value = true
  try {
    const res = await api.get(`/domains/${route.params.id}/ssl`)
    sslInfo.value = res.data.ssl
  } catch {} finally {
    sslLoading.value = false
  }
}

async function deleteDomain() {
  try {
    await ElMessageBox.confirm(`确定删除 ${domain.value.name}？`, '确认删除')
    await api.delete(`/domains/${route.params.id}`)
    ElMessage.success('删除成功')
    router.push('/')
  } catch {}
}
</script>
