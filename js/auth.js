/**
 * 認證相關功能
 */

class Auth {
  constructor() {
      this.sessionToken = null;
      this.userInfo = null;
      this.sessionTimeout = null;
      this.autoLogoutWarning = null;

      this.init();
  }

  /** 初始化認證 */
  init() {
      this.loadSession();
      this.setupSessionMonitoring();

      if (this.isLoggedIn()) {
          this.validateSession();
      }
  }

  /** 載入儲存的會話 */
  loadSession() {
      try {
          const token = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
          const userInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO);

          if (token && userInfo) {
              this.sessionToken = token;
              this.userInfo = JSON.parse(userInfo);
          }
      } catch (error) {
          console.error('載入會話失敗:', error);
          this.clearSession();
      }
  }

  /** 儲存會話 */
  saveSession(token, userInfo, rememberMe = false) {
      try {
          this.sessionToken = token;
          this.userInfo = userInfo;

          if (rememberMe) {
              localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
              localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
              localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
          } else {
              sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, token);
              sessionStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userInfo));
          }

          this.setupSessionTimeout();

      } catch (error) {
          console.error('儲存會話失敗:', error);
      }
  }

  /** 清除會話 */
  clearSession() {
      this.sessionToken = null;
      this.userInfo = null;

      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_INFO);
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER_INFO);

      if (this.sessionTimeout) {
          clearTimeout(this.sessionTimeout);
          this.sessionTimeout = null;
      }
      if (this.autoLogoutWarning) {
          clearTimeout(this.autoLogoutWarning);
          this.autoLogoutWarning = null;
      }
  }

  /** 檢查是否已登入 */
  isLoggedIn() {
      return !!(this.sessionToken && this.userInfo);
  }

  /** 取得使用者資訊 */
  getUserInfo() {
      return this.userInfo;
  }

  /** 取得會話令牌 */
  getSessionToken() {
      return this.sessionToken;
  }

  /** 檢查使用者權限 */
  hasPermission(permission) {
      if (!this.userInfo) return false;
      if (this.userInfo.role === 'admin') return true;

      const permissions = {
          'users.manage': ['admin'],
          'products.manage': ['admin', 'manager'],
          'inventory.manage': ['admin', 'manager', 'operator'],
          'inbound.manage': ['admin', 'manager', 'operator'],
          'outbound.manage': ['admin', 'manager', 'operator'],
          'suppliers.manage': ['admin', 'manager'],
          'customers.manage': ['admin', 'manager'],
          'reports.view': ['admin', 'manager', 'operator']
      };

      const allowedRoles = permissions[permission] || [];
      return allowedRoles.includes(this.userInfo.role);
  }

  /** 設定會話超時 */
  setupSessionTimeout() {
      if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
      if (this.autoLogoutWarning) clearTimeout(this.autoLogoutWarning);

      this.autoLogoutWarning = setTimeout(() => {
          this.showLogoutWarning();
      }, CONFIG.SYSTEM.SESSION_TIMEOUT - CONFIG.SYSTEM.AUTO_LOGOUT_WARNING);

      this.sessionTimeout = setTimeout(() => {
          this.autoLogout();
      }, CONFIG.SYSTEM.SESSION_TIMEOUT);
  }

  /** 顯示登出警告 */
  showLogoutWarning() {
      const warningMessage = '您的會話即將過期，請儲存您的工作並重新登入。';
      showNotification('warning', '會話警告', warningMessage, 0);

      if (confirm('是否要延長會話時間？')) {
          this.extendSession();
      }
  }

  /** 自動登出 */
  autoLogout() {
      showNotification('info', '會話過期', '您的會話已過期，請重新登入。');
      this.logout();
  }

  /** 延長會話 */
  extendSession() {
      this.setupSessionTimeout();
      showNotification('success', '會話延長', '會話時間已延長。');
  }

  /** 設定會話監控 */
  setupSessionMonitoring() {
      document.addEventListener('visibilitychange', () => {
          if (!document.hidden && this.isLoggedIn()) {
              this.validateSession();
          }
      });

      let activityTimeout;
      const resetActivityTimeout = () => {
          clearTimeout(activityTimeout);
          activityTimeout = setTimeout(() => {
              if (this.isLoggedIn()) {
                  this.validateSession();
              }
          }, 60000);
      };

      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
          document.addEventListener(event, resetActivityTimeout, true);
      });

      resetActivityTimeout();
  }

  /** 驗證會話 */
  async validateSession() {
      if (!this.sessionToken) return false;
      try {
          const response = await this.apiCall('dashboard', 'GET');
          if (response.success) {
              this.setupSessionTimeout();
              return true;
          } else if (response.code === 'AUTH_REQUIRED') {
              this.clearSession();
              this.redirectToLogin();
              return false;
          }
          return false;
      } catch (error) {
          console.error('驗證會話失敗:', error);
          return false;
      }
  }

  /** 登入 */
  async login(username, password, rememberMe = false) {
      try {
          const response = await this.apiCall('login', 'POST', { username, password });
          if (response.success) {
              this.saveSession(response.sessionToken, response.user, rememberMe);
              showNotification('success', '登入成功', `歡迎回來，${response.user.username}！`);
              setTimeout(() => this.redirectToDashboard(), 1000);
              return true;
          } else {
              showNotification('error', '登入失敗', response.message);
              return false;
          }
      } catch (error) {
          console.error('登入錯誤:', error);
          showNotification('error', '登入失敗', '網路連線錯誤，請稍後再試。');
          return false;
      }
  }

  /** 登出 */
  async logout() {
      try {
          if (this.sessionToken) {
              await this.apiCall('logout', 'POST');
          }
      } catch (error) {
          console.error('登出錯誤:', error);
      } finally {
          this.clearSession();
          showNotification('info', '已登出', '您已成功登出系統。');
          this.redirectToLogin();
      }
  }

  /** API 呼叫（FormData 版本，避免 CORS） */
  async apiCall(endpoint, method = 'GET', data = null) {
      const url = new URL(CONFIG.GAS_URL);
      url.searchParams.set('path', 'api');
      url.searchParams.set('apiPath', endpoint);

      const fd = new FormData();
      fd.append('_method', method);
      if (this.sessionToken) fd.append('sessionToken', this.sessionToken);

      if (data && typeof data === 'object') {
          Object.keys(data).forEach(k => {
              const v = data[k];
              fd.append(k, (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
          });
      }

      const res = await fetch(url.toString(), { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
  }

  /** 跳轉到登入頁面 */
  redirectToLogin() {
      if (!window.location.pathname.endsWith('index.html')) {
          window.location.href = 'index.html';
      }
  }

  /** 跳轉到儀表板 */
  redirectToDashboard() {
      window.location.href = 'dashboard.html';
  }

  /** 需要登入 */
  requireAuth() {
      if (!this.isLoggedIn()) {
          this.redirectToLogin();
          return false;
      }
      return true;
  }

  /** 需要權限 */
  requirePermission(permission) {
      if (!this.requireAuth()) return false;
      if (!this.hasPermission(permission)) {
          showNotification('error', '權限不足', '您沒有權限執行此操作。');
          return false;
      }
      return true;
  }
}

// 建立全域認證實例
const auth = new Auth();
window.auth = auth;
