import Ionicons from '@expo/vector-icons/Ionicons';
import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
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

const SLIDER_WIDTH = 260;

function BrightnessSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(0, Math.min(255, v));

  const animX = useRef(new Animated.Value((value / 255) * SLIDER_WIDTH)).current;
  const currentVal = useRef(value);

  useEffect(() => {
    animX.setValue((value / 255) * SLIDER_WIDTH);
    currentVal.current = value;
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = Math.max(0, Math.min(SLIDER_WIDTH, e.nativeEvent.locationX));
        animX.setValue(x);
        currentVal.current = clamp(Math.round((x / SLIDER_WIDTH) * 255));
      },
      onPanResponderMove: (e) => {
        const x = Math.max(0, Math.min(SLIDER_WIDTH, e.nativeEvent.locationX));
        animX.setValue(x);
        currentVal.current = clamp(Math.round((x / SLIDER_WIDTH) * 255));
      },
      onPanResponderRelease: () => {
        onChange(currentVal.current);
      },
    })
  ).current;

  const thumbLeft = animX.interpolate({
    inputRange: [0, SLIDER_WIDTH],
    outputRange: [-12, SLIDER_WIDTH - 12],
    extrapolate: 'clamp',
  });

  return (
    <View style={sliderStyles.wrapper}>
      <View style={sliderStyles.track} {...panResponder.panHandlers}>
        <Animated.View style={[sliderStyles.fill, { width: animX }]} />
        <Animated.View style={[sliderStyles.thumb, { left: thumbLeft }]} />
      </View>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelText}>0</Text>
        <Text style={sliderStyles.labelText}>255</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { width: SLIDER_WIDTH, alignSelf: 'center', paddingBottom: 4 },
  track: {
    height: 8, backgroundColor: '#DDE4F0', borderRadius: 4,
    position: 'relative', justifyContent: 'center',
  },
  fill: {
    position: 'absolute', left: 0, top: 0, height: 8,
    backgroundColor: '#1F5CA9', borderRadius: 4,
  },
  thumb: {
    position: 'absolute', top: -8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#ffffff', borderWidth: 2.5, borderColor: '#1F5CA9',
    elevation: 3, shadowColor: '#1F5CA9',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  labelText: { fontSize: 11, color: '#7A8FAD', fontWeight: '500' },
});

export default function SettingsScreen() {
  useESPConnection();

  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentSsid, setCurrentSsid] = useState<string | null>(null);

  const [brightness, setBrightness] = useState(200);
  const [savedBrightness, setSavedBrightness] = useState(200);

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
    try {
      await set(ref(db, 'DongHo/DoSang'), brightness);
      setSavedBrightness(brightness);
      showSuccess('Đã lưu', `Độ sáng LED: ${brightness}`);
    } catch (e: any) { showError('Lỗi Firebase', e.message); }
  };

  const brightnessChanged = brightness !== savedBrightness;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Cài đặt</Text>
            <Text style={styles.headerSubtitle}>Cấu hình thiết bị</Text>
          </View>
        </View>

        <View style={styles.body}>

          {/* ── WiFi ── */}
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
              <Text style={styles.fieldLabel}>Tên WiFi (SSID)</Text>
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
                <Ionicons name="save-outline" size={17} color="#ffffff" />
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
                <Text style={styles.cardSubtitle}>Panel P10 HUB12</Text>
              </View>
              <View style={styles.brightnessValueBox}>
                <Text style={styles.brightnessValue}>{brightness}</Text>
                <Text style={styles.brightnessMax}>/255</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <BrightnessSlider value={brightness} onChange={setBrightness} />

              {/* Preset nhanh */}
              <View style={styles.presetRow}>
                {[
                  { label: 'Tắt', val: 0 },
                  { label: '25%', val: 64 },
                  { label: '50%', val: 128 },
                  { label: '80%', val: 200 },
                  { label: 'Max', val: 255 },
                ].map(({ label, val }) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.presetBtn, brightness === val && styles.presetBtnActive]}
                    onPress={() => setBrightness(val)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetBtnText, brightness === val && styles.presetBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !brightnessChanged && styles.saveBtnDisabled]}
                onPress={handleSaveBrightness}
                activeOpacity={0.8}
                disabled={!brightnessChanged}
              >
                <Ionicons name="save-outline" size={17} color="#ffffff" />
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
  scrollContent: { paddingBottom: 0},

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
  hintText: {
    fontSize: 12, color: '#A0AEC0', marginTop: 10, marginBottom: 16, fontStyle: 'italic',
  },

  saveBtn: {
    backgroundColor: '#1F5CA9', borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10,
  },
  saveBtnDisabled: { backgroundColor: '#C8D3E8' },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  brightnessValueBox: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  brightnessValue: { fontSize: 22, fontWeight: '800', color: '#1F5CA9' },
  brightnessMax: { fontSize: 13, color: '#7A8FAD', fontWeight: '500' },

  presetRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18, marginBottom: 20 },
  presetBtn: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#F0F4FA', borderWidth: 1.5, borderColor: '#DDE4F0',
  },
  presetBtnActive: { backgroundColor: '#1F5CA9', borderColor: '#1F5CA9' },
  presetBtnText: { fontSize: 12, fontWeight: '700', color: '#7A8FAD' },
  presetBtnTextActive: { color: '#FFF200' },
} as any);
