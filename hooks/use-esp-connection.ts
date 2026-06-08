import { onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { db } from '../config/firebaseConfig';

let globalLastUpdateTime = Date.now();
let globalIsESPConnected = false;
let connectionCheckInterval: any = null; // Chuyển thành any để tránh xung đột môi trường
let unsubscribeFirebaseTime: (() => void) | null = null;
let localClockInterval: any = null;       // Chuyển thành any để tránh xung đột môi trường
let connectionStateListeners: Set<(status: boolean) => void> = new Set();

// Định dạng cấu trúc dữ liệu thời gian
interface TimeData {
  Gio: number;
  Phut: number;
  Giay: number;
  Ngay: number;
  Thang: number;
  Nam: number;
  Thu: number;
}

let globalTimeData: TimeData | null = null;
let timeDataListeners: Set<(data: any) => void> = new Set();

// Hàm kiểm tra năm nhuận để tính ngày trong tháng chính xác khi tự đếm tiến
const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const getDaysInMonth = (month: number, year: number) => {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};

// ⏱️ BỘ ĐẾM GIỜ NỘI BỘ: Tự động cộng 1 giây từ dữ liệu Firebase cuối cùng
const cộngMộtGiây = (current: TimeData): TimeData => {
  let { Gio, Phut, Giay, Ngay, Thang, Nam, Thu } = current;

  Giay += 1;
  if (Giay >= 60) {
    Giay = 0;
    Phut += 1;
    if (Phut >= 60) {
      Phut = 0;
      Gio += 1;
      if (Gio >= 24) {
        Gio = 0;
        Thu = (Thu + 1) % 7; // Thứ trong tuần (0: Chủ Nhật, 1: Thứ 2...)
        Ngay += 1;

        const maxDays = getDaysInMonth(Thang, Nam);
        if (Ngay > maxDays) {
          Ngay = 1;
          Thang += 1;
          if (Thang > 12) {
            Thang = 1;
            Nam += 1;
          }
        }
      }
    }
  }

  return { Gio, Phut, Giay, Ngay, Thang, Nam, Thu };
};

// Khởi chạy bộ đếm chạy ngầm khi mất kết nối ESP
const startLocalClockUpdate = () => {
  if (localClockInterval) return;

  localClockInterval = setInterval(() => {
    // Chỉ tự đếm tiến nếu đang MẤT kết nối và đang có dữ liệu gốc
    if (!globalIsESPConnected && globalTimeData) {
      globalTimeData = cộngMộtGiây(globalTimeData);
      // Phát thông báo cập nhật giao diện liên tục
      timeDataListeners.forEach(listener => listener(globalTimeData));
    }
  }, 1000);
};

const stopLocalClockUpdate = () => {
  if (localClockInterval) {
    clearInterval(localClockInterval);
    localClockInterval = null;
  }
};

// Kiểm tra trạng thái kết nối dựa trên tần suất cập nhật dữ liệu từ Firebase
const startGlobalConnectionCheck = () => {
  if (connectionCheckInterval) return;

  connectionCheckInterval = setInterval(() => {
    const timeSinceLastUpdate = Date.now() - globalLastUpdateTime;
    // Nếu quá 2.5 giây Firebase không có biến động => Coi như ESP32 mất kết nối
    const newStatus = timeSinceLastUpdate <= 2500;

    if (newStatus !== globalIsESPConnected) {
      globalIsESPConnected = newStatus;

      if (!newStatus) {
        // KHI MẤT KẾT NỐI: Kích hoạt bộ đếm thời gian nội bộ chạy tịnh tiến từ vết Firebase cũ
        startLocalClockUpdate();
      } else {
        // KHI CÓ KẾT NỐI LẠI: Tắt bộ tự đếm, nhường quyền cập nhật chính xác cho Firebase
        stopLocalClockUpdate();
      }

      connectionStateListeners.forEach(listener => listener(newStatus));
    }
  }, 500); // Kiểm tra định kỳ mỗi 500ms
};

// Lắng nghe dữ liệu realtime từ Firebase
let firebaseListenerActive = false;
const setupFirebaseListener = () => {
  if (firebaseListenerActive) return;
  firebaseListenerActive = true;

  const timeRef = ref(db, 'DongHo/ThoiGian');
  unsubscribeFirebaseTime = onValue(timeRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      globalLastUpdateTime = Date.now();

      if (data && data.GioGiac && data.Date) {
        // Cập nhật mốc thời gian chuẩn từ Firebase làm mốc gốc mới nhất
        globalTimeData = {
          Gio: data.GioGiac.Gio,
          Phut: data.GioGiac.Phut,
          Giay: data.GioGiac.Giay,
          Ngay: data.Date.Ngay,
          Thang: data.Date.Thang,
          Nam: data.Date.Nam,
          Thu: data.Date.Thu,
        };

        if (!globalIsESPConnected) {
          stopLocalClockUpdate();
        }
        globalIsESPConnected = true;

        // Gửi dữ liệu cập nhật đến màn hình hiển thị
        timeDataListeners.forEach(listener => listener(globalTimeData));
      }
      connectionStateListeners.forEach(listener => listener(true));
    }
  });
};

export const useESPConnection = () => {
  const [isConnected, setIsConnected] = useState(globalIsESPConnected);

  useEffect(() => {
    startGlobalConnectionCheck();
    setupFirebaseListener();

    const listener = (status: boolean) => setIsConnected(status);
    connectionStateListeners.add(listener);

    return () => {
      connectionStateListeners.delete(listener);
    };
  }, []);

  return isConnected;
};

export const useESPTime = () => {
  const [timeData, setTimeData] = useState<TimeData | null>(globalTimeData);

  useEffect(() => {
    startGlobalConnectionCheck();
    setupFirebaseListener();

    const listener = (data: TimeData) => setTimeData(data);
    timeDataListeners.add(listener);

    // Điền dữ liệu tức thời nếu đã có sẵn trong bộ nhớ đệm global
    if (globalTimeData) {
      setTimeData(globalTimeData);
    }

    return () => {
      timeDataListeners.delete(listener);
    };
  }, []);

  return timeData;
};

export const getESPConnectionStatus = () => globalIsESPConnected;
export const setESPLastUpdateTime = () => {
  globalLastUpdateTime = Date.now();
  if (!globalIsESPConnected) {
    globalIsESPConnected = true;
    connectionStateListeners.forEach(listener => listener(true));
  }
};