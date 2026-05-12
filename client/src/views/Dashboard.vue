<template>
  <div>
    <!-- Stats cards -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="4" v-for="card in statsCards" :key="card.label">
        <el-card :body-style="{ padding: '15px' }">
          <div :style="{ fontSize: '28px', fontWeight: 'bold', color: card.color }">{{ card.value }}</div>
          <div style="font-size: 13px; color: #999; margin-top: 5px">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Quick action pills -->
    <el-row :gutter="20" style="margin-bottom: 16px">
      <el-col :span="24">
        <div class="quick-actions">
          <el-button v-if="canAddDomain" type="primary" plain @click="goAddDomain">
            添加域名
          </el-button>
          <el-button type="primary" plain @click="goBatchAdd">
            批量导入
          </el-button>
        </div>
      </el-col>
    </el-row>

    <!-- Search and filter bar -->
    <el-card style="margin-bottom: 20px">
      <el-row :gutter="10">
        <el-col :span="6">
          <el-input v-model="search" placeholder="搜索域名..." clearable @input="loadDomains" />
        </el-col>
        <el-col :span="5">
          <el-select v-model="groupFilter" placeholder="全部分组" clearable @change="loadDomains" style="width: 100%">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="sortBy" @change="loadDomains" style="width: 100%">
            <el-option label="添加时间" value="created_at" />
            <el-option label="域名" value="name" />
            <el-option label="到期时间" value="expiration_date" />
          </el-select>
        </el-col>
        <el-col :span="1">
          <el-button @click="toggleSort" size="small">
            {{ sortOrder === 'desc' ? '↓' : '↑' }}
          </el-button>
        </el-col>
        <el-col :span="8" style="text-align: right; white-space: nowrap">
          <el-button size="small" @click="refreshAll" :loading="loading">
            刷新
          </el-button>
          <el-button size="small" @click="updateAll" :loading="updating" style="margin-left:6px">
            更新信息
          </el-button>
          <el-button size="small" @click="checkExpiry" :loading="checkingExpiry" style="margin-left:6px">
            检测到期
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- Domain table -->
    <el-card>
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>域名列表</span>
          <el-dropdown trigger="click" @command="toggleColumn">
            <el-button size="small">
              自定义列
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="col in allColumns" :key="col.key" :command="col.key" :disabled="col.key === 'name'">
                  <el-checkbox :checked="visibleColKeys.includes(col.key)" @click.stop :disabled="col.key === 'name'" />
                  {{ col.title }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>

      <!-- Batch action bar -->
      <div v-if="selectedIds.length > 0" class="batch-bar">
        <span style="font-size:13px;color:#409eff">已选择 <b>{{ selectedIds.length }}</b> 个域名</span>
        <el-button size="small" @click="openBatchGroup">
          批量分组
        </el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>

      <el-table
        :data="domains"
        style="width: 100%"
        v-loading="loading"
        @row-click="goDetail"
        @selection-change="onSelectChange"
        :scroll-x="scrollX"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column v-for="col in columns" :key="col.key" :prop="col.dataIndex" :label="col.title" :width="col.width" :fixed="col.fixed">
          <template #default="{ row }" v-if="col.key === 'name'">
            <span style="color: #409eff; cursor: pointer; font-weight: 500">{{ row.name }}</span>
          </template>
          <template #default="{ row }" v-else-if="col.key === 'expiration_date'">
            <span :style="{ color: getExpiryColor(row.expiration_date) }">
              {{ row.expiration_date ? formatDate(row.expiration_date) : '-' }}
            </span>
          </template>
          <template #default="{ row }" v-else-if="col.key === 'ssl_expiry'">
            <span :style="{ color: getSslColor(row.ssl_expiry) }">
              {{ row.ssl_expiry ? formatSslDate(row.ssl_expiry) : '-' }}
            </span>
          </template>
          <template #default="{ row }" v-else-if="col.key === 'dns'">
            <el-tag v-if="row.dns_records && row.dns_records.length > 2" type="success" size="small">已检测</el-tag>
            <el-tag v-else type="info" size="small">未检测</el-tag>
          </template>
          <template #default="{ row }" v-else-if="col.key === 'purpose'">
            <el-tag v-if="row.purpose" size="small">{{ row.purpose }}</el-tag>
          </template>
          <template #default="{ row }" v-else-if="col.key === 'action'">
            <el-button size="small" type="primary" link @click.stop="viewDetail(row)">详情</el-button>
            <el-button size="small" type="danger" link @click.stop="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 15px; display: flex; justify-content: flex-end">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next, total"
          @current-change="loadDomains"
        />
      </div>
    </el-card>

    <!-- Update progress dialog -->
    <el-dialog
      v-model="updateVisible"
      title="更新域名信息"
      :close-on-click-modal="false"
      width="600px"
    >
      <div v-if="!updateDone" style="text-align:center;padding:40px 0">
        <el-icon :size="32" class="is-loading"><Loading /></el-icon>
        <p style="margin-top:16px;color:#666">正在检测 SSL、Whois、DNS…</p>
      </div>

      <div v-else>
        <div style="display:flex;gap:20px;margin-bottom:20px">
          <el-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#409eff">{{ updateTotal }}</div>
            <div style="font-size:12px;color:#999">总域名</div>
          </el-card>
          <el-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#67c23a">{{ updateSuccess }}</div>
            <div style="font-size:12px;color:#999">成功</div>
          </el-card>
          <el-card :body-style="{ padding: '16px', textAlign: 'center' }" style="flex:1">
            <div style="font-size:28px;font-weight:700;color:#f56c6c">{{ updateFailed }}</div>
            <div style="font-size:12px;color:#999">失败</div>
          </el-card>
        </div>

        <el-table
          v-if="updateFailed > 0"
          :data="updateResults.filter(r => r.ssl || r.whois || r.dns)"
          size="small"
          style="width: 100%"
        >
          <el-table-column prop="name" label="域名" width="200" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <span v-if="row.ssl && row.whois && row.dns" style="color:#67c23a">全部通过</span>
              <span v-else-if="!row.ssl && !row.whois && !row.dns" style="color:#f56c6c">全部失败</span>
              <span v-else style="color:#e6a23c">部分失败</span>
            </template>
          </el-table-column>
          <el-table-column label="详情" width="200">
            <template #default="{ row }">
              <el-tag v-if="row.ssl" type="success" size="small">SSL</el-tag>
              <el-tag v-else type="danger" size="small">SSL</el-tag>
              <el-tag v-if="row.whois" type="success" size="small">Whois</el-tag>
              <el-tag v-else type="danger" size="small">Whois</el-tag>
              <el-tag v-if="row.dns" type="success" size="small">DNS</el-tag>
              <el-tag v-else type="danger" size="small">DNS</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div style="text-align:center;margin-top:16px">
          <el-button type="primary" @click="closeUpdateModal">关闭</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- Batch group dialog -->
    <el-dialog
      v-model="batchGroupVisible"
      title="批量分组"
      width="420px"
    >
      <p style="margin-bottom:12px">已将 <b>{{ selectedIds.length }}</b> 个域名分配到：</p>
      <el-select v-model="batchGroupId" placeholder="请选择分组" clearable style="width:100%">
        <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
      </el-select>
      <p style="margin-top:8px;font-size:12px;color:#999">清空选择 = 移出分组</p>
      <template #footer>
        <el-button @click="batchGroupVisible = false">取消</el-button>
        <el-button type="primary" @click="doBatchGroup" :loading="batchGroupSaving">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import api from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const domains = ref([])
const groups = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const groupFilter = ref(null)
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
  { label: '总域名', value: 0, color: '#409eff' },
  { label: '即将到期', value: 0, color: '#e6a23c' },
  { label: '已过期', value: 0, color: '#f56c6c' },
  { label: 'SSL 已过期', value: 0, color: '#f56c6c' },
  { label: '未检测 SSL', value: 0, color: '#909399' },
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
  return total + 20
})

