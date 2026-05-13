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
        :data-source="dnsRecords"
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
const dnsRecords = ref([])
const dnsLoading = ref(false)
const dnsNsServer = ref('')
const dnsNsProvider = ref('')
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

const dnsColumns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80 },
  { title: 'TTL', dataIndex: 'TTL', key: 'TTL', width: 80 },
  { title: '数据', dataIndex: 'data', key: 'data' },
]

onMounted(async () => {
  try {
    const res = await api.get(`/domains/${route.params.id}`)
    domain.value = res.data.domain
    dnsNsServer.value = res.data.domain.dns_ns_server || ''
    dnsNsProvider.value = res.data.domain.dns_ns_provider || ''
    Object.assign(editForm, res.data.domain)
  } catch {
    message.error('加载域名信息失败')
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
    const res = await api.get(`/domains/${route.params.id}/dns`)
    dnsRecords.value = res.data.records
    // Reload domain to get updated NS info
    const domainRes = await api.get(`/domains/${route.params.id}`)
    dnsNsServer.value = domainRes.data.domain.dns_ns_server || ''
    dnsNsProvider.value = domainRes.data.domain.dns_ns_provider || ''
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
