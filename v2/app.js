/**
 * Kedai Nongki - Sistem Manajemen Kas
 * 
 * Cara konfigurasi:
 * 1. Ganti CLIENT_ID dengan Client ID dari Google Cloud Console
 * 2. Ganti SPREADSHEET_ID dengan ID spreadsheet Google Sheets Anda
 * 3. Pastikan spreadsheet sudah dibagikan (share) ke email layanan dari Google Cloud Console
 */

// Inisialisasi aplikasi saat dokumen dimuat
document.addEventListener('DOMContentLoaded', function () {
    initApp();
    checkGoogleAPILoaded();
    window.addEventListener('resize', handleResize);
    handleResize();

    const modal = document.getElementById("transaction-modal");
    const openBtn = document.getElementById("add-transaction-btn"); // tombol di header
    const floatingBtn = document.getElementById("floating-add-transaction-btn"); // tombol floating desktop
    const closeBtn = document.getElementById("close-transaction-modal");

    // Buka modal
    if (openBtn && modal) {
        openBtn.addEventListener("click", (e) => {
            e.preventDefault(); // Prevent link navigation
            modal.classList.remove("hidden");
        });
    }

    // Buka modal dari floating button
    if (floatingBtn && modal) {
        floatingBtn.addEventListener("click", () => {
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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    sheetName: 'Transaksi', // Nama sheet untuk data laporan keuangan dasar (sesuaikan dengan nama sheet yang benar)
    sheetRange: 'A1:F20000', // Range data yang diambil (bisa disesuaikan)
    RANGE: 'Table1' // Nama tabel di Google Sheets
};

// Helper Functions

/**
 * Menghasilkan ID transaksi unik dengan format: tanggal sekarang + 4 karakter alfanumerik
 * Format: YYYYMMDD + 4 karakter alfanumerik acak
 * @returns {string} ID transaksi unik
 */
function generateTransactionId() {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
        (today.getMonth() + 1).toString().padStart(2, '0') +
        today.getDate().toString().padStart(2, '0');

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let alphanumeric = '';
    for (let i = 0; i < 4; i++) {
        alphanumeric += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return dateStr + alphanumeric;
}

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
        // Skip buttons that don't have data-page attribute (like add-transaction-btn and logout-btn-mobile)
        if (item.hasAttribute('data-page')) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                navigateTo(page);
            });
        }
    });

    // Sidebar toggle
    elements.sidebarToggle.addEventListener('click', toggleSidebar);

    // Tambahkan event listener untuk overlay
    elements.sidebarOverlay.addEventListener('click', function () {
        // Tutup sidebar dan overlay saat overlay diklik
        if (elements.sidebar.classList.contains('active')) {
            elements.sidebar.classList.remove('active');
            elements.sidebarOverlay.classList.remove('active');
        }
    });

    // Logout
    elements.logoutButton.addEventListener('click', logout);

    // Logout mobile button
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', logout);
    }

    // Close error
    elements.closeError.addEventListener('click', hideError);

    // Set default date to today for all date inputs
    setDefaultDateToToday();

    // Transaction Shortcut Button sudah ditambahkan di atas

    // Close Transaction Modal event listener sudah ditambahkan di atas

    // Quick Transaction Form
    const quickTransactionForm = document.getElementById('quick-transaction-form');
    if (quickTransactionForm) {
        quickTransactionForm.addEventListener('submit', handleQuickAddTransaction);
    }

    // Add option button event listeners for modal form
    document.addEventListener('click', function (e) {
        const button = e.target.closest('.option-btn');
        if (button) {
            const field = button.getAttribute('data-field');
            const value = button.getAttribute('data-value');

            // Remove active class from siblings
            const siblings = button.parentElement.querySelectorAll('.option-btn');
            siblings.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // Set hidden input value
            const hiddenInput = document.getElementById(field);
            if (hiddenInput) {
                hiddenInput.value = value;
            }
        }
    });

    // Event listeners untuk Transaction Shortcut Button, Close Transaction Modal, dan Quick Transaction Form sudah ditambahkan di atas

    // Transaction form
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleAddTransaction);
    }

    // Initialize modal form options on modal open
    document.addEventListener('click', function (e) {
        const addTransactionBtn = e.target.closest('#add-transaction-btn');
        if (addTransactionBtn) {
            // Reset option buttons when opening modal
            setTimeout(() => {
                document.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.getElementById('quick-type').value = '';
                document.getElementById('quick-method').value = '';
            }, 100);
        }
    });

    // Initialize edit modal form options on edit modal open
    document.addEventListener('click', function (e) {
        if (e.target.closest('[onclick*="editTransaction"]')) {
            // Reset edit option buttons when opening edit modal
            // Removed conflicting setTimeout that clears active states after editTransaction sets them
        }
    });

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

    // Generate unique ID using helper function
    const transactionId = generateTransactionId();

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
        // Format data sebelum dikirim ke Google Sheets
        const formattedData = [
            transaction.id,
            formatDate(transaction.date),
            transaction.description,
            transaction.type,
            transaction.method,
            transaction.amount
        ];

        console.table([formattedData]);

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: `${CONFIG.sheetName}!A:F`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: {
                values: [formattedData]
            }
        });

        // Add to local state
        state.transactions.push(transaction);

        // Reset form
        form.reset();

        // Reload data from sheet untuk memastikan data terbaru
        await loadTransactions();

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

