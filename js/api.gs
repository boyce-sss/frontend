/**
 * 倉庫進出貨系統 - Web API（統一回傳格式版）
 * 需求：database.gs 需提供 SHEETS 與資料存取工具（getSheetData/add/update/delete、updateInventory、generateUniqueId、initializeDatabase）
 */

/** HTTP 入口 */
function doGet(e)    { return handleRequest(e); }
function doPost(e)   { return handleRequest(e); }
function doPut(e)    { return handleRequest(e); }
function doDelete(e) { return handleRequest(e); }

/** ---- 回傳工具 ---- */
function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function ok(data)   { return json({ success: true, data: data }); }
function fail(msg, extra) {
  var out = { success: false, message: String(msg || '發生未知錯誤') };
  if (extra) out.extra = extra;
  return json(out);
}

/** ---- 主路由 ---- */
function handleRequest(e) {
  try {
    if (!e) return fail('無效的請求');

    // 允許以 query 覆寫 method（避免客戶端一定得送真正 PUT/DELETE）
    var method = 'GET';
    if (e.parameter && e.parameter.method)  method = String(e.parameter.method).toUpperCase();
    if (e.parameter && e.parameter._method) method = String(e.parameter._method).toUpperCase();

    var path    = (e.parameter && e.parameter.path)    ? e.parameter.path    : '';
    var apiPath = (e.parameter && e.parameter.apiPath) ? e.parameter.apiPath : '';

    if (path !== 'api') {
      return json({ success: true, message: '請以 ?path=api&apiPath=... 呼叫 API' });
    }

    switch (apiPath) {
      case 'dashboard': return json(handleDashboard_(e, method)); // 已內含 success
      case 'products':  return handleProducts_(e, method);
      case 'inventory': return handleInventory_(e, method);
      case 'inbound':   return handleInbound_(e, method);
      case 'outbound':  return handleOutbound_(e, method);
      case 'suppliers': return handleSuppliers_(e, method);
      case 'customers': return handleCustomers_(e, method);
      case 'init':      return handleInit_(e, method);
      default:
        return fail('無效的 API 路徑: ' + apiPath);
    }

  } catch (err) {
    console.error('handleRequest 錯誤:', err);
    return fail(err.message, { stack: err.stack });
  }
}

/** ---- 各資源處理器 ---- */

