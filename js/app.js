// app.js — 倉庫進出貨管理系統（整合 auth.js / GAS API）
// ----------------------------------------------------
// 這份包含：
// 1) UI/工具方法（notify、showLoading、showNotification shim）
// 2) 導覽列分頁切換、右上使用者下拉選單（登出）
// 3) 儀表板/商品/庫存/進出貨/供應商/客戶 載入
// 4) 新增/刪除操作與 Modal 表單
// 5) 變更密碼表單綁定
// 6) DOMContentLoaded 初始化流程
// ----------------------------------------------------

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

// --- 相容舊介面：把 showNotification 對應到 notify ---
window.showNotification = function(type = 'info', title = '', message = '', timeout = 3000) {
  const text = [title, message].filter(Boolean).join('｜');
  const box = ensureNotifyContainer();
  box.className = `notification ${type} show`;
  box.textContent = text || '';
  setTimeout(() => box.classList.remove('show'), Math.max(1000, timeout|0));
};

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
  // 手機選單
  const toggler = $('.nav-toggle');
  const menu = $('.nav-menu');
  if (toggler && menu) {
    toggler.addEventListener('click', () => menu.classList.toggle('show'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.navbar')) menu.classList.remove('show');
    });
  }

  // 分頁切換
  $all('.nav-link').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = a.getAttribute('data-page');

      // 高亮選單
      $all('.nav-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active');

      // 顯示分頁
      $all('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(page);
      if (target) target.classList.add('active');

      // 載入對應資料
      try {
        switch (page) {
          case 'dashboard': await loadDashboard(); break;
          case 'products':  await loadProducts();  break;
          case 'inventory': await loadInventory(); break;
          case 'inbound':   await loadInbound();   break;
          case 'outbound':  await loadOutbound();  break;
          case 'suppliers': await loadSuppliers(); break;
          case 'customers': await loadCustomers(); break;
        }
      } catch (err) {
        console.error(err);
        notify('error', '載入分頁失敗');
      }
    });
  });
}

/* ================ 右上使用者選單（登出） ================= */
function setupUserMenu() {
  const btn = $('#userMenuBtn');          // 觸發按鈕
  const dropdown = $('#userDropdown');    // 下拉選單本體
  const logoutBtn = $('#logoutBtn');
  const nameSpan = $('#userNameSpan');

  // 顯示使用者名稱（容錯）
  try {
    const me = auth.getUserInfo && auth.getUserInfo();
    if (me && nameSpan) {
      nameSpan.textContent = me.username || me.使用者名稱 || me.帳號 || '使用者';
    }
  } catch (_) {}

  if (btn && dropdown) {
    // 切換開關
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止冒泡到 document 的關閉監聽
      dropdown.classList.toggle('show');
      btn.setAttribute('aria-expanded', dropdown.classList.contains('show') ? 'true' : 'false');
    });

    // 點選單內部不要關閉
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // 點外面關閉（把所有可能容器與本體都納入判斷）
    document.addEventListener('click', (e) => {
      const isInside =
        e.target.closest('#userMenuBtn') ||
        e.target.closest('#userDropdown') ||
        e.target.closest('.user-menu') ||
        e.target.closest('.nav-user');
      if (!isInside) dropdown.classList.remove('show');
    });

    // Esc 關閉（友善性）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dropdown.classList.remove('show');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await auth.logout(); }
      catch (err) {
        console.error(err);
        notify('error', '登出失敗，請稍後再試');
      }
    });
  }
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

    // 統計數字
    $('#totalProducts')   && ($('#totalProducts').textContent  = res?.summary?.totalProducts ?? 0);
    $('#totalInventory')  && ($('#totalInventory').textContent = res?.summary?.totalInventory ?? 0);
    $('#lowStockCount')   && ($('#lowStockCount').textContent  = res?.summary?.lowStockItems ?? 0);
    const monthlyTx = ((res?.monthlyStats?.inboundCount ?? 0) + (res?.monthlyStats?.outboundCount ?? 0));
    $('#monthlyTransactions') && ($('#monthlyTransactions').textContent = monthlyTx);

    // 最近活動（用最近 5 筆進/出貨）
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

    // 低庫存清單
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

