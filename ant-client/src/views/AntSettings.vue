<template>
  <div>
    <h2 style="margin-bottom: 16px">设置维护</h2>

    <a-tabs v-model:activeKey="activeTab" type="card" size="small">
      <a-tab-pane key="user" tab="用户设置">
        <a-card v-if="user" size="small">
          <template #title>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>用户信息</span>
              <a-button type="link" size="small" @click="showPasswordModal = true">修改密码</a-button>
            </div>
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

        <a-modal v-model:open="showPasswordModal" title="修改密码" @ok="changePassword" :confirm-loading="changingPwd" ok-text="保存" width="400px">
          <a-form :model="passwordForm" layout="vertical" size="small">
            <a-form-item label="当前密码" :rules="[{ required: true, message: '请输入当前密码' }]">
              <a-input-password v-model:value="passwordForm.old_password" placeholder="输入当前密码" />
            </a-form-item>
            <a-form-item label="新密码" :rules="[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' }
            ]">
              <a-input-password v-model:value="passwordForm.new_password" placeholder="至少 6 位" />
            </a-form-item>
          </a-form>
        </a-modal>

        <a-card size="small">
          <template #title><span>Telegram 通知配置</span></template>
          <a-form :model="form" layout="vertical" size="small">
            <a-form-item label="Bot Token">
              <a-input v-model:value="form.telegram_bot_token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
            </a-form-item>
            <a-form-item label="Chat ID">
              <a-select
                v-model:value="chatIds"
                mode="tags"
                placeholder="输入 Chat ID 后按回车添加"
                style="width: 100%"
                :open="false"
              />
            </a-form-item>
            <a-form-item>
              <a-space size="small">
                <a-button type="primary" @click="saveSettings" :loading="saving" size="small">
                  <template #icon><SaveOutlined /></template>
                  保存设置
                </a-button>
                <a-button @click="testTelegram" :loading="testing" size="small">
                  <template #icon><SendOutlined /></template>
                  发送测试消息
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="orphans" tab="孤悬用户管理" v-if="isSuperAdmin">
        <AntOrphans />
      </a-tab-pane>

      <a-tab-pane key="logs" tab="操作日志" v-if="isSuperAdmin">
        <AntOperationLogs />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, defineAsyncComponent } from 'vue'
import { SaveOutlined, SendOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const AntOrphans = defineAsyncComponent(() => import('./AntOrphans.vue'))
const AntOperationLogs = defineAsyncComponent(() => import('./AntOperationLogs.vue'))

const activeTab = ref('user')

const saving = ref(false)
const testing = ref(false)
const changingPwd = ref(false)
const showPasswordModal = ref(false)
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
    showPasswordModal.value = false
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
