// ===== ตัวแปร Global =====
let currentUser = null;
let complaintsCollection;
let unsubscribe = null; // สำหรับ real-time listener
let statusChart = null; // สำหรับกราฟสถานะ
let categoryChart = null; // สำหรับกราฟหมวดหมู่
let trendChart = null; // สำหรับกราฟเทรนด์ประจำเดือน
let reporterChart = null; // สำหรับกราฟประเภทผู้ส่งผลงาน
let sessionInterval = null; // สำหรับเช็คเวลาหมดอายุ
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 นาที (หน่วยเป็นมิลลิวินาที)

// ===== ฟังก์ชันเริ่มต้น =====
document.addEventListener('DOMContentLoaded', function () {
    // กำหนด collection reference
    complaintsCollection = db.collection("complaints");

    // ตรวจสอบสถานะการล็อกอิน
    auth.onAuthStateChanged(user => {
        if (user) {
            // ผู้ใช้ล็อกอินอยู่แล้ว
            currentUser = user;
            showDashboard();
            loadDashboardData();
            generateSummary('weekly'); // เริ่มต้นด้วยการสรุปรายสัปดาห์
            startSessionTimer(); // เริ่มจับเวลาเซสชัน
        } else {
            // ยังไม่ล็อกอิน
            stopSessionTimer();
            showLogin();
        }
    });

    // ตั้งค่า Event Listeners
    setupAdminEventListeners();

    // ===== Cookie Consent Logic =====
    const cookieConsent = document.getElementById('cookieConsent');
    const acceptCookies = document.getElementById('acceptCookies');
    const declineCookies = document.getElementById('declineCookies');

    if (cookieConsent && !localStorage.getItem('cookieConsent')) {
        setTimeout(() => {
            cookieConsent.classList.add('show');
        }, 1500);

        acceptCookies.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'accepted');
            cookieConsent.classList.remove('show');
        });

        declineCookies.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'declined');
            cookieConsent.classList.remove('show');
        });
    }
});

// ===== ตั้งค่า Event Listeners =====
function setupAdminEventListeners() {
    // ฟอร์มล็อกอิน
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }

    // ปุ่มออกจากระบบ
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleAdminLogout);
    }

    // ฟิลเตอร์และค้นหา
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput) searchInput.addEventListener('input', () => loadComplaintsTable());
    if (categoryFilter) categoryFilter.addEventListener('change', () => loadComplaintsTable());
    if (statusFilter) statusFilter.addEventListener('change', () => loadComplaintsTable());

    // ปุ่ม Export
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    const exportPDFBtn = document.getElementById('exportPDFBtn');
    if (exportPDFBtn) {
        exportPDFBtn.addEventListener('click', exportToPDF);
    }
}

// ===== ฟังก์ชันล็อกอินผู้ดูแล =====
async function handleAdminLogin(e) {
    e.preventDefault();

    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังเข้าสู่ระบบ...';
        submitBtn.disabled = true;

        await auth.signInWithEmailAndPassword(email, password);

        // บันทึกเวลาที่ล็อกอินลงใน localStorage
        localStorage.setItem('adminLoginTime', Date.now());

        // แสดงแจ้งเตือนสำเร็จ
        Swal.fire({
            icon: 'success',
            title: 'ยินดีต้อนรับเข้าใช้งาน',
            text: 'เข้าสู่ระบบสำเร็จ!',
            timer: 2000,
            showConfirmButton: false,
            timerProgressBar: true,
            iconColor: '#1b5e20',
        });

        // รีเซ็ตฟอร์ม
        e.target.reset();

    } catch (error) {
        console.error("Login error:", error);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;

        Swal.fire({
            icon: 'error',
            title: 'เข้าสู่ระบบล้มเหลว',
            text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หากพบปัญหาบ่อยครั้งกรุณาติดต่อแอดมิน',
            confirmButtonColor: '#1b5e20'
        });
    }
}

// ===== ฟังก์ชันออกจากระบบ =====
async function handleAdminLogout() {
    try {
        const result = await Swal.fire({
            title: 'ยืนยันการออกจากระบบ?',
            text: "คุณต้องการออกจากเซสชันปัจจุบันหรือไม่",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#1b5e20',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ออกจากระบบ',
            cancelButtonText: 'ยกเลิก'
        });

        if (!result.isConfirmed) return;

        await auth.signOut();

        // ล้างข้อมูลเซสชัน
        localStorage.removeItem('adminLoginTime');
        stopSessionTimer();

        showLogin();

        // แสดงแจ้งเตือน
        Swal.fire({
            icon: 'success',
            title: 'ออกจากระบบสำเร็จ',
            text: '',
            timer: 1500,
            showConfirmButton: false,
            timerProgressBar: true
        });

        // ยกเลิก real-time listener
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

    } catch (error) {
        console.error("Logout error:", error);
        alert("ออกจากระบบไม่สำเร็จ: " + error.message);
    }
}

// ===== ระบบจัดการเซสชันแบบ Inactivity (ขยับแล้วต่อเวลาให้เอง) =====
let inactivityTimeout = null;

function startSessionTimer() {
    // ล้างของเดิมก่อน
    stopSessionTimer();

    // เริ่มจับเวลาใหม่
    resetSessionTimer();

    // เพิ่ม Event Listeners สำหรับดักจับการขยับหรือใช้งานหน้าจอ
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        window.addEventListener(event, resetSessionTimer);
    });
}

function resetSessionTimer() {
    // ถ้าไม่มีผู้ใช้ล็อกอินอยู่ ไม่ต้องจับเวลา
    if (!currentUser) return;

    // เคลียร์ Timeout เดิม
    if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
    }

    // ตั้งเวลาใหม่ (15 นาที)
    inactivityTimeout = setTimeout(() => {
        handleSessionTimeout();
    }, SESSION_TIMEOUT);
}

function stopSessionTimer() {
    // เคลียร์ Timeout
    if (inactivityTimeout) {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = null;
    }

    // ลบ Event Listeners ออก
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        window.removeEventListener(event, resetSessionTimer);
    });
}

async function handleSessionTimeout() {
    try {
        stopSessionTimer();

        // บันทึก Log เล็กน้อย
        console.log("Session expired due to inactivity.");

        // ออกจากระบบ Firebase
        await auth.signOut();

        // แจ้งเตือนผู้ใช้ด้วย SweetAlert2
        await Swal.fire({
            icon: 'info',
            title: 'เซสชันหมดอายุ',
            text: 'ระบบได้ออกจากระบบอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 15 นาที เพื่อความปลอดภัยของข้อมูล',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#1b5e20',
            allowOutsideClick: false
        });

        // รีโหลดหน้าเพื่อให้กลับไปหน้าล็อกอิน
        window.location.reload();
    } catch (error) {
        console.error("Timeout Error:", error);
    }
}

// ===== ฟังก์ชันแสดง/ซ่อนส่วนต่างๆ =====
function showDashboard() {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');

    // แสดงชื่อผู้ใช้
    document.getElementById('adminName').textContent = currentUser.email;
}

