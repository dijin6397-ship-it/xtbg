<template>
  <div class="login-page">
    <img :src="logoImg" alt="Logo" class="login-logo" />
    <div class="login-card">
      <div class="login-header">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#1677ff"/>
          <path d="M14 18h8v12h-8zM24 14h8v16h-8zM34 22h8v8h-8z" fill="#fff"/>
        </svg>
        <h1>协同管理平台</h1>
        <p>企业协同管理与任务协同</p>
      </div>
      <div class="login-form">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="username" type="text" class="form-input" placeholder="请输入用户名" @keyup.enter="handleLogin" />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input v-model="password" type="password" class="form-input" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <button class="btn-login" @click="handleLogin" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </div>
      <div class="login-footer">
        <p>初始密码: 123456</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import logoImg from '../../assets/logo.jpg'
import { useRouter, useRoute } from 'vue-router'
import { login } from '../../store/auth.js'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  error.value = ''
  loading.value = true
  try {
    await login(username.value, password.value)
    router.push(route.query.from === 'mobile' ? '/m' : '/select-module')
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-logo {
  position: fixed;
  top: 16px;
  right: 24px;
  height: 36px;
  object-fit: contain;
  z-index: 10;
}
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}
.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  width: 400px;
  max-width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header svg {
  margin-bottom: 16px;
}
.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1d2129;
  margin: 0 0 8px;
}
.login-header p {
  font-size: 14px;
  color: #86909c;
  margin: 0;
}
.form-group {
  margin-bottom: 20px;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #1d2129;
  margin-bottom: 8px;
}
.form-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1d2129;
  background: #f7f8fa;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #1677ff;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.1);
}
.error-msg {
  color: #ff4d4f;
  font-size: 13px;
  margin-bottom: 16px;
  text-align: center;
}
.btn-login {
  width: 100%;
  height: 44px;
  background: #1677ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-login:hover:not(:disabled) {
  background: #4096ff;
}
.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.login-footer {
  margin-top: 24px;
  text-align: center;
}
.login-footer p {
  font-size: 12px;
  color: #c9cdd4;
  margin: 0;
}
</style>
