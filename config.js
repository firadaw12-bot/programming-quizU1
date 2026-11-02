/* ปรับการตั้งค่าระบบสอบที่ไฟล์นี้ */
window.EXAM_CONFIG = {
  collegeName: "วิทยาลัยเทคนิคประจวบคีรีขันธ์",
  department: "แผนกวิชาเทคโนโลยีธุรกิจดิจิทัล",
  courseName: "การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น",
  courseCode: "21910-1003",
  title: "แบบทดสอบบทเรียนที่ 1",
  subtitle: "ความรู้พื้นฐานในการเขียนโปรแกรม",
  durationMinutes: 30,
  passPercent: 60,
  shuffleQuestions: true,
  shuffleOptions: true,
  showReviewAfterSubmit: false, // true = แสดงเฉลย/รายการตอบถูกผิดหลังส่ง
  allowRetakeOnSameBrowser: true,
  // วาง URL Web App ที่ลงท้าย /exec จาก Google Apps Script เพื่อเก็บผลลง Google Sheets
  // เว้นว่างได้: คะแนนจะแสดงบนอุปกรณ์ผู้สอบและดาวน์โหลดสลิปได้ แต่ครูจะยังไม่ได้รับผลอัตโนมัติ
  sheetEndpoint: ""
};
