<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="logo-area">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 class="title">DomainManage</h1>
          <p class="subtitle">一站式域名管理平台</p>
        </div>

        <div class="form-area">
          <div class="input-group">
            <div class="input-field">
              <input
                v-model="form.username"
                type="text"
                placeholder=" "
                autocomplete="username"
                @keyup.enter="login"
                @focus="focusedField = 'username'"
                @blur="focusedField = ''"
              />
              <label :class="{ 'float-up': form.username || focusedField === 'username' }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 4-7 8-7s8 3 8 7"/>
                </svg>
                用户名
              </label>
            </div>
          </div>

          <div class="input-group">
            <div class="input-field">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder=" "
                autocomplete="current-password"
                @keyup.enter="login"
                @focus="focusedField = 'password'"
                @blur="focusedField = ''"
              />
              <label :class="{ 'float-up': form.password || focusedField === 'password' }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                密码
              </label>
              <button class="toggle-pw" @click="showPassword = !showPassword" type="button" tabindex="-1">
                <svg v-if="!showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <button class="login-btn" :class="{ loading: loading }" :disabled="loading" @click="login">
            <span v-if="!loading">登 录</span>
            <span v-else class="spinner"></span>
          </button>
        </div>

        <div class="footer-links">
          <router-link to="/register" style="margin-right: 16px">注册账号</router-link>
          <a href="http://43.165.183.130:5174" style="color: #86868b; font-size: 12px" target="_blank">Ant Design 风格对比 →</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)
const focusedField = ref('')
const form = reactive({ username: 'admin', password: '' })

async function login() {
  if (!form.username || !form.password) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await api.post('/auth/login', form)
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    ElMessage.success('登录成功')
    router.push('/')
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f0 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
}

.login-container {
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.login-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 48px 40px 36px;
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.04),
    0 8px 40px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease;
}

.logo-area {
  text-align: center;
  margin-bottom: 40px;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, #007aff, #5856d6);
  color: white;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
}

.title {
  font-size: 26px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0 0 4px;
  letter-spacing: -0.5px;
}

.subtitle {
  font-size: 14px;
  color: #86868b;
  margin: 0;
  font-weight: 400;
}

.form-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  position: relative;
}

.input-field {
  position: relative;
}

.input-field input {
  width: 100%;
  height: 52px;
  padding: 20px 16px 6px;
  border: 1.5px solid #d2d2d7;
  border-radius: 12px;
  font-size: 16px;
  color: #1d1d1f;
  background: rgba(255, 255, 255, 0.9);
  outline: none;
  transition: all 0.2s ease;
  font-family: inherit;
}

.input-field input:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

.input-field label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  color: #86868b;
  pointer-events: none;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  line-height: 1;
}

.input-field label.float-up {
  top: 12px;
  transform: translateY(0);
  font-size: 12px;
  color: #007aff;
}

.toggle-pw {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #86868b;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.toggle-pw:hover {
  opacity: 1;
}

.login-btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #007aff, #5856d6);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 2px;
  font-family: inherit;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-btn.loading {
  background: linear-gradient(135deg, #007aff, #5856d6);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.footer-links {
  text-align: center;
  margin-top: 28px;
}

.footer-links a {
  color: #86868b;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}

.footer-links a:hover {
  color: #007aff;
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px 28px;
    border-radius: 20px;
  }
  .title {
    font-size: 22px;
  }
}
</style>