// Set default date to today for all date inputs
function setDefaultDateToToday() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Set default date for all date inputs
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
}

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

    // Generate unique ID using helper function
    const transactionId = generateTransactionId();

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
        // Format data sebelum dikirim ke Google Sheets
        const formattedData = [
            transaction.id,
            formatDate(transaction.date),
            transaction.description,
            transaction.type,
            transaction.method,
            transaction.amount
        ];

        console.table([formattedData]);

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.spreadsheetId,
            range: `${CONFIG.sheetName}!A:F`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: {
                values: [formattedData]
            }
        });

        // Add to local state
        state.transactions.push(transaction);

        // Reset form
        form.reset();

        // Close modal
        closeModal();

        // Reload data from sheet untuk memastikan data terbaru
        await loadTransactions();

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
        case 'all-time':
            // Semua transaksi (keseluruhan)
            // Gunakan tanggal yang sangat lampau untuk memastikan semua transaksi tercakup
            startDate = new Date(1970, 0, 1); // 1 Januari 1970
            endDate = new Date(today);
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
    // Hitung total pemasukan & pengeluaran
    const totalIncome = state.transactions
        .filter(t => t.type.toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const totalExpense = state.transactions
        .filter(t => t.type.toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // Hitung modal awal (semua metode)
    const totalModal = state.transactions
        .filter(t => t.type.toLowerCase() === 'modal awal')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // Net Profit (sesuai konsep laba bersih)
    const netProfit = totalIncome - totalExpense;
    const totalTransactions = state.transactions.length;

    // Hitung breakdown kas: tunai
    const cashIncome = state.transactions
        .filter(t => t.method.toLowerCase() === 'tunai' && t.type.toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const cashExpense = state.transactions
        .filter(t => t.method.toLowerCase() === 'tunai' && t.type.toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const cashModal = state.transactions
        .filter(t => t.method.toLowerCase() === 'tunai' && t.type.toLowerCase() === 'modal awal')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const cashAmount = cashIncome - cashExpense + cashModal;

    // Hitung breakdown kas: non tunai
    const nonCashIncome = state.transactions
        .filter(t => t.method.toLowerCase() === 'non tunai' && t.type.toLowerCase() === 'pemasukan')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const nonCashExpense = state.transactions
        .filter(t => t.method.toLowerCase() === 'non tunai' && t.type.toLowerCase() === 'pengeluaran')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const nonCashModal = state.transactions
        .filter(t => t.method.toLowerCase() === 'non tunai' && t.type.toLowerCase() === 'modal awal')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // Rumus Kas Non Tunai yang diperbarui: Pemasukan Non Tunai - Pengeluaran Non Tunai + Modal Awal Non Tunai
    const nonCashAmount = nonCashIncome - nonCashExpense + nonCashModal;

    // Total kas akhir
    const totalKas = cashAmount + nonCashAmount;

    // Persentase breakdown
    const cashPercentage = totalKas > 0 ? (cashAmount / totalKas) * 100 : 0;
    const nonCashPercentage = totalKas > 0 ? (nonCashAmount / totalKas) * 100 : 0;

    // Rasio
    const profitRatio = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    // Update DOM
    document.getElementById('total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('total-expense').textContent = formatCurrency(totalExpense);
    document.getElementById('net-profit').textContent = formatCurrency(netProfit);
    document.getElementById('total-transactions').textContent = totalTransactions;

    document.getElementById('cash-amount').textContent = formatCurrency(cashAmount);
    document.getElementById('non-cash-amount').textContent = formatCurrency(nonCashAmount);

    // Update total kas di dashboard jika elemen ada
    const totalKasEl = document.getElementById('total-kas');
    if (totalKasEl) {
        totalKasEl.textContent = formatCurrency(totalKas);
    }

    document.getElementById('cash-percentage').textContent = cashPercentage.toFixed(1) + '%';
    document.getElementById('non-cash-percentage').textContent = nonCashPercentage.toFixed(1) + '%';

    document.getElementById('profit-ratio').textContent = profitRatio.toFixed(1) + '%';
    document.getElementById('expense-ratio').textContent = expenseRatio.toFixed(1) + '%';

    // Update progress bars
    document.querySelector('.progress-fill.cash').style.width = cashPercentage + '%';
    document.querySelector('.progress-fill.non-cash').style.width = nonCashPercentage + '%';
    document.querySelector('.progress-fill.profit-ratio').style.width = Math.max(0, profitRatio) + '%';
    document.querySelector('.progress-fill.expense-ratio').style.width = Math.min(100, expenseRatio) + '%';

    // Update metrik breakdown kas baru jika elemen ada
    const totalCashEl = document.getElementById('total-cash');
    const totalNonCashEl = document.getElementById('total-non-cash');
    const cashIncomeEl = document.getElementById('cash-income');
    const nonCashIncomeEl = document.getElementById('non-cash-income');
    const cashExpenseEl = document.getElementById('cash-expense');
    const nonCashExpenseEl = document.getElementById('non-cash-expense');
    const totalAmountEl = document.getElementById('total-amount');

    if (totalCashEl) totalCashEl.textContent = formatCurrency(cashAmount);
    if (totalNonCashEl) totalNonCashEl.textContent = formatCurrency(nonCashAmount);
    if (cashIncomeEl) cashIncomeEl.textContent = formatCurrency(cashIncome);
    if (nonCashIncomeEl) nonCashIncomeEl.textContent = formatCurrency(nonCashIncome);
    if (cashExpenseEl) cashExpenseEl.textContent = formatCurrency(cashExpense);
    if (nonCashExpenseEl) nonCashExpenseEl.textContent = formatCurrency(nonCashExpense);
    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalKas);

    // Update transaksi terbaru
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
        // Tambahkan kelas income atau expense untuk styling
        card.classList.add(transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense');

        card.innerHTML = `
            <div class="transaction-card-header">
                <span class="transaction-date"><i class="bi bi-calendar3"></i> ${formatDate(transaction.date)}</span>
                <span class="transaction-type ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
            </div>
            <div class="transaction-id"><small class="text-muted"><i class="bi bi-hash"></i> ${transaction.id || 'N/A'}</small></div>
            <div class="transaction-description"><i class="bi bi-card-text"></i> ${transaction.description}</div>
            <div class="transaction-details">
                <span><i class="bi bi-wallet2"></i> ${transaction.method}</span>
                <span class="transaction-amount ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}"><i class="bi ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i> ${formatCurrency(amount)}</span>
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
        resetButton.addEventListener('click', function () {
            searchInput.value = '';
            autocompleteResults.innerHTML = '';
            autocompleteResults.classList.remove('show');
            updateTransactionsUI(state.transactions);
        });
    }

    // Event listener untuk input pencarian
    searchInput.addEventListener('input', function () {
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
                item.addEventListener('click', function () {
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
    document.addEventListener('click', function (e) {
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
        // Tambahkan kelas income atau expense untuk styling
        card.classList.add(transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense');

        card.innerHTML = `
            <div class="transaction-card-header">
                <span class="transaction-date"><i class="bi bi-calendar3"></i> ${formatDate(transaction.date)}</span>
                <span class="transaction-type ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
            </div>
            <div class="transaction-id"><small class="text-muted"><i class="bi bi-hash"></i> ${transaction.id || 'N/A'}</small></div>
            <div class="transaction-description"><i class="bi bi-card-text"></i> ${transaction.description}</div>
            <div class="transaction-details">
                <span><i class="bi bi-wallet2"></i> ${transaction.method}</span>
                <span class="transaction-amount ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense'}"><i class="bi ${transaction.type.trim().toLowerCase() === 'pemasukan' ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i> ${formatCurrency(amount)}</span>
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
let transactionTypePieChart = null;
let paymentMethodPieChart = null;
let expenseCategoryPieChart = null;
let incomeExpensePieChart = null;
let dailyTransactionsBarChart = null;
let paymentMethodBarChart = null;
let topExpenseBarChart = null;
let topIncomeBarChart = null;
let barChart = null;
let pieChart = null;

// Variabel global untuk metrik laporan
let totalAmount = 0;


// Update report UI
function updateReportUI(transactions, dateRange, reportType) {
    try {
        console.log('Memperbarui UI laporan dengan', transactions.length, 'transaksi');

        // Fungsi helper untuk menangani nilai undefined
        function safeGetLowerCase(value) {
            return value && typeof value === 'string' ? value.trim().toLowerCase() : '';
        }

        // Hitung total pemasukan & pengeluaran (sama dengan updateDashboard)
        const totalIncome = transactions
            .filter(t => safeGetLowerCase(t.type) === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const totalExpense = transactions
            .filter(t => safeGetLowerCase(t.type) === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Hitung modal awal (semua metode) - sama dengan updateDashboard
        const totalModal = transactions
            .filter(t => safeGetLowerCase(t.type) === 'modal awal')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Net Profit (sesuai konsep laba bersih) - sama dengan updateDashboard
        const netProfit = totalIncome - totalExpense;

        // Hitung breakdown kas: tunai - sama dengan updateDashboard
        const cashIncome = transactions
            .filter(t => safeGetLowerCase(t.method) === 'tunai' && safeGetLowerCase(t.type) === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const cashExpense = transactions
            .filter(t => safeGetLowerCase(t.method) === 'tunai' && safeGetLowerCase(t.type) === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const cashModal = transactions
            .filter(t => safeGetLowerCase(t.method) === 'tunai' && safeGetLowerCase(t.type) === 'modal awal')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Rumus Kas Tunai: Pemasukan Tunai - Pengeluaran Tunai + Modal Awal Tunai
        const cashAmount = cashIncome - cashExpense + cashModal;

        // Hitung breakdown kas: non tunai - sama dengan updateDashboard
        const nonCashIncome = transactions
            .filter(t => safeGetLowerCase(t.method) === 'non tunai' && safeGetLowerCase(t.type) === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const nonCashExpense = transactions
            .filter(t => safeGetLowerCase(t.method) === 'non tunai' && safeGetLowerCase(t.type) === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const nonCashModal = transactions
            .filter(t => safeGetLowerCase(t.method) === 'non tunai' && safeGetLowerCase(t.type) === 'modal awal')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Rumus Kas Non Tunai: Pemasukan Non Tunai - Pengeluaran Non Tunai + Modal Awal Non Tunai
        const nonCashAmount = nonCashIncome - nonCashExpense + nonCashModal;

        // Total kas akhir
        const totalKas = cashAmount + nonCashAmount;

        // Persentase dan rasio - sama dengan updateDashboard
        const profitPercentage = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
        const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

        // Calculate average transactions per day
        const daysDiff = Math.max(1, Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)));
        const avgTransactionsPerDay = transactions.length / daysDiff;

        // Debug console dinonaktifkan

        // Update summary - dengan pengecekan null untuk menghindari error
        const reportIncomeEl = document.getElementById('report-income');
        const reportExpenseEl = document.getElementById('report-expense');
        const reportProfitEl = document.getElementById('report-profit');
        const reportProfitPercentEl = document.getElementById('report-profit-percent');

        if (reportIncomeEl) reportIncomeEl.textContent = formatCurrency(totalIncome);
        if (reportExpenseEl) reportExpenseEl.textContent = formatCurrency(totalExpense);
        if (reportProfitEl) reportProfitEl.textContent = formatCurrency(netProfit);
        if (reportProfitPercentEl) reportProfitPercentEl.textContent = profitPercentage.toFixed(1) + '%';

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
                updateBasicReportMetrics(totalModal);
                updateAnalyticReportMetrics();
            }
            else if (reportType === 'basic' && reportBasic) {
                reportBasic.classList.remove('hidden');
                updateBasicReportMetrics(totalModal);
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

            // Fungsi untuk memperbarui metrik laporan dasar - disesuaikan dengan format Dashboard
            // Fungsi untuk menampilkan hasil laporan untuk setiap card
            function updateReportCard(cardType, value, cashValue, nonCashValue) {
                // Temukan elemen card berdasarkan tipe
                const cardSelector = `.report-card.${cardType}`;
                const card = document.querySelector(cardSelector);
                if (!card) return;

                // Temukan elemen nilai dan detail di dalam card
                const valueEl = card.querySelector('.report-card-value');
                const detailEl = card.querySelector('.report-card-detail');

                // Update nilai dan detail - format sesuai dengan Dashboard
                if (valueEl) {
                    let prefix = '';
                    let suffix = '';

                    if (cardType === 'modal') prefix = '💰 Modal Awal: ';
                    if (cardType === 'income') prefix = '📈 Pemasukan: ';
                    if (cardType === 'expense') prefix = '📉 Pengeluaran: ';
                    if (cardType === 'profit-loss') {
                        prefix = '🔄 Laba / Rugi: ';
                        // Tambahkan suffix untuk nilai negatif
                        if (value < 0) suffix = ' (defisit)';
                    }

                    // Format sesuai dengan Dashboard
                    if (typeof value === 'number' && cardType.includes('percentage')) {
                        valueEl.textContent = `${value.toFixed(1)}%${suffix}`;
                    } else {
                        valueEl.textContent = `${formatCurrency(value)}${suffix}`;
                    }
                }

                if (detailEl) {
                    detailEl.innerHTML = `Tunai: ${formatCurrency(cashValue)}<br>Non Tunai: ${formatCurrency(nonCashValue)}`;
                }
            }

            // Konfigurasi Google Sheets API
            const GOOGLE_SHEETS_CONFIG = {
                apiKey: 'YOUR_API_KEY', // Ganti dengan API key Anda
                spreadsheetId: 'YOUR_SPREADSHEET_ID', // Ganti dengan ID spreadsheet Anda
                range: 'LaporanKeuangan!A1:Z100' // Sesuaikan dengan range data Anda
            };

            // Fungsi lama untuk mengambil data dari Google Sheets (tidak digunakan)
            // Digantikan dengan implementasi baru yang menggunakan gapi.client

            // Fungsi untuk mengambil data dari Google Sheets
            async function fetchDataFromGoogleSheets() {
                try {
                    // Periksa apakah gapi sudah dimuat dan user sudah login
                    if (!gapi || !gapi.client || !gapi.client.sheets) {
                        console.log('Google API belum dimuat atau user belum login');
                        return null;
                    }

                    // Ambil data dari Google Sheets
                    const response = await gapi.client.sheets.spreadsheets.values.get({
                        spreadsheetId: CONFIG.spreadsheetId,
                        range: `${CONFIG.sheetName}!${CONFIG.sheetRange}`
                    });

                    // Proses data yang diterima
                    const values = response.result.values;
                    if (values && values.length > 0) {
                        return processSheetData(values);
                    } else {
                        console.log('Tidak ada data yang ditemukan di Google Sheets');
                        return null;
                    }
                } catch (error) {
                    console.error('Error saat mengambil data dari Google Sheets:', error);
                    return null;
                }
            }

            // Fungsi untuk memproses data dari Google Sheets
            function processSheetData(values) {
                if (!values || values.length === 0) {
                    return null;
                }

                // Asumsikan format data di Google Sheets:
                // Header: Tipe, Total, Tunai, NonTunai, Persentase, Deskripsi
                // Row 1: Modal Awal, 1000000, 500000, 500000, -, -
                // Row 2: Pemasukan, 2000000, 1000000, 1000000, -, -
                // Row 3: Pengeluaran, 1500000, 750000, 750000, -, -
                // Row 4: Laba/Rugi, 500000, -, -, 25, -
                // Row 5: Distribusi Metode, -, 1750000, 1750000, -, -
                // Row 6: Pengeluaran Terbesar, -, -, -, -, Sewa Tempat: 500000
                // Row 7: Pengeluaran Terbesar 2, -, -, -, -, Bahan Baku: 300000
                // Row 8: Pemasukan Terbesar, -, -, -, -, Penjualan Kopi: 800000
                // Row 9: Pemasukan Terbesar 2, -, -, -, -, Penjualan Makanan: 600000
                // Row 10: Jumlah Transaksi, 45, -, -, -, -

                const headers = values[0];
                const data = {};

                // Mulai dari baris 1 (setelah header)
                for (let i = 1; i < values.length; i++) {
                    const row = values[i];
                    const type = row[0];

                    // Penanganan khusus untuk tipe data tertentu
                    if (type.toLowerCase().includes('pengeluaran terbesar') && !type.toLowerCase().includes('2')) {
                        // Pengeluaran terbesar pertama
                        if (!data['pengeluaran terbesar']) {
                            data['pengeluaran terbesar'] = {
                                top1_desc: '',
                                top1_amount: 0,
                                top2_desc: '',
                                top2_amount: 0
                            };
                        }

                        // Format: "Deskripsi: Nilai"
                        const descValue = row[5] ? row[5].split(':') : [];
                        if (descValue.length >= 2) {
                            data['pengeluaran terbesar'].top1_desc = descValue[0].trim();
                            data['pengeluaran terbesar'].top1_amount = parseFloat(descValue[1].trim().replace(/[^\d.-]/g, '')) || 0;
                        }
                    }
                    else if (type.toLowerCase().includes('pengeluaran terbesar 2')) {
                        // Pengeluaran terbesar kedua
                        if (!data['pengeluaran terbesar']) {
                            data['pengeluaran terbesar'] = {
                                top1_desc: '',
                                top1_amount: 0,
                                top2_desc: '',
                                top2_amount: 0
                            };
                        }

                        // Format: "Deskripsi: Nilai"
                        const descValue = row[5] ? row[5].split(':') : [];
                        if (descValue.length >= 2) {
                            data['pengeluaran terbesar'].top2_desc = descValue[0].trim();
                            data['pengeluaran terbesar'].top2_amount = parseFloat(descValue[1].trim().replace(/[^\d.-]/g, '')) || 0;
                        }
                    }
                    else if (type.toLowerCase().includes('pemasukan terbesar') && !type.toLowerCase().includes('2')) {
                        // Pemasukan terbesar pertama
                        if (!data['pemasukan terbesar']) {
                            data['pemasukan terbesar'] = {
                                top1_desc: '',
                                top1_amount: 0,
                                top2_desc: '',
                                top2_amount: 0
                            };
                        }

                        // Format: "Deskripsi: Nilai"
                        const descValue = row[5] ? row[5].split(':') : [];
                        if (descValue.length >= 2) {
                            data['pemasukan terbesar'].top1_desc = descValue[0].trim();
                            data['pemasukan terbesar'].top1_amount = parseFloat(descValue[1].trim().replace(/[^\d.-]/g, '')) || 0;
                        }
                    }
                    else if (type.toLowerCase().includes('pemasukan terbesar 2')) {
                        // Pemasukan terbesar kedua
                        if (!data['pemasukan terbesar']) {
                            data['pemasukan terbesar'] = {
                                top1_desc: '',
                                top1_amount: 0,
                                top2_desc: '',
                                top2_amount: 0
                            };
                        }

                        // Format: "Deskripsi: Nilai"
                        const descValue = row[5] ? row[5].split(':') : [];
                        if (descValue.length >= 2) {
                            data['pemasukan terbesar'].top2_desc = descValue[0].trim();
                            data['pemasukan terbesar'].top2_amount = parseFloat(descValue[1].trim().replace(/[^\d.-]/g, '')) || 0;
                        }
                    }
                    else if (type.toLowerCase() === 'jumlah transaksi') {
                        // Jumlah transaksi
                        data['jumlah transaksi'] = {
                            total: parseInt(row[1]) || 0
                        };
                    }
                    else {
                        // Format standar untuk tipe data lainnya
                        data[type.toLowerCase()] = {
                            total: parseFloat(row[1]) || 0,
                            tunai: parseFloat(row[2]) || 0,
                            nonTunai: parseFloat(row[3]) || 0,
                            persentase: parseFloat(row[4]) || 0
                        };
                    }
                }

                return data;
            }

            // Fungsi untuk mengelola card Modal Awal
            async function updateModalCard(totalModal, cashModal, nonCashModal) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                // Pastikan totalModal, cashModal, dan nonCashModal adalah angka yang valid
                totalModal = parseFloat(totalModal) || 0;
                cashModal = parseFloat(cashModal) || 0;
                nonCashModal = parseFloat(nonCashModal) || 0;

                // Verifikasi bahwa total modal sesuai dengan jumlah tunai dan non tunai
                if (Math.abs((cashModal + nonCashModal) - totalModal) > 0.01) {
                    // Jika tidak sesuai, sesuaikan total
                    totalModal = cashModal + nonCashModal;
                }

                if (sheetData && sheetData['modal awal']) {
                    // Gunakan data dari Google Sheets
                    const modalData = sheetData['modal awal'];
                    // Pastikan data valid sebelum menggunakannya
                    if (modalData.total && modalData.tunai && modalData.nonTunai) {
                        updateReportCard('modal', modalData.total, modalData.tunai, modalData.nonTunai);
                        return; // Keluar dari fungsi jika data Google Sheets berhasil digunakan
                    }
                }

                // Fallback ke data lokal
                updateReportCard('modal', totalModal, cashModal, nonCashModal);

                // Debug: Log nilai untuk memastikan pembaruan
                console.log('Update Modal Card:', { totalModal, cashModal, nonCashModal });
            }

            // Fungsi untuk mengelola card Pemasukan
            async function updateIncomeCard(totalIncome, cashIncome, nonCashIncome) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                // Pastikan totalIncome, cashIncome, dan nonCashIncome adalah angka yang valid
                totalIncome = parseFloat(totalIncome) || 0;
                cashIncome = parseFloat(cashIncome) || 0;
                nonCashIncome = parseFloat(nonCashIncome) || 0;

                // Verifikasi bahwa total pemasukan sesuai dengan jumlah tunai dan non tunai
                if (Math.abs((cashIncome + nonCashIncome) - totalIncome) > 0.01) {
                    // Jika tidak sesuai, sesuaikan total
                    totalIncome = cashIncome + nonCashIncome;
                }

                if (sheetData && sheetData['pemasukan']) {
                    // Gunakan data dari Google Sheets
                    const incomeData = sheetData['pemasukan'];
                    // Pastikan data valid sebelum menggunakannya
                    if (incomeData.total && incomeData.tunai && incomeData.nonTunai) {
                        updateReportCard('income', incomeData.total, incomeData.tunai, incomeData.nonTunai);
                        return; // Keluar dari fungsi jika data Google Sheets berhasil digunakan
                    }
                }

                // Fallback ke data lokal jika data Google Sheets tidak tersedia atau tidak valid
                updateReportCard('income', totalIncome, cashIncome, nonCashIncome);

                // Debug: Log nilai untuk memastikan pembaruan
                console.log('Update Income Card:', { totalIncome, cashIncome, nonCashIncome });
            }

            // Fungsi untuk mengelola card Pengeluaran
            async function updateExpenseCard(totalExpense, cashExpense, nonCashExpense) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                if (sheetData && sheetData['pengeluaran']) {
                    // Gunakan data dari Google Sheets
                    const expenseData = sheetData['pengeluaran'];
                    updateReportCard('expense', expenseData.total, expenseData.tunai, expenseData.nonTunai);
                } else {
                    // Fallback ke data lokal
                    updateReportCard('expense', totalExpense, cashExpense, nonCashExpense);
                }
            }

            // Fungsi untuk mengelola card Laba/Rugi - disesuaikan dengan format Dashboard
            async function updateProfitLossCard(netProfit, profitPercentage) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                if (sheetData && sheetData['laba/rugi']) {
                    // Gunakan data dari Google Sheets
                    const profitData = sheetData['laba/rugi'];
                    // Gunakan updateReportCard untuk konsistensi format dengan Dashboard
                    updateReportCard('profit-loss', profitData.total, 0, 0);

                    // Update detail persentase
                    const profitLossCard = document.querySelector('.report-card.profit');
                    if (profitLossCard) {
                        const detailEl = profitLossCard.querySelector('.report-card-detail');
                        if (detailEl) detailEl.textContent = `(${profitData.persentase.toFixed(1)}% dari Pemasukan)`;
                    }
                } else {
                    // Fallback ke data lokal
                    // Gunakan updateReportCard untuk konsistensi format dengan Dashboard
                    updateReportCard('profit-loss', netProfit, 0, 0);

                    // Update detail persentase
                    const profitLossCard = document.querySelector('.report-card.profit');
                    if (profitLossCard) {
                        const detailEl = profitLossCard.querySelector('.report-card-detail');
                        if (detailEl) detailEl.textContent = `(${profitPercentage.toFixed(1)}% dari Pemasukan)`;

                        // Pastikan nilai laba bersih diformat dengan benar
                        const valueEl = profitLossCard.querySelector('.report-card-value');
                        if (valueEl) {
                            const prefix = netProfit >= 0 ? '🔄 Laba / Rugi: ' : '🔄 Laba / Rugi: ';
                            valueEl.textContent = `${formatCurrency(netProfit)}${netProfit < 0 ? ' (defisit)' : ''}`;
                        }
                    }
                }
            }


            // Fungsi untuk mengelola card Pengeluaran Terbesar
            async function updateTopExpenseCard(transactions) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                const topExpenseCard = document.querySelector('.report-card.top-expense');
                if (!topExpenseCard) return;

                const valueEls = topExpenseCard.querySelectorAll('.report-card-value');

                if (sheetData && sheetData['pengeluaran terbesar']) {
                    // Gunakan data dari Google Sheets
                    const topExpenseData = sheetData['pengeluaran terbesar'];

                    if (valueEls.length >= 1) {
                        valueEls[0].textContent = `🏆 ${topExpenseData.top1_desc || 'Tidak ada data'}: ${formatCurrency(topExpenseData.top1_amount || 0)}`;
                    }

                    if (valueEls.length >= 2) {
                        valueEls[1].textContent = `🥈 ${topExpenseData.top2_desc || 'Tidak ada data'}: ${formatCurrency(topExpenseData.top2_amount || 0)}`;
                    }
                } else {
                    // Fallback ke data lokal
                    // Filter transaksi pengeluaran dan urutkan dari yang terbesar
                    const expenses = transactions
                        .filter(t => safeGetLowerCase(t.type) === 'pengeluaran')
                        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

                    // Tampilkan 2 pengeluaran terbesar jika ada
                    if (expenses.length > 0 && valueEls.length >= 1) {
                        valueEls[0].textContent = `🏆 ${expenses[0].description} (${formatDate(expenses[0].date)}): ${formatCurrency(parseFloat(expenses[0].amount))}`;

                        if (expenses.length > 1 && valueEls.length >= 2) {
                            valueEls[1].textContent = `🥈 ${expenses[1].description} (${formatDate(expenses[1].date)}): ${formatCurrency(parseFloat(expenses[1].amount))}`;
                        } else if (valueEls.length >= 2) {
                            valueEls[1].textContent = '🥈 Tidak ada data';
                        }
                    } else {
                        if (valueEls.length >= 1) valueEls[0].textContent = '🏆 Tidak ada data';
                        if (valueEls.length >= 2) valueEls[1].textContent = '🥈 Tidak ada data';
                    }
                }
            }

            // Fungsi untuk mengelola card Pemasukan Terbesar
            async function updateTopIncomeCard(transactions) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                const topIncomeCard = document.querySelector('.report-card.top-income');
                if (!topIncomeCard) return;

                const valueEls = topIncomeCard.querySelectorAll('.report-card-value');

                if (sheetData && sheetData['pemasukan terbesar']) {
                    // Gunakan data dari Google Sheets
                    const topIncomeData = sheetData['pemasukan terbesar'];

                    if (valueEls.length >= 1) {
                        valueEls[0].textContent = `🏆 ${topIncomeData.top1_desc || 'Tidak ada data'}: ${formatCurrency(topIncomeData.top1_amount || 0)}`;
                    }

                    if (valueEls.length >= 2) {
                        valueEls[1].textContent = `🥈 ${topIncomeData.top2_desc || 'Tidak ada data'}: ${formatCurrency(topIncomeData.top2_amount || 0)}`;
                    }
                } else {
                    // Fallback ke data lokal
                    // Filter transaksi pemasukan dan urutkan dari yang terbesar
                    const incomes = transactions
                        .filter(t => safeGetLowerCase(t.type) === 'pemasukan')
                        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

                    // Tampilkan 2 pemasukan terbesar jika ada
                    if (incomes.length > 0 && valueEls.length >= 1) {
                        valueEls[0].textContent = `🏆 ${incomes[0].description} (${formatDate(incomes[0].date)}): ${formatCurrency(parseFloat(incomes[0].amount))}`;

                        if (incomes.length > 1 && valueEls.length >= 2) {
                            valueEls[1].textContent = `🥈 ${incomes[1].description} (${formatDate(incomes[1].date)}): ${formatCurrency(parseFloat(incomes[1].amount))}`;
                        } else if (valueEls.length >= 2) {
                            valueEls[1].textContent = '🥈 Tidak ada data';
                        }
                    } else {
                        if (valueEls.length >= 1) valueEls[0].textContent = '🏆 Tidak ada data';
                        if (valueEls.length >= 2) valueEls[1].textContent = '🥈 Tidak ada data';
                    }
                }
            }

            // Fungsi untuk mengelola card Jumlah Transaksi
            async function updateTransactionCountCard(transactionCount) {
                // Coba ambil data dari Google Sheets
                const sheetData = await fetchDataFromGoogleSheets();

                const transactionCountCard = document.querySelector('.report-card.transaction-count');
                if (!transactionCountCard) return;

                const valueEl = transactionCountCard.querySelector('.report-card-value');
                if (valueEl) {
                    if (sheetData && sheetData['jumlah transaksi']) {
                        // Gunakan data dari Google Sheets
                        const countData = sheetData['jumlah transaksi'];
                        valueEl.textContent = countData.total || 0;
                    } else {
                        // Fallback ke data lokal
                        valueEl.textContent = transactionCount;
                    }
                }
            }

            async function updateBasicReportMetrics(totalModal) {
                // Update basic report metrics - disesuaikan dengan updateDashboard
                const totalIncomeEl = document.getElementById('total-income');
                const totalExpenseEl = document.getElementById('total-expense');
                const profitLossEl = document.getElementById('profit-loss');
                const transactionCountEl = document.getElementById('transaction-count');
                const avgTransactionEl = document.getElementById('avg-transaction');

                // Elemen untuk metrik baru
                const totalCashEl = document.getElementById('total-cash');
                const totalNonCashEl = document.getElementById('total-non-cash');
                const cashIncomeEl = document.getElementById('cash-income');
                const nonCashIncomeEl = document.getElementById('non-cash-income');
                const cashExpenseEl = document.getElementById('cash-expense');
                const nonCashExpenseEl = document.getElementById('non-cash-expense');
                const totalAmountEl = document.getElementById('total-amount');

                // Gunakan nilai yang sudah dihitung di updateReportUI
                // Nilai cashModal dan nonCashModal sudah dihitung di updateReportUI
                // Gunakan cashAmount dan nonCashAmount yang sudah dihitung di updateReportUI
                const totalCash = cashAmount;
                const totalNonCash = nonCashAmount;

                // Update metrik dasar - disesuaikan dengan format Dashboard
                if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);
                if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
                if (profitLossEl) profitLossEl.textContent = formatCurrency(netProfit);
                if (transactionCountEl) transactionCountEl.textContent = transactions.length;
                if (avgTransactionEl) avgTransactionEl.textContent = avgTransactionsPerDay.toFixed(1);

                // Update metrik baru dengan format yang sama dengan Dashboard
                totalAmount = totalCash + totalNonCash; // Ubah menjadi variabel global untuk digunakan di updateAnalyticReportMetrics
                if (totalCashEl) totalCashEl.textContent = formatCurrency(totalCash);
                if (totalNonCashEl) totalNonCashEl.textContent = formatCurrency(totalNonCash);
                if (cashIncomeEl) cashIncomeEl.textContent = formatCurrency(cashIncome);
                if (nonCashIncomeEl) nonCashIncomeEl.textContent = formatCurrency(nonCashIncome);
                if (cashExpenseEl) cashExpenseEl.textContent = formatCurrency(cashExpense);
                if (nonCashExpenseEl) nonCashExpenseEl.textContent = formatCurrency(nonCashExpense);
                if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalAmount);

                // Update persentase dengan format yang sama dengan Dashboard
                const cashPercentageEl = document.getElementById('cash-percentage');
                const nonCashPercentageEl = document.getElementById('non-cash-percentage');
                const profitPercentageEl = document.getElementById('profit-percentage');
                const expensePercentageEl = document.getElementById('expense-percentage');

                if (cashPercentageEl && totalAmount > 0) {
                    const cashPercent = (totalCash / totalAmount) * 100;
                    cashPercentageEl.textContent = cashPercent.toFixed(1) + '%';
                }

                if (nonCashPercentageEl && totalAmount > 0) {
                    const nonCashPercent = (totalNonCash / totalAmount) * 100;
                    nonCashPercentageEl.textContent = nonCashPercent.toFixed(1) + '%';
                }

                if (profitPercentageEl && totalIncome > 0) {
                    const profitPercent = (netProfit / totalIncome) * 100;
                    profitPercentageEl.textContent = profitPercent.toFixed(1) + '%';
                }

                if (expensePercentageEl && totalIncome > 0) {
                    const expensePercent = (totalExpense / totalIncome) * 100;
                    expensePercentageEl.textContent = expensePercent.toFixed(1) + '%';
                }

                // Update elemen laporan Breakdown Kas
                const reportCashIncomeEl = document.getElementById('report-cash-income');
                const reportNonCashIncomeEl = document.getElementById('report-non-cash-income');
                const reportCashExpenseEl = document.getElementById('report-cash-expense');
                const reportNonCashExpenseEl = document.getElementById('report-non-cash-expense');
                const reportTransactionCountEl = document.getElementById('report-transaction-count');

                // Update nilai Breakdown Kas di laporan
                if (reportCashIncomeEl) reportCashIncomeEl.textContent = formatCurrency(cashIncome);
                if (reportNonCashIncomeEl) reportNonCashIncomeEl.textContent = formatCurrency(nonCashIncome);
                if (reportCashExpenseEl) reportCashExpenseEl.textContent = formatCurrency(cashExpense);
                if (reportNonCashExpenseEl) reportNonCashExpenseEl.textContent = formatCurrency(nonCashExpense);
                if (reportTransactionCountEl) reportTransactionCountEl.textContent = transactions.length;

                // Update saldo awal/modal dan saldo akhir periode
                const beginningBalance = totalModal; // Menggunakan nilai modal awal yang sudah dihitung
                const netMovement = netProfit;
                const endingBalance = beginningBalance + netMovement;

                const beginningBalanceEl = document.getElementById('beginning-balance');
                const netMovementEl = document.getElementById('net-movement');
                const endingBalanceEl = document.getElementById('ending-balance');

                if (beginningBalanceEl) beginningBalanceEl.textContent = formatCurrency(beginningBalance);
                if (netMovementEl) netMovementEl.textContent = formatCurrency(netMovement);
                if (endingBalanceEl) endingBalanceEl.textContent = formatCurrency(endingBalance);

                // Update semua report card menggunakan fungsi khusus untuk setiap card
                // Karena fungsi-fungsi ini sekarang async, kita perlu menggunakan await
                await updateModalCard(totalModal, cashModal, nonCashModal);
                await updateIncomeCard(totalIncome, cashIncome, nonCashIncome);
                await updateExpenseCard(totalExpense, cashExpense, nonCashExpense);
                await updateProfitLossCard(netProfit, profitPercentage);
                await updateTopExpenseCard(transactions);
                await updateTopIncomeCard(transactions);
                await updateTransactionCountCard(transactions.length);
            }

            // Fungsi untuk memperbarui metrik laporan analitis - disesuaikan dengan format Dashboard
            function updateAnalyticReportMetrics() {
                // Update analytic report metrics dengan format yang sama dengan Dashboard
                const profitMarginEl = document.getElementById('profit-margin');
                const profitMarginBarEl = document.getElementById('profit-margin-bar');
                const expenseRatioEl = document.getElementById('expense-ratio-analytics');
                const expenseRatioBarEl = document.getElementById('expense-ratio-bar');

                // Gunakan format yang sama dengan Dashboard (toFixed(1) + '%')
                if (profitMarginEl) profitMarginEl.textContent = profitPercentage.toFixed(1) + '%';
                if (profitMarginBarEl) profitMarginBarEl.style.width = Math.min(100, Math.abs(profitPercentage)) + '%';

                if (expenseRatioEl) expenseRatioEl.textContent = expenseRatio.toFixed(1) + '%';
                if (expenseRatioBarEl) expenseRatioBarEl.style.width = Math.min(100, expenseRatio) + '%';

                // Update persentase kas dan non-kas
                const cashPercentageAnalyticsEl = document.getElementById('cash-percentage-analytics');
                const nonCashPercentageAnalyticsEl = document.getElementById('non-cash-percentage-analytics');

                // Gunakan cashAmount dan nonCashAmount yang sudah dihitung di updateReportUI
                const totalCash = cashAmount;
                const totalNonCash = nonCashAmount;
                // totalAmount sudah didefinisikan di updateBasicReportMetrics

                if (cashPercentageAnalyticsEl && totalAmount > 0) {
                    const cashPercent = (totalCash / totalAmount) * 100;
                    cashPercentageAnalyticsEl.textContent = cashPercent.toFixed(1) + '%';
                }

                if (nonCashPercentageAnalyticsEl && totalAmount > 0) {
                    const nonCashPercent = (totalNonCash / totalAmount) * 100;
                    nonCashPercentageAnalyticsEl.textContent = nonCashPercent.toFixed(1) + '%';
                }

                // Tampilkan elemen analisis metode pembayaran
                document.getElementById('payment-method-analysis').style.display = 'grid';
            }

            // Forecast telah dihapus dari UI
            // if (reportType === 'forecast' || reportType === 'all') {
            //     generateForecast(transactions, dateRange);
            //     document.getElementById('report-forecast').classList.remove('hidden');
            // }

            // Update charts for all report types
            const selectedPeriod = 'monthly'; // Default period
            updateCharts(transactions, dateRange, reportType, selectedPeriod);

            // Update report table for basic report
            if (reportType === 'basic' || reportType === 'all') {
                const tableBody = document.querySelector('#report-table tbody');
                const cardsContainer = document.getElementById('report-cards-container');

                if (tableBody) tableBody.innerHTML = '';
                if (cardsContainer) cardsContainer.innerHTML = '';

                // Sort transactions by date (newest first)
                const sortedTransactions = [...transactions].sort((a, b) => {
                    return new Date(b.date) - new Date(a.date);
                });

                // Pagination state for report
                let reportPaginationState = {
                    currentPage: 1,
                    itemsPerPage: 10,
                    totalPages: Math.ceil(sortedTransactions.length / 10) || 1
                };

                // Update pagination UI
                document.getElementById('report-current-page').textContent = reportPaginationState.currentPage;
                document.getElementById('report-total-pages').textContent = reportPaginationState.totalPages;
                document.getElementById('report-prev-page').disabled = reportPaginationState.currentPage <= 1;
                document.getElementById('report-next-page').disabled = reportPaginationState.currentPage >= reportPaginationState.totalPages;

                // Get current page items (10 items per page)
                const startIndex = 0; // Always start with the first page initially
                const endIndex = startIndex + reportPaginationState.itemsPerPage;
                const currentPageItems = sortedTransactions.slice(startIndex, endIndex);

                // Add event listeners for pagination buttons
                document.getElementById('report-prev-page').onclick = function () {
                    if (reportPaginationState.currentPage > 1) {
                        reportPaginationState.currentPage--;
                        updateReportPagination();
                    }
                };

                document.getElementById('report-next-page').onclick = function () {
                    if (reportPaginationState.currentPage < reportPaginationState.totalPages) {
                        reportPaginationState.currentPage++;
                        updateReportPagination();
                    }
                };

                // Function to update pagination
                function updateReportPagination() {
                    // Update UI
                    document.getElementById('report-current-page').textContent = reportPaginationState.currentPage;
                    document.getElementById('report-prev-page').disabled = reportPaginationState.currentPage <= 1;
                    document.getElementById('report-next-page').disabled = reportPaginationState.currentPage >= reportPaginationState.totalPages;

                    // Clear previous content
                    if (tableBody) tableBody.innerHTML = '';
                    if (cardsContainer) cardsContainer.innerHTML = '';

                    // Get current page items
                    const startIndex = (reportPaginationState.currentPage - 1) * reportPaginationState.itemsPerPage;
                    const endIndex = startIndex + reportPaginationState.itemsPerPage;
                    const currentPageItems = sortedTransactions.slice(startIndex, endIndex);

                    // Render items
                    renderReportItems(currentPageItems);
                }

                // Function to render items
                function renderReportItems(items) {
                    // Show detailed transactions for basic report in table
                    items.forEach(transaction => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                        <td>${formatDate(new Date(transaction.date))}</td>
                        <td>${transaction.description}</td>
                        <td><span class="badge ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
                        <td>${transaction.method}</td>
                        <td class="${transaction.type === 'Pemasukan' ? 'text-success' : 'text-danger'}">${formatCurrency(parseFloat(transaction.amount))}</td>
                    `;
                        if (tableBody) tableBody.appendChild(row);
                    });

                    // Add cards for mobile view
                    items.forEach(transaction => {
                        const amount = parseFloat(transaction.amount) || 0;

                        const card = document.createElement('div');
                        card.className = 'transaction-card';
                        // Tambahkan kelas income atau expense untuk styling
                        card.classList.add(transaction.type === 'Pemasukan' ? 'income' : 'expense');

                        card.innerHTML = `
                        <div class="transaction-card-header">
                            <span class="transaction-date"><i class="bi bi-calendar3"></i> ${formatDate(new Date(transaction.date))}</span>
                            <span class="transaction-type ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}">${transaction.type}</span>
                        </div>
                        <div class="transaction-description"><i class="bi bi-card-text"></i> ${transaction.description}</div>
                        <div class="transaction-details">
                            <span><i class="bi bi-wallet2"></i> ${transaction.method}</span>
                            <span class="transaction-amount ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}"><i class="bi ${transaction.type === 'Pemasukan' ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'}"></i> ${formatCurrency(amount)}</span>
                        </div>
                    `;
                        if (cardsContainer) cardsContainer.appendChild(card);
                    });
                }

                // Initial render
                renderReportItems(currentPageItems);
            }

            // For analytic report, create breakdown by category
            if (reportType === 'analytic' || reportType === 'all') {
                // Tampilkan elemen analitik
                document.getElementById('report-analytic').classList.remove('hidden');
                // Group income by category
                const incomeByCategory = {};
                const expenseByCategory = {};
                const paymentMethods = { 'Tunai': 0, 'Non Tunai': 0 };

                // Inisialisasi objek untuk menyimpan pemasukan, pengeluaran, dan modal awal berdasarkan metode pembayaran
                const paymentMethodsIncome = { 'Tunai': 0, 'Non Tunai': 0 };
                const paymentMethodsExpense = { 'Tunai': 0, 'Non Tunai': 0 };
                const paymentMethodsModal = { 'Tunai': 0, 'Non Tunai': 0 };

                // Hitung metode pembayaran berdasarkan transaksi aktual
                transactions.forEach(transaction => {
                    const amount = parseFloat(transaction.amount) || 0;
                    const category = transaction.category || 'Lainnya';
                    const method = (transaction.method || 'Tunai').trim().toLowerCase();
                    const normalizedMethod = method === 'tunai' ? 'Tunai' : 'Non Tunai';
                    const transactionType = transaction.type.trim().toLowerCase();

                    // Tambahkan ke total metode pembayaran berdasarkan jenis transaksi
                    if (transactionType === 'pemasukan') {
                        paymentMethodsIncome[normalizedMethod] = (paymentMethodsIncome[normalizedMethod] || 0) + amount;
                        incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
                    } else if (transactionType === 'pengeluaran') {
                        paymentMethodsExpense[normalizedMethod] = (paymentMethodsExpense[normalizedMethod] || 0) + amount;
                        expenseByCategory[category] = (expenseByCategory[category] || 0) + amount;
                    } else if (transactionType === 'modal awal') {
                        paymentMethodsModal[normalizedMethod] = (paymentMethodsModal[normalizedMethod] || 0) + amount;
                    }

                    // Tambahkan ke total metode pembayaran (untuk kompatibilitas)
                    paymentMethods[normalizedMethod] = (paymentMethods[normalizedMethod] || 0) + amount;
                });

                // Hitung total kas sesuai dengan perhitungan di dashboard
                const cashAmount = paymentMethodsIncome['Tunai'] - paymentMethodsExpense['Tunai'] + paymentMethodsModal['Tunai'];
                // Rumus Kas Non Tunai yang diperbarui: Pemasukan Tunai - Pengeluaran Tunai + Modal Awal Non Tunai
                const nonCashAmount = paymentMethodsIncome['Non Tunai'] - paymentMethodsExpense['Non Tunai'] + paymentMethodsModal['Non Tunai'];
                const totalKas = cashAmount + nonCashAmount;

                // Category breakdown telah dihapus

                // Update payment method breakdown
                const cashPercentage = totalKas > 0 ? (cashAmount / totalKas) * 100 : 0;
                const nonCashPercentage = totalKas > 0 ? (nonCashAmount / totalKas) * 100 : 0;

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
                        <div class="stat-label">Pemasukan</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsIncome['Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Pengeluaran</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsExpense['Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Modal Awal</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsModal['Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value">${formatCurrency(cashAmount)}</div>
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
                        <div class="stat-label">Pemasukan</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsIncome['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Pengeluaran</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsExpense['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Modal Awal</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsModal['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value">${formatCurrency(nonCashAmount)}</div>
                    </div>
                </div>
            `;
                paymentMethodAnalysis.appendChild(nonCashElement);

                // Buat elemen untuk Total Keseluruhan
                const totalElement = document.createElement('div');
                totalElement.className = 'payment-method-item total-payment-method';
                totalElement.innerHTML = `
                <div class="payment-method-header">
                    <div class="payment-method-name">
                        <div class="payment-method-icon">∑</div>
                        Total Keseluruhan
                    </div>
                    <div class="payment-method-percentage">100%</div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill total" style="width: 100%"></div>
                </div>
                <div class="payment-method-stats">
                    <div class="payment-stat">
                        <div class="stat-label">Pemasukan</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsIncome['Tunai'] + paymentMethodsIncome['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Pengeluaran</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsExpense['Tunai'] + paymentMethodsExpense['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Modal Awal</div>
                        <div class="stat-value">${formatCurrency(paymentMethodsModal['Tunai'] + paymentMethodsModal['Non Tunai'])}</div>
                    </div>
                    <div class="payment-stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value">${formatCurrency(totalKas)}</div>
                    </div>
                </div>
            `;
                paymentMethodAnalysis.appendChild(totalElement);
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
                if (!tableBody) return;

                transactions.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                    <td>${formatDate(transaction.date)}</td>
                    <td>${transaction.description}</td>
                    <td><span class="badge ${transaction.type === 'Pemasukan' ? 'income' : 'expense'}">${transaction.type}</span></td>
                    <td>${transaction.method}</td>
                    <td>${formatCurrency(transaction.amount)}</td>
                `;
                    tableBody.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Error dalam updateReportUI:', error);
        showError('Terjadi kesalahan saat memperbarui laporan. Silakan coba lagi.');
    }
}

// Fungsi untuk memperbarui grafik
function updateCharts(transactions, dateRange, reportType, selectedPeriod = 'monthly') {
    // Inisialisasi variabel di luar blok try-catch
    let totalIncome = 0;
    let totalExpense = 0;
    let totalModal = 0;

    try {
        // Persiapkan data untuk pie chart (perbandingan pemasukan & pengeluaran)
        totalIncome = transactions
            .filter(t => t.type.trim().toLowerCase() === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        totalExpense = transactions
            .filter(t => t.type.trim().toLowerCase() === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        totalModal = transactions
            .filter(t => t.type.trim().toLowerCase() === 'modal awal')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Untuk laporan visualisasi, perbarui semua grafik
        if (reportType === 'visual' || reportType === 'all') {
            // Tampilkan elemen visualisasi
            document.getElementById('report-visual').classList.remove('hidden');

            // Update semua pie charts
            updateTransactionTypePieChart(totalModal, totalIncome, totalExpense);
            updatePaymentMethodPieChart(transactions);
            updateExpenseCategoryPieChart(transactions);
            updateIncomeExpensePieChart(totalIncome, totalExpense);

            // Update semua bar charts
            updateDailyTransactionsBarChart(transactions);
            updatePaymentMethodBarChart(transactions);
            updateTopExpenseBarChart(transactions);
            updateTopIncomeBarChart(transactions);
        }
    } catch (error) {
        console.error('Error in updateCharts:', error);
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
                    expense: 0,
                    modal: 0
                };
            }

            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'Pemasukan') {
                groupedByDate[dateKey].income += amount;
            } else if (transaction.type === 'Pengeluaran') {
                groupedByDate[dateKey].expense += amount;
            } else if (transaction.type === 'Modal Awal') {
                groupedByDate[dateKey].modal += amount;
            }
        });

        // Convert to array and sort by date (ascending for chart)
        barChartData = Object.values(groupedByDate).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Tambahkan properti yang diperlukan untuk bar chart
        barChartData = barChartData.map(item => ({
            ...item,
            cashIncome: item.income || 0,
            nonCashIncome: 0, // Default 0 karena tidak ada data metode pembayaran
            cashExpense: item.expense || 0,
            nonCashExpense: 0, // Default 0 karena tidak ada data metode pembayaran
            cashModal: item.modal || 0,
            nonCashModal: 0 // Default 0 karena tidak ada data metode pembayaran
        }));
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
                    expense: 0,
                    modal: 0
                };
            }

            const amount = parseFloat(transaction.amount) || 0;
            if (transaction.type === 'Pemasukan') {
                groupedByDate[dateKey].income += amount;
            } else if (transaction.type === 'Pengeluaran') {
                groupedByDate[dateKey].expense += amount;
            } else if (transaction.type === 'Modal Awal') {
                groupedByDate[dateKey].modal += amount;
            }
        });

        // Convert to array and sort by date (ascending for chart)
        barChartData = Object.values(groupedByDate).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });
    }

    // Update bar chart
    updateBarChart(barChartData, reportType, selectedPeriod);
}


// Fungsi untuk memperbarui pie chart distribusi jenis transaksi
function updateTransactionTypePieChart(modal, income, expense) {
    try {
        const chartElement = document.getElementById('transaction-type-pie-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (transactionTypePieChart) {
            transactionTypePieChart.destroy();
        }

        // Total semua transaksi
        const total = modal + income + expense;

        // Hitung persentase
        const modalPercentage = total > 0 ? (modal / total) * 100 : 0;
        const incomePercentage = total > 0 ? (income / total) * 100 : 0;
        const expensePercentage = total > 0 ? (expense / total) * 100 : 0;

        // Create new chart
        transactionTypePieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Modal Awal', 'Pemasukan', 'Pengeluaran'],
                datasets: [{
                    data: [modalPercentage, incomePercentage, expensePercentage],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',  // blue for modal
                        'rgba(74, 222, 128, 0.8)',  // green for income
                        'rgba(248, 113, 113, 0.8)'   // red for expense
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
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
                            color: 'rgb(230, 240, 242)',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ' + context.raw.toFixed(1) + '%';
                                    // Tambahkan nilai nominal
                                    if (label.includes('Modal')) {
                                        label += ' (' + formatCurrency(modal) + ')';
                                    } else if (label.includes('Pemasukan')) {
                                        label += ' (' + formatCurrency(income) + ')';
                                    } else if (label.includes('Pengeluaran')) {
                                        label += ' (' + formatCurrency(expense) + ')';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Gagal memperbarui transaction type pie chart:", error);
    }
}

// Fungsi untuk memperbarui pie chart metode pembayaran
function updatePaymentMethodPieChart(transactions) {
    try {
        const chartElement = document.getElementById('payment-method-pie-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (paymentMethodPieChart) {
            paymentMethodPieChart.destroy();
        }

        // Hitung total transaksi per metode pembayaran
        const cashTotal = transactions
            .filter(t => t.method.trim().toLowerCase() === 'tunai')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const nonCashTotal = transactions
            .filter(t => t.method.trim().toLowerCase() === 'non tunai')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Total semua transaksi
        const total = cashTotal + nonCashTotal;

        // Hitung persentase
        const cashPercentage = total > 0 ? (cashTotal / total) * 100 : 0;
        const nonCashPercentage = total > 0 ? (nonCashTotal / total) * 100 : 0;

        // Create new chart
        paymentMethodPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Tunai', 'Non-Tunai'],
                datasets: [{
                    data: [cashPercentage, nonCashPercentage],
                    backgroundColor: [
                        'rgba(234, 179, 8, 0.8)',   // yellow for cash
                        'rgba(147, 51, 234, 0.8)'   // purple for non-cash
                    ],
                    borderColor: [
                        'rgba(234, 179, 8, 1)',
                        'rgba(147, 51, 234, 1)'
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
                            color: 'rgb(230, 240, 242)',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ' + context.raw.toFixed(1) + '%';
                                    // Tambahkan nilai nominal
                                    if (label.includes('Tunai')) {
                                        label += ' (' + formatCurrency(cashTotal) + ')';
                                    } else if (label.includes('Non-Tunai')) {
                                        label += ' (' + formatCurrency(nonCashTotal) + ')';
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Gagal memperbarui payment method pie chart:", error);
    }
}

// Fungsi untuk memperbarui pie chart kategori pengeluaran
function updateExpenseCategoryPieChart(transactions) {
    try {
        const chartElement = document.getElementById('expense-category-pie-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (expenseCategoryPieChart) {
            expenseCategoryPieChart.destroy();
        }

        // Filter hanya transaksi pengeluaran
        const expenseTransactions = transactions.filter(t => t.type.trim().toLowerCase() === 'pengeluaran');

        // Kelompokkan berdasarkan deskripsi (kategori)
        const expenseCategories = {};
        expenseTransactions.forEach(transaction => {
            // Gunakan deskripsi sebagai kategori
            const category = transaction.description.trim();
            if (!expenseCategories[category]) {
                expenseCategories[category] = 0;
            }
            expenseCategories[category] += parseFloat(transaction.amount) || 0;
        });

        // Konversi ke array untuk chart
        const categories = Object.keys(expenseCategories);
        const amounts = Object.values(expenseCategories);

        // Total pengeluaran
        const totalExpense = amounts.reduce((sum, amount) => sum + amount, 0);

        // Hitung persentase
        const percentages = amounts.map(amount => totalExpense > 0 ? (amount / totalExpense) * 100 : 0);

        // Generate warna dinamis
        const backgroundColors = [
            'rgba(248, 113, 113, 0.8)', // red
            'rgba(251, 146, 60, 0.8)',  // orange
            'rgba(234, 179, 8, 0.8)',   // yellow
            'rgba(132, 204, 22, 0.8)',  // lime
            'rgba(74, 222, 128, 0.8)',  // green
            'rgba(34, 211, 238, 0.8)',  // cyan
            'rgba(59, 130, 246, 0.8)',  // blue
            'rgba(147, 51, 234, 0.8)',  // purple
            'rgba(236, 72, 153, 0.8)',  // pink
        ];

        const borderColors = [
            'rgba(248, 113, 113, 1)',
            'rgba(251, 146, 60, 1)',
            'rgba(234, 179, 8, 1)',
            'rgba(132, 204, 22, 1)',
            'rgba(74, 222, 128, 1)',
            'rgba(34, 211, 238, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(147, 51, 234, 1)',
            'rgba(236, 72, 153, 1)',
        ];

        // Pastikan ada cukup warna untuk semua kategori
        const colors = categories.map((_, index) => {
            return backgroundColors[index % backgroundColors.length];
        });

        const borders = categories.map((_, index) => {
            return borderColors[index % borderColors.length];
        });

        // Create new chart
        expenseCategoryPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    data: percentages,
                    backgroundColor: colors,
                    borderColor: borders,
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
                            color: 'rgb(230, 240, 242)',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const index = context.dataIndex;
                                const category = categories[index];
                                const amount = amounts[index];
                                return `${category}: ${context.raw.toFixed(1)}% (${formatCurrency(amount)})`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Gagal memperbarui expense category pie chart:", error);
    }
}

// Fungsi untuk memperbarui pie chart perbandingan pemasukan & pengeluaran
function updateIncomeExpensePieChart(income, expense) {
    try {
        const chartElement = document.getElementById('income-expense-pie-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (incomeExpensePieChart) {
            incomeExpensePieChart.destroy();
        }

        // Hitung persentase laba
        const profit = income - expense;
        const profitPercentage = income > 0 ? (profit / income) * 100 : 0;
        const expensePercentage = income > 0 ? (expense / income) * 100 : 0;

        // Create new chart
        incomeExpensePieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Laba', 'Pengeluaran'],
                datasets: [{
                    data: [profitPercentage, expensePercentage],
                    backgroundColor: [
                        'rgba(74, 222, 128, 0.8)',  // success color for profit
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
                            color: 'rgb(230, 240, 242)',  // text-primary color
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ' + context.raw.toFixed(1) + '%';
                                    // Tambahkan nilai nominal
                                    if (label.includes('Laba')) {
                                        label += ' (' + formatCurrency(profit) + ')';
                                    } else if (label.includes('Pengeluaran')) {
                                        label += ' (' + formatCurrency(expense) + ')';
                                    }
                                }
                                return label;
                            }
                        }
                    },
                    title: {
                        display: true,
                        color: 'rgb(230, 240, 242)',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Gagal memperbarui income expense pie chart:", error);
    }
}


// Fungsi untuk memperbarui bar chart total transaksi harian
function updateDailyTransactionsBarChart(transactions) {
    try {
        const chartElement = document.getElementById('daily-transactions-bar-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (dailyTransactionsBarChart) {
            dailyTransactionsBarChart.destroy();
        }

        // Group by date and transaction type
        const groupedByDate = {};

        transactions.forEach(transaction => {
            const dateKey = formatDate(transaction.date);
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    modal: 0,
                    income: 0,
                    expense: 0
                };
            }

            const amount = parseFloat(transaction.amount) || 0;
            const type = transaction.type.trim().toLowerCase();

            if (type === 'modal awal') {
                groupedByDate[dateKey].modal += amount;
            } else if (type === 'pemasukan') {
                groupedByDate[dateKey].income += amount;
            } else if (type === 'pengeluaran') {
                groupedByDate[dateKey].expense += amount;
            }
        });

        // Convert to array and sort by date
        const sortedData = Object.values(groupedByDate).sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Prepare data for chart
        const labels = sortedData.map(item => item.date);
        const modalData = sortedData.map(item => item.modal);
        const incomeData = sortedData.map(item => item.income);
        const expenseData = sortedData.map(item => item.expense);

        // Create new chart
        dailyTransactionsBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Modal Awal',
                        data: modalData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pemasukan',
                        data: incomeData,
                        backgroundColor: 'rgba(74, 222, 128, 0.8)', // green
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pengeluaran',
                        data: expenseData,
                        backgroundColor: 'rgba(248, 113, 113, 0.8)', // red
                        borderColor: 'rgba(248, 113, 113, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)',
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgb(230, 240, 242)',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
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
        console.error("Gagal memperbarui daily transactions bar chart:", error);
    }
}

// Fungsi untuk memperbarui bar chart pemasukan & pengeluaran per metode
function updatePaymentMethodBarChart(transactions) {
    try {
        const chartElement = document.getElementById('payment-method-bar-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (paymentMethodBarChart) {
            paymentMethodBarChart.destroy();
        }

        // Group by payment method and transaction type
        const cashIncome = transactions
            .filter(t => t.method.trim().toLowerCase() === 'tunai' && t.type.trim().toLowerCase() === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const cashExpense = transactions
            .filter(t => t.method.trim().toLowerCase() === 'tunai' && t.type.trim().toLowerCase() === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const nonCashIncome = transactions
            .filter(t => t.method.trim().toLowerCase() === 'non tunai' && t.type.trim().toLowerCase() === 'pemasukan')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        const nonCashExpense = transactions
            .filter(t => t.method.trim().toLowerCase() === 'non tunai' && t.type.trim().toLowerCase() === 'pengeluaran')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        // Create new chart
        paymentMethodBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Tunai', 'Non-Tunai'],
                datasets: [
                    {
                        label: 'Pemasukan',
                        data: [cashIncome, nonCashIncome],
                        backgroundColor: 'rgba(74, 222, 128, 0.8)', // green
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pengeluaran',
                        data: [cashExpense, nonCashExpense],
                        backgroundColor: 'rgba(248, 113, 113, 0.8)', // red
                        borderColor: 'rgba(248, 113, 113, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)',
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgb(230, 240, 242)',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
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
        console.error("Gagal memperbarui payment method bar chart:", error);
    }
}

// Fungsi untuk memperbarui bar chart top pengeluaran harian
function updateTopExpenseBarChart(transactions) {
    try {
        const chartElement = document.getElementById('top-expense-bar-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (topExpenseBarChart) {
            topExpenseBarChart.destroy();
        }

        // Filter hanya transaksi pengeluaran
        const expenseTransactions = transactions.filter(t => t.type.trim().toLowerCase() === 'pengeluaran');

        // Kelompokkan berdasarkan deskripsi (kategori)
        const expenseCategories = {};
        expenseTransactions.forEach(transaction => {
            // Gunakan deskripsi sebagai kategori
            const category = transaction.description.trim();
            if (!expenseCategories[category]) {
                expenseCategories[category] = 0;
            }
            expenseCategories[category] += parseFloat(transaction.amount) || 0;
        });

        // Konversi ke array untuk chart dan urutkan dari terbesar ke terkecil
        const sortedExpenses = Object.entries(expenseCategories)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10); // Ambil 10 pengeluaran terbesar

        // Prepare data for chart
        const labels = sortedExpenses.map(item => item.category);
        const amounts = sortedExpenses.map(item => item.amount);

        // Generate warna dinamis
        const backgroundColors = [
            'rgba(248, 113, 113, 0.8)', // red
            'rgba(251, 146, 60, 0.8)',  // orange
            'rgba(234, 179, 8, 0.8)',   // yellow
            'rgba(132, 204, 22, 0.8)',  // lime
            'rgba(74, 222, 128, 0.8)',  // green
            'rgba(34, 211, 238, 0.8)',  // cyan
            'rgba(59, 130, 246, 0.8)',  // blue
            'rgba(147, 51, 234, 0.8)',  // purple
            'rgba(236, 72, 153, 0.8)',  // pink
            'rgba(248, 113, 113, 0.8)', // red (repeat)
        ];

        const borderColors = [
            'rgba(248, 113, 113, 1)',
            'rgba(251, 146, 60, 1)',
            'rgba(234, 179, 8, 1)',
            'rgba(132, 204, 22, 1)',
            'rgba(74, 222, 128, 1)',
            'rgba(34, 211, 238, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(147, 51, 234, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(248, 113, 113, 1)',
        ];

        // Create new chart
        topExpenseBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Nominal Pengeluaran',
                        data: amounts,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)',
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
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
        console.error("Gagal memperbarui top expense bar chart:", error);
    }
}

// Fungsi untuk memperbarui bar chart top pemasukan harian
function updateTopIncomeBarChart(transactions) {
    try {
        const chartElement = document.getElementById('top-income-bar-chart');
        if (!chartElement) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (topIncomeBarChart) {
            topIncomeBarChart.destroy();
        }

        // Filter hanya transaksi pemasukan
        const incomeTransactions = transactions.filter(t => t.type.trim().toLowerCase() === 'pemasukan');

        // Kelompokkan berdasarkan deskripsi (kategori)
        const incomeCategories = {};
        incomeTransactions.forEach(transaction => {
            // Gunakan deskripsi sebagai kategori
            const category = transaction.description.trim();
            if (!incomeCategories[category]) {
                incomeCategories[category] = 0;
            }
            incomeCategories[category] += parseFloat(transaction.amount) || 0;
        });

        // Konversi ke array untuk chart dan urutkan dari terbesar ke terkecil
        const sortedIncomes = Object.entries(incomeCategories)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10); // Ambil 10 pemasukan terbesar

        // Prepare data for chart
        const labels = sortedIncomes.map(item => item.category);
        const amounts = sortedIncomes.map(item => item.amount);

        // Generate warna dinamis
        const backgroundColors = [
            'rgba(74, 222, 128, 0.8)',  // green
            'rgba(34, 211, 238, 0.8)',  // cyan
            'rgba(59, 130, 246, 0.8)',  // blue
            'rgba(147, 51, 234, 0.8)',  // purple
            'rgba(236, 72, 153, 0.8)',  // pink
            'rgba(248, 113, 113, 0.8)', // red
            'rgba(251, 146, 60, 0.8)',  // orange
            'rgba(234, 179, 8, 0.8)',   // yellow
            'rgba(132, 204, 22, 0.8)',  // lime
            'rgba(74, 222, 128, 0.8)',  // green (repeat)
        ];

        const borderColors = [
            'rgba(74, 222, 128, 1)',
            'rgba(34, 211, 238, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(147, 51, 234, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(248, 113, 113, 1)',
            'rgba(251, 146, 60, 1)',
            'rgba(234, 179, 8, 1)',
            'rgba(132, 204, 22, 1)',
            'rgba(74, 222, 128, 1)',
        ];

        // Create new chart
        topIncomeBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Nominal Pemasukan',
                        data: amounts,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)',
                            callback: function (value) {
                                return formatCurrency(value);
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgb(230, 240, 242)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
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
        console.error("Gagal memperbarui top income bar chart:", error);
    }
}

// Fungsi untuk memperbarui bar chart tren transaksi
function updateBarChart(data, reportType, selectedPeriod = 'monthly') {
    try {
        const chartElement = document.getElementById('bar-chart');
        const barChartContainer = document.getElementById('bar-chart-container');
        if (!chartElement || !barChartContainer) return; // Hindari error jika elemen tidak ditemukan

        // Tambahkan atribut willReadFrequently untuk meningkatkan performa
        chartElement.setAttribute('willReadFrequently', 'true');

        // Selalu tampilkan bar chart untuk semua periode
        barChartContainer.style.display = 'block';

        const ctx = chartElement.getContext('2d');

        // Destroy existing chart if it exists
        if (barChart) {
            barChart.destroy();
        }

        // Pastikan semua data amount valid (bukan NaN)
        if (data && data.length > 0) {
            data = data.map(item => ({
                ...item,
                income: parseFloat(item.income) || 0,
                expense: parseFloat(item.expense) || 0,
                modal: parseFloat(item.modal) || 0,
                cashIncome: parseFloat(item.cashIncome) || 0,
                nonCashIncome: parseFloat(item.nonCashIncome) || 0,
                cashExpense: parseFloat(item.cashExpense) || 0,
                nonCashExpense: parseFloat(item.nonCashExpense) || 0,
                cashModal: parseFloat(item.cashModal) || 0,
                nonCashModal: parseFloat(item.nonCashModal) || 0
            }));
        }

        // Periksa apakah data kosong atau tidak ada
        if (!data || data.length === 0) {
            console.log('Tidak ada data untuk ditampilkan di bar chart');
            // Buat chart kosong dengan pesan
            barChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Tidak ada data'],
                    datasets: [{
                        label: 'Tidak ada data transaksi',
                        data: [0],
                        backgroundColor: 'rgba(200, 200, 200, 0.5)',
                        borderColor: 'rgba(200, 200, 200, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return 'Tidak ada data transaksi';
                                }
                            }
                        }
                    }
                }
            });
            return;
        }

        // Persiapkan data untuk bar chart berdasarkan periode
        let labels = [];
        let cashIncomeData = [];
        let nonCashIncomeData = [];
        let cashExpenseData = [];
        let nonCashExpenseData = [];

        // Inisialisasi weeklyData dan monthlyData di luar blok kondisi
        let weeklyData = {};
        let monthlyData = {};

        // Kelompokkan data berdasarkan periode
        if (selectedPeriod === 'monthly') {
            // Untuk periode bulanan, kelompokkan per minggu

            // Inisialisasi minggu dalam sebulan
            const startDate = new Date(data[0]?.date || new Date());
            const endDate = new Date(data[data.length - 1]?.date || new Date());

            // Buat array minggu
            let currentDate = new Date(startDate);
            let weekNumber = 1;

            while (currentDate <= endDate) {
                const weekKey = 'Minggu ' + weekNumber;
                weeklyData[weekKey] = {
                    cashIncome: 0,
                    nonCashIncome: 0,
                    cashExpense: 0,
                    nonCashExpense: 0,
                    cashModal: 0,
                    nonCashModal: 0
                };

                // Tambah 7 hari untuk minggu berikutnya
                currentDate.setDate(currentDate.getDate() + 7);
                weekNumber++;
            }

            // Kelompokkan transaksi per minggu
            data.forEach(item => {
                const itemDate = new Date(item.date);
                const weekDiff = Math.floor((itemDate - startDate) / (7 * 24 * 60 * 60 * 1000));
                const weekKey = 'Minggu ' + (weekDiff + 1);

                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = {
                        cashIncome: 0,
                        nonCashIncome: 0,
                        cashExpense: 0,
                        nonCashExpense: 0,
                        cashModal: 0,
                        nonCashModal: 0
                    };
                }

                // Kelompokkan berdasarkan jenis dan metode
                if (item.transactions) {
                    item.transactions.forEach(t => {
                        const amount = parseFloat(t.amount) || 0;
                        const method = t.method.trim().toLowerCase();
                        const type = t.type.trim().toLowerCase();

                        if (type === 'pemasukan') {
                            if (method === 'tunai') {
                                weeklyData[weekKey].cashIncome += amount;
                            } else {
                                weeklyData[weekKey].nonCashIncome += amount;
                            }
                        } else if (type === 'pengeluaran') {
                            if (method === 'tunai') {
                                weeklyData[weekKey].cashExpense += amount;
                            } else {
                                weeklyData[weekKey].nonCashExpense += amount;
                            }
                        } else if (type === 'modal awal') {
                            if (method === 'tunai') {
                                weeklyData[weekKey].cashModal = weeklyData[weekKey].cashModal || 0;
                                weeklyData[weekKey].cashModal += amount;
                            } else {
                                weeklyData[weekKey].nonCashModal = weeklyData[weekKey].nonCashModal || 0;
                                weeklyData[weekKey].nonCashModal += amount;
                            }
                        }
                    });
                } else {
                    // Jika data sudah dikelompokkan per hari
                    const cashIncome = item.cashIncome || 0;
                    const nonCashIncome = item.nonCashIncome || 0;
                    const cashExpense = item.cashExpense || 0;
                    const nonCashExpense = item.nonCashExpense || 0;

                    weeklyData[weekKey].cashIncome += cashIncome;
                    weeklyData[weekKey].nonCashIncome += nonCashIncome;
                    weeklyData[weekKey].cashExpense += cashExpense;
                    weeklyData[weekKey].nonCashExpense += nonCashExpense;
                }
            });

            // Konversi ke array untuk chart
            labels = Object.keys(weeklyData);
            cashIncomeData = labels.map(key => weeklyData[key].cashIncome);
            nonCashIncomeData = labels.map(key => weeklyData[key].nonCashIncome);
            cashExpenseData = labels.map(key => weeklyData[key].cashExpense);
            nonCashExpenseData = labels.map(key => weeklyData[key].nonCashExpense);

        } else if (['quarterly', 'yearly', 'all-time'].includes(selectedPeriod)) {
            // Untuk periode kuartalan, tahunan, dan keseluruhan, kelompokkan per bulan
            // monthlyData sudah diinisialisasi di luar blok kondisi

            // Inisialisasi bulan
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

            // Buat array bulan
            months.forEach(month => {
                monthlyData[month] = {
                    cashIncome: 0,
                    nonCashIncome: 0,
                    cashExpense: 0,
                    nonCashExpense: 0,
                    cashModal: 0,
                    nonCashModal: 0
                };
            });

            // Kelompokkan transaksi per bulan
            data.forEach(item => {
                const itemDate = new Date(item.date);
                const monthKey = months[itemDate.getMonth()];

                // Kelompokkan berdasarkan jenis dan metode
                if (item.transactions) {
                    item.transactions.forEach(t => {
                        const amount = parseFloat(t.amount) || 0;
                        const method = t.method.trim().toLowerCase();
                        const type = t.type.trim().toLowerCase();

                        if (type === 'pemasukan') {
                            if (method === 'tunai') {
                                monthlyData[monthKey].cashIncome += amount;
                            } else {
                                monthlyData[monthKey].nonCashIncome += amount;
                            }
                        } else if (type === 'pengeluaran') {
                            if (method === 'tunai') {
                                monthlyData[monthKey].cashExpense += amount;
                            } else {
                                monthlyData[monthKey].nonCashExpense += amount;
                            }
                        } else if (type === 'modal awal') {
                            if (method === 'tunai') {
                                monthlyData[monthKey].cashModal = monthlyData[monthKey].cashModal || 0;
                                monthlyData[monthKey].cashModal += amount;
                            } else {
                                monthlyData[monthKey].nonCashModal = monthlyData[monthKey].nonCashModal || 0;
                                monthlyData[monthKey].nonCashModal += amount;
                            }
                        }
                    });
                } else {
                    // Jika data sudah dikelompokkan per hari
                    const cashIncome = item.cashIncome || 0;
                    const nonCashIncome = item.nonCashIncome || 0;
                    const cashExpense = item.cashExpense || 0;
                    const nonCashExpense = item.nonCashExpense || 0;

                    monthlyData[monthKey].cashIncome += cashIncome;
                    monthlyData[monthKey].nonCashIncome += nonCashIncome;
                    monthlyData[monthKey].cashExpense += cashExpense;
                    monthlyData[monthKey].nonCashExpense += nonCashExpense;
                }
            });

            // Konversi ke array untuk chart
            labels = Object.keys(monthlyData);
            cashIncomeData = labels.map(key => monthlyData[key].cashIncome);
            nonCashIncomeData = labels.map(key => monthlyData[key].nonCashIncome);
            cashExpenseData = labels.map(key => monthlyData[key].cashExpense);
            nonCashExpenseData = labels.map(key => monthlyData[key].nonCashExpense);
        } else {
            // Untuk periode lainnya, gunakan data asli
            labels = data.map(item => item.date);
            cashIncomeData = data.map(item => item.cashIncome || 0);
            nonCashIncomeData = data.map(item => item.nonCashIncome || 0);
            cashExpenseData = data.map(item => item.cashExpense || 0);
            nonCashExpenseData = data.map(item => item.nonCashExpense || 0);
        }

        // Tambahkan data modal awal
        let cashModalData = [];
        let nonCashModalData = [];

        // Isi data modal awal berdasarkan periode
        if (selectedPeriod === 'monthly') {
            // Untuk periode bulanan (data per minggu)
            labels.forEach(weekKey => {
                const weekData = weeklyData[weekKey];
                if (weekData) {
                    cashModalData.push(weekData.cashModal || 0);
                    nonCashModalData.push(weekData.nonCashModal || 0);
                } else {
                    console.log('Data minggu tidak ditemukan untuk:', weekKey);
                    cashModalData.push(0);
                    nonCashModalData.push(0);
                }
            });
        } else if (['quarterly', 'yearly', 'all-time'].includes(selectedPeriod)) {
            // Untuk periode kuartalan, tahunan, dan keseluruhan (data per bulan)
            labels.forEach(monthKey => {
                const monthData = monthlyData[monthKey];
                if (monthData) {
                    cashModalData.push(monthData.cashModal || 0);
                    nonCashModalData.push(monthData.nonCashModal || 0);
                } else {
                    console.log('Data bulan tidak ditemukan untuk:', monthKey);
                    cashModalData.push(0);
                    nonCashModalData.push(0);
                }
            });
        } else {
            // Untuk periode lainnya
            labels.forEach((_, index) => {
                if (index < data.length && data[index]) {
                    cashModalData.push(data[index].cashModal || 0);
                    nonCashModalData.push(data[index].nonCashModal || 0);
                } else {
                    console.log('Data tidak ditemukan untuk index:', index);
                    cashModalData.push(0);
                    nonCashModalData.push(0);
                }
            });
        }

        // Create new chart dengan 6 dataset (termasuk modal awal)
        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Modal Awal Tunai',
                        data: cashModalData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Modal Awal Non Tunai',
                        data: nonCashModalData,
                        backgroundColor: 'rgba(96, 165, 250, 0.8)',
                        borderColor: 'rgba(96, 165, 250, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pemasukan Tunai',
                        data: cashIncomeData,
                        backgroundColor: 'rgba(74, 222, 128, 0.8)',
                        borderColor: 'rgba(74, 222, 128, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pemasukan Non Tunai',
                        data: nonCashIncomeData,
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pengeluaran Tunai',
                        data: cashExpenseData,
                        backgroundColor: 'rgba(248, 113, 113, 0.8)',
                        borderColor: 'rgba(248, 113, 113, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Pengeluaran Non Tunai',
                        data: nonCashExpenseData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
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
                            callback: function (value) {
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
                            color: 'rgb(230, 240, 242)',  // text-primary color
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
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
            elements.userAvatar.onerror = function () {
                console.error('Failed to load avatar image:', avatarSrc);
                // Fallback ke avatar default dengan cache buster
                const timestamp = new Date().getTime();
                this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(state.user.name) + '&background=9CAFAA&color=0F1724&v=' + timestamp;
            };

            elements.userAvatar.onload = function () {
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

    // Otomatis tampilkan laporan keseluruhan saat halaman laporan dibuka
    if (page === 'reports' && state.transactions && state.transactions.length > 0) {
        // Hitung rentang tanggal untuk keseluruhan data (dari awal hingga sekarang)
        const dateRange = calculateDateRange('all-time');

        // Filter transaksi berdasarkan rentang tanggal
        const filteredTransactions = state.transactions.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
        });

        // Update UI laporan dengan data keseluruhan
        updateReportUI(filteredTransactions, dateRange, 'all');

        // Update teks rentang tanggal
        const reportRangeEl = document.getElementById('report-range');
        if (reportRangeEl) {
            reportRangeEl.textContent = 'Keseluruhan Data';
        }
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
    switch (type) {
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
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        console.log('JWT payload decoded successfully');
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing JWT:', e);
        return null;
    }
}

// Store current editing index globally
let currentEditingIndex = -1;

// Edit transaction
async function editTransaction(index) {
    // Get transaction from state
    const transaction = state.transactions[index];
    if (!transaction) {
        showError('Transaksi tidak ditemukan');
        return;
    }

    // Store the transaction index globally
    currentEditingIndex = index;

    // Store the transaction ID for later use
    const transactionId = transaction.id;

    // Get the modal
    const modal = document.getElementById('edit-transaction-modal');
    if (!modal) {
        showError('Modal edit tidak ditemukan');
        return;
    }

    // Populate form fields
    document.getElementById('edit-date').value = formatDateForInput(transaction.date);
    document.getElementById('edit-description').value = transaction.description;
    document.getElementById('edit-amount').value = transaction.amount;

    // Set option buttons
    document.getElementById('edit-type').value = transaction.type;
    document.getElementById('edit-method').value = transaction.method;

    // Set active class for option buttons
    document.querySelectorAll('#edit-transaction-modal .option-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Set active buttons based on transaction values
    const typeBtn = document.querySelector(`#edit-transaction-modal .option-btn[data-field="edit-type"][data-value="${transaction.type}"]`);
    const methodBtn = document.querySelector(`#edit-transaction-modal .option-btn[data-field="edit-method"][data-value="${transaction.method}"]`);

    if (typeBtn) typeBtn.classList.add('active');
    if (methodBtn) methodBtn.classList.add('active');

    // Show modal
    modal.classList.remove('hidden');

    // Add event listeners if not already added
    if (!modal.dataset.listenersAdded) {
        const closeBtn = modal.querySelector('#close-edit-transaction-modal');
        const cancelBtn = modal.querySelector('#cancel-edit-transaction');
        const form = modal.querySelector('#edit-transaction-form');

        closeBtn.addEventListener('click', closeEditModal);
        cancelBtn.addEventListener('click', closeEditModal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditModal();
            }
        });

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
                const rowIndex = currentEditingIndex + 2;

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
                state.transactions[currentEditingIndex] = updatedTransaction;

                // Update UI
                updateUI();

                // Close modal
                closeEditModal();

                // Show success message
                showMessage('Transaksi berhasil diperbarui');
            } catch (error) {
                showError('Gagal memperbarui transaksi: ' + error.message);
            } finally {
                hideLoading();
            }
        });

        modal.dataset.listenersAdded = 'true';
    }
}

