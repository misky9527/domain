<template>
  <div>
    <!-- Stats row -->
    <a-row :gutter="[20, 20]" style="margin-bottom: 20px">
      <a-col :span="4" v-for="card in statsCards" :key="card.label">
        <a-card :body-style="{ padding: '16px' }">
          <a-statistic
            :title="card.label"
            :value="card.value"
            :value-style="{ color: card.color, fontSize: '26px' }"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- Quick action pills -->
    <a-row :gutter="[20, 20]" style="margin-bottom: 16px">
      <a-col :span="24">
        <div class="quick-actions">
          <a-button v-if="canAddDomain" type="primary" ghost size="middle" @click="goAddDomain">
            <template #icon><PlusCircleOutlined /></template>
            添加域名
          </a-button>
          <a-button type="primary" ghost size="middle" @click="goBatchAdd">
            <template #icon><OrderedListOutlined /></template>
            批量导入
          </a-button>
        </div>
      </a-col>
    </a-row>

    <!-- Search & filter bar -->
    <a-card style="margin-bottom: 20px">
      <a-row :gutter="[12, 12]" align="middle">
        <a-col :span="6">
          <a-input v-model:value="search" placeholder="搜索域名..." allowClear @change="loadDomains" />
        </a-col>
        <a-col :span="5">
          <a-select v-model:value="groupFilter" placeholder="全部分组" allowClear style="width: 100%" @change="loadDomains">
            <a-select-option v-for="g in groups" :key="g.id" :value="g.id">
              {{ g.name }}
            </a-select-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model:value="sortBy" style="width: 100%" @change="loadDomains">
            <a-select-option value="created_at">添加时间</a-select-option>
            <a-select-option value="name">域名</a-select-option>
            <a-select-option value="expiration_date">到期时间</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="1">
          <a-button @click="toggleSort" size="small">
            {{ sortOrder === 'desc' ? '↓' : '↑' }}
          </a-button>
        </a-col>
        <a-col :span="8" style="text-align: right; white-space: nowrap">
          <a-button size="small" @click="refreshAll" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          <a-button size="small" @click="updateAll" :loading="updating" style="margin-left:6px">
            <template #icon><SyncOutlined /></template>
            更新信息
          </a-button>
          <a-button size="small" @click="checkExpiry" :loading="checkingExpiry" style="margin-left:6px">
            <template #icon><BellOutlined /></template>
            检测到期
          </a-button>
        </a-col>
      </a-row>
    </a-card>

    <!-- Domain table -->
    <a-card>
      <template #title>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>域名列表</span>
          <a-dropdown :trigger="['click']">
            <a-button size="small">
              <template #icon><SettingOutlined /></template>
              自定义列
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item v-for="col in allColumns" :key="col.key" @click="toggleColumn(col.key)">
                  <a-checkbox :checked="visibleColKeys.includes(col.key)" />
                  {{ col.title }}
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </template>
      <!-- Batch action bar -->
      <div v-if="selectedIds.length > 0" style="margin-bottom:12px;display:flex;align-items:center;gap:10px;padding:8px 12px;background:#e6f4ff;border-radius:6px">
        <span style="font-size:13px;color:#1677ff">已选择 <b>{{ selectedIds.length }}</b> 个域名</span>
        <a-button size="small" @click="openBatchGroup">
          <template #icon><FolderOutlined /></template>
          批量分组
        </a-button>
        <a-button size="small" danger @click="clearSelection">取消选择</a-button>
      </div>

      <a-table
        :data-source="domains"
        :columns="columns"
        :loading="loading"
        :pagination="false"
        row-key="id"
        :row-selection="{ selectedRowKeys: selectedIds, onChange: onSelectChange }"
        :scroll="{ x: scrollX }"
        @row-click="goDetail"
        :row-class-name="() => 'clickable-row'"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span style="color: #1677ff; cursor: pointer; font-weight: 500">{{ record.name }}</span>
          </template>
          <template v-if="column.key === 'expiration_date'">
            <span :style="{ color: getExpiryColor(record.expiration_date) }">
              {{ record.expiration_date ? formatDate(record.expiration_date) : '-' }}
            </span>
          </template>
          <template v-if="column.key === 'ssl_expiry'">
            <span :style="{ color: getSslColor(record.ssl_expiry) }">
              {{ record.ssl_expiry ? formatSslDate(record.ssl_expiry) : '-' }}
            </span>
          </template>
          <template v-if="column.key === 'purpose'">
            <a-tag v-if="record.purpose" color="blue">{{ record.purpose }}</a-tag>
          </template>
          <template v-if="column.key === 'dns'">
            <a-tag v-if="record.dns_records && record.dns_records.length > 2" color="green" size="small">已检测</a-tag>
            <a-tag v-else color="default" size="small">未检测</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click.stop="viewDetail(record)">详情</a-button>
            <a-button type="link" danger size="small" @click.stop="confirmDelete(record)">删除</a-button>
          </template>
        </template>
      </a-table>

      <div style="margin-top: 16px; display: flex; justify-content: flex-end">
        <a-pagination
          v-model:current="page"
          :page-size="pageSize"
          :total="total"
          show-total
          @change="loadDomains"
        />
      </div>
    </a-card>

    <!-- Update progress modal -->
    <a-modal
      v-model:visible="updateVisible"
      title="更新域名信息"
      :footer="null"
      :closable="updateDone"
      :maskClosable="false"
      width="600px"
    >
      <div v-if="!updateDone" style="text-align:center;padding:40px 0">
        <a-spin size="large" />
        <p style="margin-top:16px;color:#666">正在检测 SSL、Whois、DNS…</p>
      </div>

      <div v-else>
        <div style="display:flex;gap:20px;margin-bottom:20px">
          <a-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#1677ff">{{ updateTotal }}</div>
            <div style="font-size:12px;color:#999">总域名</div>
          </a-card>
          <a-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#52c41a">{{ updateSuccess }}</div>
            <div style="font-size:12px;color:#999">成功</div>
          </a-card>
          <a-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#ff4d4f">{{ updateFailed }}</div>
            <div style="font-size:12px;color:#999">失败</div>
          </a-card>
        </div>

        <a-table
          v-if="updateFailed > 0"
          :data-source="updateResults.filter(r => r.ssl || r.whois || r.dns)"
          :columns="updateColumns"
          size="small"
          :pagination="false"
          row-key="name"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <span v-if="record.ssl && record.whois && record.dns" style="color:#52c41a">全部通过</span>
              <span v-else-if="!record.ssl && !record.whois && !record.dns" style="color:#ff4d4f">全部失败</span>
              <span v-else style="color:#faad14">部分失败</span>
            </template>
            <template v-if="column.key === 'detail'">
              <a-tag v-if="record.ssl" color="green" size="small">SSL</a-tag>
              <a-tag v-else color="red" size="small">SSL</a-tag>
              <a-tag v-if="record.whois" color="green" size="small">Whois</a-tag>
              <a-tag v-else color="red" size="small">Whois</a-tag>
              <a-tag v-if="record.dns" color="green" size="small">DNS</a-tag>
              <a-tag v-else color="red" size="small">DNS</a-tag>
            </template>
          </template>
        </a-table>

        <div style="text-align:center;margin-top:16px">
          <a-button type="primary" @click="closeUpdateModal">关闭</a-button>
        </div>
      </div>
    </a-modal>

    <!-- Batch group modal -->
    <a-modal
      v-model:visible="batchGroupVisible"
      title="批量分组"
      @ok="doBatchGroup"
      :confirmLoading="batchGroupSaving"
      okText="确认分配"
      cancelText="取消"
    >
      <p style="margin-bottom:12px">已将 <b>{{ selectedIds.length }}</b> 个域名分配到：</p>
      <a-select v-model:value="batchGroupId" placeholder="请选择分组" allowClear style="width:100%">
        <a-select-option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</a-select-option>
      </a-select>
      <p style="margin-top:8px;font-size:12px;color:#999">清空选择 = 移出分组</p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ReloadOutlined, PlusCircleOutlined, OrderedListOutlined, BellOutlined, SyncOutlined, FolderOutlined, SettingOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

