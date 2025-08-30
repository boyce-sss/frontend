// app.js — 倉庫進出貨管理系統（與 auth.js / GAS API 相容的版本）

/* ================= 工具 & UI ================= */
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function ensureNotifyContainer() {
  let box = $('#notification');
  if (!box) {
    box = document.createElement('div');
    box.id = 'notification';
    box.className = 'notification';
    document.body.appendChild(box);
  }
  return box;
}

function showLoading(show = true) {
  const el = $('#loading');
  if (!el) return;
  if (show) { el.classList.add('show'); el.style.display = 'flex'; }
  else { el.classList.remove('show'); el.style.display = 'none'; }
}

function notify(type, text) {
  const box = ensureNotifyContainer();
  box.className = `notification ${type} show`;
  box.textContent = text || '';
  setTimeout(() => box.classList.remove('show'), 3000);
}

// === 與舊版相容：提供 showNotification，全域可用 ===
if (typeof window.showNotification !== 'function') {
  window.showNotification = function(type, title, message, timeoutMs) {
    const msg = [title, message].filter(Boolean).join(' - ');
    notify(type || 'info', msg || '');
    // timeoutMs 可忽略，目前固定 3 秒
  };
}

// 後端回傳相容：支援 {success, data} 或直接 []
function asList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (res.data && Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.result)) return res.result;
  if (Array.isArray(res.items)) return res.items;
  return [];
}

/* ================ 導覽列 & 分頁 ================= */
function setupNavigation() {
  const toggler = $('.nav-toggle');
  const menu = $('.nav-menu');
  if (toggler && menu) {
    toggler.addEventListener('click', () => menu.classList.toggle('show'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.navbar')) menu.classList.remove('show');
    });
  }

  $all('.nav-link').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = a.getAttribute('data-page');

      $all('.nav-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active');

      $all('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(page);
      if (target) target.classList.add('active');

      switch (page) {
        case 'dashboard': await loadDashboard(); break;
        case 'products':  await loadProducts();  break;
        case 'inventory': await loadInventory(); break;
        case 'inbound':   await loadInbound();   break;
        case 'outbound':  await loadOutbound();  break;
        case 'suppliers': await loadSuppliers(); break;
        case 'customers': await loadCustomers(); break;
      }
    });
  });
}

/* ================ 儀表板 ================= */
async function loadDashboard() {
  try {
    showLoading(true);
    const res = await auth.apiCall('dashboard', 'GET');
    if (res?.success === false) {
      notify('error', res?.message || '取得儀表板資料失敗');
      return;
    }

    $('#totalProducts')   && ($('#totalProducts').textContent  = res?.summary?.totalProducts ?? 0);
    $('#totalInventory')  && ($('#totalInventory').textContent = res?.summary?.totalInventory ?? 0);
    $('#lowStockCount')   && ($('#lowStockCount').textContent  = res?.summary?.lowStockItems ?? 0);
    const monthlyTx = ((res?.monthlyStats?.inboundCount ?? 0) + (res?.monthlyStats?.outboundCount ?? 0));
    $('#monthlyTransactions') && ($('#monthlyTransactions').textContent = monthlyTx);

    const act = $('#recentActivity');
    if (act) {
      const inbound = Array.isArray(res?.recentInbound) ? res.recentInbound : [];
      const outbound = Array.isArray(res?.recentOutbound) ? res.recentOutbound : [];
      const items = [
        ...inbound.map(x => ({
          icon: 'fa-truck',
          text: `進貨 ${x['商品名稱'] || x['商品ID'] || ''} × ${x['進貨數量'] || ''}`,
          date: x['進貨日期'] || ''
        })),
        ...outbound.map(x => ({
          icon: 'fa-shipping-fast',
          text: `出貨 ${x['商品名稱'] || x['商品ID'] || ''} × ${x['出貨數量'] || ''}`,
          date: x['出貨日期'] || ''
        }))
      ];
      act.innerHTML = items.length
        ? items.map(it => `
            <div class="activity-item">
              <div class="activity-info">
                <h4><i class="fas ${it.icon}"></i> ${it.text}</h4>
                <small>${it.date ? new Date(it.date).toLocaleString() : ''}</small>
              </div>
            </div>
          `).join('')
        : `<div class="activity-item"><div class="activity-info"><p>本月尚無活動</p></div></div>`;
    }

    const low = $('#lowStockItems');
    if (low) {
      const items = Array.isArray(res?.lowStockInventory) ? res.lowStockInventory : [];
      low.innerHTML = items.length
        ? items.map(x => `
            <div class="warning-item">
              <div class="item-info">
                <h4>${x['商品名稱'] || x['商品ID'] || '—'}</h4>
                <p>庫存：${x['當前庫存'] ?? 0}／最低：${x['最低庫存'] ?? 0}</p>
              </div>
              <div class="stock-level">低庫存</div>
            </div>
          `).join('')
        : `<div class="warning-item"><div class="item-info"><p>沒有低庫存項目</p></div></div>`;
    }
  } catch (err) {
    console.error(err);
    notify('error', '讀取儀表板發生錯誤');
  } finally {
    showLoading(false);
  }
}

