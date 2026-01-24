// Firebase Configuration
const firebaseConfig = {
    // ⚠️ คำเตือน: ในสภาพแวดล้อมการผลิตจริง ควรเก็บคีย์เหล่านี้ในไฟล์ .env
    // สำหรับการทดสอบ ให้ใส่ค่าจาก Firebase Console ของคุณตรงนี้

    apiKey: "AIzaSyCitQMayGj410DR5bSO4R3WGxpzvqObKFE",
    authDomain: "student-council-request.firebaseapp.com",
    projectId: "student-council-request",
    storageBucket: "student-council-request.firebasestorage.app",
    messagingSenderId: "456468854006",
    appId: "1:456468854006:web:fb48cd417fd4e8c744a8d7",
    measurementId: "G-NHY5WXNDKL"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

// ตั้งค่ากฎ timestamp
const timestamp = firebase.firestore.FieldValue.serverTimestamp;

// ฟังก์ชันตรวจสอบ connection
function checkFirebaseConnection() {
    return new Promise((resolve, reject) => {
        db.collection("test").limit(1).get()
            .then(() => resolve(true))
            .catch(error => reject(error));
    });
}

// ทดสอบ connection เมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', function () {
    checkFirebaseConnection()
        .then(() => console.log("Firebase connected successfully!"))
        .catch(error => console.error("Firebase connection error:", error));
});