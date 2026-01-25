// ===== ตัวแปร Global =====
let complaintsCollection;
let selectedFiles = []; // เก็บไฟล์รูปภาพที่เลือกไว้

// ===== ฟังก์ชันเริ่มต้น =====
document.addEventListener('DOMContentLoaded', function () {
    // กำหนด collection reference
    complaintsCollection = db.collection("complaints");

    // ตั้งค่า Event Listeners
    setupEventListeners();
});

// ===== ตั้งค่า Event Listeners =====
function setupEventListeners() {
    // ฟอร์มแจ้งเรื่อง
    const complaintForm = document.getElementById('complaintForm');
    if (complaintForm) {
        complaintForm.addEventListener('submit', handleComplaintSubmit);
    }

    // ปุ่มติดตามสถานะ
    const trackBtn = document.getElementById('trackBtn');
    if (trackBtn) {
        trackBtn.addEventListener('click', handleTrackStatus);
    }

    // ฟังก์ชันเมื่อกด Enter ในช่องค้นหา (ถ้ามี)
    // สำหรับระบบใหม่ที่เลือกจาก dropdown ไม่จำเป็นต้องใช้ Enter แต่เก็บโครงสร้างไว้เผื่อขยายผล

    // แสดงตัวอย่างรูปภาพเมื่อเลือกไฟล์ (หลายรูป)
    const imageUpload = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (imageUpload && previewContainer) {
        imageUpload.addEventListener('change', function () {
            const files = Array.from(this.files);

            // ตรวจสอบจำนวนไฟล์ (จำกัด 8 รูป)
            if (files.length + selectedFiles.length > 8) {
                Swal.fire({
                    title: 'เกินขีดจำกัด!',
                    text: 'สามารถเลือกรูปภาพได้ไม่เกิน 8 รูปครับ',
                    icon: 'warning',
                    confirmButtonColor: '#1b5e20'
                });
                this.value = '';
                return;
            }

            // ตรวจสอบขนาดรวม (จำกัด 10MB)
            const totalSize = files.reduce((acc, file) => acc + file.size, 0);
            const existingSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

            if ((totalSize + existingSize) > 10 * 1024 * 1024) {
                Swal.fire({
                    title: 'ไฟล์ใหญ่เกินไป!',
                    text: 'ขนาดไฟล์รวมกันต้องไม่เกิน 10MB ครับ',
                    icon: 'warning',
                    confirmButtonColor: '#1b5e20'
                });
                this.value = '';
                return;
            }

            files.forEach(file => {
                // เก็บไฟล์ไว้ใน array Global
                selectedFiles.push(file);

                // สร้างพรีวิว
                const reader = new FileReader();
                reader.onload = function (e) {
                    const col = document.createElement('div');
                    col.className = 'col-4 col-md-3 preview-item-container';

                    const index = selectedFiles.length - 1;
                    col.innerHTML = `
                        <div class="preview-item">
                            <img src="${e.target.result}" alt="Preview">
                            <button type="button" class="remove-img-btn" onclick="removeImage(${index}, this)">
                                <i class="bi bi-x"></i>
                            </button>
                        </div>
                    `;
                    previewContainer.appendChild(col);
                }
                reader.readAsDataURL(file);
            });

            // รีเซ็ต input เพื่อให้เลือกไฟล์ซ้ำได้
            this.value = '';
        });
    }

    // จัดการตัวเลือกไม่ระบุตัวตน (เอาออก)
    // ===== Cookie Consent Logic =====
    const cookieConsent = document.getElementById('cookieConsent');
    const acceptCookies = document.getElementById('acceptCookies');
    const declineCookies = document.getElementById('declineCookies');

    if (cookieConsent && !localStorage.getItem('cookieConsent')) {
        // แสดง Banner หลังจากโหลดหน้า 1.5 วินาที
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



    // จัดการการเลือกหมวดหมู่ "อื่นๆ"
    const categorySelect = document.getElementById('category');
    const otherCategoryGroup = document.getElementById('otherCategoryGroup');
    const otherCategoryInput = document.getElementById('otherCategory');

    if (categorySelect) {
        categorySelect.addEventListener('change', function () {
            if (this.value === 'อื่นๆ') {
                otherCategoryGroup.style.display = 'block';
                otherCategoryInput.required = true;
                otherCategoryInput.focus();
            } else {
                otherCategoryGroup.style.display = 'none';
                otherCategoryInput.required = false;
                otherCategoryInput.value = '';
            }
        });
    }

    // จัดการการเลือกประเภทผู้แจ้ง "อื่นๆ"
    const reporterTypeSelect = document.getElementById('reporterType');
    const otherReporterTypeGroup = document.getElementById('otherReporterTypeGroup');
    const otherReporterTypeInput = document.getElementById('otherReporterType');

    if (reporterTypeSelect) {
        reporterTypeSelect.addEventListener('change', function () {
            if (this.value === 'อื่นๆ') {
                otherReporterTypeGroup.style.display = 'block';
                otherReporterTypeInput.required = true;
                otherReporterTypeInput.focus();
            } else {
                otherReporterTypeGroup.style.display = 'none';
                otherReporterTypeInput.required = false;
                otherReporterTypeInput.value = '';
            }
        });
    }
}

// ===== ฟังก์ชันจัดการฟอร์มแจ้งเรื่อง =====
async function handleComplaintSubmit(e) {
    e.preventDefault();

    // Disable ปุ่ม submit
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังส่ง...';
    submitBtn.disabled = true;

    try {
        // เก็บค่าจากฟอร์ม
        const reporterEmail = document.getElementById('reporterEmail').value;
        const ticketId = "SN-" + Date.now().toString().slice(-6); // สร้าง ID ภายในสำหรับการอ้างอิง ระบบจะไม่โชว์ให้ user อีกแล้ว

        let finalCategory = document.getElementById('category').value;
        if (finalCategory === 'อื่นๆ') {
            finalCategory = `อื่นๆ (${document.getElementById('otherCategory').value})`;
        }

        let finalReporterType = document.getElementById('reporterType').value;
        if (finalReporterType === 'อื่นๆ') {
            finalReporterType = `อื่นๆ (${document.getElementById('otherReporterType').value})`;
        }
        const complaintData = {
            category: finalCategory,
            roomNumber: document.getElementById('roomNumber').value,
            reporterType: finalReporterType,
            details: document.getElementById('details').value,
            reporterEmail: reporterEmail,
            status: "waiting",
            createdAt: timestamp(),
            updatedAt: timestamp(),
            ticketId: ticketId,
            privacyConsent: document.getElementById('privacyConsent').checked,
            imageUrls: [],
            activities: [
                {
                    action: "ส่งผลงานเข้าประกวด",
                    status: "waiting",
                    timestamp: new Date(),
                    details: "ตัวแทนห้องส่งข้อมูลความสะอาดเข้าสู่ระบบ"
                }
            ],
            isDuplicate: false,
            duplicateOf: null
        };

        // ===== ตรวจสอบเรื่องซ้ำอัตโนมัติ (Duplicate Detection) =====
        // ต้องเป็นห้องเดียวกัน (Room SAME) และ ระดับชั้นเดียวกัน (Category SAME)
        const duplicateSnapshot = await complaintsCollection
            .where("category", "==", finalCategory)
            .where("roomNumber", "==", complaintData.roomNumber)
            .where("status", "in", ["waiting", "pending", "accepted", "in-progress"]) // เช็คเฉพาะที่ยังไม่เสร็จ
            .get();

        if (!duplicateSnapshot.empty) {
            // แจ้งเตือนนักเรียนและหยุดการส่งทันที เพื่อไม่ให้เกิดข้อมูลซ้ำซ้อน
            await Swal.fire({
                title: 'ตรวจพบการส่งข้อมูลซ้ำ!',
                html: `ห้อง <b>${complaintData.roomNumber}</b> ในระดับชั้น <b>${complaintData.category}</b> มีการส่งข้อมูลไว้แล้วในระบบและกำลังรอการตรวจสอบ<br><br>คุณสามารถตรวจสอบผลคะแนนได้จากเมนูด้านล่างครับ`,
                icon: 'info',
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#1b5e20',
            });

            // คืนสถานะปุ่มและหยุดการทำงาน
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            return;
        }

        // อัปโหลดรูปภาพทั้งหมด (ถ้ามี) ไปยัง ImgBB
        if (selectedFiles.length > 0) {
            const uploadPromises = selectedFiles.map(file => uploadToImgBB(file));
            complaintData.imageUrls = await Promise.all(uploadPromises);
            // กรองเอาเฉพาะ URL ที่อัปโหลดสำเร็จ (ไม่ใช่ null)
            complaintData.imageUrls = complaintData.imageUrls.filter(url => url !== null);
        }

        // บันทึกข้อมูลไปยัง Firestore
        const docRef = await complaintsCollection.add(complaintData);

        // ส่งอีเมลแจ้ง Ticket ID ผ่าน EmailJS
        sendEmailNotification(complaintData);

        // แสดงผลสำเร็จ
        showSuccessModal(complaintData.ticketId);

        // รีเซ็ตฟอร์ม
        e.target.reset();
        // รีเซ็ตหน้าตาฟอร์ม
        selectedFiles = [];
        const previewContainer = document.getElementById('imagePreviewContainer');
        if (previewContainer) previewContainer.innerHTML = '';

        if (document.getElementById('otherCategoryGroup')) document.getElementById('otherCategoryGroup').style.display = 'none';
        if (document.getElementById('otherReporterTypeGroup')) document.getElementById('otherReporterTypeGroup').style.display = 'none';
        document.getElementById('privacyConsent').checked = false;

    } catch (error) {
        console.error("Error submitting complaint:", error);
        Swal.fire({
            title: 'เกิดข้อผิดพลาด!',
            text: 'ไม่สามารถส่งข้อมูลได้: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#1b5e20'
        });
    } finally {
        // คืนสถานะปุ่ม
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ===== ฟังก์ชันส่งอีเมลแจ้ง Ticket ID =====
// ===== ฟังก์ชันอัปโหลดรูปภาพไปยัง ImgBB =====
async function uploadToImgBB(file) {
    const apiKey = "46dfbc930533d4e9c142365ba306242b"; // ⚠️ วาง API Key ที่ก๊อปมาจาก api.imgbb.com ที่นี่

    if (!apiKey || apiKey === "YOUR_IMGBB_API_KEY") {
        console.error("⚠️ กรุณาใส่ ImgBB API Key ในไฟล์ script.js");
        return null;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            console.log("✅ อัปโหลดรูปสำเร็จ:", result.data.url);
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

// ===== ฟังก์ชันส่งอีเมลแจ้ง Ticket ID ผ่าน Google Apps Script =====
async function sendEmailNotification(data) {
    // ⚠️ นำ URL จากการ Deploy Google Apps Script (Web App) มาวางที่นี่
    const scriptURL = "https://script.google.com/macros/s/AKfycbwIrhfWhuU9cNWWvCv1Z9Fx5dqLwoqcb6zdkvn6khm1JgAQPSjPqPDAQ2LC1MJovTJD/exec"; // เปลี่ยนเป็น URL ของคุณ

    if (!scriptURL || scriptURL.includes("AKfycby")) {
        console.warn("⚠️ Google Apps Script: กรุณาใส่ URL ของ Web App ในฟังก์ชัน sendEmailNotification ในไฟล์ script.js");
        // เราจะไม่รบกวนหน้าหลักถ้ายังไม่ได้ตั้งค่า
        return;
    }

    const payload = {
        to_email: data.reporterEmail,
        to_name: data.reporterName,
        ticket_id: data.ticketId,
        title: data.title,
        category: data.category,
        date: new Date().toLocaleDateString('th-TH')
    };

    try {
        // ใช้ fetch ร่วมกับ mode: 'no-cors' เพื่อเลี่ยงปัญหา CORS กับ Google Apps Script 
        // เมื่อส่งแบบ POST (ข้อมูลจะยังไปถึง Apps Script)
        await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        console.log('✅ EMAIL NOTIFICATION REQUEST SENT');
    } catch (error) {
        console.error('❌ EMAIL NOTIFICATION FAILED:', error);
    }
}

// ===== ฟังก์ชันลบรูปภาพที่เลือก =====
function removeImage(index, btn) {
    // ลบออกจาก array
    selectedFiles.splice(index, 1);

    // ลบเอาอิลิเมนต์ออกจากหน้าจอ
    const container = btn.closest('.preview-item-container');
    container.remove();

    // อัปเดต index ของปุ่มลบที่เหลือ (เพื่อความถูกต้อง)
    const allButtons = document.querySelectorAll('.remove-img-btn');
    allButtons.forEach((button, newIndex) => {
        button.setAttribute('onclick', `removeImage(${newIndex}, this)`);
    });
}

// Ticket ID generation removed - tracking now uses Class/Room




// ===== ฟังก์ชันติดตามสถานะ (ค้นหาตามห้องเรียน) =====
async function handleTrackStatus() {
    const category = document.getElementById('trackCategory').value;
    const roomNumber = document.getElementById('trackRoomNumber').value;
    const trackingResult = document.getElementById('trackingResult');
    const noResult = document.getElementById('noResult');

    if (!category || !roomNumber) {
        showAlert("กรุณาเลือกเลือกระดับชั้นและห้องเรียน", "warning");
        return;
    }

    try {
        // ค้นหาข้อมูลจาก Firestore - เอาอันล่าสุด (createdAt desc)
        const querySnapshot = await complaintsCollection
            .where("category", "==", category)
            .where("roomNumber", "==", roomNumber)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();

        // แสดงข้อมูลที่พบ
        if (querySnapshot.empty) {
            Swal.fire({
                title: 'ไม่พบข้อมูล',
                text: 'ยังไม่พบข้อมูลการส่งผลงานของห้องเรียนนี้ในระบบครับ',
                icon: 'warning',
                confirmButtonColor: '#1b5e20'
            });
            return;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        document.getElementById('resultClassDisplay').textContent = `${data.category} ห้อง ${data.roomNumber}`;
        document.getElementById('resultClassInfo').textContent = `${data.category} ห้อง ${data.roomNumber}`;
        document.getElementById('resultScore').textContent = data.score || '-';
        document.getElementById('resultStatus').textContent = data.status === 'resolved' ? (data.updatedAt ? data.updatedAt.toDate().toLocaleDateString('th-TH') : '-') : getStatusText(data.status);

        // อัปเดตข้อมูลอื่นๆ
        if (document.getElementById('resultReporterType')) document.getElementById('resultReporterType').textContent = data.reporterType || '-';
        if (document.getElementById('resultCategory')) document.getElementById('resultCategory').textContent = data.category || '-';

        // แสดง Admin Feedback (ถ้ามี)
        const feedbackContainer = document.getElementById('adminFeedbackContainer');
        if (data.adminFeedback || data.adminImageUrl) {
            feedbackContainer.classList.remove('d-none');
            document.getElementById('adminFeedbackText').textContent = data.adminFeedback || 'ไม่มีรายละเอียดเพิ่มเติม';

            const adminImage = document.getElementById('adminFeedbackImage');
            const adminImageLink = document.getElementById('adminFeedbackImageLink');
            const imageContainer = adminImage.closest('.d-none'); // Find the hidden container div

            if (data.adminImageUrl) {
                adminImage.src = data.adminImageUrl;
                adminImageLink.href = data.adminImageUrl;
                if (imageContainer) imageContainer.classList.remove('d-none');
            } else {
                if (imageContainer) imageContainer.classList.add('d-none');
            }
        } else {
            feedbackContainer.classList.add('d-none');
        }

        // แปลงวันที่
        if (data.createdAt) {
            const date = data.createdAt.toDate();
            document.getElementById('resultDate').textContent = date.toLocaleDateString('th-TH');
        }

        // อัพเดต progress bar ตามสถานะ
        updateProgressBar(data.status);

        // แสดงผลลัพธ์
        trackingResult.classList.remove('d-none');
        noResult.classList.add('d-none');

        // แสดง Timeline กิจกรรม
        renderTrackingTimeline(data.activities, data.createdAt);

    } catch (error) {
        console.error("Error tracking status:", error);
        showAlert("เกิดข้อผิดพลาดในการค้นหาข้อมูล", "danger");
    }
}

// ===== ฟังก์ชันอัพเดต Progress Bar =====
function updateProgressBar(status) {
    const steps = document.querySelectorAll('.step');
    const progressLine = document.querySelector('.progress-line');

    // รีเซ็ตทุกขั้นตอน
    steps.forEach(step => {
        step.classList.remove('active');
        step.classList.remove('rejected');
    });

    if (status === 'rejected') {
        steps.forEach(step => step.classList.add('rejected'));
        if (progressLine) progressLine.style.width = '0%';
        return;
    }

    // กำหนดขั้นตอนที่ active ตามสถานะ
    let activeSteps = 1;
    switch (status) {
        case 'waiting':
        case 'pending':
            activeSteps = 1;
            break;
        case 'accepted':
            activeSteps = 2; // รับข้อมูล
            break;
        case 'in-progress':
            activeSteps = 3; // กำลังประเมิน
            break;
        case 'resolved':
            activeSteps = 4; // ประเมินแล้ว
            break;
        default:
            activeSteps = 1;
    }

    for (let i = 0; i < activeSteps; i++) {
        if (steps[i]) steps[i].classList.add('active');
    }

    // อัปเดตความกว้าง/ความสูงของเส้น Progress ผ่าน CSS Variable
    if (progressLine) {
        const percentage = ((activeSteps - 1) / (steps.length - 1)) * 100;
        progressLine.style.setProperty('--progress-percent', `${percentage}%`);
    }
}

// ===== ฟังก์ชันแสดง Modal สำเร็จ =====
function showSuccessModal(ticketId) {
    document.getElementById('generatedTicketId').textContent = ticketId;
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
}

// ===== ฟังก์ชันแจ้งเตือนด้วย SweetAlert2 =====
function showAlert(message, type = 'info') {
    const iconMap = {
        'info': 'info',
        'warning': 'warning',
        'danger': 'error',
        'success': 'success'
    };

    Swal.fire({
        title: type === 'danger' ? 'เกิดข้อผิดพลาด' : 'แจ้งเตือน',
        text: message,
        icon: iconMap[type] || 'info',
        confirmButtonColor: '#1b5e20'
    });
}

// ===== ฟังก์ชันแปลงสถานะเป็นข้อความภาษาไทย =====
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

// ===== Smooth Scrolling สำหรับ Navbar Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// ===== ฟังก์ชันจัดการ Timeline ในหน้าติดตามสถานะ =====
function renderTrackingTimeline(activities, createdAt) {
    const timelineContainer = document.querySelector('.timeline-v2');
    if (!timelineContainer) return;

    // เริ่มต้นด้วยรายการ "ส่งผลงาน"
    let timelineHTML = '';

    // เรียงกิจกรรมจากใหม่ไปเก่า
    if (activities && activities.length > 0) {
        // กรองกิจกรรมให้ย้อนกลับล่าสุดขึ้นก่อน
        const sortedActivities = [...activities].reverse();

        sortedActivities.forEach(act => {
            let date;
            if (act.timestamp && typeof act.timestamp.toDate === 'function') {
                date = act.timestamp.toDate();
            } else if (act.timestamp) {
                date = new Date(act.timestamp);
            } else {
                date = new Date();
            }

            const dateStr = date.toLocaleString('th-TH', {
                day: 'numeric', month: 'short', year: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }) + ' น.';

            timelineHTML += `
                <li class="timeline-item-v2">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <div class="timeline-date small text-muted">${dateStr}</div>
                        <div class="timeline-title fw-bold">${act.action}</div>
                        <p class="timeline-desc small mb-0 text-muted">${act.details || ''}</p>
                    </div>
                </li>
            `;
        });
    }

    timelineContainer.innerHTML = timelineHTML;
}

// Ticket ID Copy function removed