function toggleColumn(key: string) {
  const idx = visibleColKeys.value.indexOf(key)
  if (idx >= 0) {
    if (key === 'name') return
    visibleColKeys.value.splice(idx, 1)
  } else {
    visibleColKeys.value.push(key)
  }
  localStorage.setItem('dk_cols', JSON.stringify(visibleColKeys.value))
}

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
    ElMessage.success('数据已刷新')
  } catch {
    ElMessage.error('刷新失败')
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

function onSelectChange(selection: any[]) {
  selectedIds.value = selection.map((s: any) => s.id)
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
    ElMessage.success(res.data.message)
    batchGroupVisible.value = false
    selectedIds.value = []
    loadDomains()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '操作失败')
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
    ElMessage.error(err.response?.data?.error || '更新失败')
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
    ElMessage.success(res.data.message)
    loadStats()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '检测失败')
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
  if (!date) return '#999'
  const days = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return '#f56c6c'
  if (days < 30) return '#e6a23c'
  return '#67c23a'
}

function formatDate(date: string) {
  return date.split('T')[0] || date.substring(0, 10)
}

function getSslColor(date: string) {
  if (!date) return '#999'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '#999'
  const days = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (days < 0) return '#f56c6c'
  if (days < 30) return '#e6a23c'
  return '#67c23a'
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

function goDetail(row: any) {
  router.push(`/domains/${row.id}`)
}

async function confirmDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除域名 ${row.name}？`, '确认')
    await api.delete(`/domains/${row.id}`)
    ElMessage.success('删除成功')
    loadDomains()
    loadStats()
  } catch {}
}
</script>

<style scoped>
.clickable-row {
  cursor: pointer;
}
.quick-actions {
  display: flex;
  gap: 10px;
}
.batch-bar {
  margin-bottom:12px;
  display:flex;
  align-items:center;
  gap:10px;
  padding:8px 12px;
  background:#ecf5ff;
  border-radius:6px;
}
</style>
