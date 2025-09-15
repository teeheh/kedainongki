/**
 * Kedai Nongki - Sistem Manajemen Kas
 * 
 * Cara konfigurasi:
 * 1. Ganti CLIENT_ID dengan Client ID dari Google Cloud Console
 * 2. Ganti SPREADSHEET_ID dengan ID spreadsheet Google Sheets Anda
 * 3. Pastikan spreadsheet sudah dibagikan (share) ke email layanan dari Google Cloud Console
 */

// Inisialisasi aplikasi saat dokumen dimuat
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    checkGoogleAPILoaded();
    window.addEventListener('resize', handleResize);
    handleResize();
        
    const modal = document.getElementById("transaction-modal");
    const openBtn = document.getElementById("add-transaction-btn"); // tombol di header
    const closeBtn = document.getElementById("close-transaction-modal");

    // Buka modal
    if (openBtn && modal) {
        openBtn.addEventListener("click", () => {
            modal.classList.remove("hidden");
        });
    }

    // Tutup modal
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }

    // Tutup modal kalau klik di luar modal
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.add("hidden");
        }
    });
});

// Konfigurasi Aplikasi
const CONFIG = {
    clientId: '883588123458-kc7p924f89q7dtg4ape0u8lslqjqvmrt.apps.googleusercontent.com', // Ganti dengan Client ID Anda
    spreadsheetId: '1gd1JcYiuUsPXO1xbwKHJomnLxMdK7s7xfJ60l3p7WKw', // Ganti dengan Spreadsheet ID Anda
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
    scope: 'https://www.googleapis.com/auth/spreadsheets'
};

// State Aplikasi
let state = {
    user: null,
    token: null,
    transactions: [],
    currentPage: 'dashboard',
    loading: false
};

// DOM Elements
const elements = {
    loginModal: document.getElementById('login-modal'),
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    bottomNav: document.getElementById('bottom-nav'),
    pageTitle: document.getElementById('page-title'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    googleLoginButton: document.getElementById('google-login-button'),
    logoutButton: document.getElementById('logout-btn'),
    pages: {
        dashboard: document.getElementById('dashboard-page'),
        transactions: document.getElementById('transactions-page'),
        reports: document.getElementById('reports-page')
    },
    loadingOverlay: document.getElementById('loading-overlay'),
    errorMessage: document.getElementById('error-message'),
    errorText: document.getElementById('error-text'),
    closeError: document.getElementById('close-error')
};

// Inisialisasi Aplikasi
function initApp() {
    // Debug console dinonaktifkan
    // Cek apakah user sudah login
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    const tokenExpiry = localStorage.getItem('token_expiry');
    const jwtToken = localStorage.getItem('jwt_token');
    
    // Debug console dinonaktifkan
// Debug console dinonaktifkan
    
    const now = new Date().getTime();
    const isTokenValid = tokenExpiry && parseInt(tokenExpiry) > now;
    
    if (user && (token || jwtToken) && (isTokenValid || jwtToken)) {
        try {
            state.user = JSON.parse(user);
            console.log('Parsed user data:', state.user);
            state.token = token;
            showApp();
            // Jangan panggil initSheets di sini, tunggu sampai gapi.client siap
        } catch (error) {
            console.error('Error parsing user data:', error);
            localStorage.removeItem('user');
            showLogin();
        }
    } else {
        console.log('No valid user session found');
        // Hapus token yang sudah kadaluarsa
        if (token && !isTokenValid) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('token_expiry');
            localStorage.removeItem('user');
            localStorage.removeItem('jwt_token');
        }
        showLogin();
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load Google API
    loadGoogleAPI();
    
    // Tambahkan event listener untuk DOMContentLoaded untuk memastikan semua elemen sudah dimuat
    if (document.readyState === 'loading') {
        try {
            document.addEventListener('DOMContentLoaded', () => {
                // Debug console dinonaktifkan
                // Pastikan elemen login button sudah ada
                elements.googleLoginButton = document.getElementById('google-login-button');
            });
        } catch (error) {
            // Tangani error tanpa menampilkan di console
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            navigateTo(page);
        });
    });
    
    // Sidebar toggle
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Tambahkan event listener untuk overlay
    elements.sidebarOverlay.addEventListener('click', function() {
        // Tutup sidebar dan overlay saat overlay diklik
        if (elements.sidebar.classList.contains('active')) {
            elements.sidebar.classList.remove('active');
            elements.sidebarOverlay.classList.remove('active');
        }
    });
    
    // Logout
    elements.logoutButton.addEventListener('click', logout);
    
    // Close error
    elements.closeError.addEventListener('click', hideError);
    
    // Transaction Shortcut Button sudah ditambahkan di atas
    
    // Close Transaction Modal event listener sudah ditambahkan di atas
    
    // Quick Transaction Form
    const quickTransactionForm = document.getElementById('quick-transaction-form');
    if (quickTransactionForm) {
        quickTransactionForm.addEventListener('submit', handleQuickAddTransaction);
    }
    
    // Event listeners untuk Transaction Shortcut Button, Close Transaction Modal, dan Quick Transaction Form sudah ditambahkan di atas
    
    // Transaction form
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleAddTransaction);
    }
    
    // Transactions filter
    const transactionsFilter = document.getElementById('transactions-filter');
    if (transactionsFilter) {
        transactionsFilter.addEventListener('change', filterTransactions);
    }
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    if (prevPageBtn && nextPageBtn) {
        prevPageBtn.addEventListener('click', () => handlePagination('prev'));
        nextPageBtn.addEventListener('click', () => handlePagination('next'));
    }
    
    // Report form
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', handleGenerateReport);
    }
    
    // Period filter change
    const periodFilter = document.getElementById('period');
    if (periodFilter) {
        periodFilter.addEventListener('change', toggleCustomDateRange);
    }
}

// Load Google API
function loadGoogleAPI() {
    try {
        // Pastikan gapi sudah tersedia sebelum memuat
        if (typeof gapi === 'undefined') {
            console.error('Google API belum dimuat');
            // Coba muat ulang script jika gapi tidak terdefinisi
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                console.log('Google API berhasil dimuat ulang');
                loadGoogleAPI();
            };
            document.body.appendChild(script);
            return;
        }

        gapi.load('client', () => {
            initGapiClient().then(() => {
                // Jika user sudah login, inisialisasi sheets
                if (state.token) {
                    initSheets();
                }
                // Inisialisasi Google Sign In setelah gapi client siap
                initGoogleSignIn();
            }).catch(error => {
                console.error('Gagal menginisialisasi Google API client:', error);
            });
        });
    } catch (error) {
        // Tangani error tanpa menghentikan aplikasi
        console.error("Error saat memuat Google API:", error);
    }
}


// Initialize Google API Client
async function initGapiClient() {
    try {
        await gapi.client.init({
            // Tidak perlu apiKey untuk OAuth2
            discoveryDocs: CONFIG.discoveryDocs,
        });
        console.log('Google API client berhasil diinisialisasi');
    } catch (error) {
        console.error('Gagal menginisialisasi Google API client:', error);
        throw error;
    }
}

// Setup Google Sign In
function initGoogleSignIn() {
    if (typeof google === 'undefined' || typeof google.accounts === 'undefined' || typeof google.accounts.id === 'undefined') {
        console.error('Google Sign-In API belum dimuat atau tidak lengkap');
        // Coba muat ulang script jika google tidak terdefinisi
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            console.log('Google Sign-In API berhasil dimuat ulang');
            // Tunggu sebentar untuk memastikan API benar-benar siap
            setTimeout(() => {
                initGoogleSignIn();
            }, 500);
        };
        script.onerror = (error) => {
            console.error('Gagal memuat Google Sign-In API:', error);
            showError('Gagal memuat Google Sign-In API. Coba muat ulang halaman.');
        };
        document.body.appendChild(script);
        return;
    }
    
    try {
        google.accounts.id.initialize({
            client_id: CONFIG.clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            ux_mode: 'popup',
            context: 'signin',
            itp_support: true,
            use_fedcm_for_prompt: true
        });
        
        // Log untuk debugging
        console.log('Google Sign-In initialized with client ID:', CONFIG.clientId);
        
        // Setup click handler for custom Google Sign In Button
        if (elements.googleLoginButton) {
            // Hapus event listener lama jika ada
            const newButton = elements.googleLoginButton.cloneNode(true);
            elements.googleLoginButton.parentNode.replaceChild(newButton, elements.googleLoginButton);
            elements.googleLoginButton = newButton;
            
            elements.googleLoginButton.addEventListener('click', () => {
                console.log('Google login button clicked');
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.clientId,
                    scope: CONFIG.scope,
                    callback: handleCredentialResponse
                });
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });

        } else {
            console.error('Google login button tidak ditemukan');
        }
    } catch (error) {
        console.error('Error initializing Google Sign-In:', error);
        showError('Error saat menginisialisasi Google Sign-In: ' + error.message);
    }
}

// Handle Google Sign In Response
function handleCredentialResponse(response) {
    console.log("Received credential response:", response);

    // Jika response dari OAuth2 Token Client
    if (response && response.access_token) {
        state.token = response.access_token;

        // Simpan token ke localStorage
        const expiryTime = new Date().getTime() + (response.expires_in * 1000);
        localStorage.setItem('access_token', state.token);
        localStorage.setItem('token_expiry', expiryTime.toString());

        // Coba dapatkan info user dari ID token jika ada
        if (response.id_token) {
            const payload = parseJwt(response.id_token);
            if (payload) {
                state.user = {
                    name: payload.name || "Google User",
                    email: payload.email || "-",
                    picture: payload.picture || ""
                };
                localStorage.setItem('user', JSON.stringify(state.user));
            } else {
                // Fallback jika tidak bisa decode ID token
                state.user = { name: "Google User", email: "-", picture: "" };
                localStorage.setItem('user', JSON.stringify(state.user));
            }
        } else {
            // Fallback jika tidak ada ID token
            state.user = { name: "Google User", email: "-", picture: "" };
            localStorage.setItem('user', JSON.stringify(state.user));
        }

        state.loggedIn = true;
        showApp();
        return;
    }

    // Jika response dari Google Identity Services (JWT credential)
    if (response && response.credential) {
        // Simpan JWT token ke localStorage
        localStorage.setItem('jwt_token', response.credential);
        
        const payload = parseJwt(response.credential);
        console.log('JWT payload:', payload);
        
        if (payload && payload.name) {
            // Pastikan URL gambar menggunakan https
            let pictureUrl = payload.picture || '';
            if (pictureUrl && !pictureUrl.startsWith('https://')) {
                pictureUrl = pictureUrl.replace('http://', 'https://');
            }
            
            state.user = {
                name: payload.name || 'Google User',
                email: payload.email || '-',
                picture: pictureUrl
            };
            console.log('Setting user state from JWT:', state.user);
            localStorage.setItem('user', JSON.stringify(state.user));
            
            // Pastikan elemen DOM sudah siap
            setTimeout(() => {
                showApp();
            }, 100);
            return;
        } else {
            console.error('Invalid JWT payload:', payload);
            showError('Login gagal: tidak dapat memproses data pengguna');
            return;
        }
    }

    console.error("Invalid credential response", response);
    showError("Login gagal: respons Google tidak valid");
}