function showLogin() {
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('dashboardSection').classList.add('d-none');
    currentUser = null;
}

// ===== ฟังก์ชันโหลดข้อมูล Dashboard =====
function loadDashboardData() {
    // โหลดสถิติ
    loadStatistics();

    // โหลดตารางข้อมูลแบบ real-time
    loadComplaintsTable();
}

// ===== ฟังก์ชันโหลดสถิติ =====
async function loadStatistics() {
    try {
        // ดึงข้อมูลทั้งหมด
        const snapshot = await complaintsCollection.get();

        // คำนวณสถิติ
        let total = 0;
        let waiting = 0;
        let accepted = 0;
        let rejected = 0;
        let inProgress = 0;
        let resolved = 0;

        // สำหรับกราฟระดับชั้น
        const categoryCounts = {
            'มัธยมศึกษาปีที่ 1': 0,
            'มัธยมศึกษาปีที่ 2': 0,
            'มัธยมศึกษาปีที่ 3': 0,
            'มัธยมศึกษาปีที่ 4': 0,
            'มัธยมศึกษาปีที่ 5': 0,
            'มัธยมศึกษาปีที่ 6': 0,
            'อื่นๆ': 0
        };

        // สำหรับกราฟผู้ส่งผลงาน
        const reporterCounts = {
            'หัวหน้าห้อง': 0,
            'รองหัวหน้าห้อง': 0,
            'ตัวแทนนักเรียน': 0,
            'ครูที่ปรึกษา': 0,
            'อื่นๆ': 0
        };

        // สำหรับกราฟเทรนด์ (6 เดือนล่าสุด)
        const monthlyTrend = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
            monthlyTrend[monthKey] = 0;
        }

        // คำนวณเวลาแก้ไขเฉลี่ย
        let totalResolutionTime = 0;
        let resolvedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            total++;

            // นับสถานะ
            switch (data.status) {
                case 'waiting':
                case 'pending':
                    waiting++;
                    break;
                case 'accepted':
                    accepted++;
                    break;
                case 'rejected':
                    rejected++;
                    break;
                case 'in-progress':
                    inProgress++;
                    break;
                case 'resolved':
                    resolved++;
                    // คำนวณระยะเวลา (ถ้ามี updatedAt)
                    if (data.createdAt && data.updatedAt && data.status === 'resolved') {
                        const start = data.createdAt.toDate();
                        const end = data.updatedAt.toDate();
                        const diffHours = Math.abs(end - start) / 36e5;
                        totalResolutionTime += diffHours;
                        resolvedCount++;
                    }
                    break;
            }

            // นับหมวดหมู่
            if (data.category && categoryCounts.hasOwnProperty(data.category)) {
                categoryCounts[data.category]++;
            } else if (data.category) {
                // เช็คกรณี "อื่นๆ (...)"
                if (data.category.startsWith('อื่นๆ')) {
                    categoryCounts['อื่นๆ']++;
                }
            }

            // นับประเภทผู้ส่งผลงาน
            if (data.reporterType) {
                let type = data.reporterType;
                if (type.startsWith('อื่นๆ')) type = 'อื่นๆ';
                if (reporterCounts.hasOwnProperty(type)) {
                    reporterCounts[type]++;
                } else {
                    reporterCounts['อื่นๆ']++;
                }
            }

            // นับเทรนด์รายเดือน
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                const monthKey = date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                if (monthlyTrend.hasOwnProperty(monthKey)) {
                    monthlyTrend[monthKey]++;
                }
            }
        });

        // แสดงเวลาแก้ไขเฉลี่ย
        const avgTimeBox = document.getElementById('avgTimeBox');
        if (resolvedCount > 0) {
            const avgHours = totalResolutionTime / resolvedCount;
            if (avgHours < 24) {
                avgTimeBox.textContent = `${avgHours.toFixed(1)} ชม.`;
            } else {
                avgTimeBox.textContent = `${(avgHours / 24).toFixed(1)} วัน`;
            }
        } else {
            avgTimeBox.textContent = 'ไม่มีข้อมูล';
        }

        // สร้างการ์ดสถิติ
        const statsCards = document.getElementById('statsCards');
        statsCards.innerHTML = `
            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">ทั้งหมด</h6>
                            <h3 class="fw-bold mb-0">${total}</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">รอตรวจ</h6>
                            <h3 class="fw-bold mb-0">${waiting}</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">รับข้อมูลแล้ว</h6>
                            <h3 class="fw-bold mb-0">${accepted}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">กำลังประเมิน</h6>
                            <h3 class="fw-bold mb-0">${inProgress}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">ประเมินแล้ว</h6>
                            <h3 class="fw-bold mb-0">${resolved}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">ไม่ผ่าน/ไม่ชัดเจน</h6>
                            <h3 class="fw-bold mb-0">${rejected}</h3>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // แสดงผลกราฟ
        renderCharts(
            { waiting, accepted, inProgress, resolved, rejected },
            categoryCounts,
            monthlyTrend,
            reporterCounts
        );

    } catch (error) {
        console.error("Error loading statistics:", error);
    }
}

// ===== ฟังก์ชันโหลดตารางข้อมูลแบบ real-time =====
function loadComplaintsTable() {
    // ยกเลิก listener เก่าถ้ามี
    if (unsubscribe) {
        unsubscribe();
    }

    // สร้าง real-time listener
    unsubscribe = complaintsCollection
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const tableBody = document.getElementById('complaintsTableBody');
            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
            const categoryFilter = document.getElementById('categoryFilter')?.value || '';
            const statusFilter = document.getElementById('statusFilter')?.value || '';

            tableBody.innerHTML = '';

            let filteredDocs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;

                // ค้นหาและฟิลเตอร์
                const matchesSearch = !searchTerm ||
                    (data.ticketId && data.ticketId.toLowerCase().includes(searchTerm)) ||
                    (data.title && data.title.toLowerCase().includes(searchTerm));

                const matchesCategory = !categoryFilter ||
                    (data.category && data.category.includes(categoryFilter));

                const matchesStatus = !statusFilter ||
                    (data.status === statusFilter) ||
                    (statusFilter === 'waiting' && data.status === 'pending');

                if (matchesSearch && matchesCategory && matchesStatus) {
                    filteredDocs.push({ id, ...data });
                }
            });

            if (filteredDocs.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-5">
                            <i class="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
                            <div>ไม่พบข้อมูลผลงานในขณะนี้</div>
                        </td>
                    </tr>
                `;
                return;
            }

            // เรียงลำดับตามห้อง (ระดับชั้น -> เลขห้อง -> วันที่)
            filteredDocs.sort((a, b) => {
                // 1. เรียงตามระดับชั้น (Category)
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category, 'th');
                }
                // 2. เรียงตามเลขห้อง (Room Number) - แปลงเป็นตัวเลขถ้าทำได้
                const roomA = parseInt(a.roomNumber) || 0;
                const roomB = parseInt(b.roomNumber) || 0;
                if (roomA !== roomB) {
                    return roomA - roomB;
                }
                // 3. เรียงตามวันที่ (Date) - ใหม่สุดขึ้นก่อน
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            filteredDocs.forEach(data => {
                const id = data.id;
                const isLocked = data.status === 'resolved' || data.status === 'rejected';

                // แปลงวันที่
                let dateStr = '-';
                if (data.updatedAt) {
                    const date = data.updatedAt.toDate();
                    dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.';
                } else if (data.createdAt) {
                    const date = data.createdAt.toDate();
                    dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.';
                }

                // สร้างแถวตาราง
                const row = document.createElement('tr');
                if (data.isDuplicate) {
                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                }

                row.innerHTML = `
                    <td class="ps-4" data-label="ระดับชั้น/ห้อง">
                        <div class="fw-bold text-dark">${data.category || '-'}</div>
                        <span class="badge bg-secondary-subtle text-secondary px-3 py-1 rounded-pill mt-1">
                            ห้อง ${data.roomNumber || '-'}
                        </span>
                        ${data.isDuplicate ? '<div class="mt-1"><span class="badge bg-danger-subtle text-danger" style="font-size: 0.7rem;"><i class="bi bi-intersect me-1"></i>ข้อมูลซ้ำ</span></div>' : ''}
                    </td>
                    <td class="small text-muted" data-label="วันที่ส่ง">${dateStr}</td>
                    <td data-label="คะแนน">
                        <div class="fw-bold text-success fs-5">${data.score || '-'}</div>
                    </td>
                    <td data-label="สถานะ">
                        <span class="status-badge status-${data.status || 'pending'}">
                            <i class="bi bi-dot fs-4"></i>${data.status === 'resolved' ? dateStr : getStatusText(data.status)}
                        </span>
                    </td>
                    <td class="pe-4 text-center" data-label="จัดการ">
                        <div class="action-wrapper d-flex flex-column flex-md-row align-items-center justify-content-center gap-2">
                            <div class="action-btn-group p-1 bg-white rounded-pill shadow-sm border d-flex gap-1" style="min-width: fit-content;">
                                <button class="btn btn-action-view btn-sm rounded-circle border-0 view-details-btn" 
                                        data-id="${id}"
                                        title="ดูรายละเอียด">
                                    <i class="bi bi-eye-fill"></i>
                                </button>
                                <button class="btn btn-action-delete btn-sm rounded-circle border-0" 
                                        data-id="${id}" 
                                        title="ลบ">
                                    <i class="bi bi-trash-fill"></i>
                                </button>
                            </div>
                            <div class="status-selector-container">
                                <select class="form-select form-select-sm status-select-modern border shadow-sm rounded-pill" 
                                        data-id="${id}" 
                                        ${isLocked ? 'disabled' : ''}>
                                    <option value="waiting" ${data.status === 'waiting' || data.status === 'pending' ? 'selected' : ''}>รอตรวจ</option>
                                    <option value="accepted" ${data.status === 'accepted' ? 'selected' : ''}>รับข้อมูลแล้ว</option>
                                    <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}>กำลังประเมิน</option>
                                    <option value="resolved" ${data.status === 'resolved' ? 'selected' : ''}>ประเมินแล้ว</option>
                                    <option value="rejected" ${data.status === 'rejected' ? 'selected' : ''}>ไม่ผ่าน/ไม่ชัดเจน</option>
                                </select>
                            </div>
                        </div>
                    </td>
                `;

                tableBody.appendChild(row);
            });

            // เพิ่ม Event Listeners สำหรับปุ่มในตาราง
            addTableEventListeners();

            // โหลดสถิติใหม่
            loadStatistics();
        }, error => {
            console.error("Error loading complaints:", error);
            const tableBody = document.getElementById('complaintsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center text-danger py-5">
                            <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                            <div>เกิดข้อผิดพลาดในการโหลดข้อมูล: ${error.message}</div>
                            <small class="text-muted">โปรดตรวจสอบการตั้งค่า Firestore Rules ของท่าน</small>
                        </td>
                    </tr>
                `;
            }
        });
}

// ===== เพิ่ม Event Listeners ในตาราง =====
function addTableEventListeners() {
    // Dropdown เปลี่ยนสถานะ
    const statusSelects = document.querySelectorAll('.status-select-modern');
    statusSelects.forEach(select => {
        select.addEventListener('change', handleStatusChange);
    });

    // ปุ่มลบ
    const deleteBtns = document.querySelectorAll('.btn-action-delete');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', handleDeleteComplaint);
    });

    // ปุ่มดูรายละเอียด
    const viewBtns = document.querySelectorAll('.view-details-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', handleViewDetails);
    });
}

// ===== ฟังก์ชันดูรายละเอียด =====
async function handleViewDetails(e) {
    const complaintId = e.target.closest('button').dataset.id;

    try {
        const doc = await complaintsCollection.doc(complaintId).get();
        if (!doc.exists) return;

        const data = doc.data();

        // สร้างเนื้อหาใน Modal แบบพรีเมียม
        const modalBody = `
            <div class="text-start admin-detail-modal">
                <div class="header-banner mb-4 p-3 rounded-4 d-flex align-items-center justify-content-between" style="background: var(--gradient-primary); color: white;">
                    <div>
                        <small class="text-white-50 d-block">Submission ID</small>
                        <h4 class="mb-0 fw-bold">#${data.ticketId}</h4>
                    </div>
                    <div class="text-end">
                        <div class="bg-white text-success p-2 rounded-3 shadow-sm mb-2 text-center" style="min-width: 80px;">
                            <small class="text-muted d-block fw-bold" style="font-size: 0.6rem;">คะแนน</small>
                            <span class="fs-4 fw-bold">${data.score || '-'}</span>
                        </div>
                        <span class="status-badge status-${data.status || 'pending'} shadow-sm">
                            ${getStatusText(data.status)}
                        </span>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- ส่วนข้อมูลเนื้อหา -->
                    <div class="col-md-7">
                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-house-door me-2 text-success"></i>ระดับชั้น / ห้อง</h6>
                            <p class="fs-4 fw-bold text-dark border-bottom pb-2">${data.category} ห้อง ${data.roomNumber}</p>
                        </div>



                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-justify-left me-2 text-success"></i>รายละเอียด / ข้อเสนอแนะ</h6>
                            <div class="p-3 bg-light rounded-4 border-start border-4 border-success-subtle" style="white-space: pre-wrap; font-size: 0.95rem; min-height: 100px;">${data.details}</div>
                        </div>

                        <div class="detail-section mb-0 p-3 rounded-4 bg-info-subtle bg-opacity-10 border border-info-subtle">
                            <h6 class="text-info fw-bold mb-2 small text-uppercase"><i class="bi bi-envelope me-2"></i>อีเมลสำหรับติดต่อ</h6>
                            <div class="fw-bold text-dark">${data.reporterEmail}</div>
                        </div>
                    </div>

                    <!-- ส่วนข้อมูลรูปภาพและการตอบกลับ -->
                    <div class="col-md-5">
                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-3 text-center text-md-start"><i class="bi bi-images me-2 text-success"></i>ภาพห้องเรียน</h6>
                            <div class="image-grid d-flex flex-wrap gap-2 justify-content-center justify-content-md-start">
                            ${data.imageUrls && data.imageUrls.length > 0 ?
                data.imageUrls.map(url => `
                                    <div class="position-relative">
                                        <a href="${url}" target="_blank" class="d-block image-hover-zoom">
                                            <img src="${url}" class="rounded-3 border shadow-sm" style="width: 100px; height: 100px; object-fit: cover;" alt="หลักฐาน">
                                        </a>
                                    </div>
                                `).join('')
                : (data.imageUrl ? `
                                    <div class="w-100">
                                        <a href="${data.imageUrl}" target="_blank" class="d-block image-hover-zoom">
                                            <img src="${data.imageUrl}" class="w-100 rounded-3 border shadow-sm" style="max-height: 200px; object-fit: contain;" alt="หลักฐาน">
                                        </a>
                                    </div>
                                ` : '<div class="text-center w-100 py-4 bg-light rounded-3 text-muted italic small"><i class="bi bi-camera-video-off d-block fs-3 mb-2"></i>ไม่มีการแนบรูปภาพ</div>')
            }
                            </div>
                        </div>



                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-3"><i class="bi bi-clock-history me-2 text-success"></i>ประวัติการดำเนินการ (Timeline)</h6>
                            <div class="timeline-v3 small" style="max-height: 250px; overflow-y: auto;">
                                ${data.activities ? [...data.activities].reverse().map(act => `
                                    <div class="timeline-item-v3" data-status="${act.status || 'pending'}">
                                        <div class="timeline-dot"></div>
                                        <div class="timeline-title-v3">${act.action}</div>
                                        <div class="timeline-date-v3">
                                            <i class="bi bi-clock me-1"></i>
                                            ${act.timestamp ? (typeof act.timestamp.toDate === 'function' ? act.timestamp.toDate() : new Date(act.timestamp)).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                        </div>
                                        ${act.details ? `<div class="timeline-note-v3">${act.details}</div>` : ''}
                                    </div>
                                `).join('') : '<div class="text-muted small italic p-3 text-center">ไม่มีประวัติการบันทึก</div>'}
                            </div>
                        </div>

                        <div class="admin-feedback-section mt-auto">
                            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
                                <div class="card-header bg-success text-white py-2 small fw-bold">
                                    <i class="bi bi-shield-check me-2"></i>ผลการประเมินจากผู้ดูแล
                                </div>
                                <div class="card-body p-3 bg-success bg-opacity-10">
                                    ${data.adminFeedback ? `
                                        <p class="mb-2 small text-dark">${data.adminFeedback}</p>
                                        ${data.adminImageUrl ? `
                                            <a href="${data.adminImageUrl}" target="_blank" class="d-block mt-2">
                                                <img src="${data.adminImageUrl}" class="img-fluid rounded-2 border shadow-sm" style="max-height: 120px;" alt="หลักฐานดำเนินการ">
                                            </a>
                                        ` : ''}
                                    ` : '<p class="mb-0 small text-muted italic text-center">ยังไม่มีการบันทึกการตอบกลับ</p>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Swal.fire({
            html: modalBody,
            width: '850px',
            confirmButtonText: '<i class="bi bi-x-lg me-2"></i>ปิดหน้าต่างนี้',
            confirmButtonColor: '#1b5e20',
            padding: '1.5rem',
            background: '#fff',
            customClass: {
                popup: 'rounded-5 overflow-hidden'
            },
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        });

    } catch (error) {
        console.error("Error fetching details:", error);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    }
}

