<template>
  <div>
    <h2 style="margin-bottom: 20px">分组管理</h2>
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <span>分组列表</span>
          <el-button type="primary" size="small" @click="showDialog = true">新建分组</el-button>
        </div>
      </template>
      <el-table :data="groups" v-loading="loading">
        <el-table-column prop="name" label="分组名称" />
        <el-table-column prop="domain_count" label="域名数量" width="120" />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ row.created_at }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="editGroup(row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="deleteGroup(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog -->
    <el-dialog v-model="showDialog" :title="editing ? '编辑分组' : '新建分组'" width="400px">
      <el-form :model="form">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="分组名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveGroup" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import api from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const groups = ref([])
const showDialog = ref(false)
const editing = ref(false)
const editId = ref<number | null>(null)
const form = reactive({ name: '' })

onMounted(() => loadGroups())

async function loadGroups() {
  loading.value = true
  try {
    const res = await api.get('/groups')
    groups.value = res.data.groups
  } finally {
    loading.value = false
  }
}

function editGroup(row: any) {
  editing.value = true
  editId.value = row.id
  form.name = row.name
  showDialog.value = true
}

async function saveGroup() {
  if (!form.name) {
    ElMessage.warning('请输入分组名称')
    return
  }
  saving.value = true
  try {
    if (editing.value && editId.value) {
      await api.put(`/groups/${editId.value}`, { name: form.name })
      ElMessage.success('更新成功')
    } else {
      await api.post('/groups', { name: form.name })
      ElMessage.success('创建成功')
    }
    showDialog.value = false
    form.name = ''
    editing.value = false
    editId.value = null
    loadGroups()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteGroup(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除分组「${row.name}」？分组内的域名将变为未分组。`, '确认')
    await api.delete(`/groups/${row.id}`)
    ElMessage.success('删除成功')
    loadGroups()
  } catch {}
}
</script>
