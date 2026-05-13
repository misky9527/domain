<template>
  <div>
    <h2 style="margin-bottom: 20px">批量导入域名</h2>

    <!-- File upload section -->
    <a-card style="margin-bottom: 20px">
      <template #title><span>📎 上传文件导入</span></template>
      <div style="margin-bottom:12px;color:#999;font-size:12px">
        支持 Excel (.xlsx/.xls) 或 CSV，格式：第一列=域名，第二列=用途，第三列=分组（留空则默认组）
      </div>
      <a-upload-dragger
        name="file"
        :action="uploadUrl"
        :headers="uploadHeaders"
        :before-upload="onBeforeUpload"
        @change="handleUploadChange"
        accept=".csv,.xls,.xlsx"
        :show-upload-list="false"
      >
        <p class="ant-upload-drag-icon"><InboxOutlined style="font-size:40px;color:#1677ff" /></p>
        <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p class="ant-upload-hint">支持 .csv / .xls / .xlsx 文件，最大 5MB</p>
      </a-upload-dragger>

      <!-- Upload results -->
      <div v-if="uploadResults.length > 0" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span>
            导入结果：
            <a-tag color="green">成功 {{ uploadSuccess }}</a-tag>
            <a-tag v-if="uploadFailed > 0" color="red">失败 {{ uploadFailed }}</a-tag>
          </span>
          <a-button type="primary" size="small" @click="finishBatch">完成</a-button>
        </div>
        <a-table
          :data-source="uploadResults"
          :columns="uploadColumns"
          size="small"
          :pagination="false"
          :scroll="{ y: 300 }"
          row-key="domain"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'domain'">
              <span style="font-family:monospace">{{ record.domain }}</span>
            </template>
            <template v-if="column.key === 'group'">
              <span v-if="record.group">{{ record.group }}</span>
              <a-tag v-else color="default" size="small">默认组</a-tag>
            </template>
            <template v-if="column.key === 'success'">
              <a-tag v-if="record.success" color="green" size="small">成功</a-tag>
              <a-tag v-else color="red" size="small" :title="record.error">失败</a-tag>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <!-- Manual input section -->
    <a-card style="margin-bottom: 20px">
      <template #title><span>✏️ 手动输入域名</span></template>
      <a-form layout="vertical">
        <a-form-item label="域名列表">
          <a-textarea
            v-model:value="form.domains"
            :rows="8"
            placeholder="每行一个域名，例如：&#10;example.com&#10;example.org&#10;example.net"
            @paste="onPaste"
            @blur="onBlur"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="queryBatch" :loading="queryLoading">
            <template #icon><SearchOutlined /></template>
            批量查询 Whois
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card v-if="results.length > 0">
      <template #title>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>查询结果 ({{ results.length }})</span>
          <div style="display:flex;gap:8px">
            <a-button v-if="failedCount > 0" size="small" @click="retryFailed" :loading="retrying">
              <template #icon><ReloadOutlined /></template>
              重试失败项 ({{ failedCount }})
            </a-button>
            <a-button type="primary" @click="saveAll" :loading="saving">
              <template #icon><SaveOutlined /></template>
              保存全部
            </a-button>
          </div>
        </div>
      </template>
      <a-table :data-source="results" :columns="columns" size="small" :scroll="{ y: 500 }" :pagination="false" row-key="domain">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'domain'">
            <a-checkbox v-model:checked="record.selected" /> {{ record.domain }}
          </template>
          <template v-if="column.key === 'registrar'">
            <a-input v-model:value="record.info.registrar" size="small" />
          </template>
          <template v-if="column.key === 'registration_date'">
            <a-input v-model:value="record.info.registration_date" size="small" />
          </template>
          <template v-if="column.key === 'expiration_date'">
            <a-input v-model:value="record.info.expiration_date" size="small" />
          </template>
          <template v-if="column.key === 'status'">
            <a-tag v-if="record.error" color="red" :title="record.error">失败</a-tag>
            <a-tag v-else color="green">成功</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button v-if="record.error" type="link" size="small" @click="retrySingle(record)" :loading="retrying">重试</a-button>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { SearchOutlined, SaveOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const queryLoading = ref(false)
const saving = ref(false)
const form = reactive({ domains: '' })
const results = ref<Array<any>>([])
const retrying = ref(false)

// File upload
const uploadUrl = '/api/domains/batch-upload'
const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
})
const uploadResults = ref<Array<any>>([])
const uploadSuccess = computed(() => uploadResults.value.filter(r => r.success).length)
const uploadFailed = computed(() => uploadResults.value.filter(r => !r.success).length)

const uploadColumns = [
  { title: '域名', key: 'domain', width: 200 },
  { title: '用途', dataIndex: 'purpose', key: 'purpose', width: 150 },
  { title: '分组', key: 'group', width: 120 },
  { title: '状态', key: 'success', width: 80 },
]

const failedCount = computed(() => results.value.filter(r => r.error).length)

