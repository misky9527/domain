<template>
  <div>
    <h2 style="margin-bottom: 20px">设置维护</h2>

    <a-row :gutter="[16, 16]">
      <a-col :span="8">
        <a-card hoverable @click="router.push('/settings')">
          <template #title>
            <SettingOutlined /> 用户设置
          </template>
          <p>修改密码、配置 Telegram 通知</p>
        </a-card>
      </a-col>
      <a-col :span="8" v-if="isSuperAdmin">
        <a-card hoverable @click="router.push('/settings/orphans')">
          <template #title>
            <UserDeleteOutlined /> 孤悬用户管理
          </template>
          <p>管理无公司归属的孤立用户</p>
        </a-card>
      </a-col>
      <a-col :span="8" v-if="isSuperAdmin">
        <a-card hoverable @click="router.push('/settings/logs')">
          <template #title>
            <FileTextOutlined /> 操作日志
          </template>
          <p>查看所有操作记录</p>
        </a-card>
      </a-col>
    </a-row>

    <a-divider v-if="currentPath === '/settings'" />

    <div v-if="currentPath === '/settings'">
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
            <a-select
              v-model:value="chatIds"
              mode="tags"
              placeholder="输入 Chat ID 后按回车添加"
              style="width: 100%"
              :open="false"
              :dropdown-match-select-width="false"
            />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SaveOutlined, SendOutlined, SettingOutlined, UserDeleteOutlined, FileTextOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const route = useRoute()
const currentPath = computed(() => route.path)

const saving = ref(false)
const testing = ref(false)
const changingPwd = ref(false)
const passwordForm = reactive({ old_password: '', new_password: '' })
const user = ref<any>(JSON.parse(localStorage.getItem('user') || '{}'))
const form = reactive({
  telegram_bot_token: '',
  telegram_chat_id: '',
})
const chatIds = ref<string[]>([])

const isSuperAdmin = computed(() => user.value.role === 'super_admin')

onMounted(async () => {
  try {
    const res = await api.get('/settings/telegram')
    form.telegram_bot_token = res.data.telegram_bot_token || ''
    const raw = res.data.telegram_chat_id || ''
    chatIds.value = raw.split('\n').map((s: string) => s.trim()).filter(Boolean)
  } catch {}
})

async function saveSettings() {
  saving.value = true
  try {
    await api.put('/settings/telegram', {
      telegram_bot_token: form.telegram_bot_token,
      telegram_chat_id: chatIds.value.join('\n'),
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
