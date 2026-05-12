<template>
  <div>
    <h2 style="margin-bottom: 20px">添加域名</h2>
    <el-card style="margin-bottom: 20px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="域名">
          <el-input v-model="form.name" placeholder="example.com" @keyup.enter="queryWhois">
            <template #append>
              <el-button @click="queryWhois" :loading="queryLoading">查询 Whois</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="whoisInfo" style="margin-bottom: 20px">
      <template #header>
        <span>Whois 信息预览</span>
      </template>
      <el-form :model="saveForm" label-width="120px">
        <el-form-item label="域名">{{ form.name }}</el-form-item>
        <el-form-item label="注册商">
          <el-input v-model="saveForm.registrar" />
        </el-form-item>
        <el-form-item label="注册时间">
          <el-input v-model="saveForm.registration_date" />
        </el-form-item>
        <el-form-item label="到期时间">
          <el-input v-model="saveForm.expiration_date" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input v-model="saveForm.purpose" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="saveForm.tags" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="saveForm.group_id" clearable style="width: 100%">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveDomain" :loading="saving">保存域名</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

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
  if (!form.name) {
    ElMessage.warning('请输入域名')
    return
  }
  queryLoading.value = true
  try {
    const res = await api.post('/domains/whois', { domain: form.name })
    const info = res.data.info
    saveForm.registrar = info.registrar || ''
    saveForm.registration_date = info.registration_date || ''
    saveForm.expiration_date = info.expiration_date || ''
    whoisInfo.value = true
    ElMessage.success('查询成功')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '查询失败，请手动填写信息')
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
    ElMessage.success('保存成功')
    router.push('/')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
