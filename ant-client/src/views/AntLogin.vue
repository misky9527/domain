<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 8,
        borderRadiusLG: 12,
        controlHeight: 40,
        controlHeightLG: 48,
        colorBgContainer: '#ffffff',
      },
    }"
  >
    <div class="ant-login-page">
      <div class="ant-login-bg">
        <div class="ant-blob ant-blob-1"></div>
        <div class="ant-blob ant-blob-2"></div>
        <div class="ant-blob ant-blob-3"></div>

        <div class="ant-login-container">
          <header class="ant-login-brand">
            <div>
              <div class="ant-login-logo">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h1 class="ant-login-brand-title">DomainManage</h1>
              <p class="ant-login-brand-desc">一站式域名管理平台</p>

              <ul class="ant-login-features">
                <li><span class="ant-feature-dot"></span>多公司权限管理</li>
                <li><span class="ant-feature-dot"></span>自动到期提醒</li>
                <li><span class="ant-feature-dot"></span>DNS / SSL 实时检测</li>
              </ul>
            </div>
          </header>

          <section class="ant-login-form-section">
            <a-card :bordered="false" class="ant-login-card">
              <h2 class="ant-login-form-title">登录</h2>
              <p class="ant-login-form-subtitle">欢迎回来，请登录您的账号</p>

              <a-form :model="form" @finish="login" layout="vertical">
                <a-form-item label="用户名" name="username">
                  <a-input v-model:value="form.username" size="large" placeholder="用户名">
                    <template #prefix><UserOutlined /></template>
                  </a-input>
                </a-form-item>

                <a-form-item label="密码" name="password">
                  <a-input-password v-model:value="form.password" size="large" placeholder="密码">
                    <template #prefix><LockOutlined /></template>
                  </a-input-password>
                </a-form-item>

                <a-form-item>
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <a-checkbox v-model:checked="remember">记住我</a-checkbox>
                    <router-link to="/register" style="color:#1677ff">注册账号</router-link>
                  </div>
                </a-form-item>

                <a-form-item>
                  <a-button type="primary" html-type="submit" block size="large" :loading="loading">
                    登 录
                  </a-button>
                </a-form-item>
              </a-form>
            </a-card>

            <div style="text-align:center;margin-top:16px">
            </div>
            <footer style="margin-top:16px;font-size:12px;color:#bbb;text-align:center">DomainManage · Ant Design 风格</footer>
          </section>
        </div>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message } from 'ant-design-vue'

const router = useRouter()
const loading = ref(false)
const remember = ref(false)
const form = reactive({ username: 'admin', password: '' })

async function login() {
  if (!form.username || !form.password) {
    message.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await api.post('/auth/login', form)
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    message.success('登录成功')
    router.push('/')
  } catch (err: any) {
    message.error(err.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ant-login-page {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
}

.ant-login-bg {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

.ant-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.12;
  pointer-events: none;
}

.ant-blob-1 { width: 400px; height: 400px; background: #1677ff; top: -120px; left: -80px; }
.ant-blob-2 { width: 280px; height: 280px; background: #722ed1; bottom: -60px; right: 12%; }
.ant-blob-3 { width: 180px; height: 180px; background: #13c2c2; top: 50%; right: -50px; }

.ant-login-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  min-height: 560px;
  position: relative;
  z-index: 1;
}

.ant-login-brand {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 48px 40px;
}

.ant-login-logo {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #1677ff, #0958d9);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 24px;
}

.ant-login-brand-title {
  font-size: 28px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0 0 8px;
}

.ant-login-brand-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 40px;
}

.ant-login-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ant-login-features li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #333;
}

.ant-feature-dot {
  width: 8px;
  height: 8px;
  background: #1677ff;
  border-radius: 50%;
  flex-shrink: 0;
}

.ant-login-form-section {
  width: 420px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px 0;
}

.ant-login-card {
  padding: 32px 32px 16px;
  border-radius: 12px;
}

.ant-login-form-title {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 4px;
  text-align: center;
}

.ant-login-form-subtitle {
  font-size: 14px;
  color: #999;
  margin: 0 0 28px;
  text-align: center;
}

/* Fix: ensure antd large input gets proper styling */
.ant-login-form-section :deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  padding: 4px 12px;
}

.ant-login-form-section :deep(.ant-input-affix-wrapper-lg) {
  padding: 8px 12px;
}

.ant-login-form-section :deep(.ant-input-prefix) {
  margin-right: 8px;
}

.ant-login-form-section :deep(.ant-btn-lg) {
  height: 48px;
  border-radius: 8px;
  font-size: 16px;
}

.ant-login-form-section :deep(.ant-form-item) {
  margin-bottom: 20px;
}

@media (max-width: 860px) {
  .ant-login-container { flex-direction: column; max-width: 420px; }
  .ant-login-brand { padding: 32px 24px; max-width: 100%; }
  .ant-login-form-section { width: 100%; padding: 0 0 40px; }
  .ant-login-features { display: none; }
}
</style>
