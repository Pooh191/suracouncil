// ===== ตัวแปร Global =====
let currentUser = null;
let complaintsCollection;
let unsubscribe = null; // สำหรับ real-time listener
let statusChart = null; // สำหรับกราฟสถานะ
let categoryChart = null; // สำหรับกราฟหมวดหมู่
let trendChart = null; // สำหรับกราฟเทรนด์ประจำเดือน
let reporterChart = null; // สำหรับกราฟประเภทผู้ร้องเรียน
let sessionInterval = null; // สำหรับเช็คเวลาหมดอายุ
let userProfile = null; // สำหรับเก็บข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
let calendarSelectedMonth = new Date().getMonth(); // เดือนที่เลือกในปฏิทิน (0-11)
let calendarSelectedYear = new Date().getFullYear(); // ปีที่เลือกในปฏิทิน
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 นาที (หน่วยเป็นมิลลิวินาที)

// รายชื่อตำแหน่งที่กำหนด
const POSITIONS = [
    "แอดมิน",
    "ประธานกรรมการสภานักเรียน",
    "รองประธานกรรมการสภานักเรียน คนที่หนึ่ง",
    "รองประธานกรรมการสภานักเรียน คนที่สอง",
    "เลขานุการคณะกรรมการสภานักเรียน",
    "หัวหน้ากลุ่ม",
    "หัวหน้าฝ่าย",
    "กรรมการสภานักเรียน",
    "อนุกรรมการสภานักเรียน"
];

// ===== ฟังก์ชันเริ่มต้น =====
document.addEventListener('DOMContentLoaded', function () {
    // กำหนด collection reference
    complaintsCollection = db.collection("complaints");

    // ตรวจสอบสถานะการล็อกอิน
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;

            try {
                // ดึงข้อมูลโปรไฟล์จาก Firestore
                const userDoc = await db.collection("users").doc(user.uid).get();
                if (userDoc.exists) {
                    userProfile = userDoc.data();
                    // บังคับให้เป็น superadmin ถ้าเป็นอีเมลตามที่กำหนด (ทำเพื่อความปลอดภัยกรณีข้อมูลใน DB ผิด)
                    if (user.email && user.email.toLowerCase() === "admin@student.sura.ac.th") {
                        userProfile.role = "superadmin";
                    }
                } else {
                    // ถ้าไม่มีข้อมูลใน Firestore ให้สร้างโปรไฟล์ตั้งต้น
                    userProfile = {
                        role: (user.email && user.email.toLowerCase() === "admin@student.sura.ac.th") ? "superadmin" : "admin",
                        displayName: user.email,
                        position: "แอดมิน"
                    };

                    // บันทึกข้อมูลเบื้องต้นลง Firestore ด้วย
                    await db.collection("users").doc(user.uid).set({
                        email: user.email,
                        displayName: userProfile.displayName,
                        position: userProfile.position,
                        role: userProfile.role,
                        studentId: "",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                showDashboard();
                loadDashboardData();
                startSessionTimer();
            } catch (error) {
                console.error("Error fetching user profile:", error);
                // Fallback กรณี error
                userProfile = { role: "admin", displayName: user.email };
                showDashboard();
                loadDashboardData();
                startSessionTimer();
            }
        } else {
            // ยังไม่ล็อกอิน
            currentUser = null;
            userProfile = null;
            stopSessionTimer();
            showLogin();
        }
    });

    // ตั้งค่า Event Listeners
    setupAdminEventListeners();
    initCalendarSelectors();

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
    const timeFilter = document.getElementById('timeFilter');

    if (searchInput) searchInput.addEventListener('input', () => loadComplaintsTable());
    if (categoryFilter) categoryFilter.addEventListener('change', () => loadComplaintsTable());
    if (statusFilter) statusFilter.addEventListener('change', () => loadComplaintsTable());
    if (timeFilter) timeFilter.addEventListener('change', () => loadComplaintsTable());

    // ปุ่ม Export
    const exportBtn = document.getElementById('exportDataBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    const exportPDFBtn = document.getElementById('exportPDFBtn');
    if (exportPDFBtn) {
        exportPDFBtn.addEventListener('click', exportToPDF);
    }

    // ปุ่มเปลี่ยนรหัสผ่านตนเอง
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', handleChangeOwnPassword);
    }

    // ปุ่มจัดการผู้ใช้งาน
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    if (manageUsersBtn) {
        manageUsersBtn.addEventListener('click', showUserManagement);
    }

    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', hideUserManagement);
    }

    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', handleAddUser);
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

        let finalEmail = email;
        // ถ้าเป็นตัวเลข 5 หลัก ให้ถือว่าเป็นเลขประจำตัว
        if (/^\d{5}$/.test(email)) {
            finalEmail = `${email}@council.internal`;
        }

        await auth.signInWithEmailAndPassword(finalEmail, password);

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
    document.getElementById('userManagementSection').classList.add('d-none');

    // ตรวจสอบความปลอดภัยผ่านอีเมลโดยตรงร่วมด้วย
    const isSuperAdmin = (currentUser && currentUser.email && currentUser.email.toLowerCase() === "admin@student.sura.ac.th") ||
        (userProfile && userProfile.role === 'superadmin');

    // แสดงชื่อและตำแหน่งผู้ใช้
    if (currentUser) {
        document.getElementById('adminName').textContent = (userProfile && userProfile.displayName) || currentUser.email;

        // แสดงตำแหน่งที่ระบุในจัดการผู้ใช้
        const positionSmall = document.querySelector('#adminName + small') || document.querySelector('.text-white-50');
        if (positionSmall) {
            if (currentUser && currentUser.email && currentUser.email.toLowerCase() === "admin@student.sura.ac.th") {
                positionSmall.textContent = "แอดมินสูงสุด";
            } else if (userProfile && userProfile.position) {
                positionSmall.textContent = userProfile.position;
            } else if (isSuperAdmin) {
                positionSmall.textContent = "แอดมินสูงสุด";
            } else {
                positionSmall.textContent = "ผู้ดูแลระบบ";
            }
        }

        // แสดงปุ่มจัดการผู้ใช้งาน
        const manageBtn = document.getElementById('manageUsersBtn');
        if (manageBtn) {
            if (isSuperAdmin) {
                manageBtn.classList.remove('d-none');
            } else {
                manageBtn.classList.add('d-none');
            }
        }
    }
}