// Initialize Google Sheets
function initSheets() {
    // Pastikan gapi.client sudah diinisialisasi
    if (!gapi.client) {
        console.error('gapi.client belum diinisialisasi');
        return;
    }
    
    // Set token untuk autentikasi
    gapi.client.setToken({ access_token: state.token });
    
    // Tambahkan delay kecil untuk memastikan token sudah diproses
    setTimeout(() => {
        loadTransactions();
    }, 500);
}

// Load transactions from Google Sheets
async function loadTransactions() {
    showLoading();
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Transaksi!A:F' // Updated range to include ID column
        });

        if (response.result.values && response.result.values.length > 0) {
            const rows = response.result.values.slice(1);
            state.transactions = rows.map((row, idx) => {
                const rawAmount = row[5] || '0'; // Updated index for amount
                const parsedAmount = Number(rawAmount.toString().replace(/[^0-9-]/g, '')) || 0;
                // Normalisasi metode pembayaran
                const normalizedMethod = (row[4] || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                // Normalisasi jenis transaksi
                const normalizedType = (row[3] || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                return {
                    rowIndex: idx + 2, // baris asli di sheet
                    id: row[0] || '', // Add ID from first column
                    date: row[1], // Updated index
                    description: row[2], // Updated index
                    type: normalizedType, // Jenis yang sudah dinormalisasi
                    method: normalizedMethod, // Metode yang sudah dinormalisasi
                    amount: parsedAmount
                };
            });
        } else {
            state.transactions = getDummyData();
        }
        updateUI();
    } catch (error) {
        showError('Gagal memuat data: ' + error.message);
        state.transactions = getDummyData();
        updateUI();
    } finally {
        hideLoading();
    }
}

// ... kode lain tetap sama di atas

// Add new transaction
async function handleAddTransaction(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Pastikan amount diproses dengan benar
    const rawAmount = formData.get('amount') || '0';
    const parsedAmount = parseFloat(rawAmount.replace(/[^\d.-]/g, '')) || 0;
    
    console.log('Adding transaction - raw amount:', rawAmount, 'parsed amount:', parsedAmount);
    
    // Generate unique ID (combination of date and random number)
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const transactionId = dateStr + randomNum;
    
    // Normalisasi metode pembayaran
    const normalizedMethod = (formData.get('method') || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    // Normalisasi jenis transaksi
    const normalizedType = (formData.get('type') || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    
    const transaction = {
        id: transactionId,
        date: formData.get('date') || new Date().toISOString().split('T')[0],
        description: formData.get('description'),
        type: normalizedType, // Jenis yang sudah dinormalisasi
        method: normalizedMethod, // Metode yang sudah dinormalisasi
        amount: parsedAmount
    };
    
    // Pastikan nilai tidak null atau undefined
    if (!transaction.description) transaction.description = '';
    if (!transaction.type) transaction.type = '';
    if (!transaction.method) transaction.method = '';
    
    console.log('New transaction object:', transaction);
    
    // Validation
    if (!transaction.description || !transaction.type || !transaction.method) {
        showError('Harap isi semua field yang diperlukan');
        return;
    }
    
    showLoading();
    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Transaksi!A:F',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    transaction.id,
                    transaction.date,
                    transaction.description,
                    transaction.type,
                    transaction.method,
                    transaction.amount
                ]]
            }
        });

        // Add to local state
        state.transactions.push(transaction);

        // Reset form
        form.reset();

        // Update UI
        updateUI();

        // Show success message
        showMessage('Transaksi berhasil ditambahkan');
    } catch (error) {
        showError('Gagal menambahkan transaksi: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ... kode lain tetap sama di bawah

// Open Transaction Modal
function openTransactionModal() {
    const modal = document.getElementById('transaction-modal');
    if (modal) {
        // Set tanggal hari ini sebagai default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('quick-date').value = today;
        
        // Tampilkan modal
        modal.classList.remove('hidden');
    }
}

// Close Modal
function closeModal() {
    const modal = document.getElementById('transaction-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Handle Quick Add Transaction (from modal)
async function handleQuickAddTransaction(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Pastikan amount diproses dengan benar
    const rawAmount = formData.get('amount') || '0';
    const parsedAmount = parseFloat(rawAmount.replace(/[^\d.-]/g, '')) || 0;
    
    console.log('Adding quick transaction - raw amount:', rawAmount, 'parsed amount:', parsedAmount);
    
    // Generate unique ID (combination of date and random number)
    const today = new Date();
    const dateStr = today.getFullYear().toString() + 
                   (today.getMonth() + 1).toString().padStart(2, '0') + 
                   today.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const transactionId = dateStr + randomNum;
    
    // Normalisasi metode pembayaran
    const normalizedMethod = (formData.get('quick-method') || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    // Normalisasi jenis transaksi
    const normalizedType = (formData.get('quick-type') || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    
    const transaction = {
        id: transactionId,
        date: formData.get('quick-date') || new Date().toISOString().split('T')[0],
        description: formData.get('quick-description'),
        type: normalizedType, // Jenis yang sudah dinormalisasi
        method: normalizedMethod, // Metode yang sudah dinormalisasi
        amount: parsedAmount
    };
    
    // Pastikan nilai tidak null atau undefined
    if (!transaction.description) transaction.description = '';
    if (!transaction.type) transaction.type = '';
    if (!transaction.method) transaction.method = '';
    
    console.log('New quick transaction object:', transaction);
    
    // Validation
    if (!transaction.description || !transaction.type || !transaction.method) {
        showError('Harap isi semua field yang diperlukan');
        return;
    }
    
    showLoading();
    try {
        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Transaksi!A:F',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    transaction.id,
                    transaction.date,
                    transaction.description,
                    transaction.type,
                    transaction.method,
                    transaction.amount
                ]]
            }
        });

        // Add to local state
        state.transactions.push(transaction);

        // Reset form
        form.reset();

        // Close modal
        closeModal();

        // Update UI
        updateUI();

        // Show success message
        showMessage('Transaksi berhasil ditambahkan');
    } catch (error) {
        showError('Gagal menambahkan transaksi: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Generate report
function handleGenerateReport(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const period = formData.get('period');
    const reportType = formData.get('report-type');
    
    // Calculate date range based on period
    const dateRange = calculateDateRange(period);
    
    // Filter transactions by date range
    const filteredTransactions = state.transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    });
    
    // Update report UI
    updateReportUI(filteredTransactions, dateRange, reportType);
}

// Calculate date range based on period selection
function calculateDateRange(period) {
    const today = new Date();
    let startDate, endDate;
    
    switch (period) {
        case 'daily':
            startDate = new Date(today);
            endDate = new Date(today);
            break;
        case 'weekly':
            // Start of week (Monday)
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay() + 1);
            endDate = new Date(today);
            break;
        case 'monthly':
            // Start of month
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today);
            break;
        case 'quarterly':
            // Start of current quarter
            const currentQuarter = Math.floor(today.getMonth() / 3);
            startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
            endDate = new Date(today);
            break;
        case 'yearly':
            // Start of year
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today);
            break;
        case 'last-month':
            // Last month
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'last-quarter':
            // Last quarter
            const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
            const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
            const quarter = lastQuarter < 0 ? 3 : lastQuarter;
            startDate = new Date(year, quarter * 3, 1);
            endDate = new Date(year, (quarter + 1) * 3, 0);
            break;
        case 'last-year':
            // Last year
            startDate = new Date(today.getFullYear() - 1, 0, 1);
            endDate = new Date(today.getFullYear() - 1, 11, 31);
            break;
        case 'custom':
            const startInput = document.getElementById('start-date').value;
            const endInput = document.getElementById('end-date').value;
            startDate = startInput ? new Date(startInput) : new Date(today);
            endDate = endInput ? new Date(endInput) : new Date(today);
            break;
        default:
            startDate = new Date(today);
            endDate = new Date(today);
    }
    
    // Set time to beginning and end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return { start: startDate, end: endDate };
}

// Toggle custom date range visibility
function toggleCustomDateRange() {
    const period = document.getElementById('period').value;
    const customDateRange = document.getElementById('custom-date-range');
    
    if (period === 'custom') {
        customDateRange.style.display = 'grid';
    } else {
        customDateRange.style.display = 'none';
    }
}

// Filter transactions
function filterTransactions() {
    const filter = document.getElementById('transactions-filter').value;
    let filteredTransactions = state.transactions;
    
    if (filter === 'income') {
        filteredTransactions = state.transactions.filter(t => t.type.trim().toLowerCase() === 'pemasukan');
    } else if (filter === 'expense') {
        filteredTransactions = state.transactions.filter(t => t.type.trim().toLowerCase() === 'pengeluaran');
    }
    
    updateTransactionsUI(filteredTransactions);
}

// Update all UI components
function updateUI() {
    updateDashboard();
    updateTransactionsUI(state.transactions);
    updateUserInfo();
    setupTransactionSearch();
}

