<template>
  <div style="max-width: 400px; margin: 100px auto">
    <el-card>
      <h2 style="text-align: center; margin-bottom: 20px">注册账号</h2>
      <p style="text-align: center; font-size: 13px; color: #999; margin-bottom: 20px">注册后需管理员审核通过方可使用</p>

      <div v-if="registered" style="text-align:center;padding:32px 0">
        <el-icon :size="56" color="#67c23a" style="margin-bottom:16px"><CircleCheckFilled /></el-icon>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">注册成功！</div>
        <div style="color:#666;margin-bottom:4px">公司：<b>{{ registeredCompany }}</b></div>
        <div style="color:#666;margin-bottom:24px">账号：<b>{{ registeredUser }}</b></div>
        <el-tag type="warning" style="font-size:13px;padding:4px 12px;margin-bottom:20px">⏳ 等待管理员审核</el-tag>
        <br />
        <router-link to="/login">
          <el-button type="primary">去登录</el-button>
        </router-link>
      </div>

      <el-form v-else :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="公司名称" prop="company_name">
          <el-input v-model="form.company_name" placeholder="输入公司名称">
            <template #prefix><el-icon><OfficeBuilding /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password @keyup.enter="register" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%" :loading="loading" @click="register">提交注册</el-button>
        </el-form-item>
      </el-form>
      <div v-if="!registered" style="text-align: center; margin-top: 8px">
        已有账号？
        <router-link to="/login">去登录</router-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheckFilled, OfficeBuilding } from '@element-plus/icons-vue'
import api from '../utils/axios'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const registered = ref(false)
const registeredCompany = ref('')
const registeredUser = ref('')
const formRef = ref<FormInstance>()

const form = reactive({
  company_name: '',
  username: '',
  password: '',
  confirmPassword: '',
})

const rules: FormRules = {
  company_name: [{ required: true, message: '请输入公司名称', trigger: 'blur' }],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== form.password) {
          callback(new Error('两次密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function register() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
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
    ElMessage.error(err.response?.data?.error || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>