const router = useRouter()
const loading = ref(false)
const domains = ref([])
const groups = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const groupFilter = ref(undefined)
const sortBy = ref('created_at')
const sortOrder = ref('desc')

const user = JSON.parse(localStorage.getItem('user') || '{}')
const canAddDomain = computed(() => {
  if (!user) return false
  if (['super_admin', 'company_admin'].includes(user.role)) return true
  try {
    const perms: string[] = user.permissions ? JSON.parse(user.permissions) : []
    return perms.includes('domain:add')
  } catch { return false }
})

const statsCards = reactive([
  { label: '总域名', value: 0, color: '#1677ff' },
  { label: '即将到期', value: 0, color: '#faad14' },
  { label: '已过期', value: 0, color: '#ff4d4f' },
  { label: 'SSL 已过期', value: 0, color: '#ff4d4f' },
  { label: '未检测 SSL', value: 0, color: '#8c8c8c' },
])

const allColumns = [
  { title: '域名', dataIndex: 'name', key: 'name', width: 200 },
  { title: '公司', dataIndex: 'company_name', key: 'company_name', width: 120 },
  { title: 'DNS', key: 'dns', width: 90 },
  { title: '注册商', dataIndex: 'registrar', key: 'registrar', width: 150 },
  { title: '到期时间', dataIndex: 'expiration_date', key: 'expiration_date', width: 140 },
  { title: 'SSL 到期', dataIndex: 'ssl_expiry', key: 'ssl_expiry', width: 140 },
  { title: '分组', dataIndex: 'group_name', key: 'group_name', width: 120 },
  { title: '用途', dataIndex: 'purpose', key: 'purpose', width: 150 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

const defaultColKeys = allColumns.map(c => c.key)
const savedKeys = localStorage.getItem('dk_cols')
const visibleColKeys = ref<string[]>(savedKeys ? JSON.parse(savedKeys) : defaultColKeys)

const columns = computed(() => allColumns.filter(c => visibleColKeys.value.includes(c.key)))
const scrollX = computed(() => {
  let total = 0
  for (const c of columns.value) {
    total += c.width || 100
  }
  return total + 20 // small buffer
})

function toggleColumn(key: string) {
  const idx = visibleColKeys.value.indexOf(key)
  if (idx >= 0) {
    // Don't allow hiding 'name' (domain) column
    if (key === 'name') return
    visibleColKeys.value.splice(idx, 1)
  } else {
    visibleColKeys.value.push(key)
  }
  localStorage.setItem('dk_cols', JSON.stringify(visibleColKeys.value))
}

const updateColumns = [
  { title: '域名', dataIndex: 'name', key: 'name', width: 200 },
  { title: '状态', key: 'status', width: 100 },
  { title: '详情', key: 'detail', width: 200 },
]

onMounted(() => {
  loadStats()
  loadGroups()
  loadDomains()
})

async function loadStats() {
  try {
    const res = await api.get('/dashboard/stats')
    const s = res.data.stats
    statsCards[0].value = s.total
    statsCards[1].value = s.expiring_soon
    statsCards[2].value = s.expired
    statsCards[3].value = s.ssl_expired
    statsCards[4].value = s.no_ssl
  } catch {}
}

async function loadGroups() {
  try {
    const res = await api.get('/groups')
    groups.value = res.data.groups
  } catch {}
}

async function loadDomains() {
  loading.value = true
  try {
    const params: any = { page: page.value, page_size: pageSize.value, sort_by: sortBy.value, sort_order: sortOrder.value }
    if (search.value) params.search = search.value
    if (groupFilter.value) params.group_id = groupFilter.value
    const res = await api.get('/domains', { params })
    domains.value = res.data.domains
    total.value = res.data.total
  } catch {} finally {
    loading.value = false
  }
}

function toggleSort() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  loadDomains()
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([loadStats(), loadDomains()])
    message.success('数据已刷新')
  } catch {
    message.error('刷新失败')
  } finally {
    loading.value = false
  }
}