// Update dashboard metrics
function updateDashboard() {
    // Debug console dinonaktifkan
    
    // Calculate metrics
    const totalIncome = state.transactions
        .filter(t => t.type.trim().toLowerCase() === 'pemasukan')
        .reduce((sum, t) => {
            const amount = parseFloat(t.amount) || 0;
            // Debug console dinonaktifkan
            return sum + amount;
        }, 0);
    
    const totalExpense = state.transactions
        .filter(t => t.type.trim().toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => {
            const amount = parseFloat(t.amount) || 0;
            // Debug console dinonaktifkan
            return sum + amount;
        }, 0);
    
    const netProfit = totalIncome - totalExpense;
    const totalTransactions = state.transactions.length;
    
    // Debug console dinonaktifkan
    
    // Cash breakdown
    const cashIncome = state.transactions
        .filter(t => t.method.trim().toLowerCase() === 'tunai' && t.type.trim().toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
    const cashExpense = state.transactions
        .filter(t => t.method.trim().toLowerCase() === 'tunai' && t.type.trim().toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    const nonCashIncome = state.transactions
        .filter(t => t.method.trim().toLowerCase() === 'non tunai' && t.type.trim().toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
    const nonCashExpense = state.transactions
        .filter(t => t.method.trim().toLowerCase() === 'non tunai' && t.type.trim().toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    // Total untuk setiap metode pembayaran
    const totalCash = cashIncome + cashExpense;
    const totalNonCash = nonCashIncome + nonCashExpense;
    
    // Nilai bersih (pemasukan - pengeluaran) untuk setiap metode
    const cashAmount = cashIncome - cashExpense;
    const nonCashAmount = nonCashIncome - nonCashExpense;
    
    // Total keseluruhan untuk persentase
    const totalAmount = totalCash + totalNonCash;
    const cashPercentage = totalAmount > 0 ? (totalCash / totalAmount) * 100 : 0;
    const nonCashPercentage = totalAmount > 0 ? (totalNonCash / totalAmount) * 100 : 0;
    

    
    // Ratios
    const profitRatio = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    // Update DOM dengan format mata uang yang benar
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('net-profit').textContent = formatCurrency(netProfit);
    document.getElementById('total-transactions').textContent = totalTransactions;

    // Update nilai breakdown kas
    document.getElementById('cash-amount').textContent = formatCurrency(cashAmount);
    document.getElementById('non-cash-amount').textContent = formatCurrency(nonCashAmount);

    document.getElementById('cash-percentage').textContent = cashPercentage.toFixed(1) + '%';
    document.getElementById('non-cash-percentage').textContent = nonCashPercentage.toFixed(1) + '%';

    document.getElementById('profit-ratio').textContent = profitRatio.toFixed(1) + '%';
    document.getElementById('expense-ratio').textContent = expenseRatio.toFixed(1) + '%';

    // Update progress bars
    document.querySelector('.progress-fill.cash').style.width = cashPercentage + '%';
    document.querySelector('.progress-fill.non-cash').style.width = nonCashPercentage + '%';
    document.querySelector('.progress-fill.profit-ratio').style.width = Math.max(0, profitRatio) + '%';
    document.querySelector('.progress-fill.expense-ratio').style.width = Math.min(100, expenseRatio) + '%';

    
    // Update recent transactions
    updateRecentTransactions();
}

// Update recent transactions
function updateRecentTransactions() {
    // Debug console dinonaktifkan
    
    const recentTransactions = state.transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    // Debug console dinonaktifkan
    
    const tableBody = document.querySelector('#recent-transactions-table tbody');
    const cardsContainer = document.getElementById('recent-transactions-cards');
    
    // Clear previous content
    if (tableBody) tableBody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    // Add rows to table
    recentTransactions.forEach(transaction => {
        // Pastikan amount adalah angka yang valid
        const amount = parseFloat(transaction.amount) || 0;
        // Debug console dinonaktifkan
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><small class="text-muted">${transaction.id || 'N/A'}</small></td>
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.description}</td>
            <td><span class="badge ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
            <td>${transaction.method}</td>
            <td>${formatCurrency(amount)}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add cards for mobile view
    recentTransactions.forEach(transaction => {
        // Pastikan amount adalah angka yang valid
        const amount = parseFloat(transaction.amount) || 0;
        
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
            <div class="transaction-card-header">
                <span class="transaction-date">${formatDate(transaction.date)}</span>
                <span class="transaction-type ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
            </div>
            <div class="transaction-id"><small class="text-muted">ID: ${transaction.id || 'N/A'}</small></div>
            <div class="transaction-description">${transaction.description}</div>
            <div class="transaction-details">
                <span>${transaction.method}</span>
                <span>${formatCurrency(amount)}</span>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
}

// Update transactions UI
// Pagination state
let paginationState = {
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
};

// Handle pagination navigation
function handlePagination(direction) {
    if (direction === 'prev' && paginationState.currentPage > 1) {
        paginationState.currentPage--;
    } else if (direction === 'next' && paginationState.currentPage < paginationState.totalPages) {
        paginationState.currentPage++;
    }
    
    // Re-render transactions with new page
    updateTransactionsUI(state.transactions);
}

// Fungsi untuk autocomplete pencarian transaksi
function setupTransactionSearch() {
    const searchInput = document.getElementById('transaction-search');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const resetButton = document.getElementById('reset-search');
    
    if (!searchInput || !autocompleteResults) return;
    
    // Event listener untuk tombol reset
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            searchInput.value = '';
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('show');
            updateTransactionsUI(state.transactions);
        });
    }
    
    // Event listener untuk input pencarian
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        // Jika query kosong, sembunyikan hasil autocomplete
        if (query === '') {
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('show');
            // Tampilkan semua transaksi
            updateTransactionsUI(state.transactions);
            return;
        }
        
        // Cari transaksi yang cocok dengan query
        const matchingTransactions = state.transactions.filter(transaction => {
            return (
                transaction.description.toLowerCase().includes(query) ||
                transaction.type.toLowerCase().includes(query) ||
                transaction.method.toLowerCase().includes(query) ||
                transaction.id.toLowerCase().includes(query) ||
                formatDate(transaction.date).toLowerCase().includes(query) ||
                formatCurrency(transaction.amount).toLowerCase().includes(query)
            );
        });
        
        // Tampilkan hasil autocomplete
        autocompleteResults.innerHTML = '';
        
        // Batasi hasil autocomplete hingga 5 item
        const limitedResults = matchingTransactions.slice(0, 5);
        
        if (limitedResults.length > 0) {
            limitedResults.forEach(transaction => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                
                // Highlight bagian yang cocok dengan query
                const description = highlightMatch(transaction.description, query);
                const date = highlightMatch(formatDate(transaction.date), query);
                const type = highlightMatch(transaction.type, query);
                
                item.innerHTML = `
                    <div><strong>${description}</strong></div>
                    <div>${date} - ${type} - ${formatCurrency(transaction.amount)}</div>
                `;
                
                // Event listener untuk item autocomplete
                item.addEventListener('click', function() {
                    // Isi input dengan deskripsi transaksi
                    searchInput.value = transaction.description;
                    // Sembunyikan hasil autocomplete
                    autocompleteResults.classList.remove('show');
                    // Filter transaksi berdasarkan item yang dipilih
                    updateTransactionsUI([transaction]);
                });
                
                autocompleteResults.appendChild(item);
            });
            
            autocompleteResults.classList.add('show');
        } else {
            // Jika tidak ada hasil, tampilkan pesan
            const noResults = document.createElement('div');
            noResults.className = 'autocomplete-item';
            noResults.textContent = 'Tidak ada hasil yang cocok';
            autocompleteResults.appendChild(noResults);
            autocompleteResults.classList.add('show');
        }
        
        // Filter transaksi berdasarkan query
        updateTransactionsUI(matchingTransactions);
    });
    
    // Sembunyikan hasil autocomplete saat klik di luar
    document.addEventListener('click', function(e) {
        if (e.target !== searchInput && !autocompleteResults.contains(e.target)) {
            autocompleteResults.classList.remove('show');
        }
    });
    
    // Fungsi untuk highlight teks yang cocok dengan query
    function highlightMatch(text, query) {
        if (!text) return '';
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }
}

function updateTransactionsUI(transactions) {
    console.log('Updating transactions UI with transactions:', transactions);
    
    const tableBody = document.querySelector('#transactions-table tbody');
    const cardsContainer = document.getElementById('transactions-cards');
    
    // Clear previous content
    if (tableBody) tableBody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log('Sorted transactions for display:', sortedTransactions);
    
    // Calculate pagination
    paginationState.totalPages = Math.ceil(sortedTransactions.length / paginationState.itemsPerPage) || 1;
    if (paginationState.currentPage > paginationState.totalPages) {
        paginationState.currentPage = paginationState.totalPages;
    }
    
    // Get current page items
    const startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
    const endIndex = startIndex + paginationState.itemsPerPage;
    const currentPageItems = sortedTransactions.slice(startIndex, endIndex);
    
    // Update pagination UI
    document.getElementById('current-page').textContent = paginationState.currentPage;
    document.getElementById('total-pages').textContent = paginationState.totalPages;
    document.getElementById('prev-page').disabled = paginationState.currentPage <= 1;
    document.getElementById('next-page').disabled = paginationState.currentPage >= paginationState.totalPages;
    
    // Add rows to table
    currentPageItems.forEach((transaction, index) => {
        // Pastikan amount adalah angka yang valid
        const amount = parseFloat(transaction.amount) || 0;
        console.log('Transaction for UI:', transaction, 'parsed amount:', amount);
        
        // Calculate the global index for the transaction in the full array
        const globalIndex = startIndex + index;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><small class="text-muted">${transaction.id || 'N/A'}</small></td>
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.description}</td>
            <td><span class="badge ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
            <td>${transaction.method}</td>
            <td>${formatCurrency(amount)}</td>
            <td>
                <button class="btn-icon" title="Edit" onclick="editTransaction(${globalIndex})"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon" title="Hapus" onclick="deleteTransaction(${globalIndex})"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add cards for mobile view
    currentPageItems.forEach((transaction, index) => {
        // Pastikan amount adalah angka yang valid
        const amount = parseFloat(transaction.amount) || 0;
        
        // Calculate the global index for the transaction in the full array
        const globalIndex = startIndex + index;
        
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
            <div class="transaction-card-header">
                <span class="transaction-date">${formatDate(transaction.date)}</span>
                <span class="transaction-type ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
            </div>
            <div class="transaction-id"><small class="text-muted">ID: ${transaction.id || 'N/A'}</small></div>
            <div class="transaction-description">${transaction.description}</div>
            <div class="transaction-details">
                <span>${transaction.method}</span>
                <span>${formatCurrency(amount)}</span>
            </div>
            <div class="transaction-actions">
                <button class="btn-icon" title="Edit" onclick="editTransaction(${globalIndex})"><i class="bi bi-pencil"></i></button>
                <button class="btn-icon" title="Hapus" onclick="deleteTransaction(${globalIndex})"><i class="bi bi-trash"></i></button>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
}

// Variabel global untuk menyimpan instance chart
let pieChart = null;
let barChart = null;

// Update report UI
function updateReportUI(transactions, dateRange, reportType) {
    // Debug console dinonaktifkan
    
    // Calculate report metrics
    const totalIncome = transactions
        .filter(t => t.type.trim().toLowerCase() === 'pemasukan')
        .reduce((sum, t) => {
            const amount = parseFloat(t.amount) || 0;
            // Debug console dinonaktifkan
            return sum + amount;
        }, 0);
    
    const totalExpense = transactions
        .filter(t => t.type.trim().toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => {
            const amount = parseFloat(t.amount) || 0;
            // Debug console dinonaktifkan
            return sum + amount;
        }, 0);
    
    const netProfit = totalIncome - totalExpense;
    const profitPercentage = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
    
    // Calculate average transactions per day
    const daysDiff = Math.max(1, Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)));
    const avgTransactionsPerDay = transactions.length / daysDiff;
    
    // Debug console dinonaktifkan
    
    // Update summary
    document.getElementById('report-income').textContent = formatCurrency(totalIncome);
    document.getElementById('report-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('report-profit').textContent = formatCurrency(netProfit);
    document.getElementById('report-profit-percent').textContent = profitPercentage.toFixed(1) + '%';
    
    // Update date range display
    const rangeText = `Periode: ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
    document.getElementById('report-range').textContent = rangeText;
    
    // Show/hide empty state
    const emptyState = document.getElementById('empty-state');
    const reportContainer = document.getElementById('report-container');
    
    // Hide all report sections first
    const reportBasic = document.getElementById('report-basic');
    const reportAnalytic = document.getElementById('report-analytic');
    const reportVisual = document.getElementById('report-visual');
    const reportForecast = document.getElementById('report-forecast');
    
    // Jika bukan tipe 'all', sembunyikan semua laporan terlebih dahulu
    if (reportType !== 'all') {
        if (reportBasic) reportBasic.classList.add('hidden');
        if (reportAnalytic) reportAnalytic.classList.add('hidden');
        if (reportVisual) reportVisual.classList.add('hidden');
        if (reportForecast) reportForecast.classList.add('hidden');
    }
    
    if (transactions.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (reportContainer) reportContainer.classList.add('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        if (reportContainer) reportContainer.classList.remove('hidden');
        
        // Show appropriate report section based on report type
        // Jika tipe laporan 'all', tampilkan semua jenis laporan
        if (reportType === 'all') {
            if (reportBasic) reportBasic.classList.remove('hidden');
            if (reportAnalytic) reportAnalytic.classList.remove('hidden');
            if (reportVisual) reportVisual.classList.remove('hidden');
            if (reportForecast) reportForecast.classList.remove('hidden');
            
            // Update semua metrik laporan
            updateBasicReportMetrics();
            updateAnalyticReportMetrics();
        }
        else if (reportType === 'basic' && reportBasic) {
            reportBasic.classList.remove('hidden');
            updateBasicReportMetrics();
        } 
        else if (reportType === 'analytic' && reportAnalytic) {
            reportAnalytic.classList.remove('hidden');
            updateAnalyticReportMetrics();
        }
        else if (reportType === 'visual' && reportVisual) {
            reportVisual.classList.remove('hidden');
        }
        else if (reportType === 'forecast' && reportForecast) {
            reportForecast.classList.remove('hidden');
        }
        
        // Fungsi untuk memperbarui metrik laporan dasar
        function updateBasicReportMetrics() {
            // Update basic report metrics
            const totalIncomeEl = document.getElementById('total-income');
            const totalExpenseEl = document.getElementById('total-expense');
            const profitLossEl = document.getElementById('profit-loss');
            const transactionCountEl = document.getElementById('transaction-count');
            const avgTransactionEl = document.getElementById('avg-transaction');
            
            if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);
            if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
            if (profitLossEl) profitLossEl.textContent = formatCurrency(netProfit);
            if (transactionCountEl) transactionCountEl.textContent = transactions.length;
            if (avgTransactionEl) avgTransactionEl.textContent = avgTransactionsPerDay.toFixed(1);
            
            // Update saldo akhir periode (assuming beginning balance is 0 for now)
            const beginningBalance = 0; // This should be calculated or retrieved from previous period
            const netMovement = netProfit;
            const endingBalance = beginningBalance + netMovement;
            
            const beginningBalanceEl = document.getElementById('beginning-balance');
            const netMovementEl = document.getElementById('net-movement');
            const endingBalanceEl = document.getElementById('ending-balance');
            
            if (beginningBalanceEl) beginningBalanceEl.textContent = formatCurrency(beginningBalance);
            if (netMovementEl) netMovementEl.textContent = formatCurrency(netMovement);
            if (endingBalanceEl) endingBalanceEl.textContent = formatCurrency(endingBalance);
        }
        
        // Fungsi untuk memperbarui metrik laporan analitis
        function updateAnalyticReportMetrics() {
            // Update analytic report metrics
            const profitMarginEl = document.getElementById('profit-margin');
            const profitMarginBarEl = document.getElementById('profit-margin-bar');
            const expenseRatioEl = document.getElementById('expense-ratio-analytics');
            const expenseRatioBarEl = document.getElementById('expense-ratio-bar');
            
            if (profitMarginEl) profitMarginEl.textContent = profitPercentage.toFixed(1) + '%';
            if (profitMarginBarEl) profitMarginBarEl.style.width = Math.min(100, profitPercentage) + '%';
            
            if (expenseRatioEl) expenseRatioEl.textContent = expenseRatio.toFixed(1) + '%';
            if (expenseRatioBarEl) expenseRatioBarEl.style.width = Math.min(100, expenseRatio) + '%';
            
            // Tampilkan elemen analisis metode pembayaran
            document.getElementById('payment-method-analysis').style.display = 'grid';
        }
        
        // Forecast telah dihapus dari UI
        // if (reportType === 'forecast' || reportType === 'all') {
        //     generateForecast(transactions, dateRange);
        //     document.getElementById('report-forecast').classList.remove('hidden');
        // }
        
        // Update charts for all report types
        updateCharts(transactions, dateRange, reportType);
        
        // Update report table for basic report
        if (reportType === 'basic' || reportType === 'all') {
            const tableBody = document.querySelector('#report-table tbody');
            if (!tableBody) return;
            tableBody.innerHTML = '';
        
            // Show detailed transactions for basic report
            transactions.forEach(transaction => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formatDate(new Date(transaction.date))}</td>
                    <td>${transaction.description}</td>
                    <td><span class="badge ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
                    <td>${transaction.method}</td>
                    <td class="${transaction.type === 'Pemasukan' ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloat(transaction.amount))}</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        // For analytic report, create breakdown by category
        if (reportType === 'analytic' || reportType === 'all') {
            // Tampilkan elemen analitik
            document.getElementById('report-analytic').classList.remove('hidden');
            // Group income by category
            const incomeByCategory = {};
            const expenseByCategory = {};
            const paymentMethods = { 'Tunai': 0, 'Non Tunai': 0 };
            
            // Hitung metode pembayaran berdasarkan transaksi aktual
            transactions.forEach(transaction => {
                const amount = parseFloat(transaction.amount) || 0;
                const category = transaction.category || 'Lainnya';
                const method = (transaction.method || 'Tunai').trim().toLowerCase();
                const normalizedMethod = method === 'tunai' ? 'Tunai' : 'Non Tunai';
                
                // Tambahkan ke total metode pembayaran
                paymentMethods[normalizedMethod] = (paymentMethods[normalizedMethod] || 0) + amount;
                
                if (transaction.type.trim().toLowerCase() === 'pemasukan') {
                    incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
                } else {
                    expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
                }
            });
            
            // Category breakdown telah dihapus
            
            // Update payment method breakdown
            const totalPayments = Object.values(paymentMethods).reduce((sum, val) => sum + val, 0);
            const cashPercentage = totalPayments > 0 ? (paymentMethods['Tunai'] / totalPayments) * 100 : 0;
            const nonCashPercentage = totalPayments > 0 ? (paymentMethods['Non Tunai'] / totalPayments) * 100 : 0;
            
            // Buat atau perbarui elemen analisis metode pembayaran
            const paymentMethodAnalysis = document.getElementById('payment-method-analysis');
            paymentMethodAnalysis.innerHTML = '';
            
            // Buat elemen untuk metode Tunai
            const cashElement = document.createElement('div');
            cashElement.className = 'payment-method-item';
            cashElement.innerHTML = `
                <div class="payment-method-header">
                    <div class="payment-method-name">
                        <div class="payment-method-icon">T</div>
                        Tunai
                    </div>
                    <div class="payment-method-percentage">${cashPercentage.toFixed(1)}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill cash" style="width: ${cashPercentage}%"></div>
                </div>
                <div class="payment-method-stats">
                    <div class="payment-stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value">${formatCurrency(paymentMethods['Tunai'])}</div>
                    </div>
                </div>
            `;
            paymentMethodAnalysis.appendChild(cashElement);
            
            // Buat elemen untuk metode Non Tunai
            const nonCashElement = document.createElement('div');
            nonCashElement.className = 'payment-method-item';
            nonCashElement.innerHTML = `
                <div class="payment-method-header">
                    <div class="payment-method-name">
                        <div class="payment-method-icon">N</div>
                        Non Tunai
                    </div>
                    <div class="payment-method-percentage">${nonCashPercentage.toFixed(1)}%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill non-cash" style="width: ${nonCashPercentage}%"></div>
                </div>
                <div class="payment-method-stats">
                    <div class="payment-stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value">${formatCurrency(paymentMethods['Non Tunai'])}</div>
                    </div>
                </div>
            `;
            paymentMethodAnalysis.appendChild(nonCashElement);
        } 
        // Group transactions by type for comparison report
        else if (reportType === 'comparison') {
            // Group by method
            const groupedByMethod = {};
            
            transactions.forEach(transaction => {
                const methodRaw = transaction.method || 'Tunai';
                const method = methodRaw.trim().toLowerCase() === 'tunai' ? 'Tunai' : 'Non Tunai';
                if (!groupedByMethod[method]) {
                    groupedByMethod[method] = {
                        method: method,
                        income: 0,
                        expense: 0,
                        count: 0
                    };
                }
                
                const amount = parseFloat(transaction.amount) || 0;
                groupedByMethod[method].count++;
                if (transaction.type.trim().toLowerCase() === 'pemasukan') {
                    groupedByMethod[method].income += amount;
                } else {
                    groupedByMethod[method].expense += amount;
                }
            });
            
            // Convert to array
            const comparisonData = Object.values(groupedByMethod);
            
            // Add rows to table
            comparisonData.forEach(method => {
                const row = document.createElement('tr');
                const netAmount = method.income - method.expense;
                row.innerHTML = `
                    <td>-</td>
                    <td>Perbandingan Metode</td>
                    <td>-</td>
                    <td>${method.method}</td>
                    <td>
                        <div>Jumlah Transaksi: ${method.count}</div>
                        <div>Pemasukan: ${formatCurrency(method.income)}</div>
                        <div>Pengeluaran: ${formatCurrency(method.expense)}</div>
                        <div>Bersih: ${formatCurrency(netAmount)}</div>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }
        // Detailed report (default)
        else {
            const tableBody = document.querySelector('#report-table tbody');
            const cardsContainer = document.getElementById('report-cards');
            
            if (tableBody) tableBody.innerHTML = '';
            if (cardsContainer) cardsContainer.innerHTML = '';
            
            transactions.forEach(transaction => {
                // Add row to table
                if (tableBody) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${formatDate(transaction.date)}</td>
                        <td>${transaction.description}</td>
                        <td><span class="badge ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
                        <td>${transaction.method}</td>
                        <td>${formatCurrency(transaction.amount)}</td>
                    `;
                    tableBody.appendChild(row);
                }
                
                // Add card for mobile view
                if (cardsContainer) {
                    const card = document.createElement('div');
                    card.className = 'transaction-card';
                    card.innerHTML = `
                        <div class="transaction-card-header">
                            <span class="transaction-date">${formatDate(transaction.date)}</span>
                            <span class="transaction-type ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
                        </div>
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-details">
                            <span>${transaction.method}</span>
                            <span>${formatCurrency(transaction.amount)}</span>
                        </div>
                    `;
                    cardsContainer.appendChild(card);
                }
            });
        }
    }
}

// Fungsi untuk memperbarui grafik
function updateCharts(transactions, dateRange, reportType) {
    // Inisialisasi variabel di luar blok try-catch
    let totalIncome = 0;
    let totalExpense = 0;
    
    try {
        // Persiapkan data untuk pie chart (perbandingan pemasukan & pengeluaran)
        totalIncome = transactions
            .filter(t => t.type.trim().toLowerCase() === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        totalExpense = transactions
            .filter(t => t.type.trim().toLowerCase() === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        // Untuk laporan visualisasi, perbarui semua grafik
        if (reportType === 'visual' || reportType === 'all') {
            // Tampilkan elemen visualisasi
            document.getElementById('report-visual').classList.remove('hidden');
            
            // Donut chart telah dihapus
            
            // Tren harian telah dihapus
        }
    } catch (error) {
        console.error('Error in updateCharts:', error);
    }
    
    try {
        // Update pie chart
        updatePieChart(totalIncome, totalExpense);
    } catch (error) {
        console.error('Error in updatePieChart:', error);
    }
    
    // Persiapkan data untuk bar chart (tren transaksi)
    let barChartData;
    
    if (reportType === 'summary') {
        // Group by date for summary report
        const groupedByDate = {};
        
        transactions.forEach(transaction => {
            const dateKey = formatDate(transaction.date);
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    income: 0,
                    expense: 0
                };
            }
            
            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'Pemasukan') {
                groupedByDate[dateKey].income += amount;
            } else {
                groupedByDate[dateKey].expense += amount;
            }
        });
        
        // Convert to array and sort by date (ascending for chart)
        barChartData = Object.values(groupedByDate).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });
    } else if (reportType === 'comparison') {
        // Group by method for comparison report
        const groupedByMethod = {};
        
        transactions.forEach(transaction => {
            const method = transaction.method;
            if (!groupedByMethod[method]) {
                groupedByMethod[method] = {
                    method: method,
                    income: 0,
                    expense: 0
                };
            }
            
            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'Pemasukan') {
                groupedByMethod[method].income += amount;
            } else {
                groupedByMethod[method].expense += amount;
            }
        });
        
        barChartData = Object.values(groupedByMethod);
    } else {
        // For detailed report, group by date
        const groupedByDate = {};
        
        transactions.forEach(transaction => {
            const dateKey = formatDate(transaction.date);
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    income: 0,
                    expense: 0
                };
            }
            
            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'Pemasukan') {
                groupedByDate[dateKey].income += amount;
            } else {
                groupedByDate[dateKey].expense += amount;
            }
        });
        
        // Convert to array and sort by date (ascending for chart)
        barChartData = Object.values(groupedByDate).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });
    }
    
    // Update bar chart
    updateBarChart(barChartData, reportType);
}


// Fungsi untuk memperbarui pie chart
function updatePieChart(income, expense) {
    try {
        const chartElement = document.getElementById('pie-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan
        
        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');
        
        const ctx = chartElement.getContext('2d');
        
        // Destroy existing chart if it exists
        if (pieChart) {
            pieChart.destroy();
        }
    
        // Create new chart
        pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Pemasukan', 'Pengeluaran'],
                datasets: [{
                    data: [income, expense],
                    backgroundColor: [
                        'rgba(74, 222, 128, 0.8)',  // success color for income
                        'rgba(248, 113, 113, 0.8)'   // danger color for expense
                    ],
                    borderColor: [
                        'rgba(74, 222, 128, 1)',
                        'rgba(248, 113, 113, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgb(230, 240, 242)'  // text-primary color
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ' + formatCurrency(context.raw);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        // Tangani error tanpa menampilkan di console
    }
}


// Fungsi untuk memperbarui bar chart
function updateBarChart(data, reportType) {
    try {
        const chartElement = document.getElementById('bar-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan
        
        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');
        
        const ctx = chartElement.getContext('2d');
        
        // Destroy existing chart if it exists
        if (barChart) {
            barChart.destroy();
        }
    
        let labels, incomeData, expenseData;
        
        if (reportType === 'comparison') {
            // For comparison report, use method names as labels
            labels = data.map(item => item.method);
            incomeData = data.map(item => item.income);
            expenseData = data.map(item => item.expense);
        } else {
            // For other reports, use dates as labels
            labels = data.map(item => item.date);
            incomeData = data.map(item => item.income);
            expenseData = data.map(item => item.expense);
        }
        
        // Create new chart
        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Pemasukan',
                        data: incomeData,
                        backgroundColor: 'rgba(74, 222, 128, 0.8)',
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Pengeluaran',
                        data: expenseData,
                        backgroundColor: 'rgba(248, 113, 113, 0.8)',
                        borderColor: 'rgba(248, 113, 113, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            color: 'rgb(175, 193, 196)'  // text-secondary color
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: 'rgb(175, 193, 196)',  // text-secondary color
                            callback: function(value) {
                                return formatCurrency(value).split(',')[0]; // Simplified currency format
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgb(230, 240, 242)'  // text-primary color
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatCurrency(context.raw);
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Gagal memperbarui bar chart:", error);
    }
}


// Update user info in header
function updateUserInfo() {
    // Debug console dinonaktifkan
    
    // Debug elemen DOM dinonaktifkan
    
    if (state.user) {
        // Pastikan elemen userAvatar dan userName ada
        if (!elements.userAvatar || !elements.userName) {
            console.error('User avatar or user name element not found');
            elements.userAvatar = document.getElementById('user-avatar');
            elements.userName = document.getElementById('user-name');
            console.log('Re-assigned elements:', elements.userAvatar, elements.userName);
        }
        
        // Set avatar dan nama user
        if (elements.userAvatar) {
            // Pastikan URL gambar menggunakan https
            let pictureUrl = state.user.picture || '';
            if (pictureUrl && !pictureUrl.startsWith('https://')) {
                pictureUrl = pictureUrl.replace('http://', 'https://');
            }
            
            // Tambahkan cache buster untuk menghindari masalah caching
            const timestamp = new Date().getTime();
            
            // Jika URL dari Google, gunakan URL yang lebih sederhana
            if (pictureUrl && pictureUrl.includes('googleusercontent.com')) {
                // Ambil URL dasar tanpa parameter
                const baseUrl = pictureUrl.split('?')[0];
                pictureUrl = baseUrl + '?v=' + timestamp;
            }
            
            // Gunakan URL avatar yang valid atau fallback ke ui-avatars
            const avatarSrc = pictureUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(state.user.name) + '&background=9CAFAA&color=0F1724&v=' + timestamp;
            console.log('Setting user avatar src to:', avatarSrc);
            
            // Tambahkan event listener untuk debugging
            elements.userAvatar.onerror = function() {
                console.error('Failed to load avatar image:', avatarSrc);
                // Fallback ke avatar default dengan cache buster
                const timestamp = new Date().getTime();
                this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(state.user.name) + '&background=9CAFAA&color=0F1724&v=' + timestamp;
            };
            
            elements.userAvatar.onload = function() {
                console.log('Avatar image loaded successfully');
            };
            
            // Set src setelah event listener untuk menangkap error
            elements.userAvatar.src = avatarSrc;
            
            // Pastikan avatar terlihat
            elements.userAvatar.style.display = 'block';
        }
        
        if (elements.userName) {
            console.log('Setting user name to:', state.user.name);
            elements.userName.textContent = state.user.name;
            elements.userName.style.display = 'inline-block';
        }
        
        // Tampilkan elemen user-profile
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.classList.remove('hidden');
            userProfile.style.display = 'flex';
            console.log('User profile style after update:', window.getComputedStyle(userProfile));
            
            // Tambahkan inline style untuk memastikan terlihat
            userProfile.setAttribute('style', 'display: flex !important; visibility: visible !important;');
        } else {
            console.error('User profile element not found');
        }
    } else {
        console.warn('No user data available');
        // Sembunyikan elemen user-profile jika tidak ada user
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.classList.add('hidden');
        }
    }
}

// Navigate to page
function navigateTo(page) {
    // Update current page
    state.currentPage = page;
    
    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });
    
    // Show active page
    Object.values(elements.pages).forEach(pageElement => {
        pageElement.classList.remove('active');
    });
    elements.pages[page].classList.add('active');
    
    // Update page title
    elements.pageTitle.textContent = document.querySelector(`.nav-item[data-page="${page}"] span`).textContent;
    
    // Close sidebar and overlay on mobile
    if (window.innerWidth <= 768) {
        elements.sidebar.classList.remove('active');
        elements.sidebarOverlay.classList.remove('active');
    }
}

// Toggle sidebar
function toggleSidebar() {
    elements.sidebar.classList.toggle('active');
    
    // Toggle overlay pada mobile
    if (window.innerWidth <= 768) {
        elements.sidebarOverlay.classList.toggle('active');
    }
}

// Logout
function logout() {
    // Revoke token
    if (state.token) {
        try {
            google.accounts.oauth2.revoke(state.token, () => {
                console.log('Token revoked successfully');
            });
        } catch (error) {
            console.error('Error revoking token:', error);
        }
    }
    
    // Clear state and storage
    state.user = null;
    state.token = null;
    state.loggedIn = false;
    state.sheetsInitialized = false;
    
    // Hapus semua data user dari localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('jwt_token');
    
    // Show login screen
    showLogin();
    
    // Reload Google Sign In
    setTimeout(() => {
        initGoogleSignIn();
    }, 500);
}

// Show login screen
function showLogin() {
    // Debug console dinonaktifkan
    elements.loginModal.classList.remove('hidden');
    elements.app.classList.add('hidden');
}

// Show app
function showApp() {
    // Debug console dinonaktifkan

    elements.loginModal.classList.add("hidden");
    elements.app.classList.remove("hidden");
    
    // Pastikan elemen user-profile tidak tersembunyi
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.classList.remove('hidden');
        userProfile.style.display = 'flex';
    } else {
        console.error('User profile element not found in DOM');
    }
    
    // Pastikan elemen userAvatar dan userName ada
    if (!elements.userAvatar || !elements.userName) {
        console.log('Re-initializing user avatar and name elements');
        elements.userAvatar = document.getElementById('user-avatar');
        elements.userName = document.getElementById('user-name');
    }
    
    // Update user info di UI dengan delay untuk memastikan DOM sudah siap
    setTimeout(() => {
        updateUserInfo();
    }, 100);

    // jalankan initSheets agar data tampil
    if (state.token && !state.sheetsInitialized) {
        initSheets();
        state.sheetsInitialized = true;
    }
}




// Show loading
function showLoading() {
    state.loading = true;
    elements.loadingOverlay.classList.remove('hidden');
}

// Handle window resize
function handleResize() {
    // Periksa ukuran layar dan sesuaikan tampilan
    if (window.innerWidth <= 768) {
        // Mobile view
        elements.sidebar.classList.remove('active'); // Tutup sidebar pada mobile saat resize
        elements.bottomNav.style.display = 'flex'; // Tampilkan bottom nav
    } else {
        // Desktop view
        elements.bottomNav.style.display = 'none'; // Sembunyikan bottom nav
    }
}

// Hide loading
function hideLoading() {
    state.loading = false;
    elements.loadingOverlay.classList.add('hidden');
}

// Show error message
function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(hideError, 5000);
}

// Hide error message
function hideError() {
    elements.errorMessage.classList.add('hidden');
}

// Show success message
function showMessage(message) {
    // Create temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = 'success-message';
    messageEl.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Style the message
    messageEl.style.position = 'fixed';
    messageEl.style.top = '1rem';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translateX(-50%)';
    messageEl.style.background = 'var(--success)';
    messageEl.style.color = 'white';
    messageEl.style.padding = '1rem';
    messageEl.style.borderRadius = 'var(--border-radius)';
    messageEl.style.display = 'flex';
    messageEl.style.alignItems = 'center';
    messageEl.style.gap = '1rem';
    messageEl.style.zIndex = '2000';
    messageEl.style.boxShadow = 'var(--shadow)';
    
    document.body.appendChild(messageEl);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentElement) {
            messageEl.remove();
        }
    }, 3000);
}

// Show toast message with different types (success, info, warning, error)
function showToast(message, type = 'success') {
    // Create temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Style the message
    messageEl.style.position = 'fixed';
    messageEl.style.top = '1rem';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translateX(-50%)';
    messageEl.style.color = 'white';
    messageEl.style.padding = '1rem';
    messageEl.style.borderRadius = 'var(--border-radius)';
    messageEl.style.display = 'flex';
    messageEl.style.alignItems = 'center';
    messageEl.style.gap = '1rem';
    messageEl.style.zIndex = '2000';
    messageEl.style.boxShadow = 'var(--shadow)';
    
    // Set background color based on type
    switch(type) {
        case 'success':
            messageEl.style.background = 'var(--success)';
            break;
        case 'info':
            messageEl.style.background = 'var(--primary)';
            break;
        case 'warning':
            messageEl.style.background = 'var(--warning)';
            break;
        case 'error':
            messageEl.style.background = 'var(--danger)';
            break;
        default:
            messageEl.style.background = 'var(--success)';
    }
    
    document.body.appendChild(messageEl);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentElement) {
            messageEl.remove();
        }
    }, 3000);
}

// Helper function: Format currency
function formatCurrency(amount) {
    return formatNominal(amount);
}

// Helper function: Format nominal
function formatNominal(val) { 
    if (val === null || val === undefined || val === "" || isNaN(val)) return "-";

    let num = Number(val);
    return (num < 0 ? "-Rp " : "Rp ") + Math.abs(num).toLocaleString("id-ID");
}


// Helper function: Parse nominal
function parseNominal(value) {
    return parseFloat(value.replace(/[^\d]/g, ''));
}

// Helper function: Parse JWT
function parseJwt(token) {
    if (!token) {
        console.error('Token is null or undefined');
        return null;
    }
    
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) {
            console.error('Invalid token format: no payload section found');
            return null;
        }
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        console.log('JWT payload decoded successfully');
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing JWT:', e);
        return null;
    }
}

// Edit transaction
async function editTransaction(index) {
    // Get transaction from state
    const transaction = state.transactions[index];
    if (!transaction) {
        showError('Transaksi tidak ditemukan');
        return;
    }
    
    // Store the transaction ID for later use
    const transactionId = transaction.id;
    
    // Create modal for editing
    const modalContainer = document.createElement('div');
    modalContainer.className = 'modal-container';
    modalContainer.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Edit Transaksi</h3>
                <button class="btn-icon close-modal">&times;</button>
            </div>
            <form id="edit-transaction-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="edit-date">Tanggal</label>
                        <input type="date" id="edit-date" name="date" value="${transaction.date}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-description">Deskripsi</label>
                        <input type="text" id="edit-description" name="description" value="${transaction.description}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-type">Jenis</label>
                        <select id="edit-type" name="type" required>
                            <option value="Pemasukan" ${transaction.type === 'Pemasukan' ? 'selected' : ''}>Pemasukan</option>
                            <option value="Pengeluaran" ${transaction.type === 'Pengeluaran' ? 'selected' : ''}>Pengeluaran</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-method">Metode</label>
                        <select id="edit-method" name="method" required>
                            <option value="Tunai" ${transaction.method === 'Tunai' ? 'selected' : ''}>Tunai</option>
                            <option value="Non Tunai" ${transaction.method === 'Non Tunai' ? 'selected' : ''}>Non Tunai</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-amount">Nominal (Rp)</label>
                        <input type="number" id="edit-amount" name="amount" value="${transaction.amount}" min="0" required>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn-primary">
                            <i class="bi bi-save"></i> Simpan Perubahan
                        </button>
                    </div>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modalContainer);
    
    // Add event listeners
    const closeBtn = modalContainer.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        modalContainer.remove();
    });
    
    const form = modalContainer.querySelector('#edit-transaction-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const updatedTransaction = {
            date: formData.get('date'),
            description: formData.get('description'),
            type: formData.get('type'),
            method: formData.get('method'),
            amount: parseFloat(formData.get('amount'))
        };
        
        // Update in Google Sheets
        showLoading();
        try {
            // Get the row index (add 2 because of header row and 0-indexing)
            const rowIndex = index + 2;
            
            // Preserve the original transaction ID
            updatedTransaction.id = transactionId;
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: CONFIG.spreadsheetId,
                range: `Transaksi!A${rowIndex}:F${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[
                        updatedTransaction.id, // Include ID in the update
                        updatedTransaction.date,
                        updatedTransaction.description,
                        updatedTransaction.type,
                        updatedTransaction.method,
                        updatedTransaction.amount
                    ]]
                }
            });
            
            // Update local state
            state.transactions[index] = updatedTransaction;
            
            // Update UI
            updateUI();
            
            // Close modal
            modalContainer.remove();
            
            // Show success message
            showMessage('Transaksi berhasil diperbarui');
        } catch (error) {
            showError('Gagal memperbarui transaksi: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

// Delete transaction
async function deleteTransaction(index) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;
    showLoading();
    try {
        const transaction = state.transactions[index];
        if (!transaction) {
            showError('Gagal menemukan transaksi yang sesuai.');
            return;
        }
        
        // Cari transaksi berdasarkan ID di spreadsheet
        const transactionId = transaction.id;
        console.log('Mencari transaksi dengan ID:', transactionId);
        
        // Ambil semua data dari spreadsheet untuk mencari ID yang sesuai
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.spreadsheetId,
            range: 'Transaksi!A:A' // Hanya kolom ID
        });
        
        if (!response.result.values) {
            showError('Gagal mendapatkan data dari spreadsheet.');
            return;
        }
        
        // Cari baris dengan ID yang sesuai
        let rowIndex = -1;
        response.result.values.forEach((row, idx) => {
            if (row[0] === transactionId) {
                rowIndex = idx + 1; // +1 karena indeks dimulai dari 0, tapi baris dimulai dari 1
            }
        });
        
        if (rowIndex === -1) {
            showError('Gagal menemukan baris transaksi dengan ID: ' + transactionId);
            return;
        }
        
        console.log('Menemukan transaksi dengan ID:', transactionId, 'pada baris:', rowIndex);
        
        // Hapus baris dari spreadsheet
        await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: CONFIG.spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: 0,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // -1 karena API menggunakan indeks 0
                            endIndex: rowIndex
                        }
                    }
                }]
            }
        });

        // Hapus dari state
        state.transactions.splice(index, 1);
        
        // Reload transaksi untuk memastikan rowIndex terupdate dengan benar
        await loadTransactions();
        
        showMessage('Transaksi berhasil dihapus');
    } catch (error) {
        console.error('Error saat menghapus transaksi:', error);
        showError('Gagal menghapus transaksi: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Helper function: Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Dummy data for fallback
function getDummyData() {
    return [
        { id: 'w42342', date: '2025-09-10', description: 'pendapatan warungg', type: 'Pemasukan', method: 'Tunai', amount: 50000 },
        { id: '85835', date: '2025-08-02', description: 'Qris', type: 'Pengeluaran', method: 'Non Tunai', amount: 131076 },
        { id: '3568', date: '2025-08-02', description: 'Pendapatan cash', type: 'Pengeluaran', method: 'Tunai', amount: 400000 },
        { id: '56858', date: '2025-08-02', description: 'Pendapatan warung', type: 'Pengeluaran', method: 'Tunai', amount: 135000 },
        { id: '58568358', date: '2025-08-02', description: 'Beli susu uht', type: 'Pemasukan', method: 'Tunai', amount: 43000 },
        { id: '6367565', date: '2025-08-02', description: 'Beli es', type: 'Pemasukan', method: 'Tunai', amount: 36000 },
        { id: '75673378', date: '2025-08-15', description: 'Beli galon', type: 'Pemasukan', method: 'Tunai', amount: 15000 },
        { id: '5685', date: '2025-08-15', description: 'Beli gula', type: 'Pemasukan', method: 'Tunai', amount: 40000 },
        { id: '5686538', date: '2025-08-19', description: 'shopee', type: 'Pengeluaran', method: 'Non Tunai', amount: 22500 },
        { id: '6865', date: '2025-08-27', description: 'Qris', type: 'Pengeluaran', method: 'Non Tunai', amount: 204558 },
        { id: '856868568', date: '2025-08-29', description: 'Pendapatan cash', type: 'Pengeluaran', method: 'Tunai', amount: 615000 },
        { id: '863', date: '2025-08-30', description: 'Pendapatan warung', type: 'Pengeluaran', method: 'Tunai', amount: 120000 },
        { id: '5368568568', date: '2025-08-31', description: 'beli santan', type: 'Pemasukan', method: 'Tunai', amount: 5000 },
        { id: '6746838', date: '2025-08-31', description: 'pendapatan warung', type: 'Pengeluaran', method: 'Tunai', amount: 399000 },
        { id: '3637', date: '2025-08-31', description: 'Pengeluaran warung makan', type: 'Pengeluaran', method: 'Non Tunai', amount: 500000 },
        { id: '3737', date: '2025-09-03', description: 'beli sabun', type: 'Pengeluaran', method: 'Tunai', amount: 100000 },
        { id: '77567', date: '2025-09-10', description: 'beli serbuk minuman', type: 'Pengeluaran', method: 'Tunai', amount: 45000 },
        { id: '76765', date: '2025-09-10', description: 'pendapatan warung', type: 'Pemasukan', method: 'Tunai', amount: 50000 }
    ];
}

// Initialize Google Sign-In after Google API is loaded
function checkGoogleAPILoaded() {
    if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
        initGoogleSignIn();
    } else {
        setTimeout(checkGoogleAPILoaded, 100);
    }
}

// Fungsi category breakdown telah dihapus

// Fungsi donut chart telah dihapus

// Fungsi tren harian telah dihapus

// Fungsi untuk menghasilkan forecast keuangan
function generateForecast(transactions, dateRange) {
    // Hitung total pemasukan dan pengeluaran dari transaksi aktual
    const totalIncome = transactions
        .filter(t => t.type.trim().toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    const totalExpense = transactions
        .filter(t => t.type.trim().toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    const netBalance = totalIncome - totalExpense;
    
    // Buat data forecast sederhana berdasarkan data aktual
    const forecastData = [{
        month: 'Proyeksi',
        income: totalIncome,
        expense: totalExpense,
        net: netBalance,
        date: new Date()
    }];
    
    // Update UI dengan data forecast aktual
    updateForecastUI({
        monthlyData: [{
            month: 'Aktual',
            income: totalIncome,
            expense: totalExpense,
            net: netBalance,
            date: new Date()
        }]
    }, forecastData);
    
    // Buat chart forecast
    createForecastChart({
        monthlyData: [{
            month: 'Aktual',
            income: totalIncome,
            expense: totalExpense,
            net: netBalance,
            date: new Date()
        }]
    }, forecastData);
}

// Fungsi untuk menganalisis data historis
function analyzeHistoricalData(transactions) {
    // Kelompokkan transaksi berdasarkan bulan
    const monthlyData = {};
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: monthKey,
                income: 0,
                expense: 0,
                net: 0,
                date: new Date(date.getFullYear(), date.getMonth(), 1)
            };
        }
        
        const amount = parseFloat(transaction.amount) || 0;
        if (transaction.type === 'Pemasukan') {
            monthlyData[monthKey].income += amount;
        } else {
            monthlyData[monthKey].expense += amount;
        }
        
        // Hitung net (laba bersih)
        monthlyData[monthKey].net = monthlyData[monthKey].income - monthlyData[monthKey].expense;
    });
    
    // Konversi ke array dan urutkan berdasarkan bulan
    const monthlyArray = Object.values(monthlyData).sort((a, b) => a.date - b.date);
    
    // Hitung rata-rata pertumbuhan
    let incomeGrowth = 0;
    let expenseGrowth = 0;
    
    if (monthlyArray.length > 1) {
        // Hitung pertumbuhan untuk setiap bulan dan ambil rata-ratanya
        let totalIncomeGrowth = 0;
        let totalExpenseGrowth = 0;
        let growthMonths = 0;
        
        for (let i = 1; i < monthlyArray.length; i++) {
            const prevMonth = monthlyArray[i - 1];
            const currentMonth = monthlyArray[i];
            
            if (prevMonth.income > 0) {
                const monthIncomeGrowth = (currentMonth.income - prevMonth.income) / prevMonth.income;
                totalIncomeGrowth += monthIncomeGrowth;
            }
            
            if (prevMonth.expense > 0) {
                const monthExpenseGrowth = (currentMonth.expense - prevMonth.expense) / prevMonth.expense;
                totalExpenseGrowth += monthExpenseGrowth;
            }
            
            growthMonths++;
        }
        
        if (growthMonths > 0) {
            incomeGrowth = totalIncomeGrowth / growthMonths;
            expenseGrowth = totalExpenseGrowth / growthMonths;
        }
    }
    
    // Batasi pertumbuhan agar tidak terlalu ekstrem
    incomeGrowth = Math.max(-0.5, Math.min(0.5, incomeGrowth));
    expenseGrowth = Math.max(-0.5, Math.min(0.5, expenseGrowth));
    
    return {
        monthlyData: monthlyArray,
        incomeGrowth,
        expenseGrowth
    };
}

