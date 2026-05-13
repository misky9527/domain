<template>
  <div>
    <a-button style="margin-bottom: 16px" @click="$router.push('/')">
      <template #icon><ArrowLeftOutlined /></template>
      返回
    </a-button>

    <a-card title="DNS 服务商管理" style="margin-bottom: 20px">
      <template #extra>
        <a-button type="primary" size="small" @click="openAdd">
          <template #icon><PlusOutlined /></template>
          新增
        </a-button>
      </template>

      <a-table
        :data-source="providers"
        :columns="columns"
        :loading="loading"
        :pagination="false"
        size="small"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'domain'">
            <span style="font-family:monospace;color:#333">{{ record.domain }}</span>
          </template>
          <template v-if="column.key === 'name'">
            <a-tag color="blue">{{ record.name }}</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button type="link" danger size="small" @click="confirmDelete(record)">删除</a-button>
          </template>
        </template>
      </a-table>

      <a-empty v-if="!loading && providers.length === 0" description="暂无数据，点击右上角新增" />
    </a-card>

    <!-- Add/Edit modal -->
    <a-modal
      v-model:visible="modalVisible"
      :title="editingId ? '编辑服务商' : '新增服务商'"
      @ok="handleSave"
      :confirmLoading="saving"
      okText="保存"
      cancelText="取消"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="DNS 域名">
          <a-input
            v-model:value="form.domain"
            placeholder="例如: xundns.com"
            @input="form.domain = form.domain.toLowerCase().replace(/[^a-z0-9.\-]/g, '')"
          />
          <div style="font-size:11px;color:#999;margin-top:4px">
            输入 NS 服务器的根域名，系统会自动匹配子域名（如 ns1.xundns.com → xundns.com）
          </div>
        </a-form-item>
        <a-form-item label="服务商名称">
          <a-input v-model:value="form.name" placeholder="例如: 讯DNS" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons-vue'
import api from '../utils/axios'
import { message, Modal } from 'ant-design-vue'

const providers = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({ domain: '', name: '' })

const columns = [
  { title: 'DNS 域名', dataIndex: 'domain', key: 'domain' },
  { title: '服务商', dataIndex: 'name', key: 'name', width: 200 },
  { title: '操作', key: 'action', width: 140 },
]

onMounted(loadProviders)

async function loadProviders() {
  loading.value = true
  try {
    const res = await api.get('/dns-providers')
    providers.value = res.data.providers
  } catch {
    message.error('加载失败')
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  form.domain = ''
  form.name = ''
  modalVisible.value = true
}

function openEdit(record: any) {
  editingId.value = record.id
  form.domain = record.domain
  form.name = record.name
  modalVisible.value = true
}

async function handleSave() {
  if (!form.domain.trim() || !form.name.trim()) {
    message.warning('请填写完整')
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await api.put(`/dns-providers/${editingId.value}`, form)
      message.success('更新成功')
    } else {
      await api.post('/dns-providers', form)
      message.success('添加成功')
    }
    modalVisible.value = false
    loadProviders()
  } catch (err: any) {
    message.error(err.response?.data?.error || '操作失败')
  } finally {
    saving.value = false
  }
}

async function confirmDelete(record: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除 ${record.domain} → ${record.name}？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await api.delete(`/dns-providers/${record.id}`)
      message.success('删除成功')
      loadProviders()
    },
  })
}
</script>
