/**
 * 登入頁面功能（配合新版 auth.apiCall FormData）
 */

// 全域變數
let loginAttempts = 0;
let isLoggingIn = false;

document.addEventListener('DOMContentLoaded', function () {
  initLoginPage();
});

/** 初始化登入頁面 */
function initLoginPage() {
  // 若已登入就跳到儀表板
  if (auth.isLoggedIn()) {
    auth.redirectToDashboard();
    return;
  }

  loadRememberedLogin();
  setupFormEvents();
  setupPasswordToggle();
  setupAutocomplete();
  checkSystemInit(); // 可有可無，不影響登入
}

/** 載入「記住我」資訊 */
function loadRememberedLogin() {
  try {
    const remembered = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
    if (remembered === 'true') {
      const savedUsername = localStorage.getItem('warehouse_username');
      if (savedUsername) {
        const usernameEl = document.getElementById('username');
        const rememberEl = document.getElementById('rememberMe');
        if (usernameEl) usernameEl.value = savedUsername;
        if (rememberEl) rememberEl.checked = true;
      }
    }
  } catch (err) {
    console.error('載入記住的登入資訊失敗:', err);
  }
}

/** 綁定表單事件 */
function setupFormEvents() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  // 提交
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (isLoggingIn) return;
    await handleLogin();
  });

  // 輸入欄位：清錯誤、Enter 提交
  const inputs = loginForm.querySelectorAll('input[type="text"], input[type="password"]');
  inputs.forEach((input) => {
    input.addEventListener('input', function () {
      clearFieldError(this);
    });
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') loginForm.dispatchEvent(new Event('submit'));
    });
  });

  // 記住我變更
  const rememberEl = document.getElementById('rememberMe');
  if (rememberEl) {
    rememberEl.addEventListener('change', function () {
      if (!this.checked) localStorage.removeItem('warehouse_username');
    });
  }
}

/** 切換密碼顯示 */
function setupPasswordToggle() {
  const toggleBtn = document.querySelector('.toggle-password');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', togglePassword);
}

/** 欄位自動完成 */
function setupAutocomplete() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  if (usernameInput) usernameInput.setAttribute('autocomplete', 'username');
  if (passwordInput) passwordInput.setAttribute('autocomplete', 'current-password');
}

/** 系統初始化（呼叫 /init，不會影響登入流程） */
async function checkSystemInit() {
  try {
    const res = await auth.apiCall('init', 'GET');
    if (res && res.success) {
      console.log('系統初始化完成或已存在');
    }
  } catch (err) {
    console.warn('系統初始化檢查失敗（可忽略）:', err);
  }
}

/** 處理登入 */
async function handleLogin() {
  const usernameEl = document.getElementById('username');
  const passwordEl = document.getElementById('password');
  const rememberEl = document.getElementById('rememberMe');

  const username = (usernameEl?.value || '').trim();
  const password = passwordEl?.value || '';
  const rememberMe = !!(rememberEl && rememberEl.checked);

  if (!validateLoginInput(username, password)) return;

  isLoggingIn = true;
  setLoginButtonState(true);

  try {
    const ok = await auth.login(username, password, rememberMe);
    if (ok) {
      if (rememberMe) localStorage.setItem('warehouse_username', username);
      else localStorage.removeItem('warehouse_username');
      loginAttempts = 0;
    } else {
      // 登入失敗：累計次數
      loginAttempts++;
      if (loginAttempts >= CONFIG.SYSTEM.MAX_LOGIN_ATTEMPTS) {
        showNotification('error', '登入失敗', '登入嘗試次數過多，請稍後再試。');
        disableLoginForm();
      }
    }
  } catch (err) {
    console.error('登入處理錯誤:', err);
    showNotification('error', '登入失敗', '網路連線錯誤，請稍後再試。');
  } finally {
    isLoggingIn = false;
    setLoginButtonState(false);
  }
}

/** 驗證輸入 */
function validateLoginInput(username, password) {
  let isValid = true;
  clearAllErrors();

  if (!username) {
    showFieldError('username', '請輸入使用者名稱');
    isValid = false;
  } else if (username.length < 3) {
    showFieldError('username', '使用者名稱至少需要3個字元');
    isValid = false;
  }

  if (!password) {
    showFieldError('password', '請輸入密碼');
    isValid = false;
  } else if (password.length < CONFIG.SYSTEM.PASSWORD_MIN_LENGTH) {
    showFieldError('password', `密碼至少需要${CONFIG.SYSTEM.PASSWORD_MIN_LENGTH}個字元`);
    isValid = false;
  }

  return isValid;
}

/** 顯示欄位錯誤 */
function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const formGroup = field.closest('.form-group');
  if (!formGroup) return;

  formGroup.classList.add('error');

  const exist = formGroup.querySelector('.error-message');
  if (exist) exist.remove();

  const msg = document.createElement('div');
  msg.className = 'error-message';
  msg.textContent = message;
  formGroup.appendChild(msg);

  field.focus();
}

/** 清除欄位錯誤 */
function clearFieldError(field) {
  const formGroup = field.closest('.form-group');
  if (!formGroup) return;
  formGroup.classList.remove('error');
  const msg = formGroup.querySelector('.error-message');
  if (msg) msg.remove();
}

/** 清除所有錯誤 */
function clearAllErrors() {
  document.querySelectorAll('.form-group').forEach((g) => {
    g.classList.remove('error');
    const msg = g.querySelector('.error-message');
    if (msg) msg.remove();
  });
}

/** 登入按鈕狀態 */
function setLoginButtonState(loading) {
  const loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoading = loginBtn.querySelector('.btn-loading');

  if (loading) {
    loginBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';
  } else {
    loginBtn.disabled = false;
    if (btnText) btnText.style.display = 'inline';
    if (btnLoading) btnLoading.style.display = 'none';
  }
}

/** 鎖住登入表單（達到上限時） */
function disableLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  const inputs = form.querySelectorAll('input, button');
  inputs.forEach((el) => (el.disabled = true));

  // 5 分鐘後解鎖
  setTimeout(() => {
    inputs.forEach((el) => (el.disabled = false));
    loginAttempts = 0;
  }, 5 * 60 * 1000);
}

/** 切換密碼顯示 */
function togglePassword() {
  const input = document.getElementById('password');
  const icon = document.querySelector('.toggle-password i');
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

/** 登入頁用通知（與 dashboard 分開） */
function showNotification(type, title, message, autoHideDelay = null) {
  const container = document.getElementById('notificationContainer');
  if (!container) return;

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };

  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.innerHTML = `
    <i class="${icons[type] || icons.info}"></i>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(n);

  const delay = autoHideDelay !== null ? autoHideDelay : CONFIG.NOTIFICATION.AUTO_HIDE_DELAY;
  if (delay) {
    setTimeout(() => {
      if (n.parentElement) {
        n.classList.add('hide');
        setTimeout(() => n.remove(), 300);
      }
    }, delay);
  }
}

/* 對外（HTML 會用到） */
window.togglePassword = togglePassword;
window.showNotification = showNotification;