// Fungsi untuk menghitung forecast
function calculateForecast(historicalData, months) {
    const forecast = [];
    
    // Ambil data bulan terakhir sebagai dasar
    const lastMonth = historicalData.monthlyData[historicalData.monthlyData.length - 1];
    let lastIncome = lastMonth ? lastMonth.income : 0;
    let lastExpense = lastMonth ? lastMonth.expense : 0;
    
    // Ambil tanggal bulan terakhir dan tambahkan 1 bulan untuk forecast pertama
    let forecastDate = lastMonth ? new Date(lastMonth.date) : new Date();
    forecastDate.setMonth(forecastDate.getMonth() + 1);
    
    // Hitung forecast untuk jumlah bulan yang ditentukan
    for (let i = 0; i < months; i++) {
        // Hitung proyeksi berdasarkan pertumbuhan
        const projectedIncome = lastIncome * (1 + historicalData.incomeGrowth);
        const projectedExpense = lastExpense * (1 + historicalData.expenseGrowth);
        const projectedNet = projectedIncome - projectedExpense;
        
        // Format tanggal untuk label
        const monthYear = forecastDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        
        // Tambahkan ke array forecast
        forecast.push({
            month: monthYear,
            income: projectedIncome,
            expense: projectedExpense,
            net: projectedNet,
            date: new Date(forecastDate)
        });
        
        // Update untuk bulan berikutnya
        lastIncome = projectedIncome;
        lastExpense = projectedExpense;
        forecastDate.setMonth(forecastDate.getMonth() + 1);
    }
    
    return forecast;
}

