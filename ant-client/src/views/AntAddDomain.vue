<template>
  <div>
    <h2 style="margin-bottom: 20px">添加域名</h2>

    <a-card style="margin-bottom: 20px">
      <a-form layout="inline" :model="form" @finish="queryWhois">
        <a-form-item
          label="域名"
          name="name"
          :rules="[{ required: true, message: '请输入域名' }]"
          style="flex: 1"
        >
          <a-input v-model:value="form.name" placeholder="example.com" style="min-width: 300px" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="queryLoading">
            <template #icon><SearchOutlined /></template>
            查询 Whois
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card v-if="whoisInfo" title="域名信息">
      <a-form :model="saveForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="域名">{{ form.name }}</a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="DNS 服务商">
              <a-select v-model:value="saveForm.dns_ns_provider" allowClear placeholder="选择或输入" style="width: 100%">
                <a-select-option v-for="p in dnsProviders" :key="p.name" :value="p.name">{{ p.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="注册商">
              <a-input v-model:value="saveForm.registrar" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="NS 服务器">
              <a-input v-model:value="saveForm.dns_ns_server" placeholder="ns1.example.com, ns2.example.com" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="注册时间">
              <a-input v-model:value="saveForm.registration_date" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="到期时间">
              <a-input v-model:value="saveForm.expiration_date" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="用途">
              <a-input v-model:value="saveForm.purpose" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="标签">
              <a-input v-model:value="saveForm.tags" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="分组">
              <a-select v-model:value="saveForm.group_id" allowClear style="width: 100%">
                <a-select-option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="解析记录">
              <a-textarea v-model:value="saveForm.dns_records_text" :rows="4" placeholder="每行一条，格式: TYPE 主机记录 值&#10;例如:&#10;A @ 1.2.3.4&#10;CNAME www example.com&#10;MX @ 10 mail.example.com&#10;TXT @ v=spf1 include:_spf.google.com ~all" />
              <div style="font-size:11px;color:#999;margin-top:4px">每行一条：<b>类型</b> <b>主机记录</b> <b>值</b>（用空格隔开）</div>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item>
          <a-button type="primary" @click="saveDomain" :loading="saving">
            <template #icon><SaveOutlined /></template>
            保存域名
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { SearchOutlined, SaveOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const queryLoading = ref(false)
const saving = ref(false)
const whoisInfo = ref(false)
const groups = ref<any[]>([])
const dnsProviders = ref<any[]>([])

const form = reactive({ name: '' })
const saveForm = reactive({
  registrar: '',
  registration_date: '',
  expiration_date: '',
  purpose: '',
  tags: '',
  group_id: null as number | null,
  dns_ns_server: '',
  dns_ns_provider: '',
  dns_records_text: '',
})

onMounted(async () => {
  try {
    const [groupsRes, providersRes] = await Promise.all([
      api.get('/groups'),
      api.get('/dns-providers'),
    ])
    groups.value = groupsRes.data.groups
    dnsProviders.value = providersRes.data.providers || []
  } catch {}
})

function parseDnsRecords(text: string): Array<{ type: string; name: string; data: string }> {
  if (!text.trim()) return []
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split(/\s+/)
      if (parts.length < 3) return null
      return {
        type: parts[0].toUpperCase(),
        name: parts[1],
        data: parts.slice(2).join(' '),
      }
    })
    .filter((r): r is { type: string; name: string; data: string } => r !== null)
}

async function queryWhois() {
  queryLoading.value = true
  try {
    const res = await api.post('/domains/whois', { domain: form.name })
    const info = res.data.info
    saveForm.registrar = info.registrar || ''
    saveForm.registration_date = info.registration_date || ''
    saveForm.expiration_date = info.expiration_date || ''
    whoisInfo.value = true
    message.success('查询成功')
  } catch (err: any) {
    message.error(err.response?.data?.error || '查询失败，请手动填写信息')
    whoisInfo.value = true
  } finally {
    queryLoading.value = false
  }
}

async function saveDomain() {
  saving.value = true
  try {
    const records = parseDnsRecords(saveForm.dns_records_text)
    await api.post('/domains', {
      name: form.name,
      registrar: saveForm.registrar,
      registration_date: saveForm.registration_date,
      expiration_date: saveForm.expiration_date,
      purpose: saveForm.purpose,
      tags: saveForm.tags,
      group_id: saveForm.group_id,
      dns_ns_server: saveForm.dns_ns_server,
      dns_ns_provider: saveForm.dns_ns_provider,
      dns_records: records.length > 0 ? records : undefined,
    })
    message.success('保存成功')
    router.push('/')
  } catch (err: any) {
    message.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