const columns = [
  { title: '域名', dataIndex: 'domain', key: 'domain', width: 200 },
  { title: '注册商', dataIndex: 'registrar', key: 'registrar', width: 150 },
  { title: '注册时间', dataIndex: 'registration_date', key: 'registration_date', width: 160 },
  { title: '到期时间', dataIndex: 'expiration_date', key: 'expiration_date', width: 160 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 80 },
]

function onBeforeUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xls', 'xlsx'].includes(ext || '')) {
    message.error('仅支持 CSV / Excel 文件 (.csv .xls .xlsx)')
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('文件不能超过 5MB')
    return false
  }
  return true
}

function handleUploadChange(info: any) {
  if (info.file.status === 'done') {
    const data = info.file.response
    if (data.results) {
      uploadResults.value = data.results
      message.success(data.message || '导入完成')
    } else if (data.error) {
      message.error(data.error)
    }
  } else if (info.file.status === 'error') {
    const err = info.file.response?.error || info.file.error?.message || '上传失败'
    message.error(err)
  }
}

function finishBatch() {
  uploadResults.value = []
  router.push('/')
}

async function queryBatch() {
  const raw = form.domains.split('\n').map((d: string) => d.trim()).filter(Boolean)
  const seen = new Set<string>()
  const domains: string[] = []
  for (const d of raw) {
    const cleaned = cleanDomain(d)
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned)
      domains.push(cleaned)
    }
  }
  if (domains.length === 0) {
    message.warning('没有有效的域名，请检查输入格式')
    return
  }
  const skipped = raw.length - domains.length
  queryLoading.value = true
  try {
    const res = await api.post('/domains/batch-whois', { domains })
    results.value = res.data.results.map((r: any) => ({
      ...r,
      selected: !r.error,
      info: {
        registrar: r.info.registrar || '',
        registration_date: r.info.registration_date || '',
        expiration_date: r.info.expiration_date || '',
      }
    }))
    const msg = `查询完成，共 ${results.value.length} 个域名`
    message.success(skipped > 0 ? `${msg}（已过滤 ${skipped} 个无效格式）` : msg)
  } catch (err: any) {
    message.error(err.response?.data?.error || '查询失败')
  } finally {
    queryLoading.value = false
  }
}

function cleanDomain(d: string): string | null {
  let s = rawClean(d)
  if (!s) return null
  return toRootDomain(s)
}

function rawClean(s: string): string | null {
  let r = s.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '')
  if (!r || !r.includes('.')) return null
  return r.toLowerCase()
}

function toRootDomain(d: string): string {
  const parts = d.split('.')
  if (parts.length <= 2) return d
  return parts.slice(parts.length - 2).join('.')
}

function formatInput(text: string): string {
  const seen = new Set<string>()
  return text.split('\n').map((line: string) => {
    let s = rawClean(line)
    if (!s) return ''
    s = toRootDomain(s)
    if (seen.has(s)) return ''
    seen.add(s)
    return s
  }).filter(Boolean).join('\n')
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text') || ''
  const formatted = formatInput(text)
  const target = e.target as HTMLTextAreaElement
  const start = target.selectionStart
  const end = target.selectionEnd
  const before = form.domains.substring(0, start)
  const after = form.domains.substring(end)
  form.domains = before + formatted + after
}

function onBlur() {
  form.domains = formatInput(form.domains)
}

async function saveAll() {
  const selected = results.value.filter(r => r.selected)
  if (selected.length === 0) {
    message.warning('请至少选择一个域名')
    return
  }
  saving.value = true
  try {
    const domains = selected.map(r => ({
      name: r.domain,
      registrar: r.info.registrar,
      registration_date: r.info.registration_date,
      expiration_date: r.info.expiration_date,
    }))
    await api.post('/domains/batch', { domains })
    message.success(`成功保存 ${domains.length} 个域名`)
    router.push('/')
  } catch (err: any) {
    message.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function retrySingle(record: any) {
  retrying.value = true
  try {
    const res = await api.post('/domains/whois', { domain: record.domain })
    const info = res.data.info
    record.info.registrar = info.registrar || ''
    record.info.registration_date = info.registration_date || ''
    record.info.expiration_date = info.expiration_date || ''
    record.error = undefined
    record.selected = true
    message.success(`${record.domain} 查询成功`)
  } catch (err: any) {
    message.error(`${record.domain} 查询失败: ${err.response?.data?.error || err.message}`)
  } finally {
    retrying.value = false
  }
}

async function retryFailed() {
  const failed = results.value.filter(r => r.error)
  if (failed.length === 0) return
  retrying.value = true
  let ok = 0
  for (const record of failed) {
    try {
      const res = await api.post('/domains/whois', { domain: record.domain })
      const info = res.data.info
      record.info.registrar = info.registrar || ''
      record.info.registration_date = info.registration_date || ''
      record.info.expiration_date = info.expiration_date || ''
      record.error = undefined
      record.selected = true
      ok++
    } catch {}
  }
  message.success(`${ok}/${failed.length} 个域名重试成功`)
  retrying.value = false
}
</script>