/** 儀表板（回傳物件，附 success: true） */
function handleDashboard_(e, method) {
  if (method !== 'GET') return { success: false, message: '不支援的方法' };
  try {
    var products  = getSheetData(SHEETS.PRODUCTS);
    var inventory = getSheetData(SHEETS.INVENTORY);
    var inbound   = getSheetData(SHEETS.INBOUND);
    var outbound  = getSheetData(SHEETS.OUTBOUND);
    var suppliers = getSheetData(SHEETS.SUPPLIERS);
    var customers = getSheetData(SHEETS.CUSTOMERS);

    var totalProducts  = products.length;
    var totalInventory = inventory.reduce(function(sum, item) {
      return sum + (parseInt(item['當前庫存']) || 0);
    }, 0);
    var lowStockItems  = inventory.filter(function(it) {
      return (parseInt(it['當前庫存']) || 0) < (parseInt(it['最低庫存']) || 0);
    }).length;

    var now = new Date();
    var m = now.getMonth(), y = now.getFullYear();

    var monthlyInbound = inbound.filter(function(it) {
      if (!it['進貨日期']) return false;
      var d = new Date(it['進貨日期']);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    var monthlyOutbound = outbound.filter(function(it) {
      if (!it['出貨日期']) return false;
      var d = new Date(it['出貨日期']);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    var totalInboundAmount  = monthlyInbound.reduce(function(s, it) { return s + (parseFloat(it['總金額']) || 0); }, 0);
    var totalOutboundAmount = monthlyOutbound.reduce(function(s, it) { return s + (parseFloat(it['總金額']) || 0); }, 0);

    return {
      success: true,
      summary: {
        totalProducts: totalProducts,
        totalInventory: totalInventory,
        lowStockItems: lowStockItems,
        totalSuppliers: suppliers.length,
        totalCustomers: customers.length
      },
      monthlyStats: {
        inboundCount: monthlyInbound.length,
        outboundCount: monthlyOutbound.length,
        inboundAmount: totalInboundAmount,
        outboundAmount: totalOutboundAmount
      },
      recentInbound: inbound.slice(-5).reverse(),
      recentOutbound: outbound.slice(-5).reverse(),
      lowStockInventory: inventory.filter(function(it) {
        return (parseInt(it['當前庫存']) || 0) < (parseInt(it['最低庫存']) || 0);
      })
    };
  } catch (err) {
    console.error('儀表板處理錯誤:', err);
    return { success: false, message: err.message };
  }
}

/** 商品 */
function handleProducts_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.PRODUCTS));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['商品ID']    = generateUniqueId('P');
      data['建立日期']  = new Date().toISOString();
      data['更新日期']  = new Date().toISOString();
      data['狀態']      = data['狀態'] || 'active';
      addSheetData(SHEETS.PRODUCTS, data);
      return ok({ message: '商品新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      upd['更新日期'] = new Date().toISOString();
      var okFlag = updateSheetData(SHEETS.PRODUCTS, { '商品ID': upd['商品ID'] }, upd);
      return ok({ message: okFlag ? '商品更新成功' : '商品更新失敗' });
    }
    if (method === 'DELETE') {
      var del = parseBody_(e);
      var delOk = deleteSheetData(SHEETS.PRODUCTS, { '商品ID': del['商品ID'] });
      return ok({ message: delOk ? '商品刪除成功' : '商品刪除失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('商品處理錯誤:', err);
    return fail(err.message);
  }
}

/** 庫存 */
function handleInventory_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.INVENTORY));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['最後更新日期'] = new Date().toISOString();
      data['狀態'] = data['狀態'] || 'active';
      addSheetData(SHEETS.INVENTORY, data);
      return ok({ message: '庫存記錄新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      upd['最後更新日期'] = new Date().toISOString();
      var okFlag = updateSheetData(SHEETS.INVENTORY, { '商品ID': upd['商品ID'] }, upd);
      return ok({ message: okFlag ? '庫存更新成功' : '庫存更新失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('庫存處理錯誤:', err);
    return fail(err.message);
  }
}

/** 進貨 */
function handleInbound_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.INBOUND));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['進貨單號'] = generateUniqueId('IN');
      data['進貨日期'] = new Date().toISOString();
      data['總金額']   = (Number(data['進貨數量']) || 0) * (Number(data['單價']) || 0);
      data['狀態']     = data['狀態'] || 'active';

      addSheetData(SHEETS.INBOUND, data);
      updateInventory(data['商品ID'], data['進貨數量'], 'inbound');

      return ok({ message: '進貨記錄新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      var okFlag = updateSheetData(SHEETS.INBOUND, { '進貨單號': upd['進貨單號'] }, upd);
      return ok({ message: okFlag ? '進貨記錄更新成功' : '進貨記錄更新失敗' });
    }
    if (method === 'DELETE') {
      var del = parseBody_(e);
      var delOk = deleteSheetData(SHEETS.INBOUND, { '進貨單號': del['進貨單號'] });
      return ok({ message: delOk ? '進貨記錄刪除成功' : '進貨記錄刪除失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('進貨處理錯誤:', err);
    return fail(err.message);
  }
}

/** 出貨 */
function handleOutbound_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.OUTBOUND));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['出貨單號'] = generateUniqueId('OUT');
      data['出貨日期'] = new Date().toISOString();
      data['總金額']   = (Number(data['出貨數量']) || 0) * (Number(data['單價']) || 0);
      data['狀態']     = data['狀態'] || 'active';

      addSheetData(SHEETS.OUTBOUND, data);
      updateInventory(data['商品ID'], data['出貨數量'], 'outbound');

      return ok({ message: '出貨記錄新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      var okFlag = updateSheetData(SHEETS.OUTBOUND, { '出貨單號': upd['出貨單號'] }, upd);
      return ok({ message: okFlag ? '出貨記錄更新成功' : '出貨記錄更新失敗' });
    }
    if (method === 'DELETE') {
      var del = parseBody_(e);
      var delOk = deleteSheetData(SHEETS.OUTBOUND, { '出貨單號': del['出貨單號'] });
      return ok({ message: delOk ? '出貨記錄刪除成功' : '出貨記錄刪除失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('出貨處理錯誤:', err);
    return fail(err.message);
  }
}

/** 供應商 */
function handleSuppliers_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.SUPPLIERS));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['供應商ID']  = generateUniqueId('S');
      data['建立日期']  = new Date().toISOString();
      data['狀態']      = data['狀態'] || 'active';
      addSheetData(SHEETS.SUPPLIERS, data);
      return ok({ message: '供應商新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      var okFlag = updateSheetData(SHEETS.SUPPLIERS, { '供應商ID': upd['供應商ID'] }, upd);
      return ok({ message: okFlag ? '供應商更新成功' : '供應商更新失敗' });
    }
    if (method === 'DELETE') {
      var del = parseBody_(e);
      var delOk = deleteSheetData(SHEETS.SUPPLIERS, { '供應商ID': del['供應商ID'] });
      return ok({ message: delOk ? '供應商刪除成功' : '供應商刪除失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('供應商處理錯誤:', err);
    return fail(err.message);
  }
}

/** 客戶 */
function handleCustomers_(e, method) {
  try {
    if (method === 'GET') {
      return ok(getSheetData(SHEETS.CUSTOMERS));
    }
    if (method === 'POST') {
      var data = parseBody_(e);
      data['客戶ID']   = generateUniqueId('C');
      data['建立日期'] = new Date().toISOString();
      data['狀態']     = data['狀態'] || 'active';
      addSheetData(SHEETS.CUSTOMERS, data);
      return ok({ message: '客戶新增成功' });
    }
    if (method === 'PUT') {
      var upd = parseBody_(e);
      var okFlag = updateSheetData(SHEETS.CUSTOMERS, { '客戶ID': upd['客戶ID'] }, upd);
      return ok({ message: okFlag ? '客戶更新成功' : '客戶更新失敗' });
    }
    if (method === 'DELETE') {
      var del = parseBody_(e);
      var delOk = deleteSheetData(SHEETS.CUSTOMERS, { '客戶ID': del['客戶ID'] });
      return ok({ message: delOk ? '客戶刪除成功' : '客戶刪除失敗' });
    }
    return fail('不支援的方法');
  } catch (err) {
    console.error('客戶處理錯誤:', err);
    return fail(err.message);
  }
}

/** 初始化（建立表 & 預設管理員） */
function handleInit_(e, method) {
  if (method !== 'GET') return fail('不支援的方法');
  try {
    var result = initializeDatabase(); // 這個函式請在 database.gs 實作
    // initializeDatabase 可以自己回傳 { success, message }，這裡直接轉成標準格式
    if (result && result.success) return ok({ message: result.message || '初始化成功' });
    return fail((result && result.message) || '初始化失敗');
  } catch (err) {
    console.error('初始化錯誤:', err);
    return fail('初始化失敗：' + err.message);
  }
}

/** 解析 Body（POST/PUT/DELETE） */
function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { throw new Error('無法解析 JSON：' + err.message); }
  }
  return {};
}
