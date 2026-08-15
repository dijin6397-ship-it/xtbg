<template>
  <div class="landing">
    <div class="landing-topbar">
      <img :src="logoImg" alt="Logo" class="topbar-logo" />
    </div>
    <div class="hero">
      <div class="hero-content">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="#1677ff"/>
          <path d="M18 24h10v16H18zM30 18h10v22H30zM42 28h10v14h-10z" fill="#fff"/>
        </svg>
        <h1>上海中车申通长客轨道交通车辆有限公司</h1>
        <p>协同办公平台</p>
        <div class="hero-actions">
          <button class="btn-hero" @click="goToAdmin">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            进入网页端
          </button>
          <button class="btn-hero-outline" @click="goToMobile">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            移动端
          </button>
        </div>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <div class="feature-icon" style="background:#e6f4ff;color:#1677ff">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h3>多路径任务管理</h3>
        <p>支持自主修、问题整改、现场质量问题分析三种任务路径</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:#f6ffed;color:#52c41a">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h3>分级审核流程</h3>
        <p>主管审核输出物，领导层最终确认，确保任务质量</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:#fff7e6;color:#fa8c16">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <h3>督办与追踪</h3>
        <p>实时追踪任务进度，支持催办、警告、升级督办</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon" style="background:#f9f0ff;color:#722ed1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <h3>多端适配</h3>
        <p>网页端与移动端统一接口，随时随地处理任务</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import logoImg from '../assets/logo.jpg'

const router = useRouter()

function goToAdmin() {
  const token = localStorage.getItem('token')
  if (token) {
    router.push('/admin/dashboard')
  } else {
    router.push('/admin/login')
  }
}

function goToMobile() {
  router.push('/admin/login?from=mobile')
}
</script>

<style scoped>
.landing-topbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}
.topbar-logo { height: 36px; object-fit: contain; }
.landing { min-height: 100vh; background: #f5f7fa; }

.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 80px 20px;
  text-align: center;
  color: #fff;
}
.hero-content { max-width: 700px; margin: 0 auto; }
.hero-content svg { margin-bottom: 24px; }
.hero-content h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px; white-space: nowrap; letter-spacing: 2px; }
.hero-content p { font-size: 24px; font-weight: 500; opacity: 0.95; margin: 0 0 32px; letter-spacing: 4px; }
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

.btn-hero {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 28px; background: #fff; color: #1677ff; border: none;
  border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.btn-hero:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
.btn-hero-outline {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 28px; background: transparent; color: rgba(255,255,255,0.9);
  border: 2px solid rgba(255,255,255,0.4); border-radius: 12px; font-size: 16px;
  font-weight: 600; cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
}
.btn-hero-outline:hover { transform: translateY(-2px); background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.7); }

.features {
  max-width: 960px; margin: -40px auto 0; padding: 0 20px 60px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;
  position: relative; z-index: 1;
}
.feature-card {
  background: #fff; border-radius: 16px; padding: 24px; text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
}
.feature-icon {
  width: 48px; height: 48px; border-radius: 12px;
  display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;
}
.feature-card h3 { font-size: 16px; font-weight: 600; color: #1d2129; margin: 0 0 8px; }
.feature-card p { font-size: 13px; color: #86909c; margin: 0; line-height: 1.6; }

@media (max-width: 768px) {
  .features { grid-template-columns: repeat(2, 1fr); }
  .hero-content h1 { font-size: 18px; letter-spacing: 1px; white-space: normal; }
  .hero-content p { font-size: 18px; letter-spacing: 2px; }
}
@media (max-width: 480px) {
  .features { grid-template-columns: 1fr; }
}
</style>