// ===== ฟังก์ชันเปลี่ยนสถานะ =====
async function handleStatusChange(e) {
    const complaintId = e.target.dataset.id;
    const newStatus = e.target.value;
    let feedback = "";
    let adminImageUrl = "";
    let adminScore = undefined;
    let detailedScores = null;

    // ข้อมูลเดิม
    const doc = await complaintsCollection.doc(complaintId).get();
    const data = doc.data();

    // กรณีดำเนินการ, เสร็จสิ้น, หรือ ไม่รับเรื่อง - ใช้ Modal รูปแบบพรีเมียม
    if (newStatus === 'in-progress' || newStatus === 'resolved' || newStatus === 'rejected') {
        const isRejected = newStatus === 'rejected';

        const { value: result } = await Swal.fire({
            title: `อัพเดตข้อมูลสถานะ: ${getStatusText(newStatus)}`,
            width: '600px',
            html: `
                <div class="text-start">
                    ${newStatus === 'resolved' ? `
                    <div class="premium-score-system p-4 rounded-4 bg-white shadow-sm border mb-4">
                        <div class="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
                            <h5 class="fw-bold mb-0 text-success"><i class="bi bi-shield-check me-2"></i>เกณฑ์การประเมินห้องเรียน</h5>
                            <div class="badge bg-success-subtle text-success fs-6 px-3 py-2 rounded-pill">คะแนนเต็ม 15</div>
                        </div>
                        
                        <div class="row g-4">
                            <!-- Group 1: 2 Points Criteria -->
                            <div class="col-12"><small class="text-muted fw-bold text-uppercase" style="letter-spacing: 1px;">รายการละ 2 คะแนน</small></div>
                            
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-house-door fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">สภาพห้องเรียน</label>
                                    <input type="number" id="sc1" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc1 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-layers fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">พื้นห้องเรียน</label>
                                    <input type="number" id="sc2" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc2 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-display fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">โต๊ะนักเรียน</label>
                                    <input type="number" id="sc3" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc3 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-person-workspace fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">โต๊ะครู</label>
                                    <input type="number" id="sc4" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc4 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-lightning-charge fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">เครื่องใช้ไฟฟ้า</label>
                                    <input type="number" id="sc5" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc5 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-door-closed fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">ประตูห้อง</label>
                                    <input type="number" id="sc6" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="2" value="${data.detailedScores?.sc6 || 0}">
                                </div>
                            </div>

                            <!-- Group 2: 1 Point Criteria -->
                            <div class="col-12 mt-2"><small class="text-muted fw-bold text-uppercase" style="letter-spacing: 1px;">รายการละ 1 คะแนน</small></div>
                            
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-trash fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">ถังขยะ</label>
                                    <input type="number" id="sc7" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="1" value="${data.detailedScores?.sc7 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-border-style fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">กระดานหน้าห้อง</label>
                                    <input type="number" id="sc8" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="1" value="${data.detailedScores?.sc8 || 0}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="score-card-v2 p-3 rounded-4 border text-center transition-all h-100">
                                    <i class="bi bi-grid-3x3 fs-3 mb-2 d-block text-success"></i>
                                    <label class="small fw-bold d-block mb-2">หน้าต่าง</label>
                                    <input type="number" id="sc9" class="form-control form-control-lg score-field text-center fw-bold border-0 bg-light rounded-3" min="0" max="1" value="${data.detailedScores?.sc9 || 0}">
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 p-3 rounded-4 bg-success bg-opacity-10 d-flex justify-content-between align-items-center">
                            <span class="fw-bold text-dark fs-5">คะแนนสรุปห้องเรียน:</span>
                            <div class="d-flex align-items-baseline">
                                <span id="total-score-preview" class="display-5 fw-bold text-success me-2">${data.score || 0}</span>
                                <span class="text-muted fs-4">/ 15</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <label class="form-label small fw-bold text-secondary text-uppercase mb-2" style="letter-spacing: 1px;">
                        <i class="bi bi-chat-dots me-1"></i> คอมเมนต์ / ข้อผิดพลาดที่พบ
                    </label>
                    <textarea id="swal-feedback" class="form-control mb-4 p-3" style="border-radius: 15px; font-size: 0.95rem; border: 1px solid #e0e0e0; min-height: 100px;" placeholder="ระบุสิ่งที่ต้องการให้แก้ไข หรือชมเชย...">${data.adminFeedback || ''}</textarea>
                    
                    <label class="form-label small fw-bold text-secondary text-uppercase mb-2" style="letter-spacing: 1px;">
                        <i class="bi bi-camera-fill me-1"></i> ภาพถ่ายการประเมิน
                    </label>
                    <div class="input-group">
                        <input type="file" id="swal-imagefile" class="form-control p-2" style="border-radius: 12px;" accept="image/*">
                    </div>
                    <div id="upload-status" class="small text-muted mt-2"></div>
                </div>`,
            didOpen: () => {
                const scoreFields = document.querySelectorAll('.score-field');
                const totalPreview = document.getElementById('total-score-preview');

                if (scoreFields && totalPreview) {
                    const calculateTotal = () => {
                        let total = 0;
                        scoreFields.forEach(f => total += (parseFloat(f.value) || 0));
                        totalPreview.textContent = total;
                    };
                    scoreFields.forEach(f => f.addEventListener('input', calculateTotal));
                }
            },
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'บันทึกข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: isRejected ? '#dc2626' : '#1b5e20',
            preConfirm: async () => {
                const feedbackValue = document.getElementById('swal-feedback').value;
                const imageFile = document.getElementById('swal-imagefile').files[0];
                let uploadedUrl = data.adminImageUrl || "";

                // บังคับใส่เหตุผลถ้าไม่รับเรื่อง
                if (isRejected && !feedbackValue.trim()) {
                    Swal.showValidationMessage('กรุณาระบุเหตุผลที่ไม่รับเรื่องด้วยครับ');
                    return false;
                }

                if (imageFile) {
                    Swal.showLoading();
                    document.getElementById('upload-status').innerHTML = '<span class="spinner-border spinner-border-sm me-1 text-success"></span>กำลังอัปโหลดรูปภาพ...';
                    uploadedUrl = await uploadToImgBB(imageFile);
                    if (!uploadedUrl) {
                        Swal.showValidationMessage('การอัปโหลดรูปภาพล้มเหลว กรุณาลองใหม่อีกครั้ง');
                        document.getElementById('upload-status').innerHTML = '<span class="text-danger">อัปโหลดไม่สำเร็จ</span>';
                        return false;
                    }
                }

                if (newStatus === 'resolved') {
                    const fields = ['sc1', 'sc2', 'sc3', 'sc4', 'sc5', 'sc6', 'sc7', 'sc8', 'sc9'];
                    const detailedScores = {};
                    let total = 0;

                    fields.forEach(f => {
                        const input = document.getElementById(f);
                        const numVal = parseFloat(input.value) || 0;
                        detailedScores[f] = numVal;
                        total += numVal;
                    });

                    // บังคับให้กรอกคะแนน - ถ้าคะแนนรวมเป็น 0 แสดงว่ายังไม่ได้ประเมิน
                    if (total === 0) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'กรุณากรอกคะแนนประเมิน',
                            text: 'คะแนนรวมต้องมากกว่า 0 จึงจะสามารถบันทึกได้',
                            confirmButtonColor: '#f59e0b',
                            confirmButtonText: 'ตกลง'
                        });
                        return false;
                    }

                    return {
                        feedback: feedbackValue,
                        imageUrl: uploadedUrl,
                        score: total,
                        detailedScores: detailedScores
                    }
                }

                return {
                    feedback: feedbackValue,
                    imageUrl: uploadedUrl
                }
            }
        });

        if (!result) {
            // ยกเลิกการเปลี่ยนสถานะ โดยให้ตัวเลือก Reset กลับเป็นค่าเดิม
            loadComplaintsTable();
            return;
        }
        feedback = result.feedback;
        adminImageUrl = result.imageUrl;
        adminScore = result.score;
        detailedScores = result.detailedScores;
    }

    try {
        const updateData = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (feedback) updateData.adminFeedback = feedback;
        if (adminImageUrl) updateData.adminImageUrl = adminImageUrl;
        if (adminScore !== undefined) updateData.score = adminScore;
        if (detailedScores) updateData.detailedScores = detailedScores;

        // บันทึก Timeline
        const activity = {
            action: `เปลี่ยนสถานะเป็น ${getStatusText(newStatus)}`,
            status: newStatus,
            timestamp: new Date(),
            details: feedback ? `โน้ต: ${feedback}` : "เปลี่ยนสถานะโดยแอดมิน"
        };

        await complaintsCollection.doc(complaintId).update({
            ...updateData,
            activities: firebase.firestore.FieldValue.arrayUnion(activity)
        });

        // แสดงแจ้งเตือน
        showAdminAlert(`อัพเดตสถานะและคะแนนประเมินสำเร็จ`, 'success');

    } catch (error) {
        console.error("Error updating status:", error);
        showAdminAlert(`อัพเดตสถานะไม่สำเร็จ: ${error.message}`, 'danger');
        loadComplaintsTable();
    }
}

// ===== ฟังก์ชันจัดการเรื่องซ้ำ =====
async function markAsDuplicate(complaintId) {
    const { value: parentTicketId } = await Swal.fire({
        title: 'ระบุ Ticket ID ที่เป็นต้นฉบับ',
        input: 'text',
        inputLabel: 'ตัวอย่าง: SN-0001',
        showCancelButton: true,
        confirmButtonColor: '#1b5e20',
        inputValidator: (value) => {
            if (!value) return 'กรุณาระบุ Ticket ID ด้วยครับ';
            if (!value.startsWith('SN-')) return 'รูปแบบ Ticket ID ไม่ถูกต้อง';
        }
    });

    if (parentTicketId) {
        try {
            await complaintsCollection.doc(complaintId).update({
                isDuplicate: true,
                duplicateOf: parentTicketId.toUpperCase(),
                status: 'rejected',
                adminFeedback: `เรื่องนี้ถูกทำเครื่องหมายว่าเป็นเรื่องซ้ำกับ Ticket ID: ${parentTicketId}`,
                activities: firebase.firestore.FieldValue.arrayUnion({
                    action: "ทำเครื่องหมายเป็นเรื่องซ้ำ",
                    status: "rejected",
                    timestamp: new Date(),
                    details: `ถูกตรวจสอบว่าเป็นเรื่องเดียวกับ ${parentTicketId}`
                })
            });
            Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรื่องซ้ำแล้ว', 'success');
        } catch (error) {
            console.error("Duplicate mark error:", error);
            Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
        }
    }
}

// ===== ฟังก์ชัน Export ข้อมูลเป็น CSV =====
async function exportToCSV() {
    try {
        Swal.fire({
            title: 'กำลังเตรียมชุดข้อมูล...',
            didOpen: () => { Swal.showLoading(); }
        });

        const snapshot = await complaintsCollection.get();
        let csvContent = "\uFEFF"; // Unicode Character 'ZERO WIDTH NO-BREAK SPACE' for Excel UTF-8
        csvContent += "Submission ID,วันที่ส่ง,ระดับชั้น,ห้อง,คะแนน,สถานะ,อีเมลติดต่อ,รายละเอียด\n";

        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-';
            const row = [
                d.ticketId || '',
                date,
                d.category || '',
                d.roomNumber || '',
                d.score !== undefined ? `${d.score}/15` : '-',
                getStatusText(d.status),
                d.reporterEmail || '',
                `"${(d.details || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Complaints_Report_${new Date().toLocaleDateString('th-TH')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.close();
        Swal.fire('สำเร็จ', 'ส่งออกข้อมูลเรียบร้อยแล้ว (CSV)', 'success');

    } catch (error) {
        console.error("Export error:", error);
        Swal.fire('ผิดพลาด', 'ไม่สามารถส่งออกข้อมูลได้', 'error');
    }
}

// ===== ฟังก์ชันลบข้อมูล =====
async function handleDeleteComplaint(e) {
    const complaintId = e.target.closest('button').dataset.id;

    const result = await Swal.fire({
        title: 'ยืนยันการลบข้อมูล?',
        text: "ข้อมูลที่ลบไปแล้วจะไม่สามารถกู้คืนกลับมาได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก',
        iconColor: '#ef4444'
    });

    if (!result.isConfirmed) return;

    try {
        await complaintsCollection.doc(complaintId).delete();

        Swal.fire({
            icon: 'success',
            title: 'ลบข้อมูลสำเร็จ',
            text: 'ข้อมูลถูกลบออกจากระบบเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false,
            timerProgressBar: true,
            iconColor: '#1b5e20'
        });

    } catch (error) {
        console.error("Error deleting complaint:", error);
        Swal.fire({
            icon: 'error',
            title: 'ลบข้อมูลไม่สำเร็จ',
            text: 'เกิดข้อผิดพลาดในการลบข้อมูล กรุณาติดต่อแอดมิน',
            confirmButtonColor: '#1b5e20'
        });
    }
}

// ===== ฟังก์ชันแจ้งเตือนใน Admin =====
function showAdminAlert(message, type = 'info') {
    // สร้างแจ้งเตือนชั่วคราว
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    alertDiv.innerHTML = `
        <i class="bi ${type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // ลบแจ้งเตือนหลังจาก 3 วินาที
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}

// ===== ฟังก์ชันแสดงผลกราฟ =====
function renderCharts(statusData, categoryData, trendData, reporterData) {
    // 1. กราฟสถานะ (Doughnut Chart)
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['รอรับเรื่อง', 'รับเรื่องแล้ว', 'ดำเนินการ', 'เสร็จสิ้น', 'ไม่รับเรื่อง'],
            datasets: [{
                data: [
                    statusData.waiting,
                    statusData.accepted,
                    statusData.inProgress,
                    statusData.resolved,
                    statusData.rejected
                ],
                backgroundColor: ['#64748b', '#0284c7', '#f59e0b', '#10b981', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: 'Kanit' } } },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, titleFont: { family: 'Kanit' }, bodyFont: { family: 'Kanit' } }
            },
            cutout: '70%'
        }
    });

    // 2. กราฟหมวดหมู่ (Bar Chart)
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                label: 'จำนวนเรื่อง',
                data: Object.values(categoryData),
                backgroundColor: 'rgba(27, 94, 32, 0.7)',
                borderColor: '#1b5e20',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Kanit' } } },
                x: { ticks: { font: { family: 'Kanit' } } }
            }
        }
    });

    // 3. กราฟเทรนด์รายเดือน (Line Chart)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: Object.keys(trendData),
            datasets: [{
                label: 'จำนวนเรื่อง',
                data: Object.values(trendData),
                fill: true,
                backgroundColor: 'rgba(27, 94, 32, 0.1)',
                borderColor: '#1b5e20',
                tension: 0.4,
                pointBackgroundColor: '#1b5e20',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Kanit' } } },
                x: { ticks: { font: { family: 'Kanit' } } }
            }
        }
    });

    // 4. กราฟประเภทผู้ส่งผลงาน (Doughnut Chart)
    const reporterCtx = document.getElementById('reporterChart').getContext('2d');
    if (reporterChart) reporterChart.destroy();
    reporterChart = new Chart(reporterCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(reporterData),
            datasets: [{
                data: Object.values(reporterData),
                backgroundColor: ['#1b5e20', '#1565c0', '#f9a825', '#ad1457', '#64748b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Kanit', size: 11 } } }
            },
            cutout: '60%'
        }
    });
}

// ===== ฟังก์ชันช่วยเหลือ =====
function getStatusText(status) {
    const statusMap = {
        'waiting': 'รอตรวจ',
        'pending': 'รอตรวจ',
        'accepted': 'รับข้อมูลแล้ว',
        'in-progress': 'กำลังประเมิน',
        'resolved': 'ประเมินแล้ว',
        'rejected': 'ไม่ผ่าน/ข้อมูลไม่ชัดเจน'
    };
    return statusMap[status] || status;
}
// ===== ฟังก์ชันอัปโหลดรูปภาพไปยัง ImgBB =====
async function uploadToImgBB(file) {
    const apiKey = "46dfbc930533d4e9c142365ba306242b";

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            return result.data.url;
        } else {
            console.error("❌ ImgBB Error:", result.error.message);
            return null;
        }
    } catch (error) {
        console.error("❌ Network Error:", error);
        return null;
    }
}
// ===== ฟังก์ชัน Export ข้อมูลเป็น PDF =====
// ===== ฟังก์ชัน Export ข้อมูลเป็น PDF (เวอร์ชันแก้ไขปัญหาหน้าขาวถาวรด้วย Iframe/New Window) =====
async function exportToPDF() {
    try {
        Swal.fire({
            title: 'กำลังเตรียมข้อมูลรายงาน...',
            text: 'ระบบกำลังจัดรูปแบบเอกสารภาษาไทย',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        const snapshot = await complaintsCollection.orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            Swal.fire('ไม่พบข้อมูล', 'ไม่มีรายการส่งผลงานที่ต้องการส่งออก', 'info');
            return;
        }

        // เตรียมชุดข้อมูลตาราง
        let tableRows = '';
        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-';
            tableRows += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${d.ticketId || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${date}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${d.title || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${d.category || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #1b5e20;">${d.score !== undefined ? d.score : '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${getStatusText(d.status)}</td>
                </tr>
            `;
        });

        // สร้างเนื้อหาที่จะส่งไปพิมพ์
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Kanit', sans-serif; padding: 40px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1b5e20; padding-bottom: 20px; }
                    .logo { width: 80px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th { background-color: #f1f8e9; color: #1b5e20; padding: 12px; border: 1px solid #ddd; }
                    .footer { margin-top: 50px; text-align: right; }
                    @page { size: A4; margin: 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="logo.png" class="logo">
                    <h2 style="margin:0;">รายงานสรุปผลการประกวดห้องเรียนสะอาด</h2>
                    <p style="margin:5px 0 0 0;">สภานักเรียนโรงเรียนสุรวิทยาคาร</p>
                </div>
                <div style="margin-bottom:30px;">
                    <h1 style="color:#1b5e20; border-bottom:2px solid #1b5e20; padding-bottom:10px;">ภาพรวมการประเมินผล</h1>
                </div>
                <h4 style="border-left:5px solid #1b5e20; padding-left:10px;">รายการส่งผลงานทั้งหมด (${snapshot.size} รายการ)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Submission ID</th>
                            <th>วันที่ส่ง</th>
                            <th>ห้องเรียน</th>
                            <th>ระดับชั้น</th>
                            <th>คะแนน</th>
                            <th>สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <div class="footer">
                    <p style="margin-bottom:60px;">ลงชื่อ...........................................................</p>
                    <p>(...........................................................)</p>
                    <p>ประธานสภานักเรียนโรงเรียนสุรวิทยาคาร</p>
                </div>
                
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                <script>
                    window.onload = function() {
                        const opt = {
                            margin: 10,
                            filename: 'Report_Council.pdf',
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2, useCORS: true },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        html2pdf().set(opt).from(document.body).save().then(() => {
                            window.parent.postMessage('pdf-done', '*');
                        });
                    };
                </script>
            </body>
            </html>
        `;

        // ใช้ Iframe ในการเรนเดอร์ (เป็นวิธีที่เสถียรที่สุดในการกันหน้าขาว)
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.zIndex = '-9999';
        iframe.style.opacity = '0.01'; // ให้มันรู้สึกว่ามีตัวตนแต่ไม่เห็น
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();

        // รอรับข้อความว่าเสร็จแล้วค่อยลบ iframe
        window.addEventListener('message', function (event) {
            if (event.data === 'pdf-done') {
                setTimeout(() => {
                    if (iframe.parentNode) document.body.removeChild(iframe);
                    Swal.close();
                    Swal.fire('สำเร็จ', 'บันทึกรายงาน PDF เรียบร้อยแล้ว', 'success');
                }, 1000);
            }
        }, { once: true });

    } catch (error) {
        console.error("PDF Export error:", error);
        Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    }
}

// ===== ฟังก์ชันสรุปคะแนนประเมินรายสัปดาห์/เดือน/ปี =====
async function generateSummary(period) {
    const summaryTableBody = document.getElementById('summaryTableBody');
    const dateRangeDisplay = document.getElementById('dateRangeDisplay');
    const buttons = document.querySelectorAll('.btn-summary-filter');

    // อัปเดตสถานะปุ่ม
    buttons.forEach(btn => {
        btn.classList.remove('active', 'btn-success', 'text-white');
        btn.classList.add('btn-light');
        if ((period === 'daily' && btn.id === 'btnDaily') ||
            (period === 'weekly' && btn.id === 'btnWeekly') ||
            (period === 'monthly' && btn.id === 'btnMonthly') ||
            (period === 'yearly' && btn.id === 'btnYearly')) {
            btn.classList.remove('btn-light');
            btn.classList.add('active', 'btn-success', 'text-white');
        }
    });

    if (summaryTableBody) {
        summaryTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <div class="spinner-border spinner-border-sm text-success me-2"></div>
                    กำลังคำนวณอันดับคะแนน...
                </td>
            </tr>
        `;
    }

    try {
        const now = new Date();
        let startDate = new Date();

        if (period === 'daily') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'weekly') {
            const day = now.getDay() || 7;
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(now.getDate() - (day - 1));
        } else if (period === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        } else if (period === 'yearly') {
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        }

        if (dateRangeDisplay) {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            dateRangeDisplay.textContent = `${startDate.toLocaleDateString('th-TH', options)} - ${now.toLocaleDateString('th-TH', options)}`;
        }

        // ดึงเฉพาะข้อมูลที่สถานะเป็น resolved มาก่อน (เพื่อเลี่ยงการขอ Index ซ้อน)
        const snapshot = await complaintsCollection
            .where('status', '==', 'resolved')
            .get();

        const roomGroups = {};
        const startTimestamp = firebase.firestore.Timestamp.fromDate(startDate);

        snapshot.forEach(doc => {
            const data = doc.data();

            // กรองวันเวลาด้วย JavaScript (Client-side filtering) เพื่อไม่ต้องทำ Composite Index ใน Firebase
            if (!data.createdAt || data.createdAt.seconds < startTimestamp.seconds) {
                return;
            }

            const roomKey = `${data.category || 'ไม่ระบุ'}_${data.roomNumber || 'ไม่ระบุ'}`;
            const score = parseInt(data.score) || 0;

            if (!roomGroups[roomKey]) {
                roomGroups[roomKey] = {
                    category: data.category || '-',
                    roomNumber: data.roomNumber || '-',
                    totalScore: 0,
                    count: 0,
                    lastScore: score,
                    lastDate: data.updatedAt ? data.updatedAt.toDate() : (data.createdAt ? data.createdAt.toDate() : new Date())
                };
            }

            roomGroups[roomKey].totalScore += score;
            roomGroups[roomKey].count += 1;
            roomGroups[roomKey].lastScore = score;
            const currentDate = data.updatedAt ? data.updatedAt.toDate() : (data.createdAt ? data.createdAt.toDate() : new Date());
            if (currentDate > roomGroups[roomKey].lastDate) {
                roomGroups[roomKey].lastDate = currentDate;
            }
        });

        const sortedRooms = Object.values(roomGroups).sort((a, b) => {
            const avgA = a.totalScore / a.count;
            const avgB = b.totalScore / b.count;
            return avgB - avgA;
        });

        if (summaryTableBody) {
            if (sortedRooms.length === 0) {
                summaryTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ยังไม่มีข้อมูลการประเมินที่เสร็จสิ้น (Resolved) ในช่วงเวลาที่เลือก</td></tr>`;
            } else {
                summaryTableBody.innerHTML = sortedRooms.map((room, index) => {
                    const avgScore = (room.totalScore / room.count).toFixed(2);
                    const rankClass = index === 0 ? 'bg-warning text-dark shadow-sm' : (index === 1 ? 'bg-secondary text-white' : (index === 2 ? 'bg-bronze text-white' : 'bg-light text-dark'));
                    const rankIcon = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : index + 1));

                    return `
                        <tr>
                            <td class="ps-4">
                                <span class="badge rounded-circle p-2 ${rankClass}" style="width: 35px; height: 35px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                                    ${rankIcon}
                                </span>
                            </td>
                            <td>
                                <div class="fw-bold text-dark">${room.category}</div>
                                <div class="text-muted small">ห้องเรียนที่ ${room.roomNumber}</div>
                            </td>
                            <td class="text-center"><span class="badge bg-light text-dark border rounded-pill px-3">${room.count}</span></td>
                            <td class="text-center fw-bold text-success fs-5">${room.totalScore}</td>
                            <td class="text-center">
                                <div class="d-flex flex-column align-items-center">
                                    <div class="progress mb-1" style="height: 6px; width: 100px; border-radius: 10px; background-color: #eee;">
                                        <div class="progress-bar bg-success rounded-pill" style="width: ${(avgScore / 15) * 100}%"></div>
                                    </div>
                                    <div class="fw-bold">${avgScore} <small class="text-muted">/ 15</small></div>
                                </div>
                            </td>
                            <td class="pe-4 text-center">
                                <span class="badge bg-light text-success border rounded-pill px-3">
                                    <i class="bi bi-calendar-check me-1"></i>
                                    ${room.lastDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

    } catch (error) {
        console.error("Error generating summary:", error);
        if (summaryTableBody) {
            summaryTableBody.innerHTML = `< tr > <td colspan="6" class="text-center py-5 text-danger">เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}</td></tr > `;
        }
    }
}



// ===== ฟังก์ชันสุ่มตรวจห้องเรียน (Random Audit Mode) =====
function startRandomAudit() {
    const auditListContainer = document.getElementById('auditListContainer');
    const modal = new bootstrap.Modal(document.getElementById('auditModal'));
    modal.show();

    // จำลองการสุ่มเลือกห้อง (ในอนาคตอาจดึงจากรายชื่อห้องทั้งหมดในระบบ)
    const levels = [
        'มัธยมศึกษาปีที่ 1', 'มัธยมศึกษาปีที่ 2', 'มัธยมศึกษาปีที่ 3',
        'มัธยมศึกษาปีที่ 4', 'มัธยมศึกษาปีที่ 5', 'มัธยมศึกษาปีที่ 6'
    ];

    // สุ่ม 3 ห้องที่ไม่ซ้ำกัน
    const selectedRooms = [];
    while (selectedRooms.length < 3) {
        const randomLevel = levels[Math.floor(Math.random() * levels.length)];
        const randomRoom = Math.floor(Math.random() * 10) + 1; // สมมติว่ามี 10 ห้องต่อชั้น
        const roomObj = { level: randomLevel, room: randomRoom };

        // เช็คซ้ำ
        const isDuplicate = selectedRooms.some(r => r.level === randomLevel && r.room === randomRoom);
        if (!isDuplicate) {
            selectedRooms.push(roomObj);
        }
    }

    // หน่วงเวลาเล็กน้อยเพื่อความสมจริง
    setTimeout(() => {
        auditListContainer.innerHTML = selectedRooms.map((item, index) => `
                        < div class="col-md-4" >
                            <div class="card border-0 shadow-sm h-100 audit-card">
                                <div class="card-body text-center p-4">
                                    <div class="badge bg-primary-subtle text-primary mb-3 rounded-pill px-3">เป้าหมายที่ ${index + 1}</div>
                                    <h4 class="fw-bold text-dark mb-1">${item.level}</h4>
                                    <div class="display-4 fw-bold text-primary mb-3">ห้อง ${item.room}</div>
                                    <div class="d-grid">
                                        <button class="btn btn-outline-primary btn-sm rounded-pill" onclick="printAuditForm('${item.level}', '${item.room}')">
                                            <i class="bi bi-printer me-2"></i>พิมพ์แบบประเมิน
                                        </button>
                                    </div>
                                </div>
                            </div>
            </div >
                        `).join('');
    }, 1500);
}

// ===== ฟังก์ชันพิมพ์แบบฟอร์มตรวจสอบ =====
function printAuditForm(level, room) {
    const printableArea = document.getElementById('printableArea');
    const today = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    printableArea.innerHTML = `
                        < div class="audit-paper" >
            <div class="audit-header">
                <div class="audit-logo">
                    <img src="logo.png" alt="Logo" style="width: 80px; height: 80px;">
                </div>
                <div class="audit-title">แบบฟอร์มการตรวจสอบห้องเรียนสะอาด (Audit)</div>
                <div class="audit-subtitle">สภานักเรียนโรงเรียนสุรวิทยาคาร</div>
                <div style="font-size: 14pt; margin-top: 10px;">วันที่: ${today}</div>
            </div>

            <div class="audit-info">
                ระดับชั้น: ${level} &nbsp;&nbsp;|&nbsp;&nbsp; ห้องที่: ${room}
            </div>

            <div class="audit-checklist">
                <h3 style="border-bottom: 2px solid #ddd; padding-bottom: 5px;">รายการตรวจสอบ</h3>
                
                <div class="checklist-item">
                    <span>1. ความสะอาดพื้นห้อง (กวาด/ถู)</span>
                    <div class="score-box"></div>
                </div>
                <div class="checklist-item">
                    <span>2. การจัดโต๊ะและเก้าอี้เป็นระเบียบ</span>
                    <div class="score-box"></div>
                </div>
                <div class="checklist-item">
                    <span>3. ถังขยะ (มีการคัดแยก/ไม่ล้น)</span>
                    <div class="score-box"></div>
                </div>
                <div class="checklist-item">
                    <span>4. กระดานดำ/ไวท์บอร์ดสะอาด</span>
                    <div class="score-box"></div>
                </div>
                <div class="checklist-item">
                    <span>5. ความเรียบร้อยทั่วไป (หลังตู้/มุมห้อง)</span>
                    <div class="score-box"></div>
                </div>
            </div>

            <div style="margin-top: 30px; border: 1px solid #000; padding: 15px; height: 150px;">
                <strong>ข้อเสนอแนะเพิ่มเติม:</strong>
            </div>

            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div>(....................................................)</div>
                    <div>หัวหน้าห้อง/ตัวแทนห้อง</div>
                    <div>ผู้รับการตรวจ</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <div>(....................................................)</div>
                    <div>กรรมการนักเรียน</div>
                    <div>ผู้ตรวจสอบ</div>
                </div>
            </div>
        </div >
                        `;

    // สั่งพิมพ์
    window.print();
}
