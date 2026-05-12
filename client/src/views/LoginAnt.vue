<template>
  <article class="antv6-page">
    <div class="antv6-bg">
      <!-- Decorative gradient blobs (v6 style: AI-friendly modern) -->
      <div class="antv6-blob antv6-blob-1"></div>
      <div class="antv6-blob antv6-blob-2"></div>
      <div class="antv6-blob antv6-blob-3"></div>

      <div class="antv6-container">
        <!-- Left: Brand -->
        <header class="antv6-brand">
          <div class="antv6-brand-inner">
            <div class="antv6-logo">
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 class="antv6-brand-title">DomainKeeper</h1>
            <p class="antv6-brand-desc">一站式域名管理平台</p>

            <div class="antv6-features">
              <div class="antv6-feature-item">
                <span class="antv6-feature-dot"></span>
                <div>
                  <strong>多公司权限</strong>
                  <p>分公司管理，角色权限灵活分配</p>
                </div>
              </div>
              <div class="antv6-feature-item">
                <span class="antv6-feature-dot"></span>
                <div>
                  <strong>自动到期提醒</strong>
                  <p>30/15/7/3/1 天阶梯提醒</p>
                </div>
              </div>
              <div class="antv6-feature-item">
                <span class="antv6-feature-dot"></span>
                <div>
                  <strong>智能检测</strong>
                  <p>DNS / SSL 实时监控</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Right: Form -->
        <section class="antv6-form-section">
          <div class="antv6-form-card">
            <h2 class="antv6-form-title">登录</h2>
            <p class="antv6-form-subtitle">欢迎回来，请登录您的账号</p>

            <form @submit.prevent="login" class="antv6-form">
              <div class="antv6-field">
                <label class="antv6-label">用户名</label>
                <div class="antv6-input-affix" :class="{ focused: focusedField === 'username' }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 4-7 8-7s8 3 8 7"/>
                  </svg>
                  <input
                    v-model="form.username"
                    type="text"
                    placeholder="请输入用户名"
                    autocomplete="username"
                    @focus="focusedField = 'username'"
                    @blur="focusedField = ''"
                  />
                </div>
              </div>

              <div class="antv6-field">
                <label class="antv6-label">密码</label>
                <div class="antv6-input-affix" :class="{ focused: focusedField === 'password' }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <input
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
                    autocomplete="current-password"
                    @focus="focusedField = 'password'"
                    @blur="focusedField = ''"
                  />
                  <button class="antv6-pw-toggle" @click="showPassword = !showPassword" type="button" tabindex="-1">
                    <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="antv6-options">
                <label class="antv6-checkbox">
                  <input type="checkbox" v-model="remember" />
                  <span class="antv6-checkbox-inner"></span>
                  <span>记住我</span>
                </label>
                <router-link to="/register" class="antv6-link">注册账号</router-link>
              </div>

              <button type="submit" class="antv6-btn" :class="{ loading }" :disabled="loading">
                <span v-if="!loading">登 录</span>
                <span v-else class="antv6-spinner"></span>
              </button>
            </form>
          </div>
          <footer class="antv6-footer">
            <span>DomainKeeper v2</span>
            <span class="antv6-footer-dot">·</span>
            <span>Ant Design 6.0 风格</span>
          </footer>
        </section>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)
const remember = ref(false)
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

/* ===== Page ===== */
.antv6-page {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
}

.antv6-bg {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

/* ===== Decorative blobs (v6 AI-friendly style) ===== */
.antv6-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.15;
  pointer-events: none;
}

.antv6-blob-1 {
  width: 400px;
  height: 400px;
  background: #1677ff;
  top: -100px;
  left: -100px;
}

.antv6-blob-2 {
  width: 300px;
  height: 300px;
  background: #722ed1;
  bottom: -50px;
  right: 10%;
}

.antv6-blob-3 {
  width: 200px;
  height: 200px;
  background: #13c2c2;
  top: 40%;
  right: -60px;
}

/* ===== Container ===== */
.antv6-container {
  display: flex;
  width: 100%;
  max-width: 1040px;
  min-height: 600px;
  position: relative;
  z-index: 1;
}

