import Ionicons from '@expo/vector-icons/Ionicons';
import { get, onValue, ref, update } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FeedbackModal } from '../../components/feedbackmodal';
import { db } from '../../config/firebaseConfig';
import { useESPConnection } from '../../hooks';

export default function SettingsScreen() {
  useESPConnection();

  const scrollRef = useRef<any>(null);

  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentSsid, setCurrentSsid] = useState<string | null>(null);

  const [dangKiemTra, setDangKiemTra] = useState(false);
  const [statusText, setStatusText] = useState('Đang kiểm tra...');
  const trangThaiUnsub = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [brightness, setBrightness] = useState(200);
  const [savedBrightness, setSavedBrightness] = useState(200);
  const [brightnessInput, setBrightnessInput] = useState('200');

  const [ringDuration, setRingDuration] = useState(5);
  const [savedRingDuration, setSavedRingDuration] = useState(5);
  const [ringDurationInput, setRingDurationInput] = useState('5');

  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean; type: 'success' | 'error'; title: string; message: string;
  }>({ visible: false, type: 'success', title: '', message: '' });

  const showSuccess = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'success', title, message });
  const showError = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'error', title, message });
  const hideFeedback = () => setFeedbackModal(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const unsubWifi = onValue(ref(db, 'WiFi/ssidHienTai'), (snap) => {
      const val = snap.val();
      if (typeof val === 'string' && val.length > 0) setCurrentSsid(val);
    });
    const unsubBright = onValue(ref(db, 'DongHo/DoSang'), (snap) => {
      const val = snap.val();
      if (typeof val === 'number') {
        setBrightness(val);
        setSavedBrightness(val);
        setBrightnessInput(String(val));
      }
    });
    const unsubRing = onValue(ref(db, 'DongHo/ThoiGianReo'), (snap) => {
      const val = snap.val();
      if (typeof val === 'number' && val > 0) {
        setRingDuration(val);
        setSavedRingDuration(val);
        setRingDurationInput(String(val));
      }
    });
    return () => { unsubWifi(); unsubBright(); unsubRing(); };
  }, []);

  useEffect(() => {
    return () => {
      trangThaiUnsub.current?.();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopListening = () => {
    trangThaiUnsub.current?.();
    trangThaiUnsub.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const startTimeout = (ms: number, label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      stopListening();
      setDangKiemTra(false);
      showError('Hết thời gian', `${label}\nKiểm tra thiết bị có đang bật không.`);
    }, ms);
  };

  const handleSaveWifi = async () => {
    Keyboard.dismiss();
    if (!ssid.trim()) { showError('Thiếu thông tin', 'Vui lòng nhập tên Wi-Fi'); return; }
    if (dangKiemTra) return;
    try {
      await update(ref(db, 'WiFi'), {
        ssid: ssid.trim(),
        password: password,
        capNhat: true,
        trangThai: 'choDoi',
      });
      setSsid('');
      setPassword('');
      setDangKiemTra(true);
      setStatusText('Chờ thiết bị phản hồi...');
      startTimeout(20000, 'Chưa nhận được lệnh đổi Wi-Fi.');

      const pollInterval = setInterval(async () => {
        try {
          const snap = await get(ref(db, 'WiFi/trangThai'));
          const val = snap.val() as string;
          if (!val || val === 'choDoi') return;
          if (val === 'dangKetNoi') {
            setStatusText('Đang kết nối Wi-Fi mới...');
            startTimeout(25000, 'Không kết nối được Wi-Fi.');
            return;
          }
          clearInterval(pollInterval);
          stopListening();
          setDangKiemTra(false);
          if (val === 'thanhCong') {
            showSuccess('Kết nối thành công', 'Đã kết nối Wi-Fi mới.\nThiết bị sẽ tự khởi động lại.');
          } else if (val === 'thatBai') {
            showError('Kết nối thất bại', 'Sai mật khẩu hoặc không tìm thấy mạng.\nTiếp tục dùng Wi-Fi cũ.');
          }
        } catch (_) {}
      }, 1500);
      trangThaiUnsub.current = () => clearInterval(pollInterval);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const handleSaveBrightness = async () => {
    Keyboard.dismiss();
    const num = parseInt(brightnessInput, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      showError('Giá trị không hợp lệ', 'Vui lòng nhập số từ 0 đến 100');
      return;
    }
    try {
      await update(ref(db, 'DongHo'), { DoSang: num });
      setBrightness(num);
      setSavedBrightness(num);
      showSuccess('Đã lưu', `Độ sáng LED: ${num}`);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const handleSaveRingDuration = async () => {
    Keyboard.dismiss();
    const num = parseInt(ringDurationInput, 10);
    if (isNaN(num) || num < 1 || num > 300) {
      showError('Giá trị không hợp lệ', 'Vui lòng nhập số từ 1 đến 300 giây');
      return;
    }
    try {
      await update(ref(db, 'DongHo'), { ThoiGianReo: num });
      setRingDuration(num);
      setSavedRingDuration(num);
      showSuccess('Đã lưu', `Thời gian chuông reo: ${num} giây`);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const parsedBrightnessInput = parseInt(brightnessInput, 10);
  const brightnessChanged = !isNaN(parsedBrightnessInput) && parsedBrightnessInput !== savedBrightness;

  const parsedRingInput = parseInt(ringDurationInput, 10);
  const ringDurationChanged = !isNaN(parsedRingInput) && parsedRingInput !== savedRingDuration;

  const [expandedCard, setExpandedCard] = useState<'wifi' | 'brightness' | 'ring' | null>(null);

  const toggleCard = (card: 'wifi' | 'brightness' | 'ring') => {
    Keyboard.dismiss();
    setExpandedCard(prev => (prev === card ? null : card));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <Text style={styles.headerSubtitle}>Cấu hình thiết bị</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>

          {/* Card Wi-Fi */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggleCard('wifi')}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="wifi" size={20} color="#1F5CA9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Kết nối Wi-Fi</Text>
                {currentSsid ? (
                  <Text style={styles.cardSubtitle}>
                    Hiện tại: <Text style={styles.cardSubtitleBold}>{currentSsid}</Text>
                  </Text>
                ) : (
                  <Text style={styles.cardSubtitle}>Chưa cấu hình</Text>
                )}
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="#7A8FAD"
                style={{ transform: [{ rotate: expandedCard === 'wifi' ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {expandedCard === 'wifi' && (
              <View style={styles.cardBody}>
                <Text style={styles.fieldLabel}>Tên Wi-Fi</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tên mạng Wi-Fi"
                  placeholderTextColor="#A0AEC0"
                  value={ssid}
                  onChangeText={setSsid}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!dangKiemTra}
                />

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mật khẩu</Text>
                {/* Icon mắt nằm TRONG ô input */}
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={styles.inputInner}
                    placeholder="Nhập mật khẩu Wi-Fi"
                    placeholderTextColor="#A0AEC0"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!dangKiemTra}
                  />
                  <TouchableOpacity
                    style={styles.eyeInner}
                    onPress={() => setShowPassword(p => !p)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={19}
                      color="#7A8FAD"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, dangKiemTra && styles.saveBtnDisabled]}
                  onPress={handleSaveWifi}
                  activeOpacity={0.8}
                  disabled={dangKiemTra}
                >
                  {dangKiemTra ? (
                    <View style={styles.saveBtnLoading}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={[styles.saveBtnText, { marginLeft: 8 }]}>{statusText}</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveBtnText}>Lưu Wi-Fi</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card Độ sáng */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggleCard('brightness')}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="sunny" size={20} color="#1F5CA9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Độ sáng LED</Text>
                <Text style={styles.cardSubtitle}>Hiện tại: {brightness}</Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="#7A8FAD"
                style={{ transform: [{ rotate: expandedCard === 'brightness' ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {expandedCard === 'brightness' && (
              <View style={styles.cardBody}>
                <Text style={styles.fieldLabel}>Giá trị (0 – 100)</Text>
                <TextInput
                  style={styles.input}
                  value={brightnessInput}
                  onChangeText={(t) => {
                    if (/^\d{0,3}$/.test(t)) setBrightnessInput(t);
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="0 – 100"
                  placeholderTextColor="#A0AEC0"
                  selectTextOnFocus
                  onFocus={() => {
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                  }}
                />

                <TouchableOpacity
                  style={[styles.saveBtn, !brightnessChanged && styles.saveBtnDisabled]}
                  onPress={handleSaveBrightness}
                  activeOpacity={0.8}
                  disabled={!brightnessChanged}
                >
                  <Text style={styles.saveBtnText}>
                    {brightnessChanged ? 'Lưu độ sáng' : 'Đã lưu'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Card Thời gian chuông reo */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggleCard('ring')}
              activeOpacity={0.7}
            >
              <View style={styles.cardIconBox}>
                <Ionicons name="alarm" size={20} color="#1F5CA9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Thời gian chuông reo</Text>
                <Text style={styles.cardSubtitle}>Hiện tại: {ringDuration} giây</Text>
              </View>
              <Ionicons
                name="chevron-down"
                size={20}
                color="#7A8FAD"
                style={{ transform: [{ rotate: expandedCard === 'ring' ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {expandedCard === 'ring' && (
              <View style={styles.cardBody}>
                <Text style={styles.fieldLabel}>Số giây chuông reo (1 – 300)</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={styles.inputInner}
                    value={ringDurationInput}
                    onChangeText={(t) => {
                      if (/^\d{0,3}$/.test(t)) setRingDurationInput(t);
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="VD: 5"
                    placeholderTextColor="#A0AEC0"
                    selectTextOnFocus
                    onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                    }}
                  />
                  <Text style={styles.unitInner}>giây</Text>
                </View>

                <Text style={styles.hintText}>
                  Chuông sẽ reo liên tục trong khoảng thời gian này mỗi khi báo thức kích hoạt.
                </Text>

                <TouchableOpacity
                  style={[styles.saveBtn, !ringDurationChanged && styles.saveBtnDisabled]}
                  onPress={handleSaveRingDuration}
                  activeOpacity={0.8}
                  disabled={!ringDurationChanged}
                >
                  <Text style={styles.saveBtnText}>
                    {ringDurationChanged ? 'Lưu thời gian' : 'Đã lưu'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </ScrollView>

      <FeedbackModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onDismiss={hideFeedback}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },
  scrollContent: { paddingBottom: 140 },

  header: {
    backgroundColor: '#1F5CA9',
    paddingVertical: 15, paddingHorizontal: 20, paddingTop: 50,
    flexDirection: 'row', alignItems: 'center',
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', color: '#ffffff' },

  body: { padding: 16, gap: 14 },

  card: {
    backgroundColor: '#ffffff', borderRadius: 20, overflow: 'hidden',
    elevation: 2, shadowColor: '#1F5CA9',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  cardIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#11181C' },
  cardSubtitle: { fontSize: 12, color: '#7A8FAD', marginTop: 2 },
  cardSubtitleBold: { fontWeight: '700', color: '#1F5CA9' },
  cardBody: {
    padding: 16, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#F0F4FA',
  },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 8, marginTop: 14 },

  // Input thường
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#F8FAFC', fontSize: 15, color: '#11181C',
  },

  // Container bọc input + icon mắt bên trong
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: '#11181C',
  },
  eyeInner: {
    paddingLeft: 8,
    paddingVertical: 11,
  },

  unitInner: {
    fontSize: 13, fontWeight: '600', color: '#7A8FAD',
    paddingLeft: 6, paddingVertical: 11,
  },
  hintText: { fontSize: 12, color: '#7A8FAD', marginTop: 10, lineHeight: 18 },

  saveBtn: {
    backgroundColor: '#1F5CA9', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 15,
  },
  saveBtnDisabled: { backgroundColor: '#C8D3E8' },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  saveBtnLoading: { flexDirection: 'row', alignItems: 'center' },
} as any);
