// ===== ตัวแปร Global =====
let complaintsCollection;
let selectedFiles = []; // เก็บไฟล์รูปภาพที่เลือกไว้

// ===== ฟังก์ชันเริ่มต้น =====
document.addEventListener('DOMContentLoaded', function () {
    // กำหนด collection reference
    complaintsCollection = db.collection("complaints");

    // ตั้งค่า Event Listeners
    setupEventListeners();

    // สุ่ม Ticket ID สำหรับการแสดงตัวอย่าง
    generateSampleTicketId();

    // แสดง Developer Announcement Popup
    showDeveloperAnnouncement();
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

    // ฟังก์ชันเมื่อกด Enter ในช่อง Ticket ID
    const ticketIdInput = document.getElementById('ticketId');
    if (ticketIdInput) {
        ticketIdInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handleTrackStatus();
            }
        });
    }

    // แสดงตัวอย่างรูปภาพเมื่อเลือกไฟล์ (หลายรูป)
    const imageUpload = document.getElementById('imageUpload');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (imageUpload && previewContainer) {
        imageUpload.addEventListener('change', function () {
            const files = Array.from(this.files);

            // ตรวจสอบจำนวนรูป (จำกัด 3 รูป)
            if (files.length + selectedFiles.length > 3) {
                alert("สามารถเลือกรูปภาพได้ไม่เกิน 3 รูปครับ");
                this.value = '';
                return;
            }

            // ตรวจสอบขนาดรวม (จำกัด 5MB)
            const totalSize = files.reduce((acc, file) => acc + file.size, 0);
            const existingSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

            if ((totalSize + existingSize) > 5 * 1024 * 1024) {
                alert("ขนาดไฟล์รวมกันต้องไม่เกิน 5MB ครับ");
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

    // จัดการตัวเลือกไม่ระบุตัวตน
    const anonymousCheckbox = document.getElementById('anonymous');
    const anonymousToggle = document.getElementById('anonymousToggle');
    const reporterNameGroup = document.getElementById('reporterNameGroup');
    const reporterNameInput = document.getElementById('reporterName');

    if (anonymousCheckbox && anonymousToggle) {
        // เมื่อคลิกที่การ์ด ให้ติ๊ก checkbox
        anonymousToggle.addEventListener('click', function () {
            anonymousCheckbox.checked = !anonymousCheckbox.checked;
            // เรียกใช้ event change ของ checkbox
            anonymousCheckbox.dispatchEvent(new Event('change'));
        });

        anonymousCheckbox.addEventListener('change', function () {
            const nameLabel = reporterNameGroup.querySelector('label[for="reporterName"]');
            const statusIcon = anonymousToggle.querySelector('.status-icon i');

            if (this.checked) {
                anonymousToggle.classList.add('active');
                if (statusIcon) {
                    statusIcon.classList.remove('bi-eye');
                    statusIcon.classList.add('bi-eye-slash-fill');
                }
                if (nameLabel) nameLabel.style.opacity = '0.5';
                reporterNameInput.style.opacity = '0.5';
                reporterNameInput.disabled = true;
                reporterNameInput.value = '';
                reporterNameInput.required = false;
            } else {
                anonymousToggle.classList.remove('active');
                if (statusIcon) {
                    statusIcon.classList.remove('bi-eye-slash-fill');
                    statusIcon.classList.add('bi-eye');
                }
                if (nameLabel) nameLabel.style.opacity = '1';
                reporterNameInput.style.opacity = '1';
                reporterNameInput.disabled = false;
                reporterNameInput.required = true;
                reporterNameInput.focus();
            }
        });
    }

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

    // ตั้งค่า Flatpickr แทน Date Picker เดิม
    const incidentDateInput = document.getElementById('incidentDate');
    if (incidentDateInput) {
        flatpickr(incidentDateInput, {
            locale: "th",
            dateFormat: "Y-m-d",
            defaultDate: "today",
            altInput: true,
            altFormat: "j F Y",
            disableMobile: "true"
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

// ===== ฟังก์ชันอัปเดต Submission Stepper (New) =====
function updateSubmissionStepper(step) {
    const steps = document.querySelectorAll('.submission-stepper .step-item');
    steps.forEach((s, index) => {
        if (index + 1 === step) {
            s.classList.add('active');
        } else {
            s.classList.remove('active');
        }
    });

    // ถ้าเข้าสู่ขั้นตอนที่ 4 (ส่งแล้ว)
    if (step === 4) {
        steps.forEach(s => s.classList.remove('active'));
        const lastStep = document.getElementById('step4');
        if (lastStep) lastStep.classList.add('active');
    }
}

// ===== ฟังก์ชันควบคุมการเปลี่ยนหน้าฟอร์ม (New) =====
function goToStep(step) {
    // ตรวจสอบความถูกต้องของข้อมูลก่อนไปหน้าถัดไป (เฉพาะเมื่อกด 'ถัดไป')
    const currentStepDiv = document.querySelector('.form-step.active');
    const currentStepNum = parseInt(currentStepDiv.id.replace('formStep', ''));

    if (step > currentStepNum) {
        // ค้นหา input ใน step ปัจจุบัน
        const inputs = currentStepDiv.querySelectorAll('input, select, textarea');
        let isValid = true;

        try {
            inputs.forEach(input => {
                if (!input.checkValidity()) {
                    // หาชื่อฟิลด์จาก Label
                    const label = input.closest('div').querySelector('.form-label');
                    const fieldName = label ? label.textContent.replace('*', '').trim() : "ข้อมูลบางส่วน";

                    Swal.fire({
                        icon: 'warning',
                        title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                        text: `โปรดระบุ "${fieldName}" ก่อนไปขั้นตอนถัดไป`,
                        confirmButtonColor: '#1b5e20',
                        confirmButtonText: 'รับทราบ',
                        showClass: {
                            popup: 'animate__animated animate__shakeX'
                        }
                    });

                    isValid = false;
                    input.classList.add('is-invalid'); // เพิ่มคลาสสีแดงให้ input

                    // ลบคลาสสีแดงเมื่อมีการพิมพ์
                    input.addEventListener('input', function () {
                        this.classList.remove('is-invalid');
                    }, { once: true });

                    throw 'Validation Failed'; // หยุดการตรวจสอบที่ตัวแรกเพื่อไม่ให้ Swal เด้งรัวๆ
                }
            });
        } catch (e) {
            if (e === 'Validation Failed') return;
        }
    }

    // ซ่อนทุกหน้า และแสดงหน้าที่ต้องการ
    document.querySelectorAll('.form-step').forEach(div => {
        div.classList.remove('active');
    });
    const targetStepDiv = document.getElementById(`formStep${step}`);
    if (targetStepDiv) targetStepDiv.classList.add('active');

    // อัปเดต Stepper
    updateSubmissionStepper(step);

    // ถ้าไปที่ Step 3 (ตรวจสอบข้อมูล) ให้สรุปผล
    if (step === 3) {
        summaryData();
    }

    // เลื่อนหน้าจอกลับไปด้านบนของฟอร์ม
    const formSection = document.getElementById('complaint-form');
    if (formSection) {
        window.scrollTo({
            top: formSection.offsetTop - 100,
            behavior: 'smooth'
        });
    }
}

// ===== ฟังก์ชันสรุปข้อมูลก่อนส่ง (New) =====
function summaryData() {
    const title = document.getElementById('title').value;
    let category = document.getElementById('category').value;
    if (category === 'อื่นๆ') category = document.getElementById('otherCategory').value;

    const location = document.getElementById('location').value;

    const isAnonymous = document.getElementById('anonymous').checked;
    const reporterName = isAnonymous ? "ไม่ระบุตัวตน" : document.getElementById('reporterName').value;

    document.getElementById('summaryTitle').textContent = title || '-';
    document.getElementById('summaryCategory').textContent = category || '-';
    document.getElementById('summaryLocation').textContent = location || '-';
    document.getElementById('summaryReporter').textContent = reporterName || '-';
}

// ===== ฟังก์ชันจัดการฟอร์มแจ้งเรื่อง =====
async function handleComplaintSubmit(e) {
    e.preventDefault();

    // บังคับให้กด ยอมรับนโยบายความเป็นส่วนตัว
    const privacyConsent = document.getElementById('privacyConsent');
    if (privacyConsent && !privacyConsent.checked) {
        Swal.fire({
            icon: 'warning',
            title: 'กรุณายอมรับนโยบาย',
            text: 'คุณต้องกดยอมรับนโยบายความเป็นส่วนตัวก่อนส่งคำร้องเรียน',
            confirmButtonColor: '#1b5e20',
            confirmButtonText: 'ตกลง'
        });
        return;
    }

    // แสดง Popup ยืนยันการยินยอมข้อมูลส่วนบุคคล
    const confirmResult = await Swal.fire({
        title: '📋 ยืนยันการส่งคำร้องเรียน',
        html: `
            <div style="text-align: left; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); padding: 20px; border-radius: 15px; margin-bottom: 20px; color: white; text-align: center;">
                    <i class="bi bi-shield-check" style="font-size: 3rem; margin-bottom: 10px;"></i>
                    <h5 style="color: white; margin: 0;">นโยบายความเป็นส่วนตัว</h5>
                </div>
                
                <div style="background: #f0fdf4; padding: 15px; border-radius: 10px; border-left: 4px solid #16a34a; margin-bottom: 15px;">
                    <p style="margin: 0; color: #166534; font-weight: 600;">
                        <i class="bi bi-check-circle-fill" style="color: #16a34a;"></i> 
                        ท่านยอมรับให้ข้อมูลส่วนบุคคลของท่าน
                    </p>
                </div>

                <div style="background: #fff9c4; padding: 15px; border-radius: 10px; border-left: 4px solid #fdd835; margin-bottom: 15px;">
                    <p style="margin: 0; color: #854d0e; font-weight: 500;">
                        <i class="bi bi-lock-fill" style="color: #fdd835;"></i> 
                        ทางสภานักเรียนโรงเรียนสุรวิทยาคารจะเก็บข้อมูลไว้เป็นความลับ
                    </p>
                </div>

                <div style="background: #e0f2fe; padding: 15px; border-radius: 10px; border-left: 4px solid #0ea5e9;">
                    <p style="margin: 0; color: #075985; font-weight: 500;">
                        <i class="bi bi-info-circle-fill" style="color: #0ea5e9;"></i> 
                        ข้อมูลจะถูกใช้เพื่อการดำเนินการแก้ไขปัญหาเท่านั้น
                    </p>
                </div>

                <p style="margin-top: 20px; color: #dc3545; font-size: 1rem; text-align: center; font-weight: bold;">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> กรุณาตรวจสอบข้อมูลก่อนส่งข้อมูล
                </p>
                <p style="margin-top: 5px; color: #64748b; font-size: 0.9rem; text-align: center;">
                    กรุณายืนยันว่าท่านได้อ่านและเข้าใจนโยบายความเป็นส่วนตัวแล้ว
                </p>
            </div>
        `,
        icon: null,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-check-circle me-2"></i>ยืนยันและส่งคำร้องเรียน',
        cancelButtonText: '<i class="bi bi-x-circle me-2"></i>ยกเลิก',
        confirmButtonColor: '#1b5e20',
        cancelButtonColor: '#64748b',
        width: '600px',
        customClass: {
            popup: 'swal-custom-popup',
            confirmButton: 'swal-custom-confirm',
            cancelButton: 'swal-custom-cancel'
        },
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        }
    });

    // ถ้าผู้ใช้กดยกเลิก ให้หยุดการทำงาน
    if (!confirmResult.isConfirmed) {
        return;
    }

    // อัปเดต stepper เป็นขั้นตอนที่ 4
    updateSubmissionStepper(4);

    // Disable ปุ่ม submit
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังส่ง...';
    submitBtn.disabled = true;

    try {
        // เก็บค่าจากฟอร์ม
        const isAnonymous = document.getElementById('anonymous').checked;
        const reporterName = isAnonymous ? "ไม่ระบุตัวตน" : document.getElementById('reporterName').value;
        const reporterEmail = document.getElementById('reporterEmail').value;
        const ticketId = await generateTicketId();

        let finalCategory = document.getElementById('category').value;
        if (finalCategory === 'อื่นๆ') {
            finalCategory = `อื่นๆ (${document.getElementById('otherCategory').value})`;
        }

        let finalReporterType = document.getElementById('reporterType').value;
        if (finalReporterType === 'อื่นๆ') {
            finalReporterType = `อื่นๆ (${document.getElementById('otherReporterType').value})`;
        }
        const complaintData = {
            title: document.getElementById('title').value,
            category: finalCategory,
            reporterType: finalReporterType,
            location: document.getElementById('location').value,
            incidentDate: document.getElementById('incidentDate').value,
            details: document.getElementById('details').value,
            anonymous: isAnonymous,
            reporterName: reporterName,
            reporterEmail: reporterEmail,
            status: "waiting",
            createdAt: timestamp(),
            updatedAt: timestamp(),
            ticketId: ticketId,
            privacyConsent: document.getElementById('privacyConsent').checked,
            imageUrls: [], // เปลี่ยนเป็น array เพื่อเก็บหลายรูป
            activities: [ // เริ่มต้นประวัติการแก้ไข
                {
                    action: "สร้างคำร้องเรียน",
                    status: "waiting",
                    timestamp: new Date(),
                    details: "นักเรียนส่งเรื่องเข้าสู่ระบบ"
                }
            ],
            isDuplicate: false, // ระบบจัดการเรื่องซ้ำ
            duplicateOf: null
        };

        // ===== ตรวจสอบเรื่องซ้ำอัตโนมัติ (Duplicate Detection) =====
        // ปรับปรุงเกณฑ์การตรวจสอบ: หมวดหมู่ + สถานที่ + (หัวข้อ หรือ รายละเอียด)
        const duplicateSnapshot = await complaintsCollection
            .where("category", "==", finalCategory)
            .where("location", "==", complaintData.location)
            .get();

        // ค้นหาเรื่องที่อาจจะเป็นเรื่องซ้ำ (เฉพาะที่ยังอยู่ระหว่างดำเนินการ หรือถูกปฏิเสธไปก่อนหน้า)
        const activeDuplicate = duplicateSnapshot.docs.find(doc => {
            const d = doc.data();
            const status = d.status;

            // ถ้าสถานะเดิมคือ 'เสร็จสิ้น' (resolved) จะอนุญาตให้แจ้งใหม่ได้ทันที (เพราะปัญหาเดิมอาจกลับมาเกิดซ้ำ)
            if (status === 'resolved') return false;

            // ตรวจสอบความคล้ายคลึงของหัวข้อหรือรายละเอียด (สำหรับสถานะอื่นๆ เช่น waiting, accepted, in-progress, rejected)
            const isTitleSimilar = d.title && d.title.trim().toLowerCase() === complaintData.title.trim().toLowerCase();
            const isDetailsSimilar = d.details && d.details.trim().toLowerCase() === complaintData.details.trim().toLowerCase();

            return isTitleSimilar || isDetailsSimilar;
        });

        if (activeDuplicate) {
            const existingData = activeDuplicate.data();

            // แจ้งเตือนนักเรียนและหยุดการส่งทันที เพื่อไม่ให้เกิดข้อมูลซ้ำซ้อน
            await Swal.fire({
                title: 'ตรวจพบเรื่องซ้ำในระบบ!',
                html: `เรื่องนี้มีการแจ้งไว้แล้วในระบบ (Ticket ID: <b>${existingData.ticketId}</b>)<br><br><b>หัวข้อ:</b> ${existingData.title}<br><b>สถานที่:</b> ${existingData.location}<br><br>คุณสามารถใช้รหัส Ticket เดิมเพื่อติดตามความคืบหน้าได้เลยครับ`,
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

        document.getElementById('otherCategoryGroup').style.display = 'none';
        document.getElementById('otherReporterTypeGroup').style.display = 'none';
        document.getElementById('reporterNameGroup').style.opacity = '1';
        document.getElementById('reporterName').disabled = false;
        document.getElementById('privacyConsent').checked = false;

        // กลับไป Step 1 หลังส่งสำเร็จ (หรือปล่อยไว้หน้า Success Modal)
        goToStep(1);

    } catch (error) {
        console.error("Error submitting complaint:", error);
        alert("เกิดข้อผิดพลาดในการส่งข้อมูล: " + error.message + "\n\nกรุณาติดต่อแอดมินเพื่อขอความช่วยเหลือ");
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
    const scriptURL = "https://script.google.com/macros/s/AKfycbw4zePrBbAJ8VHFbWBywUgo2WgQNLzrZ95qDdyEqicKOyWSbiCJgxNMLSzaH3vJCJyM8Q/exec"; // เปลี่ยนเป็น URL ของคุณ

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

// ===== ฟังก์ชันสร้าง Ticket ID (รูปแบบ: SN-NNNNMM) =====
// SN = สภานักเรียน
// NNNN = เลขที่รันต่อเนื่อง (0001, 0002, ...)
// MM = นาทีที่ส่งข้อมูล (00-59)
async function generateTicketId() {
    try {
        const snapshot = await complaintsCollection.get();
        const existingNums = [];

        // ดึงเลขที่รันจาก Ticket ID ทั้งหมด
        snapshot.forEach(doc => {
            const tid = doc.data().ticketId;
            if (tid && tid.startsWith("SN-")) {
                // ตัด SN- ออก แล้วเอาแค่ 4 หลักแรก (เลขที่รัน)
                const numPart = tid.replace("SN-", "").substring(0, 4);
                const num = parseInt(numPart);
                if (!isNaN(num)) existingNums.push(num);
            }
        });

        // เรียงลำดับตัวเลขจากน้อยไปมาก
        existingNums.sort((a, b) => a - b);

        // หาเลขตัวแรกที่ว่างอยู่ (Smallest Missing Positive Integer)
        let nextNum = 1;
        for (let i = 0; i < existingNums.length; i++) {
            if (existingNums[i] === nextNum) {
                nextNum++;
            } else if (existingNums[i] > nextNum) {
                // เจอช่องว่างแล้ว
                break;
            }
        }

        // ดึงนาทีปัจจุบัน
        const now = new Date();
        const minute = now.getMinutes().toString().padStart(2, '0');

        // สร้าง Ticket ID
        const prefix = "SN-";
        const formattedNum = nextNum.toString().padStart(4, '0'); // เลขที่รัน 4 หลัก
        return prefix + formattedNum + minute; // SN-NNNNMM

    } catch (error) {
        console.error("Error generating Ticket ID:", error);
        // Fallback กรณีเกิดข้อผิดพลาด
        const now = new Date();
        const minute = now.getMinutes().toString().padStart(2, '0');
        return "SN-" + Math.floor(1000 + Math.random() * 9000) + minute;
    }
}

// สร้าง Ticket ID ตัวอย่างสำหรับการแสดง
async function generateSampleTicketId() {
    const ticketIdInput = document.getElementById('ticketId');
    if (ticketIdInput) {
        ticketIdInput.placeholder = "เช่น: SN-000125";
    }
}



// ===== ฟังก์ชันติดตามสถานะ =====
async function handleTrackStatus() {
    const ticketId = document.getElementById('ticketId').value.trim();
    const trackingResult = document.getElementById('trackingResult');
    const noResult = document.getElementById('noResult');

    if (!ticketId) {
        showAlert("กรุณากรอกรหัส Ticket ID", "warning");
        return;
    }

    try {
        // ค้นหาข้อมูลจาก Firestore
        const querySnapshot = await complaintsCollection
            .where("ticketId", "==", ticketId)
            .limit(1)
            .get();

        // แสดงข้อมูลที่พบ
        const doc = querySnapshot.docs[0];
        const data = doc.data();

        if (data.isDuplicate && data.duplicateOf) {
            showAlert(`เรื่องนี้เป็นเรื่องซ้ำ กำลังดำเนินการรวมชุดข้อมูลกับ Ticket: ${data.duplicateOf}`, "info");
        }

        // อัพเดตข้อมูลในตาราง
        document.getElementById('resultTicketId').textContent = data.ticketId;
        document.getElementById('resultTitle').textContent = data.title;
        document.getElementById('resultCategory').textContent = data.category;
        document.getElementById('resultLocation').textContent = data.location || '-';
        document.getElementById('resultIncidentDate').textContent = data.incidentDate ? new Date(data.incidentDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        document.getElementById('resultReporterType').textContent = data.reporterType || '-';
        document.getElementById('resultStatus').textContent = getStatusText(data.status);

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
    const container = document.querySelector('.progress-container');
    const steps = document.querySelectorAll('.step');
    const progressLine = document.querySelector('.progress-line');

    if (!container) return;

    // รีเซ็ตคลาสสถานะเดิมบน container
    container.classList.remove('status-waiting', 'status-pending', 'status-accepted', 'status-in-progress', 'status-resolved', 'status-rejected');
    container.classList.add(`status-${status}`);

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
            activeSteps = 2;
            break;
        case 'in-progress':
            activeSteps = 3;
            break;
        case 'resolved':
            activeSteps = 4;
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

// ===== ฟังก์ชันแจ้งเตือน =====
function showAlert(message, type = 'info') {
    // สร้างแจ้งเตือนชั่วคราว
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 100px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // ลบแจ้งเตือนหลังจาก 5 วินาที
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// ===== ฟังก์ชันแปลงสถานะเป็นข้อความภาษาไทย =====
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

    // เริ่มต้นด้วยรายการ "สร้างคำร้องเรียน"
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

// ===== ฟังก์ชันคัดลอก Ticket ID =====
function copyTicketId() {
    const ticketId = document.getElementById('generatedTicketId').textContent;
    if (!ticketId) return;

    navigator.clipboard.writeText(ticketId).then(() => {
        Swal.fire({
            icon: 'success',
            title: 'คัดลอกสำเร็จ!',
            text: 'คัดลอกรหัส Ticket ID เรียบร้อยแล้ว',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000
        });
    });
}

// ===== ฟังก์ชันแสดง Developer Announcement Popup =====
function showDeveloperAnnouncement() {
    // ตรวจสอบว่าผู้ใช้เคยเลือก "ไม่ต้องแสดงอีก" หรือไม่
    const dontShowAgain = localStorage.getItem('dontShowDevAnnouncement');

    if (dontShowAgain === 'true') {
        return; // ไม่แสดง popup ถ้าผู้ใช้เลือกไม่ต้องแสดงอีก
    }

    // แสดง modal หลังจากโหลดหน้าเว็บ 1 วินาที
    setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('developerAnnouncementModal'));
        modal.show();

        // จัดการปุ่มปิด modal
        const modalElement = document.getElementById('developerAnnouncementModal');
        const dontShowCheckbox = document.getElementById('dontShowAgain');

        modalElement.addEventListener('hidden.bs.modal', function () {
            // ถ้าผู้ใช้เลือก checkbox "ไม่ต้องแสดงอีก"
            if (dontShowCheckbox && dontShowCheckbox.checked) {
                localStorage.setItem('dontShowDevAnnouncement', 'true');
            }
        });
    }, 1000);
}