const checkingExpiry = ref(false)
const updating = ref(false)
const updateVisible = ref(false)
const updateResults = ref<Array<{name:string;ssl:boolean;whois:boolean;dns:boolean;error?:string}>>([])
const updateDone = ref(false)
const updateTotal = ref(0)
const updateSuccess = ref(0)
const updateFailed = ref(0)

// Batch select & group
const selectedIds = ref<number[]>([])
const batchGroupVisible = ref(false)
const batchGroupId = ref<number | undefined>(undefined)
const batchGroupSaving = ref(false)

function onSelectChange(keys: number[]) {
  selectedIds.value = keys
}

function clearSelection() {
  selectedIds.value = []
}

function openBatchGroup() {
  batchGroupId.value = undefined
  batchGroupVisible.value = true
}

async function doBatchGroup() {
  if (selectedIds.value.length === 0) return
  batchGroupSaving.value = true
  try {
    const res = await api.post('/domains/batch-group', {
      ids: selectedIds.value,
      group_id: batchGroupId.value || null,
    })
    message.success(res.data.message)
    batchGroupVisible.value = false
    selectedIds.value = []
    loadDomains()
  } catch (err: any) {
    message.error(err.response?.data?.error || '操作失败')
  } finally {
    batchGroupSaving.value = false
  }
}

