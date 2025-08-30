/**
 * 系統設定檔案
 */

// GAS API 設定
const CONFIG = {
    // GAS Web App URL - 部署後需要更新此 URL
    GAS_URL: 'https://script.google.com/macros/s/AKfycbyEyGdnABA3tsYgiAzZnYHaxXNc9CEl6BPrIwGc9D2DIHhYEho1btLz1Jad5pYVCaYvQw/exec',
    
    // API 端點
    API_ENDPOINTS: {
        LOGIN: 'login',
        INIT: 'init',
        DASHBOARD: 'dashboard',
        PRODUCTS: 'products',
        INVENTORY: 'inventory',
        INBOUND: 'inbound',
        OUTBOUND: 'outbound',
        SUPPLIERS: 'suppliers',
        CUSTOMERS: 'customers',
        USERS: 'users',
        LOGOUT: 'logout'
    },
    
    // 系統設定
    SYSTEM: {
        SESSION_TIMEOUT: 30 * 60 * 1000, // 30分鐘
        AUTO_LOGOUT_WARNING: 5 * 60 * 1000, // 5分鐘前警告
        MAX_LOGIN_ATTEMPTS: 5,
        PASSWORD_MIN_LENGTH: 6
    },
    
    // 通知設定
    NOTIFICATION: {
        AUTO_HIDE_DELAY: 5000, // 5秒後自動隱藏
        SUCCESS_DELAY: 3000,   // 成功訊息3秒後隱藏
        ERROR_DELAY: 8000      // 錯誤訊息8秒後隱藏
    },
    
    // 分頁設定
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,
        MAX_PAGE_SIZE: 100
    }
};

// 本地儲存鍵值
const STORAGE_KEYS = {
    SESSION_TOKEN: 'warehouse_session_token',
    USER_INFO: 'warehouse_user_info',
    REMEMBER_ME: 'warehouse_remember_me',
    THEME: 'warehouse_theme',
    LANGUAGE: 'warehouse_language'
};

// 主題設定
const THEMES = {
    LIGHT: {
        name: 'light',
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#f8f9fa',
        surface: '#ffffff',
        text: '#333333',
        textSecondary: '#666666',
        border: '#e1e5e9',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
    },
    DARK: {
        name: 'dark',
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#1a1a1a',
        surface: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#cccccc',
        border: '#404040',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
    }
};

