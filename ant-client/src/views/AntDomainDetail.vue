<template>
  <div>
    <a-button style="margin-bottom: 16px" @click="$router.push('/')">
      <template #icon><ArrowLeftOutlined /></template>
      返回
    </a-button>

    <a-card v-if="domain" style="margin-bottom: 20px">
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 18px; font-weight: 600">{{ domain.name }}</span>
          <div>
            <a-button size="small" style="margin-right: 8px" @click="editMode = !editMode">
              {{ editMode ? '取消编辑' : '编辑' }}
            </a-button>
            <a-button size="small" danger @click="deleteDomain">删除</a-button>
          </div>
        </div>
      </template>

      <!-- Edit form -->
      <a-form v-if="editMode" :model="editForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="注册商">
              <a-input v-model:value="editForm.registrar" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="注册时间">
              <a-input v-model:value="editForm.registration_date" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="到期时间">
              <a-input v-model:value="editForm.expiration_date" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="用途">
              <a-input v-model:value="editForm.purpose" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="标签">
              <a-input v-model:value="editForm.tags" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="分组">
              <a-select v-model:value="editForm.group_id" allowClear style="width: 100%">
                <a-select-option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item>
          <a-button type="primary" @click="saveEdit" :loading="saving">保存</a-button>
        </a-form-item>
      </a-form>

      <!-- Info display -->
      <a-descriptions v-else :column="2" bordered size="small">
        <a-descriptions-item label="注册商">{{ domain.registrar || '-' }}</a-descriptions-item>
        <a-descriptions-item label="注册时间">{{ domain.registration_date || '-' }}</a-descriptions-item>
        <a-descriptions-item label="到期时间">{{ domain.expiration_date || '-' }}</a-descriptions-item>
        <a-descriptions-item label="用途">{{ domain.purpose || '-' }}</a-descriptions-item>
        <a-descriptions-item label="标签">{{ domain.tags || '-' }}</a-descriptions-item>
        <a-descriptions-item label="分组">{{ domain.group_name || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- DNS 指向 -->
    <a-card v-if="domain" style="margin-bottom: 20px">
      <template #title>
        <div style="display: flex; justify-content: space-between">
          <span>DNS 指向</span>
          <a-button size="small" @click="refreshDns" :loading="dnsLoading">刷新</a-button>
        </div>
      </template>
      <a-descriptions v-if="dnsNsServer" :column="2" bordered size="small">
        <a-descriptions-item label="NS 服务器">
          <span style="font-family:monospace">{{ dnsNsServer }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="服务商">
          <a-tag v-if="dnsNsProvider" color="blue">{{ dnsNsProvider }}</a-tag>
          <span v-else style="color:#8c8c8c">未知</span>
        </a-descriptions-item>
      </a-descriptions>
      <a-empty v-else description="暂未检测 DNS 指向，点击右上角刷新" />
    </a-card>

    <!-- DNS Records -->
    <a-card style="margin-bottom: 20px">
      <template #title>
        <div style="display: flex; justify-content: space-between">
          <span>DNS 记录</span>
          <a-button size="small" @click="refreshDns" :loading="dnsLoading">刷新</a-button>
        </div>
      </template>
      <a-table
        v-if="dnsRecords.length > 0"
        :data-source="formattedDnsRecords"
        :columns="dnsColumns"
        size="small"
        :pagination="false"
        row-key="name"
      />
      <a-empty v-else description="暂无 DNS 记录" />
    </a-card>

    <!-- SSL Info -->
    <a-card>
      <template #title>
        <div style="display: flex; justify-content: space-between">
          <span>SSL 信息</span>
          <a-button size="small" @click="refreshSsl" :loading="sslLoading">刷新</a-button>
        </div>
      </template>
      <a-descriptions v-if="sslInfo" :column="2" bordered size="small">
        <a-descriptions-item label="颁发者">{{ sslInfo.issuer || '-' }}</a-descriptions-item>
        <a-descriptions-item label="到期时间">{{ sslInfo.expiry || '-' }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="sslInfo.valid ? 'green' : 'red'">
            {{ sslInfo.valid ? '有效' : '无效/已过期' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="剩余天数">{{ sslInfo.days_remaining }} 天</a-descriptions-item>
      </a-descriptions>
      <a-empty v-else description="暂无 SSL 信息" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const domain = ref<any>(null)
const groups = ref([])
const editMode = ref(false)
const saving = ref(false)
const dnsRecords = ref<Array<{ name: string; type: string; TTL?: number; data: string }>>([])
const dnsLoading = ref(false)
const dnsNsServer = ref('')
const dnsNsProvider = ref('')
const sslInfo = ref<any>(null)
const sslLoading = ref(false)

// 格式化 DNS 记录：名称 → 记录(根域名显示@)、TTL 空值显示0
const formattedDnsRecords = computed(() => {
  const rootName = domain.value?.name?.toLowerCase() || ''
  return dnsRecords.value.map((r: any) => ({
    ...r,
    host: r.name
      ? (() => {
          const n = r.name.replace(/\.$/, '').toLowerCase()
          if (n === rootName) return '@'
          if (n.endsWith('.' + rootName)) return n.slice(0, -(rootName.length + 1))
          return n
        })()
      : '-',
    TTL: r.TTL ?? 0,
  }))
})

const editForm = reactive({
  registrar: '',
  registration_date: '',
  expiration_date: '',
  purpose: '',
  tags: '',
  group_id: null,
})

const dnsColumns = [
  { title: '记录', key: 'host', width: 120 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
  { title: 'TTL', dataIndex: 'TTL', key: 'TTL', width: 80 },
  { title: '记录值', dataIndex: 'data', key: 'data' },
]

onMounted(async () => {
  try {
    const res = await api.get(`/domains/${route.params.id}`)
    domain.value = res.data.domain
    dnsNsServer.value = res.data.domain.dns_ns_server || ''
    dnsNsProvider.value = res.data.domain.dns_ns_provider || ''
    Object.assign(editForm, res.data.domain)

    // Parse cached DNS records from domain data
    if (res.data.domain.dns_records) {
      try {
        dnsRecords.value = JSON.parse(res.data.domain.dns_records)
      } catch {
        dnsRecords.value = []
      }
    }

    // Parse cached SSL from domain data
    if (res.data.domain.ssl_expiry) {
      sslInfo.value = {
        expiry: res.data.domain.ssl_expiry,
        issuer: res.data.domain.ssl_issuer || '',
        valid: new Date(res.data.domain.ssl_expiry).getTime() > Date.now(),
        days_remaining: Math.ceil((new Date(res.data.domain.ssl_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }
    }
  } catch {
    message.error('加载域名信息失败')
    router.push('/')
  }

  try {
    const res = await api.get('/groups')
    groups.value = res.data.groups
  } catch {}
})

async function saveEdit() {
  saving.value = true
  try {
    await api.put(`/domains/${route.params.id}`, editForm)
    message.success('保存成功')
    const res = await api.get(`/domains/${route.params.id}`)
    domain.value = res.data.domain
    editMode.value = false
  } catch (err: any) {
    message.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function refreshDns() {
  dnsLoading.value = true
  try {
    // Call write refresh endpoint
    const res = await api.put(`/domains/${route.params.id}/refresh-dns`)
    dnsRecords.value = res.data.records || []
    // Also update dns_ns_server/provider from fresh response
    const domainRes = await api.get(`/domains/${route.params.id}`)
    domain.value = domainRes.data.domain
    dnsNsServer.value = domainRes.data.domain.dns_ns_server || ''
    dnsNsProvider.value = domainRes.data.domain.dns_ns_provider || ''
    message.success('DNS 刷新成功')
  } catch (err: any) {
    message.error(err.response?.data?.error || 'DNS 刷新失败')
  } finally {
    dnsLoading.value = false
  }
}

async function refreshSsl() {
  sslLoading.value = true
  try {
    const res = await api.put(`/domains/${route.params.id}/refresh-ssl`)
    sslInfo.value = res.data.ssl
    message.success('SSL 刷新成功')
  } catch (err: any) {
    message.error(err.response?.data?.error || 'SSL 刷新失败')
  } finally {
    sslLoading.value = false
  }
}

async function deleteDomain() {
  try {
    await Modal.confirm({
      title: '确认删除',
      content: `确定删除 ${domain.value?.name}？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
    })
    await api.delete(`/domains/${route.params.id}`)
    message.success('删除成功')
    router.push('/')
  } catch {}
}
</script>