/* ...（中間省略：Products、Inventory、Inbound、Outbound、Suppliers、Customers、Modal、FormHandler、表單模板等邏輯，與你之前相同，無需改動）... */

/* ================ 變更密碼綁定 ================= */
function bindChangePasswordForm() {
  const form = document.getElementById('changePwdForm');
  if (!form) return;

  const oldPwdEl = document.getElementById('oldPassword');
  const newPwdEl = document.getElementById('newPassword');
  const targetIdEl = document.getElementById('targetUserId');
  const targetNameEl = document.getElementById('targetUsername');
  const msgEl = document.getElementById('changePwdMsg');
  const adminDetails = form.querySelector('details');

  const me = auth.getUserInfo();
  const isAdmin = !!(me && me.role === 'admin');
  if (adminDetails) {
    if (isAdmin) {
      adminDetails.style.display = '';
    } else {
      adminDetails.open = false;
      adminDetails.style.display = 'none';
      if (targetIdEl) targetIdEl.value = '';
      if (targetNameEl) targetNameEl.value = '';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msgEl) { msgEl.hidden = true; msgEl.textContent = ''; }

    const oldPassword = (oldPwdEl?.value || '').trim();
    const newPassword = (newPwdEl?.value || '').trim();
    const targetUserId = (targetIdEl?.value || '').trim();
    const targetUsername = (targetNameEl?.value || '').trim();

    if (!isAdmin && (targetUserId || targetUsername)) {
      notify('error', '只有管理員可以重設他人密碼');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      notify('warning', '新密碼至少 8 碼');
      return;
    }

    try {
      showLoading(true);
      const res = await auth.changePassword({
        oldPassword: oldPassword || undefined,
        newPassword,
        targetUserId: isAdmin ? (targetUserId || undefined) : undefined,
        targetUsername: isAdmin ? (targetUsername || undefined) : undefined
      });

      if (msgEl) {
        msgEl.textContent = res?.message || (res?.success ? '密碼已更新' : '更新失敗');
        msgEl.hidden = false;
      }
      form.reset();
    } catch (err) {
      console.error(err);
      notify('error', '變更密碼失敗，請稍後重試');
    } finally {
      showLoading(false);
    }
  });
}

/* ================ 初始流程 ================= */
document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  setupNavigation();
  bindChangePasswordForm();

  try {
    const [p, s, c] = await Promise.all([
      auth.apiCall('products',  'GET'),
      auth.apiCall('suppliers', 'GET'),
      auth.apiCall('customers', 'GET'),
    ]);
    window._productsCache  = asList(p);
    window._suppliersCache = asList(s);
    window._customersCache = asList(c);
  } catch (e) {
    console.warn('預載清單失敗（可忽略）', e);
  }

  await loadDashboard();
});

/* ================ 對外 ================= */
window.showAddProductModal  = showAddProductModal;
window.showAddSupplierModal = showAddSupplierModal;
window.showAddCustomerModal = showAddCustomerModal;
window.showAddInboundModal  = showAddInboundModal;
window.showAddOutboundModal = showAddOutboundModal;

window.closeModal   = closeModal;
window.deleteProduct  = deleteProduct;
window.deleteInbound  = deleteInbound;
window.deleteOutbound = deleteOutbound;
window.editProduct    = editProduct;
window.editSupplier   = editSupplier;
window.editCustomer   = editCustomer;