function showUserManagement() {
    const isSuperAdmin = (currentUser && currentUser.email && currentUser.email.toLowerCase() === "admin@student.sura.ac.th") ||
        (userProfile && userProfile.role === 'superadmin');

    if (isSuperAdmin) {
        document.getElementById('dashboardSection').classList.add('d-none');
        document.getElementById('userManagementSection').classList.remove('d-none');
        loadUsersTable();
    } else {
        showAdminAlert('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้', 'error');
    }
}

function hideUserManagement() {
    showDashboard();
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

        // คำนวณสถิติสถานะ
        let total = 0;
        let waiting = 0;
        let accepted = 0;
        let rejected = 0;
        let inProgress = 0;
        let resolved = 0;

        // คำนวณสถิติตามเวลา (รายวัน, รายสัปดาห์, รายเดือน)
        let todayCount = 0;
        let weekCount = 0;
        let monthCount = 0;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);

        // สำหรับปฏิทินรายวัน (เดือนปัจจุบัน)
        const dailyCounts = {};

        // สำหรับกราฟหมวดหมู่
        const categoryCounts = {
            'อาคารสถานที่': 0,
            'ระบบการเรียนการสอน': 0,
            'กิจกรรมนักเรียน': 0,
            'สวัสดิการ': 0,
            'อื่นๆ': 0
        };

        // สำหรับกราฟผู้ร้องเรียน
        const reporterCounts = {
            'นักเรียน': 0,
            'ครู / บุคลากร': 0,
            'ผู้ปกครอง': 0,
            'บุคคลภายนอก': 0,
            'อื่นๆ': 0
        };

        // สำหรับกราฟเทรนด์ (6 เดือนล่าสุด)
        const monthlyTrend = {};
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

            // ตรวจสอบเวลาเพื่อจัดกลุ่มสถิติรายเวลา
            if (data.createdAt) {
                const createdAt = data.createdAt.toDate();
                const createdTime = createdAt.getTime();

                if (createdTime >= todayStart) todayCount++;
                if (createdTime >= sevenDaysAgo) weekCount++;
                if (createdTime >= thisMonthStart) monthCount++;

                // นับสำหรับปฏิทินรายวัน (ตามเดือน/ปีที่เลือก)
                if (createdAt.getMonth() === calendarSelectedMonth && createdAt.getFullYear() === calendarSelectedYear) {
                    const dayNum = createdAt.getDate();
                    dailyCounts[dayNum] = (dailyCounts[dayNum] || 0) + 1;
                }

                // นับเทรนด์รายเดือนสำหรับกราฟ
                const monthKey = createdAt.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
                if (monthlyTrend.hasOwnProperty(monthKey)) {
                    monthlyTrend[monthKey]++;
                }
            }

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
                if (data.category.startsWith('อื่นๆ')) {
                    categoryCounts['อื่นๆ']++;
                }
            }

            // นับประเภทผู้ร้องเรียน
            if (data.reporterType) {
                let type = data.reporterType;
                if (type.startsWith('อื่นๆ')) type = 'อื่นๆ';
                if (reporterCounts.hasOwnProperty(type)) {
                    reporterCounts[type]++;
                } else {
                    reporterCounts['อื่นๆ']++;
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

        // สร้างการ์ดสถิติ (อัปเกรดใหม่ แบ่งโซน)
        const statsCards = document.getElementById('statsCards');
        statsCards.innerHTML = `
            <!-- สรุปรายเวลา (Daily/Weekly/Monthly) -->
            <div class="col-12 mb-3">
                <div class="d-flex align-items-center mb-3">
                    <span class="premium-title-vbar me-3" style="height: 20px; background: var(--accent-yellow);"></span>
                    <h6 class="mb-0 fw-bold">สรุปสถิติรายเวลา (New Reports Summary)</h6>
                </div>
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="card stat-card shadow-sm border-0" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                            <div class="card-body p-3 d-flex align-items-center">
                                <div class="stat-icon-bg me-3"><i class="bi bi-calendar-day"></i></div>
                                <div>
                                    <h6 class="text-white-50 mb-0 small">เรื่องใหม่วันนี้</h6>
                                    <h3 class="fw-bold mb-0">${todayCount} <small class="fs-6 fw-normal">เรื่อง</small></h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card shadow-sm border-0" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;">
                            <div class="card-body p-3 d-flex align-items-center">
                                <div class="stat-icon-bg me-3"><i class="bi bi-calendar-week"></i></div>
                                <div>
                                    <h6 class="text-white-50 mb-0 small">เรื่องใหม่สัปดาห์นี้ (7 วัน)</h6>
                                    <h3 class="fw-bold mb-0">${weekCount} <small class="fs-6 fw-normal">เรื่อง</small></h3>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card stat-card shadow-sm border-0" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;">
                            <div class="card-body p-3 d-flex align-items-center">
                                <div class="stat-icon-bg me-3"><i class="bi bi-calendar-month"></i></div>
                                <div>
                                    <h6 class="text-white-50 mb-0 small">เรื่องใหม่เดือนนี้</h6>
                                    <h3 class="fw-bold mb-0">${monthCount} <small class="fs-6 fw-normal">เรื่อง</small></h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- สรุปตามสถานะ -->
            <div class="col-12 mt-4 mb-2">
                <div class="d-flex align-items-center mb-3">
                    <span class="premium-title-vbar me-3" style="height: 20px;"></span>
                    <h6 class="mb-0 fw-bold">สถานะการดำเนินงานทั้งหมด (Work Status)</h6>
                </div>
            </div>

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
                            <h6 class="text-white-50 mb-1 small">รอรับเรื่อง</h6>
                            <h3 class="fw-bold mb-0">${waiting}</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">รับเรื่องแล้ว</h6>
                            <h3 class="fw-bold mb-0">${accepted}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">ดำเนินการ</h6>
                            <h3 class="fw-bold mb-0">${inProgress}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">เสร็จสิ้น</h6>
                            <h3 class="fw-bold mb-0">${resolved}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-2 col-md-4 col-6 mb-3">
                <div class="card stat-card shadow-sm border-0 h-100" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white;">
                    <div class="card-body p-3">
                        <div class="text-center">
                            <h6 class="text-white-50 mb-1 small">ไม่รับเรื่อง</h6>
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

        // แสดงปฏิทินสรุปรายวัน
        renderComplaintCalendar(dailyCounts);

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
            const timeFilter = document.getElementById('timeFilter')?.value || '';

            tableBody.innerHTML = '';

            let filteredDocs = [];

            // เตรียมตัวแปรสำหรับเช็คเวลา
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

            snapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;

                // ค้นหาและฟิลเตอร์พื้นฐาน
                const matchesSearch = !searchTerm ||
                    (data.ticketId && data.ticketId.toLowerCase().includes(searchTerm)) ||
                    (data.title && data.title.toLowerCase().includes(searchTerm));

                const matchesCategory = !categoryFilter ||
                    (data.category && data.category.includes(categoryFilter));

                const matchesStatus = !statusFilter ||
                    (data.status === statusFilter) ||
                    (statusFilter === 'waiting' && data.status === 'pending');

                // ฟิลเตอร์ช่วงเวลา
                let matchesTime = true;
                if (timeFilter && data.createdAt) {
                    const createdTime = data.createdAt.toDate().getTime();
                    if (timeFilter === 'daily') matchesTime = createdTime >= todayStart;
                    else if (timeFilter === 'monthly') matchesTime = createdTime >= monthStart;
                    else if (timeFilter === 'yearly') matchesTime = createdTime >= yearStart;
                }

                if (matchesSearch && matchesCategory && matchesStatus && matchesTime) {
                    filteredDocs.push({ id, ...data });
                }
            });

            if (filteredDocs.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-muted py-4">
                            <i class="bi bi-inbox me-2"></i>ไม่พบข้อมูลที่ตรงตามเงื่อนไข
                        </td>
                    </tr>
                `;
                return;
            }

            filteredDocs.forEach(data => {
                const id = data.id;
                const isLocked = data.status === 'resolved' || data.status === 'rejected';

                // แปลงวันที่
                let dateStr = '-';
                if (data.createdAt) {
                    const date = data.createdAt.toDate();
                    dateStr = date.toLocaleDateString('th-TH');
                }

                // สร้างแถวตาราง
                const row = document.createElement('tr');
                // เพิ่มสีพื้นหลังเบาๆ ถ้าเป็นเรื่องซ้ำ
                if (data.isDuplicate) {
                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                }

                row.innerHTML = `
                    <td class="ps-4" data-label="Ticket ID">
                        <span class="badge bg-light text-dark border p-2 rounded-3">${data.ticketId || '-'}</span>
                        ${data.isDuplicate ? '<div class="mt-1"><span class="badge bg-danger-subtle text-danger" style="font-size: 0.7rem;"><i class="bi bi-intersect me-1"></i>เรื่องซ้ำ</span></div>' : ''}
                    </td>
                    <td data-label="หัวข้อ">
                        <div class="fw-bold text-dark table-truncate-title" title="${data.title || '-'}">${data.title || '-'}</div>
                    </td>
                    <td data-label="ประเภท">
                        <span class="badge bg-secondary-subtle text-secondary px-3 py-2 rounded-pill table-truncate-category" title="${data.category || '-'}">
                            ${data.category || '-'}
                        </span>
                    </td>
                    <td data-label="สถานที่">
                        <div class="small fw-bold text-dark table-truncate-location" title="${data.location || '-'}">${data.location || '-'}</div>
                    </td>
                    <td data-label="วันที่พบปัญหา" class="small">
                        ${data.incidentDate ? new Date(data.incidentDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                    </td>
                    <td data-label="ผู้ร้องเรียน">
                        <div class="d-flex align-items-center justify-content-end justify-content-md-start">
                            <div class="bg-light rounded-circle p-2 me-2 d-none d-md-block">
                                <i class="bi bi-person text-success"></i>
                            </div>
                            <div class="text-end text-md-start">
                                <div class="fw-bold small">${data.reporterName || '-'}</div>
                                <div class="mb-1"><span class="badge bg-info-subtle text-info fw-normal" style="font-size: 0.7rem;">${data.reporterType || '-'}</span></div>
                                <div class="text-muted" style="font-size: 0.75rem;">${data.reporterEmail || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="small text-muted" data-label="วันที่แจ้ง">${dateStr}</td>
                    <td data-label="สถานะ">
                        <span class="status-badge status-${data.status || 'pending'}">
                            <i class="bi bi-dot fs-4"></i>${getStatusText(data.status)}
                        </span>
                    </td>
                    <td class="pe-4 text-center" data-label="จัดการ">
                        <div class="action-wrapper d-flex flex-column flex-md-row align-items-center justify-content-center gap-2">
                            <!-- Action Group for View/Delete -->
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

                            <!-- Status Selector (Modernized) -->
                            <div class="status-selector-container">
                                <select class="form-select form-select-sm status-select-modern border shadow-sm rounded-pill" 
                                        data-id="${id}" 
                                        ${isLocked ? 'disabled' : ''}>
                                    <option value="waiting" ${data.status === 'waiting' || data.status === 'pending' ? 'selected' : ''} 
                                        ${(data.status !== 'waiting' && data.status !== 'pending') ? 'disabled' : ''}>รอรับเรื่อง</option>
                                    <option value="accepted" ${data.status === 'accepted' ? 'selected' : ''}
                                        ${(data.status === 'in-progress' || data.status === 'resolved' || data.status === 'rejected') ? 'disabled' : ''}>รับเรื่องแล้ว</option>
                                    <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}
                                        ${(data.status === 'resolved' || data.status === 'rejected') ? 'disabled' : ''}>ดำเนินการ</option>
                                    <option value="resolved" ${data.status === 'resolved' ? 'selected' : ''}>เสร็จสิ้น</option>
                                    <option value="rejected" ${data.status === 'rejected' ? 'selected' : ''}
                                        ${(data.status === 'in-progress' || data.status === 'resolved') ? 'disabled' : ''}>ไม่รับเรื่อง</option>
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
// ===== ฟังก์ชันดูรายละเอียด =====
async function handleViewDetails(complaintIdOrEvent) {
    let complaintId;

    // รองรับทั้งการเรียกจาก Event และเรียกด้วย ID โดยตรง
    if (typeof complaintIdOrEvent === 'string') {
        complaintId = complaintIdOrEvent;
    } else {
        const btn = complaintIdOrEvent.target.closest('button');
        if (!btn) return;
        complaintId = btn.dataset.id;
    }

    if (!complaintId) return;

    try {
        const doc = await complaintsCollection.doc(complaintId).get();
        if (!doc.exists) return;

        const data = doc.data();

        // สร้างเนื้อหาใน Modal แบบพรีเมียม
        const modalBody = `
            <div class="text-start admin-detail-modal">
                <div class="header-banner mb-4 p-3 rounded-4 d-flex align-items-center justify-content-between" style="background: var(--gradient-primary); color: white;">
                    <div>
                        <small class="text-white-50 d-block">Ticket ID</small>
                        <h4 class="mb-0 fw-bold">#${data.ticketId}</h4>
                    </div>
                    <div class="text-end">
                        <span class="status-badge status-${data.status || 'pending'} shadow-sm">
                            ${getStatusText(data.status)}
                        </span>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- ส่วนข้อมูลเนื้อหา -->
                    <div class="col-md-7">
                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-chat-left-text me-2 text-success"></i>หัวข้อเรื่อง</h6>
                            <p class="fs-5 fw-bold text-dark border-bottom pb-2">${data.title}</p>
                        </div>

                        <div class="row mb-4">
                            <div class="col-6">
                                <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-tag me-2 text-success"></i>หมวดหมู่</h6>
                                <p class="badge bg-light text-dark border px-3 py-2 rounded-pill mb-0">${data.category}</p>
                            </div>
                            <div class="col-6">
                                <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-geo-alt me-2 text-success"></i>สถานที่</h6>
                                <p class="badge bg-warning-subtle text-dark border border-warning-subtle px-3 py-2 rounded-pill mb-0">${data.location || '-'}</p>
                            </div>
                        </div>

                        <div class="row mb-4">
                            <div class="col-12">
                                <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-calendar-event me-2 text-success"></i>วันที่พบปัญหา</h6>
                                <p class="mb-0 text-dark fw-bold">${data.incidentDate ? new Date(data.incidentDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</p>
                            </div>
                        </div>

                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-justify-left me-2 text-success"></i>รายละเอียดเพิ่มเติม</h6>
                            <div class="p-3 bg-light rounded-4 border-start border-4 border-success-subtle" style="white-space: pre-wrap; font-size: 0.95rem; min-height: 100px;">${data.details}</div>
                        </div>

                        <div class="detail-section mb-0 p-3 rounded-4 bg-info-subtle bg-opacity-10 border border-info-subtle">
                            <h6 class="text-info fw-bold mb-2 small text-uppercase"><i class="bi bi-person-circle me-2"></i>ข้อมูลผู้แจ้ง</h6>
                            <div class="d-flex align-items-center">
                                <div class="bg-white rounded-circle p-2 me-3 border">
                                    <i class="bi bi-person-vcard text-info fs-4"></i>
                                </div>
                                <div>
                                    <div class="fw-bold text-dark">${data.reporterName}</div>
                                    <div class="small text-muted">${data.reporterEmail}</div>
                                    <div class="badge bg-info text-white mt-1 fw-normal">${data.reporterType || 'นักเรียน'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ส่วนข้อมูลรูปภาพและการตอบกลับ -->
                    <div class="col-md-5">
                        <div class="detail-section mb-4">
                            <h6 class="text-muted small text-uppercase fw-bold mb-3 text-center text-md-start"><i class="bi bi-images me-2 text-success"></i>ภาพหลักฐาน</h6>
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
                            <h6 class="text-muted small text-uppercase fw-bold mb-3"><i class="bi bi-clock-history me-2 text-success"></i>ประวัติการแก้ไข (Timeline)</h6>
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
                                    <i class="bi bi-shield-check me-2"></i>ผลดำเนินการจากผู้ดูแล
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
                popup: 'rounded-5 overflow-hidden',
                container: 'premium-swal-container'
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

    // ข้อมูลเดิม
    const doc = await complaintsCollection.doc(complaintId).get();
    const data = doc.data();

    // กรณีดำเนินการ, เสร็จสิ้น, หรือ ไม่รับเรื่อง - ใช้ Modal รูปแบบพรีเมียม
    if (newStatus === 'in-progress' || newStatus === 'resolved' || newStatus === 'rejected') {
        const isRejected = newStatus === 'rejected';

        const { value: result } = await Swal.fire({
            title: `อัพเดตข้อมูลสถานะ: ${getStatusText(newStatus)}`,
            html:
                `<div class="text-start">
                    <label class="form-label small fw-bold text-dark">${isRejected ? 'ระบุเหตุผลที่ไม่รับเรื่อง' : 'เหตุผลหรือรายละเอียดเพิ่มเติม (ถ้ามี)'}</label>
                    <textarea id="swal-feedback" class="form-control mb-3" style="border-radius: 12px; font-size: 0.9rem;" placeholder="กรอกรายละเอียด...">${data.adminFeedback || ''}</textarea>
                    
                    <label class="form-label small fw-bold text-dark">อัปโหลดรูปภาพหลักฐาน (ถ้ามี)</label>
                    <div class="input-group">
                        <input type="file" id="swal-imagefile" class="form-control" style="border-radius: 12px;" accept="image/*">
                    </div>
                    <div id="upload-status" class="small text-muted mt-2"></div>
                </div>`,
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
    }

    try {
        const updateData = {
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (feedback) updateData.adminFeedback = feedback;
        if (adminImageUrl) updateData.adminImageUrl = adminImageUrl;

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
        showAdminAlert(`อัพเดตสถานะเป็น "${getStatusText(newStatus)}" สำเร็จ`, 'success');

    } catch (error) {
        console.error("Error updating status:", error);
        showAdminAlert("อัพเดตสถานะไม่สำเร็จ กรุณาติดต่อแอดมิน", 'danger');
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
        csvContent += "Ticket ID,วันที่แจ้ง,หัวข้อเรื่อง,หมวดหมู่,สถานที่,สถานะ,ผู้ร้องเรียน,ประเภทผู้แจ้ง,รายละเอียด\n";

        snapshot.forEach(doc => {
            const d = doc.data();
            const date = d.createdAt ? d.createdAt.toDate().toLocaleDateString('th-TH') : '-';
            const row = [
                d.ticketId || '',
                date,
                `"${(d.title || '').replace(/"/g, '""')}"`,
                d.category || '',
                d.location || '',
                getStatusText(d.status),
                d.reporterName || '',
                d.reporterType || '',
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

    // 4. กราฟประเภทผู้ร้องเรียน (Doughnut Chart)
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
        'waiting': 'รอรับเรื่อง',
        'pending': 'รอรับเรื่อง',
        'accepted': 'รับเรื่องแล้ว',
        'in-progress': 'ดำเนินการ',
        'resolved': 'เสร็จสิ้น',
        'rejected': 'ไม่รับเรื่อง'
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
            Swal.fire('ไม่พบข้อมูล', 'ไม่มีรายการร้องเรียนที่ต้องการส่งออก', 'info');
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
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${getStatusText(d.status)}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${d.reporterName || '-'}</td>
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
                    <h2 style="margin:0;">รายงานสรุปผลการดำเนินงานระบบร้องเรียนออนไลน์</h2>
                    <h3 style="margin:5px 0; color:#666;">สภานักเรียนโรงเรียนสุรวิทยาคาร</h3>
                    <p style="font-size:12px;">พิมพ์เมื่อ: ${new Date().toLocaleString('th-TH')}</p>
                </div>
                
                <h4 style="border-left:5px solid #1b5e20; padding-left:10px;">รายการร้องเรียนทั้งหมด (${snapshot.size} รายการ)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Ticket ID</th>
                            <th>วันที่</th>
                            <th>หัวข้อเรื่อง</th>
                            <th>หมวดหมู่</th>
                            <th>สถานะ</th>
                            <th>ผู้แจ้ง</th>
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

// ===== ฟังก์ชันจัดการผู้ใช้งาน (User Management) =====

async function loadUsersTable() {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    try {
        // ถอน orderBy ออกชั่วคราวเพื่อป้องกัน Error เรื่อง Index ที่ยังไม่ได้สร้างใน Firestore
        const snapshot = await db.collection("users").get();
        tableBody.innerHTML = '';

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">ไม่พบข้อมูลผู้ใช้งาน</td></tr>';
            return;
        }

        // เรียงลำดับและอัปเดตยอดรวม
        const docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const countBadge = document.getElementById('userCountBadge');
        if (countBadge) countBadge.textContent = `ทั้งหมด ${docs.length} คน`;

        docs.forEach(data => {
            const id = data.id;
            const row = document.createElement('tr');

            // กำหนดสี Badge ตามตำแหน่ง
            let posClass = 'pos-sub-member';
            if (data.position === 'แอดมิน') posClass = 'pos-admin';
            else if (data.position === 'ประธานกรรมการสภานักเรียน') posClass = 'pos-president';
            else if (data.position && data.position.includes('รองประธาน')) posClass = 'pos-v-president';
            else if (data.position === 'เลขานุการคณะกรรมการสภานักเรียน') posClass = 'pos-secretary';
            else if (data.position === 'กรรมการสภานักเรียน') posClass = 'pos-member';

            // ตัวอักษรตัวแรกของชื่อสำหรับ Avatar
            const firstLetter = (data.displayName || '?').charAt(0).toUpperCase();

            row.innerHTML = `
                <td class="ps-4">
                    <span class="student-id-label">${data.studentId || '-'}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="user-avatar-placeholder me-3">${firstLetter}</div>
                        <div class="fw-bold text-dark">${data.displayName || '-'}</div>
                    </div>
                </td>
                <td>
                    <span class="pos-badge ${posClass}">
                        <i class="bi bi-patch-check-fill"></i> ${data.position || '-'}
                    </span>
                </td>
                <td><span class="text-muted small">${data.email || '-'}</span></td>
                <td class="pe-4 text-center">
                    <div class="manage-btn-group">
                        <button class="btn btn-edit-user edit-user-btn shadow-sm" 
                                data-id="${id}" title="แก้ไขข้อมูล">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-outline-warning btn-sm border-0 reset-password-btn shadow-sm" 
                                data-id="${id}" data-studentid="${data.studentId}" data-name="${data.displayName}" data-pos="${data.position}"
                                title="เปลี่ยนรหัสผ่านให้สมาชิก"
                                style="background: #fff8e1; color: #ffa000; border-radius: 10px; width: 36px; height: 36px;">
                            <i class="bi bi-key-fill"></i>
                        </button>
                        <button class="btn btn-delete-user delete-user-btn shadow-sm" 
                                data-id="${id}" data-email="${data.email}" title="ลบผู้ใช้งาน"
                                ${data.role === 'superadmin' ? 'disabled' : ''}>
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for edit buttons
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.dataset.id;
                handleEditUser(uid);
            });
        });

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const uid = e.currentTarget.dataset.id;
                const email = e.currentTarget.dataset.email;
                handleDeleteUser(uid, email);
            });
        });

        // Add event listeners for reset password buttons
        document.querySelectorAll('.reset-password-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const dataset = e.currentTarget.dataset;
                handleForceResetPassword(dataset.id, dataset.studentid, dataset.name, dataset.pos);
            });
        });

    } catch (error) {
        console.error("Error loading users:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
    }
}

async function handleAddUser() {
    const { value: formValues } = await Swal.fire({
        title: 'เพิ่มผู้ใช้งานใหม่',
        html:
            `<div class="text-start mb-3">
                <label class="form-label">เลขประจำตัว 5 หลัก (Username)</label>
                <input id="swal-input1" class="form-control mb-3" placeholder="เช่น 12345" maxlength="5">
                
                <label class="form-label">ชื่อ-นามสกุล</label>
                <input id="swal-input2" class="form-control mb-3" placeholder="ระบุชื่อผู้ใช้งาน">
                
                <label class="form-label">รหัสผ่าน</label>
                <input id="swal-input3" type="password" class="form-control mb-3" placeholder="กำหนดรหัสผ่าน">
                
                <label class="form-label">ตำแหน่ง</label>
                <select id="swal-input4" class="form-select mb-3">
                    ${POSITIONS.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
            </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1b5e20',
        preConfirm: () => {
            const studentId = document.getElementById('swal-input1').value;
            const displayName = document.getElementById('swal-input2').value;
            const password = document.getElementById('swal-input3').value;
            const position = document.getElementById('swal-input4').value;

            if (!/^\d{5}$/.test(studentId)) {
                Swal.showValidationMessage('กรุณากรอกเลขประจำตัว 5 หลักให้ถูกต้อง');
                return false;
            }
            if (!displayName || !password) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                return false;
            }
            if (password.length < 6) {
                Swal.showValidationMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
                return false;
            }

            return { studentId, displayName, password, position };
        }
    });

    if (formValues) {
        try {
            Swal.fire({
                title: 'กำลังบันทึกข้อมูล...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            // สร้าง Email จำลองสำหรับ Firebase Auth
            const email = `${formValues.studentId}@council.internal`;

            // ใช้ Secondary App Trick เพื่อสร้าง User โดยไม่หลุดจาก Session ปัจจุบัน
            const secondaryApp = firebase.initializeApp(firebaseConfig, "secondary");
            const secondaryAuth = secondaryApp.auth();

            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, formValues.password);
            const uid = userCredential.user.uid;

            // บันทึกลง Firestore
            await db.collection("users").doc(uid).set({
                studentId: formValues.studentId,
                displayName: formValues.displayName,
                email: email,
                position: formValues.position,
                role: formValues.position === 'แอดมิน' ? 'admin' : 'staff',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // ลบ Secondary App
            await secondaryApp.delete();

            Swal.fire('สำเร็จ', 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว', 'success');
            loadUsersTable();

        } catch (error) {
            console.error("Error adding user:", error);
            let msg = 'ไม่สามารถเพิ่มผู้ใช้งานได้';
            if (error.code === 'auth/email-already-in-use') msg = 'เลขประจำตัวนี้มีอยู่ในระบบแล้ว';
            Swal.fire('ผิดพลาด', msg + ' (' + error.message + ')', 'error');
        }
    }
}

async function handleDeleteUser(uid, email) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบผู้ใช้งาน ${email} หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ยืนยันการลบ',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        try {
            await db.collection("users").doc(uid).delete();
            Swal.fire('สำเร็จ', 'ลบผู้ใช้งานเรียบร้อยแล้ว', 'success');
            loadUsersTable();
        } catch (error) {
            console.error("Error deleting user:", error);
            Swal.fire('ผิดพลาด', 'ไม่สามารถลบผู้ใช้งานได้', 'error');
        }
    }
}

// ===== ฟังก์ชันจัดการรหัสผ่าน =====

async function handleChangeOwnPassword() {
    const { value: formValues } = await Swal.fire({
        title: 'เปลี่ยนรหัสผ่านใหม่',
        html:
            `<div class="text-start mb-3">
                <label class="form-label">รหัสผ่านใหม่</label>
                <input id="swal-new-password" type="password" class="form-control mb-3" placeholder="ระบุรหัสผ่านใหม่">
                <label class="form-label">ยืนยันรหัสผ่านใหม่</label>
                <input id="swal-confirm-password" type="password" class="form-control mb-3" placeholder="ระบุรหัสผ่านใหม่อีกครั้ง">
                <small class="text-muted">หมายเหตุ: คุณอาจถูกให้ออกจากระบบและต้องล็อกอินใหม่เพื่อความปลอดภัย</small>
            </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'อัปเดตรหัสผ่าน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1b5e20',
        preConfirm: () => {
            const newPass = document.getElementById('swal-new-password').value;
            const confirmPass = document.getElementById('swal-confirm-password').value;

            if (!newPass || !confirmPass) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                return false;
            }
            if (newPass.length < 6) {
                Swal.showValidationMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
                return false;
            }
            if (newPass !== confirmPass) {
                Swal.showValidationMessage('รหัสผ่านไม่ตรงกัน');
                return false;
            }

            return newPass;
        }
    });

    if (formValues) {
        try {
            Swal.fire({
                title: 'กำลังอัปเดตรหัสผ่าน...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            await currentUser.updatePassword(formValues);

            await Swal.fire({
                icon: 'success',
                title: 'สำเร็จ',
                text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
                confirmButtonColor: '#1b5e20'
            });

            // ออกจากระบบเพื่อให้ล็อกอินใหม่ด้วยรหัสใหม่
            handleAdminLogout();

        } catch (error) {
            console.error("Change password error:", error);
            if (error.code === 'auth/requires-recent-login') {
                Swal.fire('ความปลอดภัยสูง', 'กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่หนึ่งครั้ง ก่อนทำการเปลี่ยนรหัสผ่าน', 'info');
            } else {
                Swal.fire('ผิดพลาด', 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + error.message, 'error');
            }
        }
    }
}

async function handleForceResetPassword(uid, studentId, name, position) {
    const result = await Swal.fire({
        title: 'เปลี่ยนรหัสผ่านให้สมาชิก',
        text: `เนื่องจากนโยบายความปลอดภัยของ Firebase แอดมินต้อง "ลบบัญชีเดิม" แล้วกด "เพิ่มใหม่ด้วยรหัสใหม่" ครับ (ระบบจะช่วยกรอกข้อมูลอัตโนมัติ)`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#1b5e20',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ตกลง, เริ่มขั้นตอน',
        cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
        // ขั้นตอนที่ 1: ลบผู้ใช้เดิม
        const deleteConfirm = await Swal.fire({
            title: 'ยืนยันการลบบัญชีเก่า?',
            text: `คุณกำลังจะลบบัญชี ${name} เพื่อเตรียมสร้างใหม่ด้วยรหัสใหม่`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ลบข้อมูลเดิม'
        });

        if (deleteConfirm.isConfirmed) {
            try {
                await db.collection("users").doc(uid).delete();

                // ขั้นตอนที่ 2: เปิดหน้าต่างเพิ่มผู้ใช้ใหม่พร้อมกรอกข้อมูลเดิมให้
                Swal.fire({
                    title: 'กำลังเตรียมระบบ...',
                    timer: 1000,
                    didOpen: () => { Swal.showLoading(); }
                }).then(() => {
                    // เรียกฟังก์ชันเพิ่มผู้ใช้พร้อม Pre-fill ข้อมูล
                    handleAddUserWithDefault(studentId, name, position);
                });
            } catch (error) {
                Swal.fire('ผิดพลาด', 'ไม่สามารถลบข้อมูลได้: ' + error.message, 'error');
            }
        }
    }
}

async function handleAddUserWithDefault(defaultId, defaultName, defaultPos) {
    const { value: formValues } = await Swal.fire({
        title: 'กำหนดรหัสผ่านใหม่',
        html:
            `<div class="text-start mb-3">
                <p class="small text-muted mb-4">ระบบได้ดึงข้อมูลเดิมมาให้แล้ว กรุณากำหนดรหัสผ่านใหม่ที่ต้องการ</p>
                <label class="form-label">เลขประจำตัว 5 หลัก</label>
                <input id="swal-input1" class="form-control mb-3 bg-light" value="${defaultId}" readonly>
                
                <label class="form-label">ชื่อ-นามสกุล</label>
                <input id="swal-input2" class="form-control mb-3" value="${defaultName}" placeholder="ระบุชื่อผู้ใช้งาน">
                
                <label class="form-label">รหัสผ่านใหม่</label>
                <input id="swal-input3" type="password" class="form-control mb-3" placeholder="ระบุรหัสผ่านใหม่ที่ต้องการ">
                
                <label class="form-label">ตำแหน่ง</label>
                <select id="swal-input4" class="form-select mb-3">
                    ${POSITIONS.map(p => `<option value="${p}" ${p === defaultPos ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
            </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึกรหัสผ่านใหม่',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1b5e20',
        preConfirm: () => {
            const studentId = document.getElementById('swal-input1').value;
            const displayName = document.getElementById('swal-input2').value;
            const password = document.getElementById('swal-input3').value;
            const position = document.getElementById('swal-input4').value;

            if (!password || password.length < 6) {
                Swal.showValidationMessage('กรุณากำหนดรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)');
                return false;
            }

            return { studentId, displayName, password, position };
        }
    });

    if (formValues) {
        // ใช้ตรรกะเดียวกับ handleAddUser
        try {
            Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
            const email = `${formValues.studentId}@council.internal`;
            const secondaryApp = firebase.initializeApp(firebaseConfig, "secondary-reset-" + Date.now());
            const secondaryAuth = secondaryApp.auth();
            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, formValues.password);
            const uid = userCredential.user.uid;
            await db.collection("users").doc(uid).set({
                studentId: formValues.studentId,
                displayName: formValues.displayName,
                email: email,
                position: formValues.position,
                role: formValues.position === 'แอดมิน' ? 'admin' : 'staff',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await secondaryApp.delete();
            Swal.fire('สำเร็จ', 'เปลี่ยนรหัสผ่านให้สมาชิกเรียบร้อยแล้ว', 'success');
            loadUsersTable();
        } catch (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถสร้างบัญชีใหม่ได้: ' + error.message, 'error');
        }
    } else {
        // ถ้ากดยกเลิกกลางคัน ให้โหลดตารางใหม่ (ข้อมูล Firestore เดิมถูกลบไปแล้วแต่ใน Auth อาจยังอยู่ถ้าเกิด Error)
        loadUsersTable();
    }
}

async function handleSendResetLink(email) {
    // ฟังก์ชันเดิมสำรองไว้สำหรับคนที่มีอีเมลจริง
    try {
        await auth.sendPasswordResetEmail(email);
        Swal.fire('สำเร็จ', `ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email} เรียบร้อยแล้ว`, 'success');
    } catch (error) {
        Swal.fire('ผิดพลาด', error.message, 'error');
    }
}



async function handleEditUser(uid) {
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();

        const { value: formValues } = await Swal.fire({
            title: 'แก้ไขข้อมูลผู้ใช้งาน',
            html:
                `<div class="text-start mb-3">
                    <label class="form-label">เลขประจำตัว 5 หลัก (ไม่สามารถแก้ไขได้)</label>
                    <input id="swal-edit-input1" class="form-control mb-3 bg-light" value="${userData.studentId || ''}" readonly>
                    
                    <label class="form-label">ชื่อ-นามสกุล</label>
                    <input id="swal-edit-input2" class="form-control mb-3" value="${userData.displayName || ''}" placeholder="ระบุชื่อผู้ใช้งาน">
                    
                    <label class="form-label">ตำแหน่ง</label>
                    <select id="swal-edit-input3" class="form-select mb-3">
                        ${POSITIONS.map(p => `<option value="${p}" ${userData.position === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                    <small class="text-muted">หมายเหตุ: หากต้องการเปลี่ยนรหัสผ่าน กรุณาลบและเพิ่มผู้ใช้ใหม่</small>
                </div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'บันทึกการแก้ไข',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#1b5e20',
            preConfirm: () => {
                const displayName = document.getElementById('swal-edit-input2').value;
                const position = document.getElementById('swal-edit-input3').value;

                if (!displayName) {
                    Swal.showValidationMessage('กรุณากรอกชื่อ-นามสกุล');
                    return false;
                }

                return { displayName, position };
            }
        });

        if (formValues) {
            Swal.fire({
                title: 'กำลังบันทึกการแก้ไข...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            await db.collection("users").doc(uid).update({
                displayName: formValues.displayName,
                position: formValues.position,
                role: formValues.position === 'แอดมิน' ? 'admin' : 'staff',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            Swal.fire('สำเร็จ', 'แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
            loadUsersTable();
        }
    } catch (error) {
        console.error("Error editing user:", error);
        Swal.fire('ผิดพลาด', 'ไม่สามารถแก้ไขข้อมูลได้', 'error');
    }
}
// ===== ฟังก์ชันแสดงผลปฏิทินสรุปรายวัน =====
function renderComplaintCalendar(dailyCounts) {
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;

    const now = new Date();
    const year = calendarSelectedYear;
    const month = calendarSelectedMonth;

    // หาจำนวนวันในเดือนและวันแรกของเดือน
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    calendarGrid.innerHTML = '';

    // วันว่างช่วงต้นเดือน (เพื่อให้วันที่ 1 ตรงตามวันจริง)
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }

    // สร้างวันที่ 1 จนถึงวันสุดท้ายของเดือน
    for (let day = 1; day <= daysInMonth; day++) {
        const count = dailyCounts[day] || 0;
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
        const dateToCheck = new Date(year, month, day);
        const isFuture = dateToCheck > now;

        if (isToday) {
            dayCell.classList.add('today');
        }

        if (isFuture) {
            dayCell.classList.add('future-day');
            dayCell.title = "ไม่สามารถดูข้อมูลล่วงหน้าได้";
        } else if (count > 0) {
            dayCell.classList.add('has-data');
            // ถ้ามีการร้องเรียนเยอะ (มากกว่า 5 เรื่อง) ให้ใช้สีแดงแจ้งเตือน
            if (count > 5) dayCell.classList.add('has-data-high');

            // ทำให้กดดูรายละเอียดได้
            dayCell.style.cursor = 'pointer';
            dayCell.addEventListener('click', () => showDailyDetails(day, month, year));
        } else {
            // วันในอดีตที่ไม่มีข้อมูล
            dayCell.classList.add('no-data');
        }

        dayCell.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="complaint-count-wrapper">
                <span class="complaint-count-badge" title="${count} เรื่อง">${count}</span>
            </div>
        `;
        calendarGrid.appendChild(dayCell);
    }
}

async function showDailyDetails(day, month, year) {
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    const dateStr = `${day} ${months[month]} ${year + 543}`;

    // ฟังก์ชันย่อยสำหรับโหลดและสร้าง HTML รายการ
    const loadAndRenderList = async (targetElement) => {
        try {
            const startOfDay = new Date(year, month, day);
            const endOfDay = new Date(year, month, day, 23, 59, 59);

            const snapshot = await complaintsCollection
                .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
                .where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
                .get();

            if (snapshot.empty) {
                targetElement.innerHTML = `
                    <div class="text-center py-5">
                        <i class="bi bi-clipboard-x text-muted" style="font-size: 3rem;"></i>
                        <p class="mt-3 text-muted">ไม่พบข้อมูลการร้องเรียนในวันนี้</p>
                    </div>`;
                return;
            }

            let html = '';
            snapshot.docs.forEach((doc, index) => {
                const data = doc.data();
                const docId = doc.id;
                const isLocked = data.status === 'resolved' || data.status === 'rejected';

                html += `
                    <div class="daily-complaint-item" style="animation-delay: ${index * 0.1}s">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <span class="daily-ticket-badge">#${data.ticketId}</span>
                            <span class="status-badge status-${data.status || 'pending'} shadow-sm">
                                 <i class="bi bi-dot fs-4"></i>${getStatusText(data.status)}
                            </span>
                        </div>
                        
                        <div class="daily-title">${data.title}</div>
                        <div class="daily-desc">${data.details ? (data.details.length > 180 ? data.details.substring(0, 180) + '...' : data.details) : 'ไม่มีรายละเอียดเพิ่มเติม'}</div>
                        
                        <div class="daily-meta-grid">
                            <div class="daily-meta-item">
                                <i class="bi bi-folder2-open"></i>
                                <span>${data.category}</span>
                            </div>
                            <div class="daily-meta-item">
                                <i class="bi bi-person-badge"></i>
                                <span>${data.reporterName || 'ไม่ระบุตัวตน'}</span>
                            </div>
                            <div class="daily-meta-item">
                                <i class="bi bi-geo-alt"></i>
                                <span>${data.location || 'ไม่ระบุสถานที่'}</span>
                            </div>
                        </div>

                        <!-- เพิ่มส่วนการเปลี่ยนสถานะแบบด่วน -->
                        <div class="daily-action-row d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                            <div class="quick-status-change-wrapper">
                                <label class="status-label-v3"><i class="bi bi-lightning-fill text-warning"></i>เปลี่ยนสถานะด่วน</label>
                                <select class="status-select-daily" 
                                        data-id="${docId}" 
                                        ${isLocked ? 'disabled' : ''}>
                                    <option value="waiting" ${data.status === 'waiting' || data.status === 'pending' ? 'selected' : ''}>รอรับเรื่อง</option>
                                    <option value="accepted" ${data.status === 'accepted' ? 'selected' : ''}>รับเรื่องแล้ว</option>
                                    <option value="in-progress" ${data.status === 'in-progress' ? 'selected' : ''}>ดำเนินการ</option>
                                    <option value="resolved" ${data.status === 'resolved' ? 'selected' : ''}>เสร็จสิ้น</option>
                                    <option value="rejected" ${data.status === 'rejected' ? 'selected' : ''}>ไม่รับเรื่อง</option>
                                </select>
                            </div>
                            <button class="btn daily-manage-link" onclick="handleViewDetails('${docId}')">
                                <i class="bi bi-pencil-square"></i> รายละเอียด/จัดการ
                            </button>
                        </div>
                    </div>
                `;
            });
            targetElement.innerHTML = html;

            // ผูก Event Listener ใหม่ทุกครั้งที่เรนเดอร์
            targetElement.querySelectorAll('.status-select-daily').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const originalStatus = e.target.getAttribute('data-original-status');
                    const confirmed = await handleStatusChange(e);

                    // หลังจากเปลี่ยนสถานะเสร็จ ให้รีเฟรชหน้าต่างนี้ด้วย
                    loadAndRenderList(targetElement);
                });
            });

        } catch (error) {
            console.error("Error fetching daily details:", error);
            targetElement.innerHTML =
                '<div class="alert alert-danger shadow-sm rounded-4">เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + error.message + '</div>';
        }
    };

    Swal.fire({
        title: `รายการร้องเรียนวันที่ ${dateStr}`,
        html: '<div id="dailyComplaintsList" class="text-start" style="max-height: 65vh; overflow-y: auto; padding: 10px;"></div>',
        width: '800px',
        showConfirmButton: false,
        showCloseButton: true,
        background: '#f8fafc',
        customClass: {
            container: 'premium-swal-container',
            title: 'fw-bold text-success pt-4'
        },
        didOpen: () => {
            const listEl = document.getElementById('dailyComplaintsList');
            listEl.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success" role="status"></div><p class="mt-2 text-muted">กำลังโหลดข้อมูล...</p></div>';
            loadAndRenderList(listEl);
        }
    });
}

// ===== ฟังก์ชันจัดการตัวเลือกปฏิทิน =====
function initCalendarSelectors() {
    const monthSelect = document.getElementById('calendarMonthSelect');
    const yearSelect = document.getElementById('calendarYearSelect');
    const todayBtn = document.getElementById('calendarTodayBtn');

    if (!monthSelect || !yearSelect) return;

    // เติมรายชื่อเดือน
    const months = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    months.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        opt.selected = i === calendarSelectedMonth;
        monthSelect.appendChild(opt);
    });

    // เติมปี (2569 - 2570)
    for (let y = 2026; y <= 2027; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + 543; // พ.ศ.
        opt.selected = y === calendarSelectedYear;
        yearSelect.appendChild(opt);
    }

    // Event Listeners
    monthSelect.addEventListener('change', (e) => {
        const newMonth = parseInt(e.target.value);
        const checkDate = new Date(calendarSelectedYear, newMonth, 1);
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        if (checkDate > currentMonthStart) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่สามารถดูข้อมูลล่วงหน้าได้',
                text: 'กรุณาเลือกเดือนปัจจุบันหรือย้อนหลัง',
                confirmButtonColor: '#1b5e20'
            });
            e.target.value = calendarSelectedMonth;
            return;
        }

        calendarSelectedMonth = newMonth;
        loadStatistics(); // รีโหลดสถิติเพื่อคำนวณ dailyCounts ใหม่
    });

    yearSelect.addEventListener('change', (e) => {
        const newYear = parseInt(e.target.value);
        const now = new Date();

        if (newYear > now.getFullYear()) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่สามารถดูข้อมูลล่วงหน้าได้',
                text: 'กรุณาเลือกปีปัจจุบันหรือย้อนหลัง',
                confirmButtonColor: '#1b5e20'
            });
            e.target.value = calendarSelectedYear;
            return;
        }

        calendarSelectedYear = newYear;

        // ถ้าเปลี่ยนปีแล้ว เดือนที่เลือกอยู่เป็นอนาคต ให้ปรับเป็นเดือนปัจจุบัน
        if (calendarSelectedYear === now.getFullYear() && calendarSelectedMonth > now.getMonth()) {
            calendarSelectedMonth = now.getMonth();
            monthSelect.value = calendarSelectedMonth;
        }

        loadStatistics();
    });

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const now = new Date();
            calendarSelectedMonth = now.getMonth();
            calendarSelectedYear = now.getFullYear();

            monthSelect.value = calendarSelectedMonth;
            yearSelect.value = calendarSelectedYear;

            loadStatistics();
        });
    }
}