// 語言設定
const LANGUAGES = {
    'zh-TW': {
        name: '繁體中文',
        flag: '🇹🇼',
        translations: {
            // 登入頁面
            login: '登入',
            username: '使用者名稱',
            password: '密碼',
            rememberMe: '記住我',
            loginSuccess: '登入成功',
            loginFailed: '登入失敗',
            invalidCredentials: '使用者名稱或密碼錯誤',
            
            // 通用
            loading: '載入中...',
            save: '儲存',
            cancel: '取消',
            delete: '刪除',
            edit: '編輯',
            add: '新增',
            search: '搜尋',
            filter: '篩選',
            export: '匯出',
            import: '匯入',
            
            // 儀表板
            dashboard: '儀表板',
            totalProducts: '總商品數',
            totalInventory: '總庫存數',
            lowStockItems: '低庫存商品',
            monthlyTransactions: '本月交易',
            
            // 商品管理
            products: '商品管理',
            productName: '商品名稱',
            productCategory: '商品分類',
            specification: '規格',
            unit: '單位',
            costPrice: '成本價',
            sellingPrice: '售價',
            
            // 庫存管理
            inventory: '庫存管理',
            currentStock: '當前庫存',
            minStock: '最低庫存',
            maxStock: '最高庫存',
            stockLocation: '庫存位置',
            
            // 進出貨
            inbound: '進貨管理',
            outbound: '出貨管理',
            inboundNumber: '進貨單號',
            outboundNumber: '出貨單號',
            quantity: '數量',
            unitPrice: '單價',
            totalAmount: '總金額',
            date: '日期',
            notes: '備註',
            
            // 供應商/客戶
            suppliers: '供應商管理',
            customers: '客戶管理',
            supplierName: '供應商名稱',
            customerName: '客戶名稱',
            contactPerson: '聯絡人',
            phone: '電話',
            email: '電子郵件',
            address: '地址',
            
            // 使用者管理
            users: '使用者管理',
            userRole: '使用者角色',
            admin: '管理員',
            user: '一般使用者',
            status: '狀態',
            active: '啟用',
            inactive: '停用',
            
            // 通知
            success: '成功',
            error: '錯誤',
            warning: '警告',
            info: '資訊',
            confirmDelete: '確定要刪除嗎？',
            operationSuccess: '操作成功',
            operationFailed: '操作失敗',
            
            // 驗證
            required: '此欄位為必填',
            invalidFormat: '格式不正確',
            minLength: '最少需要 {0} 個字元',
            maxLength: '最多只能 {0} 個字元',
            invalidEmail: '請輸入有效的電子郵件地址',
            invalidPhone: '請輸入有效的電話號碼',
            passwordMismatch: '密碼不一致'
        }
    },
    'en-US': {
        name: 'English',
        flag: '🇺🇸',
        translations: {
            // Login page
            login: 'Login',
            username: 'Username',
            password: 'Password',
            rememberMe: 'Remember me',
            loginSuccess: 'Login successful',
            loginFailed: 'Login failed',
            invalidCredentials: 'Invalid username or password',
            
            // Common
            loading: 'Loading...',
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            edit: 'Edit',
            add: 'Add',
            search: 'Search',
            filter: 'Filter',
            export: 'Export',
            import: 'Import',
            
            // Dashboard
            dashboard: 'Dashboard',
            totalProducts: 'Total Products',
            totalInventory: 'Total Inventory',
            lowStockItems: 'Low Stock Items',
            monthlyTransactions: 'Monthly Transactions',
            
            // Products
            products: 'Products',
            productName: 'Product Name',
            productCategory: 'Category',
            specification: 'Specification',
            unit: 'Unit',
            costPrice: 'Cost Price',
            sellingPrice: 'Selling Price',
            
            // Inventory
            inventory: 'Inventory',
            currentStock: 'Current Stock',
            minStock: 'Min Stock',
            maxStock: 'Max Stock',
            stockLocation: 'Location',
            
            // Inbound/Outbound
            inbound: 'Inbound',
            outbound: 'Outbound',
            inboundNumber: 'Inbound Number',
            outboundNumber: 'Outbound Number',
            quantity: 'Quantity',
            unitPrice: 'Unit Price',
            totalAmount: 'Total Amount',
            date: 'Date',
            notes: 'Notes',
            
            // Suppliers/Customers
            suppliers: 'Suppliers',
            customers: 'Customers',
            supplierName: 'Supplier Name',
            customerName: 'Customer Name',
            contactPerson: 'Contact Person',
            phone: 'Phone',
            email: 'Email',
            address: 'Address',
            
            // Users
            users: 'Users',
            userRole: 'Role',
            admin: 'Admin',
            user: 'User',
            status: 'Status',
            active: 'Active',
            inactive: 'Inactive',
            
            // Notifications
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info',
            confirmDelete: 'Are you sure you want to delete?',
            operationSuccess: 'Operation successful',
            operationFailed: 'Operation failed',
            
            // Validation
            required: 'This field is required',
            invalidFormat: 'Invalid format',
            minLength: 'Minimum {0} characters required',
            maxLength: 'Maximum {0} characters allowed',
            invalidEmail: 'Please enter a valid email address',
            invalidPhone: 'Please enter a valid phone number',
            passwordMismatch: 'Passwords do not match'
        }
    }
};

// 匯出設定
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        STORAGE_KEYS,
        THEMES,
        LANGUAGES
    };
} 