/* ===== Left Brand ===== */
.antv6-brand {
  flex: 1;
  padding: 64px 48px;
  display: flex;
  align-items: center;
}

.antv6-brand-inner {
  max-width: 360px;
}

.antv6-logo {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 24px;
}

.antv6-brand-title {
  font-size: 30px;
  font-weight: 700;
  color: #1d1d1f;
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}

.antv6-brand-desc {
  font-size: 15px;
  color: #666;
  margin-bottom: 48px;
}

.antv6-features {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.antv6-feature-item {
  display: flex;
  gap: 16px;
}

.antv6-feature-dot {
  width: 8px;
  height: 8px;
  background: #1677ff;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.antv6-feature-item strong {
  display: block;
  font-size: 15px;
  color: #1d1d1f;
  margin-bottom: 2px;
}

.antv6-feature-item p {
  font-size: 13px;
  color: #999;
  margin: 0;
}

/* ===== Right Form ===== */
.antv6-form-section {
  width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.antv6-form-card {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 40px 40px 32px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 2px 12px rgba(0, 0, 0, 0.04);
}

.antv6-form-title {
  font-size: 24px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 4px;
}

.antv6-form-subtitle {
  font-size: 14px;
  color: #999;
  margin: 0 0 32px;
}

/* ===== Fields ===== */
.antv6-form {
  display: flex;
  flex-direction: column;
}

.antv6-field {
  margin-bottom: 24px;
}

.antv6-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.antv6-input-affix {
  display: flex;
  align-items: center;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background: #fff;
  transition: all 0.2s ease;
  padding: 0 12px;
}

.antv6-input-affix:hover {
  border-color: #1677ff;
}

.antv6-input-affix.focused {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.08);
}

.antv6-input-affix svg {
  color: #bfbfbf;
  flex-shrink: 0;
  transition: color 0.2s;
}

.antv6-input-affix.focused svg {
  color: #1677ff;
}

.antv6-input-affix input {
  flex: 1;
  height: 42px;
  border: none;
  outline: none;
  padding: 0 10px;
  font-size: 14px;
  color: #333;
  background: transparent;
  font-family: inherit;
}

.antv6-input-affix input::placeholder {
  color: #bfbfbf;
}

.antv6-pw-toggle {
  background: none;
  border: none;
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  display: flex;
  transition: color 0.2s;
}

.antv6-pw-toggle:hover {
  color: #666;
}

/* ===== Options ===== */
.antv6-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}

.antv6-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  user-select: none;
  position: relative;
}

.antv6-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.antv6-checkbox-inner {
  width: 16px;
  height: 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.antv6-checkbox input:checked + .antv6-checkbox-inner {
  background: #1677ff;
  border-color: #1677ff;
}

.antv6-checkbox input:checked + .antv6-checkbox-inner::after {
  content: '';
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  margin-top: -2px;
}

.antv6-link {
  font-size: 14px;
  color: #1677ff;
  text-decoration: none;
  transition: color 0.2s;
}

.antv6-link:hover {
  color: #4096ff;
}

/* ===== Button ===== */
.antv6-btn {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 8px;
  background: #1677ff;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  letter-spacing: 1px;
}

.antv6-btn:hover:not(:disabled) {
  background: #4096ff;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.25);
}

.antv6-btn:active:not(:disabled) {
  background: #0958d9;
  box-shadow: none;
}

.antv6-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.antv6-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: antv6-spin 0.6s linear infinite;
}

@keyframes antv6-spin {
  to { transform: rotate(360deg); }
}

/* ===== Footer ===== */
.antv6-footer {
  margin-top: 24px;
  font-size: 12px;
  color: #bbb;
  display: flex;
  gap: 8px;
  align-items: center;
}

.antv6-footer-dot {
  color: #ddd;
}

/* ===== Responsive ===== */
@media (max-width: 900px) {
  .antv6-container {
    flex-direction: column;
    max-width: 480px;
  }
  .antv6-brand {
    padding: 40px 24px 24px;
  }
  .antv6-form-section {
    width: 100%;
    padding: 0 0 40px;
  }
  .antv6-form-card {
    padding: 32px 24px;
  }
  .antv6-features {
    display: none;
  }
}
</style>