/* ================ 資料列表：商品 / 庫存 / 進出貨 / 供應商 / 客戶 ================ */
async function loadProducts() {
  try {
    showLoading(true);
    const res = await auth.apiCall('products', 'GET');
    const list = asList(res);
    const tbody = $('#productsTable tbody');
    if (tbody) {
      // 修正欄位數與 thead 一致（不再輸出「當前庫存」）
      tbody.innerHTML = list.map(p => `
        <tr>
          <td>${p['商品ID'] || ''}</td>
          <td>${p['商品名稱'] || ''}</td>
          <td>${p['商品分類'] || ''}</td>
          <td>${p['規格'] || ''}</td>
          <td>${p['成本價'] ?? ''}</td>
          <td>${p['售價'] ?? ''}</td>
          <td class="action-buttons">
            <button class="btn btn-secondary" onclick="editProduct('${p['商品ID'] || ''}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger" onclick="deleteProduct('${p['商品ID'] || ''}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
    window._productsCache = list;
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入商品失敗');
  } finally {
    showLoading(false);
  }
}

async function loadInventory() {
  try {
    showLoading(true);
    const res = await auth.apiCall('inventory', 'GET');
    const list = asList(res);
    const tbody = $('#inventoryTable tbody');
    if (tbody) {
      tbody.innerHTML = list.map(it => {
        const now = parseInt(it['當前庫存']) || 0;
        const min = parseInt(it['最低庫存']) || 0;
        const danger = now < min;
        return `
          <tr>
            <td>${it['商品ID'] || ''}</td>
            <td>${it['商品名稱'] || ''}</td>
            <td class="${danger ? 'text-danger' : 'text-success'}">${now}</td>
            <td>${it['可用庫存'] ?? ''}</td>
            <td>${it['預留庫存'] ?? ''}</td>
            <td>${it['狀態'] || ''}</td>
            <td>${it['最後更新日期'] ? new Date(it['最後更新日期']).toLocaleString() : ''}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入庫存失敗');
  } finally {
    showLoading(false);
  }
}

async function loadInbound() {
  try {
    showLoading(true);
    const res = await auth.apiCall('inbound', 'GET');
    const list = asList(res);
    const tbody = $('#inboundTable tbody');
    if (tbody) {
      tbody.innerHTML = list.map(r => `
        <tr>
          <td>${r['進貨單號'] || ''}</td>
          <td>${r['商品名稱'] || ''}</td>
          <td>${r['供應商名稱'] || r['供應商ID'] || ''}</td>
          <td>${r['進貨數量'] ?? ''}</td>
          <td>${r['單價'] ?? ''}</td>
          <td>${r['總金額'] ?? ''}</td>
          <td>${r['進貨日期'] ? new Date(r['進貨日期']).toLocaleDateString() : ''}</td>
          <td class="action-buttons">
            <button class="btn btn-danger" onclick="deleteInbound('${r['進貨單號'] || ''}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入進貨失敗');
  } finally {
    showLoading(false);
  }
}

async function loadOutbound() {
  try {
    showLoading(true);
    const res = await auth.apiCall('outbound', 'GET');
    const list = asList(res);
    const tbody = $('#outboundTable tbody');
    if (tbody) {
      tbody.innerHTML = list.map(r => `
        <tr>
          <td>${r['出貨單號'] || ''}</td>
          <td>${r['商品名稱'] || ''}</td>
          <td>${r['客戶名稱'] || r['客戶ID'] || ''}</td>
          <td>${r['出貨數量'] ?? ''}</td>
          <td>${r['單價'] ?? ''}</td>
          <td>${r['總金額'] ?? ''}</td>
          <td>${r['出貨日期'] ? new Date(r['出貨日期']).toLocaleDateString() : ''}</td>
          <td class="action-buttons">
            <button class="btn btn-danger" onclick="deleteOutbound('${r['出貨單號'] || ''}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入出貨失敗');
  } finally {
    showLoading(false);
  }
}

async function loadSuppliers() {
  try {
    showLoading(true);
    const res = await auth.apiCall('suppliers', 'GET');
    const list = asList(res);
    const tbody = $('#suppliersTable tbody');
    if (tbody) {
      tbody.innerHTML = list.map(s => `
        <tr>
          <td>${s['供應商ID'] || ''}</td>
          <td>${s['供應商名稱'] || ''}</td>
          <td>${s['聯絡人'] || ''}</td>
          <td>${s['電話'] || ''}</td>
          <td>${s['地址'] || ''}</td>
          <td class="action-buttons">
            <button class="btn btn-secondary" onclick="editSupplier('${s['供應商ID'] || ''}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger" onclick="deleteSupplier('${s['供應商ID'] || ''}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
    window._suppliersCache = list;
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入供應商失敗');
  } finally {
    showLoading(false);
  }
}

async function loadCustomers() {
  try {
    showLoading(true);
    const res = await auth.apiCall('customers', 'GET');
    const list = asList(res);
    const tbody = $('#customersTable tbody');
    if (tbody) {
      tbody.innerHTML = list.map(c => `
        <tr>
          <td>${c['客戶ID'] || ''}</td>
          <td>${c['客戶名稱'] || ''}</td>
          <td>${c['聯絡人'] || ''}</td>
          <td>${c['電話'] || ''}</td>
          <td>${c['地址'] || ''}</td>
          <td class="action-buttons">
            <button class="btn btn-secondary" onclick="editCustomer('${c['客戶ID'] || ''}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger" onclick="deleteCustomer('${c['客戶ID'] || ''}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
    window._customersCache = list;
  } catch (e) {
    console.error(e);
    notify('error', e.message || '載入客戶失敗');
  } finally {
    showLoading(false);
  }
}

/* ================ 新增 / 刪除（示範，編輯先保留） ================ */
function showAddProductModal() {
  showModal('新增商品', getProductForm());
  // 讓「自動產生商品ID」切換（預設勾選 → disabled；取消勾選 → 可輸入）
  initProductFormBehaviors();
  setupFormHandler('productForm', async (payload) => {
    // —— 修正版：只在手動輸入時帶 商品ID，並轉大寫＋驗證 ——
    const manualIdRaw = (payload['商品ID'] || '').toString().trim();
    const manualId = manualIdRaw ? manualIdRaw.toUpperCase() : '';

    if (manualId) {
      const re = /^[A-Z0-9\-]{3,20}$/;
      if (!re.test(manualId)) {
        throw new Error('【商品ID】格式不符（僅限 A-Z/0-9/-，3~20 碼）');
      }
    }

    const body = {
      ...(manualId ? { '商品ID': manualId } : {}),
      '商品名稱': (payload['商品名稱'] || '').trim(),
      '商品分類': (payload['商品分類'] || '').trim(),
      '規格': (payload['規格'] || '').trim(),
      '單位': (payload['單位'] || '').trim(),
      '成本價': Number(payload['成本價'] || 0),
      '售價': Number(payload['售價'] || 0),
      '最低庫存': Number(payload['最低庫存'] || 0),
      '最高庫存': Number(payload['最高庫存'] || 0),
      '備註': (payload['備註'] || '').trim()
    };

    const res = await auth.apiCall('products', 'POST', body);
    if (res?.success === false) throw new Error(res?.message || '新增商品失敗');
    await loadProducts();
  });
}

function showAddSupplierModal() {
  showModal('新增供應商', getSupplierForm());
  setupFormHandler('supplierForm', async (payload) => {
    const res = await auth.apiCall('suppliers', 'POST', {
      '供應商名稱': payload['供應商名稱'],
      '聯絡人': payload['聯絡人'],
      '電話': payload['電話'],
      '地址': payload['地址'],
      '備註': payload['備註']
    });
    if (res?.success === false) throw new Error(res?.message || '新增供應商失敗');
    await loadSuppliers();
  });
}

function showAddCustomerModal() {
  showModal('新增客戶', getCustomerForm());
  setupFormHandler('customerForm', async (payload) => {
    const res = await auth.apiCall('customers', 'POST', {
      '客戶名稱': payload['客戶名稱'],
      '聯絡人': payload['聯絡人'],
      '電話': payload['電話'],
      '地址': payload['地址'],
      '備註': payload['備註']
    });
    if (res?.success === false) throw new Error(res?.message || '新增客戶失敗');
    await loadCustomers();
  });
}

function showAddInboundModal() {
  showModal('新增進貨', getInboundForm());
  setupFormHandler('inboundForm', async (payload) => {
    const res = await auth.apiCall('inbound', 'POST', {
      '商品ID': payload['商品ID'],
      '進貨數量': Number(payload['進貨數量']),
      '單價': Number(payload['單價']),
      '供應商ID': payload['供應商ID'],
      '備註': payload['備註'] || ''
    });
    if (res?.success === false) throw new Error(res?.message || '新增進貨失敗');
    await loadInbound();
    await loadInventory(); // 進貨會改庫存
  });
}

function showAddOutboundModal() {
  showModal('新增出貨', getOutboundForm());
  setupFormHandler('outboundForm', async (payload) => {
    const res = await auth.apiCall('outbound', 'POST', {
      '商品ID': payload['商品ID'],
      '出貨數量': Number(payload['出貨數量']),
      '單價': Number(payload['單價']),
      '客戶ID': payload['客戶ID'],
      '備註': payload['備註'] || ''
    });
    if (res?.success === false) throw new Error(res?.message || '新增出貨失敗');
    await loadOutbound();
    await loadInventory(); // 出貨會改庫存
  });
}

// 刪除：依 GAS 規格使用 body，非路徑參數
async function deleteProduct(id) {
  if (!id) return;
  if (!confirm('確定要刪除此商品嗎？')) return;
  try {
    showLoading(true);
    const res = await auth.apiCall('products', 'DELETE', { '商品ID': id });
    if (res?.success === false) throw new Error(res?.message || '刪除商品失敗');
    notify('success', '刪除成功');
    await loadProducts();
  } catch (e) {
    console.error(e);
    notify('error', e.message || '刪除商品失敗');
  } finally {
    showLoading(false);
  }
}

async function deleteInbound(no) {
  if (!no) return;
  if (!confirm('確定要刪除此進貨記錄嗎？')) return;
  try {
    showLoading(true);
    const res = await auth.apiCall('inbound', 'DELETE', { '進貨單號': no });
    if (res?.success === false) throw new Error(res?.message || '刪除進貨失敗');
    notify('success', '刪除成功');
    await loadInbound();
  } catch (e) {
    console.error(e);
    notify('error', e.message || '刪除進貨失敗');
  } finally {
    showLoading(false);
  }
}

async function deleteOutbound(no) {
  if (!no) return;
  if (!confirm('確定要刪除此出貨記錄嗎？')) return;
  try {
    showLoading(true);
    const res = await auth.apiCall('outbound', 'DELETE', { '出貨單號': no });
    if (res?.success === false) throw new Error(res?.message || '刪除出貨失敗');
    notify('success', '刪除成功');
    await loadOutbound();
  } catch (e) {
    console.error(e);
    notify('error', e.message || '刪除出貨失敗');
  } finally {
    showLoading(false);
  }
}

// 先保留編輯功能占位
function editProduct()  { notify('info', '編輯商品功能開發中'); }
function editSupplier() { notify('info', '編輯供應商功能開發中'); }
function editCustomer() { notify('info', '編輯客戶功能開發中'); }

/* ================ Modal & 表單 ================= */
function showModal(title, contentHtml) {
  const box = $('#modalContainer');
  if (!box) return;
  box.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-content">${contentHtml}</div>
      </div>
    </div>`;
  // 背景點擊關閉
  const overlay = $('.modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
}

function closeModal() {
  const box = $('#modalContainer');
  if (box) box.innerHTML = '';
}

function setupFormHandler(formId, onSubmit) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {};
    fd.forEach((v, k) => { payload[k] = v; });
    try {
      showLoading(true);
      await onSubmit(payload);
      closeModal();
      notify('success', '操作成功');
    } catch (err) {
      console.error(err);
      notify('error', err.message || '操作失敗');
    } finally {
      showLoading(false);
    }
  });
}

/* ================ 表單模板（統一風格） ================ */
function getProductForm() {
  // 與進/出貨相同的排版：表單群組 + footer
  return `
    <form id="productForm">
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:.5rem;">
          <input type="checkbox" id="autoProductId" checked>
          自動產生商品ID
        </label>
        <small class="hint" style="color:#6b7280;display:block;margin-top:.25rem;">
          取消勾選可自行輸入；格式：A-Z/0-9/-，3~20 碼
        </small>
      </div>
      <div class="form-group">
        <label>商品ID</label>
        <input name="商品ID" id="productIdInput" placeholder="例如：ABC-001" readonly pattern="[A-Z0-9\\-]{3,20}">
      </div>

      <div class="form-row">
        <div class="form-group"><label>商品名稱</label><input name="商品名稱" required></div>
        <div class="form-group"><label>商品分類</label><input name="商品分類" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>規格</label><input name="規格"></div>
        <div class="form-group"><label>單位</label><input name="單位" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>成本價</label><input name="成本價" type="number" step="0.01" required></div>
        <div class="form-group"><label>售價</label><input name="售價" type="number" step="0.01" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>最低庫存</label><input name="最低庫存" type="number" value="0" required></div>
        <div class="form-group"><label>最高庫存</label><input name="最高庫存" type="number" value="0" required></div>
      </div>
      <div class="form-group"><label>備註</label><textarea name="備註" rows="3"></textarea></div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增</button>
      </div>
    </form>`;
}

function getSupplierForm() {
  return `
    <form id="supplierForm">
      <div class="form-group"><label>供應商名稱</label><input name="供應商名稱" required></div>
      <div class="form-row">
        <div class="form-group"><label>聯絡人</label><input name="聯絡人" required></div>
        <div class="form-group"><label>電話</label><input name="電話" required></div>
      </div>
      <div class="form-group"><label>地址</label><input name="地址" required></div>
      <div class="form-group"><label>備註</label><textarea name="備註" rows="3"></textarea></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增</button>
      </div>
    </form>`;
}

function getCustomerForm() {
  return `
    <form id="customerForm">
      <div class="form-group"><label>客戶名稱</label><input name="客戶名稱" required></div>
      <div class="form-row">
        <div class="form-group"><label>聯絡人</label><input name="聯絡人" required></div>
        <div class="form-group"><label>電話</label><input name="電話" required></div>
      </div>
      <div class="form-group"><label>地址</label><input name="地址" required></div>
      <div class="form-group"><label>備註</label><textarea name="備註" rows="3"></textarea></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增</button>
      </div>
    </form>`;
}

function getInboundForm() {
  const products = window._productsCache || [];
  const suppliers = window._suppliersCache || [];
  const optsP = products.map(p => `<option value="${p['商品ID']}">${p['商品名稱']}</option>`).join('');
  const optsS = suppliers.map(s => `<option value="${s['供應商ID']}">${s['供應商名稱']}</option>`).join('');
  return `
    <form id="inboundForm">
      <div class="form-group"><label>商品</label><select name="商品ID" required><option value="">請選擇</option>${optsP}</select></div>
      <div class="form-group"><label>供應商</label><select name="供應商ID" required><option value="">請選擇</option>${optsS}</select></div>
      <div class="form-row">
        <div class="form-group"><label>數量</label><input name="進貨數量" type="number" min="1" required></div>
        <div class="form-group"><label>單價</label><input name="單價" type="number" step="0.01" min="0" required></div>
      </div>
      <div class="form-group"><label>備註</label><textarea name="備註" rows="3"></textarea></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增進貨</button>
      </div>
    </form>`;
}

function getOutboundForm() {
  const products = window._productsCache || [];
  const customers = window._customersCache || [];
  const optsP = products.map(p => `<option value="${p['商品ID']}">${p['商品名稱']}</option>`).join('');
  const optsC = customers.map(c => `<option value="${c['客戶ID']}">${c['客戶名稱']}</option>`).join('');
  return `
    <form id="outboundForm">
      <div class="form-group"><label>商品</label><select name="商品ID" required><option value="">請選擇</option>${optsP}</select></div>
      <div class="form-group"><label>客戶</label><select name="客戶ID" required><option value="">請選擇</option>${optsC}</select></div>
      <div class="form-row">
        <div class="form-group"><label>數量</label><input name="出貨數量" type="number" min="1" required></div>
        <div class="form-group"><label>單價</label><input name="單價" type="number" step="0.01" min="0" required></div>
      </div>
      <div class="form-group"><label>備註</label><textarea name="備註" rows="3"></textarea></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">新增出貨</button>
      </div>
    </form>`;
}

/* === 新增：商品表單行為（自動ID切換 & 可打字） === */
function initProductFormBehaviors() {
  const autoChk = document.getElementById('autoProductId');
  const idInput = document.getElementById('productIdInput');
  if (!autoChk || !idInput) return;

  // 讓瀏覽器有更友善的提示
  idInput.setAttribute('pattern', '[A-Z0-9\\-]{3,20}');
  idInput.setAttribute('title', '僅限 A-Z / 0-9 / -，長度 3~20');

  const applyState = () => {
    if (autoChk.checked) {
      // 自動模式：避免送出空欄位 → disabled（FormData 會忽略）
      idInput.value = '';
      idInput.readOnly = true;
      idInput.disabled = true;
    } else {
      // 手動模式：允許輸入
      idInput.readOnly = false;
      idInput.disabled = false;
      idInput.focus();
    }
  };

  autoChk.addEventListener('change', applyState);
  applyState();
}

/* ================ 變更密碼綁定 ================ */
function bindChangePasswordForm() {
  const form = document.getElementById('changePwdForm');
  if (!form) return; // 該頁沒有此區塊則略過

  const oldPwdEl = document.getElementById('oldPassword');
  const newPwdEl = document.getElementById('newPassword');
  const targetIdEl = document.getElementById('targetUserId');
  const targetNameEl = document.getElementById('targetUsername');
  const msgEl = document.getElementById('changePwdMsg');
  const adminDetails = form.querySelector('details');

  // 依角色顯示/隱藏管理員選項
  try {
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
  } catch (_) {}

  // 提交處理
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (msgEl) { msgEl.hidden = true; msgEl.textContent = ''; }

    const me = auth.getUserInfo && auth.getUserInfo();
    const isAdmin = !!(me && me.role === 'admin');

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
        oldPassword: isAdmin ? (oldPassword || undefined) : (oldPassword || undefined),
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
  // 必須已登入
  if (!auth.requireAuth()) return;

  setupNavigation();
  setupUserMenu();
  bindChangePasswordForm();

  // 預載清單（讓下拉表單有資料；失敗亦不阻擋頁面）
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

  // 預設載入儀表板
  await loadDashboard();
});

/* ================ 對外（HTML 會呼叫） ================ */
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
