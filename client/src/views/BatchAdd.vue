<template>
  <div>
    <h2 style="margin-bottom: 20px">批量导入域名</h2>
    <el-card style="margin-bottom: 20px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="域名列表">
          <el-input
            v-model="form.domains"
            type="textarea"
            :rows="8"
            placeholder="每行一个域名，例如：&#10;example.com&#10;example.org&#10;example.net"
            @paste="onPaste"
            @blur="onBlur"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="queryBatch" :loading="queryLoading">批量查询 Whois</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="results.length > 0">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>查询结果 ({{ results.length }})</span>
          <div style="display:flex;gap:8px">
            <el-button v-if="failedCount > 0" size="small" @click="retryFailed" :loading="retrying">
              重试失败项 ({{ failedCount }})
            </el-button>
            <el-button type="primary" @click="saveAll" :loading="saving">保存全部</el-button>
          </div>
        </div>
      </template>
      <el-table :data="results" size="small" max-height="500" style="width: 100%">
        <el-table-column label="域名" width="200">
          <template #default="{ row }">
            <el-checkbox v-model="row.selected" /> {{ row.domain }}
          </template>
        </el-table-column>
        <el-table-column label="注册商" width="150">
          <template #default="{ row }">
            <el-input v-model="row.info.registrar" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">
            <el-input v-model="row.info.registration_date" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">
            <el-input v-model="row.info.expiration_date" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.error" type="danger" size="small" :title="row.error">失败</el-tag>
            <el-tag v-else type="success" size="small">成功</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button v-if="row.error" type="primary" link size="small" @click="retrySingle(row)" :loading="retrying">重试</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const queryLoading = ref(false)
const saving = ref(false)
const retrying = ref(false)
const form = reactive({ domains: '' })
const results = ref<Array<any>>([])

const failedCount = computed(() => results.value.filter(r => r.error).length)

function cleanDomain(d: string): string | null {
  let s = rawClean(d)
  if (!s) return null
  return toRootDomain(s)
}

// Strip protocol, path, port, non-ASCII
function rawClean(s: string): string | null {
  let r = s.replace(/^https?:\/\//i, '').replace(/[\/:].*$/, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '')
  if (!r || !r.includes('.')) return null
  return r.toLowerCase()
}

// Strip subdomain: 123.b.com → b.com, sub.example.co.uk → example.co.uk
function toRootDomain(d: string): string {
  const parts = d.split('.')
  if (parts.length <= 2) return d
  return parts.slice(parts.length - 2).join('.')
}

// Format: clean input, dedup, remove invalid
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
    ElMessage.warning('没有有效的域名，请检查输入格式')
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
    ElMessage.success(skipped > 0 ? `${msg}（已过滤 ${skipped} 个无效格式）` : msg)
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '查询失败')
  } finally {
    queryLoading.value = false
  }
}

async function saveAll() {
  const selected = results.value.filter(r => r.selected)
  if (selected.length === 0) {
    ElMessage.warning('请至少选择一个域名')
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
    ElMessage.success(`成功保存 ${domains.length} 个域名`)
    router.push('/')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败')
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
    ElMessage.success(`${record.domain} 查询成功`)
  } catch (err: any) {
    ElMessage.error(`${record.domain} 查询失败: ${err.response?.data?.error || err.message}`)
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
  ElMessage.success(`${ok}/${failed.length} 个域名重试成功`)
  retrying.value = false
}
</script>
