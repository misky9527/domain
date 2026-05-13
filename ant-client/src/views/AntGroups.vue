<template>
  <div>
    <h2 style="margin-bottom: 20px">分组管理</h2>

    <a-card>
      <template #title>
        <div style="display: flex; justify-content: space-between">
          <span>分组列表</span>
          <a-button type="primary" size="small" @click="showCreateDialog">
            <template #icon><PlusOutlined /></template>
            新建分组
          </a-button>
        </div>
      </template>
      <a-table :data-source="groups" :columns="columns" :loading="loading" :pagination="false" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'created_at'">
            {{ record.created_at }}
          </template>
          <template v-if="column.key === 'action'">
            <template v-if="!record.is_default">
              <a-button type="link" size="small" @click="editGroup(record)">编辑</a-button>
              <a-popconfirm
                title="确定删除此分组？"
                @confirm="deleteGroup(record)"
                ok-text="删除"
                ok-type="danger"
                cancel-text="取消"
              >
                <a-button type="link" danger size="small">删除</a-button>
              </a-popconfirm>
            </template>
            <a-tag v-else color="default" size="small">默认组</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="showDialog"
      :title="editing ? '编辑分组' : '新建分组'"
      @ok="saveGroup"
      :confirm-loading="saving"
      ok-text="保存"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称" name="name" :rules="[{ required: true, message: '请输入分组名称' }]">
          <a-input v-model:value="form.name" placeholder="分组名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

const loading = ref(false)
const saving = ref(false)
const groups = ref([])
const showDialog = ref(false)
const editing = ref(false)
const editId = ref<number | null>(null)
const form = ref({ name: '' })

const columns = [
  { title: '分组名称', dataIndex: 'name', key: 'name' },
  { title: '域名数量', dataIndex: 'domain_count', key: 'domain_count', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 200 },
]

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

function showCreateDialog() {
  editing.value = false
  editId.value = null
  form.value = { name: '' }
  showDialog.value = true
}

function editGroup(row: any) {
  editing.value = true
  editId.value = row.id
  form.value = { name: row.name }
  showDialog.value = true
}

async function saveGroup() {
  if (!form.value.name) {
    message.warning('请输入分组名称')
    return
  }
  saving.value = true
  try {
    if (editing.value && editId.value) {
      await api.put(`/groups/${editId.value}`, { name: form.value.name })
      message.success('更新成功')
    } else {
      await api.post('/groups', { name: form.value.name })
      message.success('创建成功')
    }
    showDialog.value = false
    loadGroups()
  } catch (err: any) {
    message.error(err.response?.data?.error || '操作失败')
  } finally {
    saving.value = false
  }
}

async function deleteGroup(row: any) {
  try {
    await api.delete(`/groups/${row.id}`)
    message.success('删除成功')
    loadGroups()
  } catch (err: any) {
    message.error(err.response?.data?.error || '删除失败')
  }
}
</script>