// Close edit modal function
function closeEditModal() {
    const modal = document.getElementById('edit-transaction-modal');
    if (modal) {
        modal.classList.add('hidden');
        currentEditingIndex = -1;
    }
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
function formatDate(value) {
    const d = new Date(value);
    if (isNaN(d)) return value; // kalau gagal parsing, kembalikan aslinya

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Format date for input type="date" (YYYY-MM-DD)
function formatDateForInput(value) {
    const d = new Date(value);
    if (isNaN(d)) return value; // kalau gagal parsing, kembalikan aslinya

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
                        label: function (context) {
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
                        callback: function (value) {
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

    // Pastikan semua metrik baru terlihat dalam laporan cetak
    const reportTotalCash = document.getElementById('report-total-cash');
    const reportTotalNonCash = document.getElementById('report-total-non-cash');
    const reportCashIncome = document.getElementById('report-cash-income');
    const reportNonCashIncome = document.getElementById('report-non-cash-income');
    const reportCashExpense = document.getElementById('report-cash-expense');
    const reportNonCashExpense = document.getElementById('report-non-cash-expense');
    const reportTotalAmount = document.getElementById('report-total-amount');
    const reportTransactionCount = document.getElementById('report-transaction-count');

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

        // Pastikan semua metrik baru terlihat dalam laporan PDF
        const reportTotalCash = document.getElementById('report-total-cash');
        const reportTotalNonCash = document.getElementById('report-total-non-cash');
        const reportCashIncome = document.getElementById('report-cash-income');
        const reportNonCashIncome = document.getElementById('report-non-cash-income');
        const reportCashExpense = document.getElementById('report-cash-expense');
        const reportNonCashExpense = document.getElementById('report-non-cash-expense');
        const reportTotalAmount = document.getElementById('report-total-amount');
        const reportTransactionCount = document.getElementById('report-transaction-count');

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
document.addEventListener('DOMContentLoaded', function () {
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