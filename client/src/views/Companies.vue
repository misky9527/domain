<template>
  <div>
    <el-card>
      <div slot="header" style="display: flex; justify-content: space-between; align-items: center">
        <span>公司管理</span>
        <el-button v-if="isSuperAdmin" type="primary" size="small" @click="showCreateDialog = true">创建公司</el-button>
      </div>

      <el-table :data="companies" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="公司名称" min-width="200" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="viewCompany(row)">用户管理</el-button>
            <el-button v-if="isSuperAdmin" size="small" type="warning" link @click="editCompany(row)">编辑</el-button>
            <el-button v-if="isSuperAdmin" size="small" type="danger" link @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Create company dialog -->
    <el-dialog v-model="showCreateDialog" title="创建公司" width="400px">
      <el-form :model="companyForm">
        <el-form-item label="公司名称">
          <el-input v-model="companyForm.name" placeholder="输入公司名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createCompany" :loading="saving">创建</el-button>
      </template>
    </el-dialog>

    <!-- Edit company dialog -->
    <el-dialog v-model="showEditDialog" title="编辑公司" width="400px">
      <el-form :model="editForm">
        <el-form-item label="公司名称">
          <el-input v-model="editForm.name" placeholder="输入公司名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateCompany" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const companies = ref([])
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const companyForm = ref({ name: '' })
const editForm = ref({ id: 0, name: '' })

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const isSuperAdmin = computed(() => user.value.role === 'super_admin')

onMounted(() => {
  loadCompanies()
})

async function loadCompanies() {
  loading.value = true
  try {
    const res = await api.get('/companies')
    companies.value = res.data.companies
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function createCompany() {
  if (!companyForm.value.name) {
    ElMessage.warning('公司名称不能为空')
    return
  }
  saving.value = true
  try {
    await api.post('/companies', { name: companyForm.value.name })
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    companyForm.value.name = ''
    loadCompanies()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '创建失败')
  } finally {
    saving.value = false
  }
}

function editCompany(row: any) {
  editForm.value = { id: row.id, name: row.name }
  showEditDialog.value = true
}

async function updateCompany() {
  if (!editForm.value.name) {
    ElMessage.warning('公司名称不能为空')
    return
  }
  saving.value = true
  try {
    await api.put(`/companies/${editForm.value.id}`, { name: editForm.value.name })
    ElMessage.success('更新成功')
    showEditDialog.value = false
    loadCompanies()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '更新失败')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除公司「${row.name}」？此操作不可撤销。`, '确认', { type: 'warning' })
    await api.delete(`/companies/${row.id}`)
    ElMessage.success('删除成功')
    loadCompanies()
  } catch {}
}

function viewCompany(row: any) {
  router.push(`/companies/${row.id}`)
}

function formatDate(date: string) {
  if (!date) return '-'
  return date.split('T')[0] || date.substring(0, 10)
}
</script>
