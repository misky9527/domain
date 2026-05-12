<template>
  <a-config-provider :theme="{ token: { colorPrimary: '#1677ff', borderRadius: 8, controlHeight: 40 } }">
    <div class="register-page">
      <div class="register-bg">
        <div class="register-card">
          <a-card :bordered="false" style="border-radius:12px">
            <template #title>
              <div style="text-align:center">
                <div style="font-size:22px;font-weight:600;margin-bottom:4px">注册账号</div>
                <div style="font-size:13px;color:#999">注册后需管理员审核通过方可使用</div>
              </div>
            </template>

            <div v-if="registered" style="text-align:center;padding:32px 0">
              <CheckCircleFilled style="font-size:56px;color:#52c41a;margin-bottom:16px" />
              <div style="font-size:18px;font-weight:600;margin-bottom:8px">注册成功！</div>
              <div style="color:#666;margin-bottom:4px">公司：<b>{{ registeredCompany }}</b></div>
              <div style="color:#666;margin-bottom:24px">账号：<b>{{ registeredUser }}</b></div>
              <a-tag color="orange" style="font-size:13px;padding:4px 12px;margin-bottom:20px">⏳ 等待管理员审核</a-tag>
              <br />
              <router-link to="/login">
                <a-button type="primary">去登录</a-button>
              </router-link>
            </div>

            <a-form v-else :model="form" @finish="register" layout="vertical">
              <a-form-item
                label="公司名称"
                name="company_name"
                :rules="[{ required: true, message: '请输入公司名称' }]"
              >
                <a-input v-model:value="form.company_name" size="large" placeholder="输入公司名称">
                  <template #prefix><BankOutlined /></template>
                </a-input>
              </a-form-item>

              <a-form-item
                label="用户名"
                name="username"
                :rules="[
                  { required: true, message: '请输入用户名' },
                  { min: 3, message: '用户名至少3个字符' },
                ]"
              >
                <a-input v-model:value="form.username" size="large" placeholder="输入用户名">
                  <template #prefix><UserOutlined /></template>
                </a-input>
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]"
              >
                <a-input-password v-model:value="form.password" size="large" placeholder="输入密码">
                  <template #prefix><LockOutlined /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item
                label="确认密码"
                name="confirmPassword"
                :rules="[
                  { required: true, message: '请确认密码' },
                  { validator: validateConfirm, message: '两次密码不一致' },
                ]"
              >
                <a-input-password v-model:value="form.confirmPassword" size="large" placeholder="再次输入密码">
                  <template #prefix><LockOutlined /></template>
                </a-input-password>
              </a-form-item>

              <a-form-item>
                <a-button type="primary" html-type="submit" block size="large" :loading="loading">
                  提交注册
                </a-button>
              </a-form-item>
            </a-form>

            <div v-if="!registered" style="text-align:center;margin-top:8px">
              已有账号？
              <router-link to="/login">去登录</router-link>
            </div>
          </a-card>
        </div>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { UserOutlined, LockOutlined, BankOutlined, CheckCircleFilled } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const loading = ref(false)
const registered = ref(false)
const registeredCompany = ref('')
const registeredUser = ref('')

const form = reactive({
  company_name: '',
  username: '',
  password: '',
  confirmPassword: '',
})

function validateConfirm(_rule: any, value: string) {
  if (value !== form.password) {
    return Promise.reject('两次密码不一致')
  }
  return Promise.resolve()
}

async function register() {
  loading.value = true
  try {
    const res = await api.post('/auth/register', {
      company_name: form.company_name,
      username: form.username,
      password: form.password,
    })
    registeredCompany.value = form.company_name
    registeredUser.value = form.username
    registered.value = true
  } catch (err: any) {
    message.error(err.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
.register-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.register-card {
  width: 100%;
  max-width: 440px;
}
</style>
