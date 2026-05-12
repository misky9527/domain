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

    <a-card v-if="whoisInfo" title="Whois 信息预览">
      <a-form :model="saveForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="域名">{{ form.name }}</a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="注册商">
              <a-input v-model:value="saveForm.registrar" />
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
const groups = ref([])

const form = reactive({ name: '' })
const saveForm = reactive({
  registrar: '',
  registration_date: '',
  expiration_date: '',
  purpose: '',
  tags: '',
  group_id: null,
})

onMounted(async () => {
  try {
    const res = await api.get('/groups')
    groups.value = res.data.groups
  } catch {}
})

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
    await api.post('/domains', {
      name: form.name,
      ...saveForm,
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
