<template>
  <div class="supervision-page">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-icon red"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.overdue }}</div><div class="stat-label">已逾期</div></div>
      </div>
      <div class="stat-card"><div class="stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.urgeCount }}</div><div class="stat-label">催办次数</div></div>
      </div>
      <div class="stat-card"><div class="stat-icon purple"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#722ed1" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
        <div class="stat-info"><div class="stat-value">{{ stats.escalatedCount }}</div><div class="stat-label">已升级</div></div>
      </div>
    </div>

    <div class="card table-card">
      <div v-if="logs.length === 0" class="empty-state">暂无督办记录</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead><tr><th>类型</th><th>任务</th><th>操作人</th><th>责任人</th><th>内容</th><th>时间</th></tr></thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td><span class="tag" :class="'type-' + log.type">{{ { urge: '催办', warn: '警告', escalate: '升级' }[log.type] }}</span></td>
              <td class="cell-title">{{ log.taskTitle }}</td>
              <td>{{ log.operator?.name }}</td>
              <td>{{ log.target?.name }}</td>
              <td class="cell-content">{{ log.content }}</td>
              <td class="cell-time">{{ log.time }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supervisionAPI } from '../../api/index.js'

const stats = ref({ overdue: 0, urgeCount: 0, warnCount: 0, escalatedCount: 0 })
const logs = ref([])

async function loadData() {
  try {
    const [statsData, logsData] = await Promise.all([supervisionAPI.stats(), supervisionAPI.list()])
    stats.value = statsData
    logs.value = logsData.logs
  } catch (e) {
    console.error(e)
  }
}

onMounted(loadData)
</script>

<style scoped>
.supervision-page { display: flex; flex-direction: column; gap: 20px; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-card { background: #fff; border-radius: var(--radius); padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon.red { background: #fff2f0; }
.stat-icon.orange { background: #fff7e6; }
.stat-icon.purple { background: #f9f0ff; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--text); line-height: 1.2; }
.stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.card { background: #fff; border-radius: var(--radius); box-shadow: 0 1px 4px rgba(0,0,0,0.04); overflow: hidden; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px; color: var(--text-secondary); font-size: 14px; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { text-align: left; padding: 12px 14px; color: var(--text-secondary); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; background: #fafbfc; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f5f7fa; color: var(--text); }
.data-table tbody tr:hover { background: #fafbfc; }
.cell-title { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.cell-content { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-time { white-space: nowrap; color: var(--text-secondary); }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.type-urge { color: #fa8c16; background: #fff7e6; }
.type-warn { color: #ff4d4f; background: #fff2f0; }
.type-escalate { color: #722ed1; background: #f9f0ff; }
@media (max-width: 768px) { .stats-row { grid-template-columns: 1fr; } }
</style>