// Fungsi untuk memperbarui UI forecast
function updateForecastUI(historicalData, forecastData) {
    // Update periode forecast - menampilkan berdasarkan data aktual
    document.getElementById('forecast-period').textContent = 'data aktual';
    
    // Ambil data forecast
    const forecastMonth = forecastData[0];
    
    // Update nilai forecast dengan data aktual
    document.getElementById('forecast-income').textContent = formatCurrency(forecastMonth.income);
    document.getElementById('forecast-expense').textContent = formatCurrency(forecastMonth.expense);
    document.getElementById('forecast-balance').textContent = formatCurrency(forecastMonth.net);
    
    // Untuk tren, kita gunakan persentase sederhana
    // Persentase pemasukan terhadap total (pemasukan + pengeluaran)
    const totalTransactions = forecastMonth.income + forecastMonth.expense;
    const incomeTrend = totalTransactions > 0 ? (forecastMonth.income / totalTransactions) * 100 : 0;
    
    // Persentase pengeluaran terhadap total
    const expenseTrend = totalTransactions > 0 ? (forecastMonth.expense / totalTransactions) * 100 : 0;
    
    // Persentase saldo akhir terhadap pemasukan
    const balanceTrend = forecastMonth.income > 0 ? (forecastMonth.net / forecastMonth.income) * 100 : 0;
    
    // Update indikator tren
    updateTrendIndicator('forecast-income-trend', incomeTrend);
    updateTrendIndicator('forecast-expense-trend', expenseTrend);
    updateTrendIndicator('forecast-balance-trend', balanceTrend);
}