async function updateAll() {
  updateVisible.value = true
  updateDone.value = false
  updateResults.value = []
  updateTotal.value = 0
  updateSuccess.value = 0
  updateFailed.value = 0
  updating.value = true
  try {
    const res = await api.post('/domains/refresh-all')
    const data = res.data
    updateResults.value = data.results || []
    updateTotal.value = data.total
    updateSuccess.value = data.success
    updateFailed.value = data.failed
    updateDone.value = true
    loadDomains()
    loadStats()
  } catch (err: any) {
    updateDone.value = true
    message.error(err.response?.data?.error || '更新失败')
  } finally {
    updating.value = false
  }
}

function closeUpdateModal() {
  updateVisible.value = false
}

async function checkExpiry() {
  checkingExpiry.value = true
  try {
    const res = await api.post('/domains/check-expiry')
    message.success(res.data.message)
    // Refresh stats after check
    loadStats()
  } catch (err: any) {
    message.error(err.response?.data?.error || '检测失败')
  } finally {
    checkingExpiry.value = false
  }
}

function goAddDomain() {
  router.push('/domains/add')
}

function goBatchAdd() {
  router.push('/domains/batch')
}

function getExpiryColor(date: string) {
  if (!date) return '#8c8c8c'
  const days = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return '#ff4d4f'
  if (days < 30) return '#faad14'
  return '#52c41a'
}

function formatDate(date: string) {
  return date.split('T')[0] || date.substring(0, 10)
}

function getSslColor(date: string) {
  if (!date) return '#8c8c8c'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '#8c8c8c'
  const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return '#ff4d4f'
  if (days < 30) return '#faad14'
  return '#52c41a'
}

function formatSslDate(date: string) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return date.substring(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function viewDetail(row: any) {
  router.push(`/domains/${row.id}`)
}

function goDetail(record: any) {
  router.push(`/domains/${record.id}`)
}

async function confirmDelete(row: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除域名 ${row.name}？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await api.delete(`/domains/${row.id}`)
      message.success('删除成功')
      loadDomains()
      loadStats()
    },
  })
}
</script>

<style scoped>
.clickable-row {
  cursor: pointer;
}
:deep(.ant-table-row:hover) {
  cursor: pointer;
}
:deep(.ant-statistic-content) {
  font-weight: 700;
}
.quick-actions {
  display: flex;
  gap: 10px;
}
</style>
