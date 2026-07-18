<template>
  <div class="layout">
    <el-container>
      <el-aside width="200px">
        <div class="logo">
          <h2>商家后台</h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409eff"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>工作台</span>
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            <span>任务管理</span>
          </el-menu-item>
          <el-menu-item index="/submissions">
            <el-icon><Document /></el-icon>
            <span>提交审核</span>
          </el-menu-item>
          <el-menu-item index="/withdrawals">
            <el-icon><Money /></el-icon>
            <span>提现审核</span>
          </el-menu-item>
          <el-menu-item index="/recharges">
            <el-icon><Coin /></el-icon>
            <span>充值管理</span>
          </el-menu-item>
          <el-menu-item index="/audit-logs">
            <el-icon><Tickets /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
          <el-menu-item index="/risk-users">
            <el-icon><Warning /></el-icon>
            <span>风险用户</span>
          </el-menu-item>
          <el-menu-item index="/users">
            <el-icon><UserFilled /></el-icon>
            <span>用户权限</span>
          </el-menu-item>
          <el-menu-item index="/staffs">
            <el-icon><User /></el-icon>
            <span>员工管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header>
          <div class="header-content">
            <div class="breadcrumb">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
                <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
              </el-breadcrumb>
            </div>
            <div class="user-info">
              <el-dropdown @command="handleCommand">
                <span class="user-name">
                  {{ authStore.userInfo.username || '管理员' }}
                  <el-icon><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-header>

        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessageBox } from 'element-plus'
import { ArrowDown, Coin, DataAnalysis, Document, List, Money, Tickets, User, UserFilled, Warning } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => {
  const titles = {
    '/dashboard': '工作台',
    '/tasks': '任务管理',
    '/submissions': '提交审核',
    '/withdrawals': '提现审核',
    '/recharges': '充值管理',
    '/audit-logs': '操作日志',
    '/risk-users': '风险用户',
    '/users': '用户权限',
    '/staffs': '员工管理'
  }
  return titles[route.path] || ''
})

const handleCommand = (command) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确认退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      authStore.logout()
      router.push('/login')
    })
  }
}
</script>

<style scoped>
.layout {
  width: 100%;
  height: 100vh;
}

.el-container {
  height: 100%;
}

.el-aside {
  background: #304156;
  height: 100vh;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2b3a4a;
}

.logo h2 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.el-menu {
  border: none;
}

.el-header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0 20px;
}

.header-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-name {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.el-main {
  background: #f5f7fa;
  padding: 20px;
}
</style>