// Fungsi untuk memperbarui indikator tren
function updateTrendIndicator(elementId, trendPercentage) {
    const element = document.getElementById(elementId);
    const formattedPercentage = Math.abs(trendPercentage).toFixed(1) + '%';
    
    // Reset kelas
    element.classList.remove('positive', 'negative');
    
    // Tambahkan kelas dan ikon berdasarkan tren
    if (trendPercentage > 0) {
        element.classList.add('positive');
        element.innerHTML = `<i class="bi bi-arrow-up"></i> ${formattedPercentage}`;
    } else if (trendPercentage < 0) {
        element.classList.add('negative');
        element.innerHTML = `<i class="bi bi-arrow-down"></i> ${formattedPercentage}`;
    } else {
        element.innerHTML = `<i class="bi bi-dash"></i> ${formattedPercentage}`;
    }
}

function createForecastChart(historicalData, forecastData) {
    const chartElement = document.getElementById('forecast-chart');
    if (!chartElement) return; // Hindari error jika elemen tidak ditemukan
    
    // Tambahkan atribut willReadFrequently untuk meningkatkan performa
    chartElement.setAttribute('willReadFrequently', 'true');
    
    const ctx = chartElement.getContext('2d');
    
    // Hapus chart lama jika ada
    if (window.forecastChart) {
        window.forecastChart.destroy();
    }
    
    // Gunakan data aktual untuk chart
    const chartData = [
        {
            label: 'Pemasukan',
            value: forecastData[0].income,
            color: 'rgba(74, 222, 128, 1)'
        },
        {
            label: 'Pengeluaran',
            value: forecastData[0].expense,
            color: 'rgba(248, 113, 113, 1)'
        },
        {
            label: 'Saldo Akhir',
            value: forecastData[0].net,
            color: 'rgba(59, 130, 246, 1)'
        }
    ];
    
    const labels = chartData.map(d => d.label);
    const values = chartData.map(d => d.value);
    const colors = chartData.map(d => d.color);
    
    // Pastikan Chart.js tersedia
    if (typeof Chart === 'undefined') {
        console.error('Chart.js tidak tersedia');
        return;
    }
    
    // Buat chart
    window.forecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nilai Aktual',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.raw);
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 11
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: 1, // contoh separatorIndex
                            xMax: 1,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: 'Forecast →',
                                position: 'start',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                font: {
                                    size: 11
                                }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}


