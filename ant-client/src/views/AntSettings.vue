<template>
  <div>
    <h2 style="margin-bottom: 20px">设置</h2>

    <a-card v-if="user" style="margin-bottom: 20px">
      <template #title>
        <span>用户信息</span>
      </template>
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="用户名">{{ user.username }}</a-descriptions-item>
        <a-descriptions-item label="角色">
          <a-tag :color="user.role === 'super_admin' ? 'red' : (user.role === 'company_admin' ? 'orange' : 'blue')">
            {{ user.role === 'super_admin' ? '超级管理员' : (user.role === 'company_admin' ? '公司管理员' : '普通用户') }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <a-card style="margin-bottom: 20px">
      <template #title><span>修改密码</span></template>
      <a-form :model="passwordForm" layout="vertical">
        <a-form-item label="当前密码">
          <a-input-password v-model:value="passwordForm.old_password" />
        </a-form-item>
        <a-form-item label="新密码">
          <a-input-password v-model:value="passwordForm.new_password" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="changePassword" :loading="changingPwd">修改密码</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card>
      <template #title>
        <span>Telegram 通知配置</span>
      </template>
      <a-form :model="form" layout="vertical">
        <a-form-item label="Bot Token">
          <a-input
            v-model:value="form.telegram_bot_token"
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          />
        </a-form-item>
        <a-form-item label="Chat ID">
          <a-input v-model:value="form.telegram_chat_id" placeholder="123456789" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="saveSettings" :loading="saving">
            <template #icon><SaveOutlined /></template>
            保存设置
          </a-button>
          <a-button style="margin-left: 10px" @click="testTelegram" :loading="testing">
            <template #icon><SendOutlined /></template>
            发送测试消息
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { SaveOutlined, SendOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const saving = ref(false)
const testing = ref(false)
const changingPwd = ref(false)
const passwordForm = reactive({ old_password: '', new_password: '' })
const user = ref<any>(JSON.parse(localStorage.getItem('user') || '{}'))
const form = reactive({
  telegram_bot_token: '',
  telegram_chat_id: '',
})

onMounted(async () => {
  try {
    const res = await api.get('/settings/telegram')
    form.telegram_bot_token = res.data.telegram_bot_token || ''
    form.telegram_chat_id = res.data.telegram_chat_id || ''
  } catch {}
})

async function saveSettings() {
  saving.value = true
  try {
    await api.put('/settings/telegram', {
      telegram_bot_token: form.telegram_bot_token,
      telegram_chat_id: form.telegram_chat_id,
    })
    message.success('设置已保存')
  } catch (err: any) {
    message.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  if (!passwordForm.old_password || !passwordForm.new_password) {
    message.warning('请填写当前密码和新密码')
    return
  }
  if (passwordForm.new_password.length < 6) {
    message.warning('新密码至少6位')
    return
  }
  changingPwd.value = true
  try {
    await api.put('/auth/password', {
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    })
    message.success('密码修改成功')
    passwordForm.old_password = ''
    passwordForm.new_password = ''
  } catch (err: any) {
    message.error(err.response?.data?.error || '修改失败')
  } finally {
    changingPwd.value = false
  }
}

async function testTelegram() {
  testing.value = true
  try {
    await api.post('/settings/telegram/test')
    message.success('测试消息已发送，请检查 Telegram')
  } catch (err: any) {
    message.error(err.response?.data?.error || '发送失败')
  } finally {
    testing.value = false
  }
}
</script>
