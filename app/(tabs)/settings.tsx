import Ionicons from '@expo/vector-icons/Ionicons';
import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
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

  const [brightness, setBrightness] = useState(200);
  const [savedBrightness, setSavedBrightness] = useState(200);
  const [brightnessInput, setBrightnessInput] = useState('200');

  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean; type: 'success' | 'error'; title: string; message: string;
  }>({ visible: false, type: 'success', title: '', message: '' });

  const showSuccess = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'success', title, message });
  const showError = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'error', title, message });
  const hideFeedback = () => setFeedbackModal(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const unsubWifi = onValue(ref(db, 'WiFi'), (snap) => {
      const data = snap.val();
      if (data?.ssid) setCurrentSsid(data.ssid);
    });
    const unsubBright = onValue(ref(db, 'DongHo/DoSang'), (snap) => {
      const val = snap.val();
      if (typeof val === 'number') {
        setBrightness(val);
        setSavedBrightness(val);
        setBrightnessInput(String(val));
      }
    });
    return () => { unsubWifi(); unsubBright(); };
  }, []);

  const handleSaveWifi = async () => {
    Keyboard.dismiss();
    if (!ssid.trim()) { showError('Thiếu thông tin', 'Vui lòng nhập tên WiFi'); return; }
    try {
      await set(ref(db, 'WiFi'), { ssid: ssid.trim(), password });
      setCurrentSsid(ssid.trim());
      setSsid('');
      setPassword('');
      showSuccess('Đã lưu', `WiFi "${ssid.trim()}" đã cập nhật.\nESP32 sẽ kết nối lại khi khởi động.`);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const handleSaveBrightness = async () => {
    Keyboard.dismiss();
    const num = parseInt(brightnessInput, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      showError('Giá trị không hợp lệ', 'Vui lòng nhập số từ 0 đến 255');
      return;
    }
    try {
      await set(ref(db, 'DongHo/DoSang'), num);
      setBrightness(num);
      setSavedBrightness(num);
      showSuccess('Đã lưu', `Độ sáng LED: ${num}`);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const parsedInput = parseInt(brightnessInput, 10);
  const brightnessChanged = !isNaN(parsedInput) && parsedInput !== savedBrightness;

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

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <Ionicons name="wifi" size={20} color="#1F5CA9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Kết nối WiFi</Text>
                {currentSsid ? (
                  <Text style={styles.cardSubtitle}>
                    Hiện tại: <Text style={styles.cardSubtitleBold}>{currentSsid}</Text>
                  </Text>
                ) : (
                  <Text style={styles.cardSubtitle}>Chưa cấu hình</Text>
                )}
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>Tên WiFi</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên mạng WiFi"
                placeholderTextColor="#A0AEC0"
                value={ssid}
                onChangeText={setSsid}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mật khẩu</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nhập mật khẩu WiFi"
                  placeholderTextColor="#A0AEC0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20} color="#7A8FAD"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveWifi} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Lưu WiFi</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBox}>
                <Ionicons name="sunny" size={20} color="#1F5CA9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Độ sáng LED</Text>
                <Text style={styles.cardSubtitle}>Hiện tại: {brightness}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.fieldLabel}>Giá trị (0 – 255)</Text>
              <TextInput
                style={styles.input}
                value={brightnessInput}
                onChangeText={(t) => {
                  if (/^\d{0,3}$/.test(t)) setBrightnessInput(t);
                }}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0 – 255"
                placeholderTextColor="#A0AEC0"
                selectTextOnFocus
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 150);
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
    borderBottomWidth: 1, borderBottomColor: '#F0F4FA',
  },
  cardIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#E8F4FB', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#11181C' },
  cardSubtitle: { fontSize: 12, color: '#7A8FAD', marginTop: 2 },
  cardSubtitleBold: { fontWeight: '700', color: '#1F5CA9' },
  cardBody: { padding: 16 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#F8FAFC', fontSize: 15, color: '#11181C',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0',
  },

  saveBtn: {
    backgroundColor: '#1F5CA9', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', marginTop: 15,
  },
  saveBtnDisabled: { backgroundColor: '#C8D3E8' },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
} as any);