// Fungsi untuk export/print laporan
function exportReport() {
    // Tambahkan kelas print-mode ke body untuk styling khusus cetak
    document.body.classList.add('print-mode');
    
    // Tambahkan header cetak
    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.innerHTML = `
        <h1>Laporan Keuangan</h1>
        <p>Periode: ${document.getElementById('report-range').textContent}</p>
        <p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    `;
    document.querySelector('.page-content').prepend(printHeader);
    
    // Tampilkan dialog cetak browser
    window.print();
    
    // Hapus header cetak dan kelas print-mode setelah dialog cetak ditutup
    setTimeout(() => {
        document.body.classList.remove('print-mode');
        const headerElement = document.querySelector('.print-header');
        if (headerElement) {
            headerElement.remove();
        }
    }, 1000);
}

// Fungsi untuk export laporan ke PDF
function exportToPDF() {
    try {
        // Tambahkan kelas print-mode ke body untuk styling khusus
        document.body.classList.add('print-mode');
    
    // Ambil elemen report range
    const reportRangeEl = document.getElementById('report-range');
    const reportRange = reportRangeEl ? reportRangeEl.textContent : 'Periode Tidak Tersedia';
    
    // Ambil jenis laporan yang sedang aktif
    const reportTypeEl = document.getElementById('report-type');
    const reportType = reportTypeEl ? reportTypeEl.value : 'basic';
    
    // Pastikan semua bagian laporan terlihat untuk PDF
    const reportBasic = document.getElementById('report-basic');
    const reportAnalytic = document.getElementById('report-analytic');
    const reportVisual = document.getElementById('report-visual');
    const reportForecast = document.getElementById('report-forecast');
    
    // Simpan status awal (hidden atau tidak)
    const basicHidden = reportBasic ? reportBasic.classList.contains('hidden') : true;
    const analyticHidden = reportAnalytic ? reportAnalytic.classList.contains('hidden') : true;
    const visualHidden = reportVisual ? reportVisual.classList.contains('hidden') : true;
    const forecastHidden = reportForecast ? reportForecast.classList.contains('hidden') : true;
    
    // Tampilkan semua bagian laporan jika tipe 'all', atau hanya bagian yang sesuai
    if (reportType === 'all') {
        if (reportBasic) reportBasic.classList.remove('hidden');
        if (reportAnalytic) reportAnalytic.classList.remove('hidden');
        if (reportVisual) reportVisual.classList.remove('hidden');
        if (reportForecast) reportForecast.classList.remove('hidden');
    } else {
        // Jika bukan 'all', pastikan hanya bagian yang sesuai yang terlihat
        if (reportType === 'basic' && reportBasic) reportBasic.classList.remove('hidden');
        if (reportType === 'analytic' && reportAnalytic) reportAnalytic.classList.remove('hidden');
        if (reportType === 'visual' && reportVisual) reportVisual.classList.remove('hidden');
        if (reportType === 'forecast' && reportForecast) reportForecast.classList.remove('hidden');
    }
    
    // Ambil elemen yang akan dikonversi ke PDF
    const reportContainer = document.querySelector('.card:nth-child(2)');
    if (!reportContainer) {
        console.error('Elemen card laporan tidak ditemukan');
        document.body.classList.remove('print-mode');
        return;
    }
    
    // Buat clone dari elemen untuk dimodifikasi sebelum konversi ke PDF
    const clonedReport = reportContainer.cloneNode(true);
    // Tambahkan kelas khusus untuk styling PDF
    clonedReport.classList.add('pdf-container');
    
    // Buat header cetak
    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.innerHTML = `
        <h1>Laporan Keuangan</h1>
        <p>Periode: ${reportRange}</p>
        <p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    `;
    
    // Tambahkan header cetak ke elemen yang di-clone
    clonedReport.prepend(printHeader);
    
    // Pastikan semua bagian laporan terlihat dalam elemen yang di-clone
    const clonedBasic = clonedReport.querySelector('#report-basic');
    const clonedAnalytic = clonedReport.querySelector('#report-analytic');
    const clonedVisual = clonedReport.querySelector('#report-visual');
    const clonedForecast = clonedReport.querySelector('#report-forecast');
    
    if (clonedBasic) clonedBasic.classList.remove('hidden');
    if (clonedAnalytic) clonedAnalytic.classList.remove('hidden');
    if (clonedVisual) clonedVisual.classList.remove('hidden');
    if (clonedForecast) clonedForecast.classList.remove('hidden');
    
    // Tambahkan kelas untuk memastikan layout yang benar
    const clonedReportCards = clonedReport.querySelectorAll('.report-card');
    clonedReportCards.forEach(card => {
        card.style.pageBreakInside = 'avoid';
        card.style.breakInside = 'avoid';
    });
    
    // Pastikan tabel memiliki lebar yang tepat
    const clonedTables = clonedReport.querySelectorAll('table');
    clonedTables.forEach(table => {
        table.style.width = '100%';
        table.style.tableLayout = 'fixed';
    });
    
    // Pastikan grafik memiliki tinggi yang cukup
    const clonedCharts = clonedReport.querySelectorAll('.chart-wrapper');
    clonedCharts.forEach(chart => {
        chart.style.height = '300px';
        chart.style.pageBreakInside = 'avoid';
        chart.style.breakInside = 'avoid';
    });
    
    // Konfigurasi html2pdf dengan pengaturan yang lebih baik
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `Laporan_Keuangan_${reportRange.replace(/\s/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: true,
            letterRendering: true,
            willReadFrequently: true,
            allowTaint: true,
            foreignObjectRendering: false,
            removeContainer: true,
            imageTimeout: 15000,
            windowWidth: 1200, // Lebar tetap untuk konsistensi
            windowHeight: 1600 // Tinggi tetap untuk konsistensi
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait',
            compress: true,
            precision: 2,
            hotfixes: ['px_scaling'] // Perbaikan untuk scaling
        },
        pagebreak: { mode: 'avoid-all', before: '.page-break-before', after: '.page-break-after' }
    };
    
    // Tambahkan clone ke body untuk konversi, tapi hidden
    clonedReport.style.position = 'absolute';
    clonedReport.style.left = '-9999px';
    document.body.appendChild(clonedReport);
    
    // Tunggu sebentar agar semua elemen visual (grafik, dll) dirender dengan benar
    setTimeout(() => {
        // Tampilkan pesan loading
        showToast('Sedang membuat PDF, mohon tunggu...', 'info');
        
        // Generate PDF dari elemen yang sudah di-clone
    html2pdf().set(opt).from(clonedReport).save()
    .then(() => {
        // Kembalikan status hidden seperti semula
        if (basicHidden && reportBasic) reportBasic.classList.add('hidden');
        if (analyticHidden && reportAnalytic) reportAnalytic.classList.add('hidden');
        if (visualHidden && reportVisual) reportVisual.classList.add('hidden');
        if (forecastHidden && reportForecast) reportForecast.classList.add('hidden');
        
        // Hapus header cetak, elemen clone, dan kelas print-mode setelah PDF dibuat
        setTimeout(() => {
            document.body.classList.remove('print-mode');
            const headerElement = document.querySelector('.print-header');
            if (headerElement) {
                headerElement.remove();
            }
            // Hapus elemen yang di-clone
            if (clonedReport && clonedReport.parentNode) {
                clonedReport.parentNode.removeChild(clonedReport);
            }
            
            // Tampilkan pesan sukses
            showToast('PDF berhasil dibuat!', 'success');
        }, 1000);
    })
    .catch(error => {
        console.error('Error generating PDF:', error);
        // Kembalikan status hidden seperti semula
        if (basicHidden && reportBasic) reportBasic.classList.add('hidden');
        if (analyticHidden && reportAnalytic) reportAnalytic.classList.add('hidden');
        if (visualHidden && reportVisual) reportVisual.classList.add('hidden');
        if (forecastHidden && reportForecast) reportForecast.classList.add('hidden');
        
        document.body.classList.remove('print-mode');
        // Hapus elemen yang di-clone
        if (clonedReport && clonedReport.parentNode) {
            clonedReport.parentNode.removeChild(clonedReport);
        }
        
        showToast('Gagal membuat PDF. Silakan coba lagi.', 'error');
    });
    }, 500); // Tutup setTimeout untuk rendering
    } catch (error) {
        console.error('Error in exportToPDF:', error);
        document.body.classList.remove('print-mode');
        showToast('Terjadi kesalahan saat membuat PDF. Silakan coba lagi.', 'error');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    checkGoogleAPILoaded();
    
    // Event listener untuk tombol export/print
    const exportReportBtn = document.getElementById('export-report');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', exportReport);
    }
    
    // Event listener untuk tombol export PDF
    const exportPdfBtn = document.getElementById('export-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }
});