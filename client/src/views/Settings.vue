<template>
  <div>
    <h2 style="margin-bottom: 20px">设置</h2>

    <el-card v-if="user" style="margin-bottom: 20px">
      <template #header>
        <span>用户信息</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="用户名">{{ user.username }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag :type="user.role === 'admin' ? 'danger' : 'info'">
            {{ user.role === 'admin' ? '管理员' : '用户' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card>
      <template #header>
        <span>Telegram 通知配置</span>
      </template>
      <el-form :model="form" label-width="140px">
        <el-form-item label="Bot Token">
          <el-input v-model="form.telegram_bot_token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
        </el-form-item>
        <el-form-item label="Chat ID">
          <el-input v-model="form.telegram_chat_id" placeholder="123456789" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveSettings" :loading="saving">保存设置</el-button>
          <el-button @click="testTelegram" :loading="testing" style="margin-left: 10px">发送测试消息</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

const saving = ref(false)
const testing = ref(false)
const user = ref<any>(JSON.parse(localStorage.getItem('user') || '{}'))
const form = reactive({
  telegram_bot_token: '',
  telegram_chat_id: '',
})

onMounted(async () => {
  try {
    const res = await api.get('/settings/telegram')
    form.telegram_bot_token = res.data.telegram_bot_token
    form.telegram_chat_id = res.data.telegram_chat_id
  } catch {}
})

async function saveSettings() {
  saving.value = true
  try {
    await api.put('/settings/telegram', {
      telegram_bot_token: form.telegram_bot_token,
      telegram_chat_id: form.telegram_chat_id,
    })
    ElMessage.success('设置已保存')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function testTelegram() {
  testing.value = true
  try {
    await api.post('/settings/telegram/test')
    ElMessage.success('测试消息已发送，请检查 Telegram')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '发送失败')
  } finally {
    testing.value = false
  }
}
</script>
