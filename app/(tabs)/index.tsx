import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { CustomSwitch } from '../../components/customswitch';
import { FeedbackModal } from '../../components/feedbackmodal';
import ScrollPicker from '../../components/scrollpicker';
import { db } from '../../config/firebaseConfig';
import { useESPConnection } from '../../hooks';

interface ScheduleItem {
  id: number;
  alarmTime: string;
  note: string;
  enabled: boolean;
}

export default function ScheduleScreen() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMinute, setAlarmMinute] = useState(0);
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({ visible: false, type: 'success', title: '', message: '' });

  const showSuccess = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'success', title, message });
  const showError = (title: string, message: string) =>
    setFeedbackModal({ visible: true, type: 'error', title, message });
  const hideFeedback = () => setFeedbackModal(prev => ({ ...prev, visible: false }));

  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetTargetId, setBottomSheetTargetId] = useState<number | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const bottomSheetAnim = useRef(new Animated.Value(300)).current;

  useESPConnection();

  // Load notes từ AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('alarm_notes').then((raw) => {
      if (raw) setLocalNotes(JSON.parse(raw));
    });
  }, []);

  const saveLocalNotes = async (notes: Record<string, string>) => {
    setLocalNotes(notes);
    await AsyncStorage.setItem('alarm_notes', JSON.stringify(notes));
  };

  useEffect(() => {
    const alarmRef = ref(db, 'DongHo/dsBaoThuc');
    const unsubscribe = onValue(alarmRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedSchedule: ScheduleItem[] = [];
        Object.keys(data).forEach((key) => {
          const alarm = data[key];
          if (alarm && typeof alarm.gio === 'number' && typeof alarm.phut === 'number') {
            const match = key.match(/\d+/);
            const idNum = match ? parseInt(match[0], 10) : loadedSchedule.length + 1;
            const formattedTime = `${String(alarm.gio).padStart(2, '0')}:${String(alarm.phut).padStart(2, '0')}`;
            loadedSchedule.push({
              id: idNum,
              alarmTime: formattedTime,
              note: '',  // sẽ merge từ localNotes bên dưới
              enabled: alarm.active ?? false,
            });
          }
        });
        AsyncStorage.getItem('alarm_notes').then((raw) => {
          const notes: Record<string, string> = raw ? JSON.parse(raw) : {};
          const merged = loadedSchedule.map(item => ({ ...item, note: notes[item.alarmTime] || '' }));
          setSchedule(merged.sort((a, b) => a.alarmTime.localeCompare(b.alarmTime)));
        });
      } else {
        setSchedule([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveScheduleToFirebase = (updatedList: ScheduleItem[]) => {
    const alarmObjects: any = {};
    updatedList.forEach((item, index) => {
      const [hours, minutes] = item.alarmTime.split(':');
      const keyName = `BaoThuc${index + 1}`;
      alarmObjects[keyName] = {
        active: item.enabled,
        gio: parseInt(hours, 10) || 0,
        phut: parseInt(minutes, 10) || 0,
      };
    });
    set(ref(db, 'DongHo/dsBaoThuc'), alarmObjects)
      .catch((error) => showError('Lỗi Firebase', error.message));
  };

  const openBottomSheet = (id: number) => {
    setBottomSheetTargetId(id);
    setShowConfirmDelete(false);
    setShowBottomSheet(true);
    Animated.spring(bottomSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const closeBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setShowBottomSheet(false);
      setBottomSheetTargetId(null);
      setShowConfirmDelete(false);
    });
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setEditTargetId(null);
    setAlarmHour(7);
    setAlarmMinute(0);
    setNote('');
    setShowModal(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    const [h, m] = item.alarmTime.split(':').map(Number);
    setAlarmHour(h);
    setAlarmMinute(m);
    setNote(item.note);
    setEditTargetId(item.id);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleDeleteItem = (id: number) => {
    const target = schedule.find(item => item.id === id);
    const updated = schedule.filter(item => item.id !== id);
    setSchedule(updated);
    saveScheduleToFirebase(updated);
    // Xóa note khỏi AsyncStorage
    if (target) {
      const updatedNotes = { ...localNotes };
      delete updatedNotes[target.alarmTime];
      saveLocalNotes(updatedNotes);
    }
    closeBottomSheet();
    showSuccess('Thành công', 'Đã xóa hẹn giờ');
  };

  const handleSubmit = () => {
    const alarmTimeStr = `${String(alarmHour).padStart(2, '0')}:${String(alarmMinute).padStart(2, '0')}`;

    const isDuplicate = schedule.some(item =>
      item.alarmTime === alarmTimeStr &&
      (!isEditMode || item.id !== editTargetId)
    );

    if (isDuplicate) {
      showError('Lỗi', 'Giờ hẹn này đã tồn tại');
      return;
    }

    if (isEditMode && editTargetId !== null) {
      const oldItem = schedule.find(item => item.id === editTargetId);
      const updated = schedule.map(item =>
        item.id === editTargetId ? { ...item, alarmTime: alarmTimeStr, note } : item
      );
      setSchedule(updated);
      saveScheduleToFirebase(updated);
      // Cập nhật note trong AsyncStorage (xóa key cũ nếu đổi giờ)
      const updatedNotes = { ...localNotes };
      if (oldItem && oldItem.alarmTime !== alarmTimeStr) delete updatedNotes[oldItem.alarmTime];
      updatedNotes[alarmTimeStr] = note;
      saveLocalNotes(updatedNotes);
      showSuccess('Thành công', 'Đã cập nhật hẹn giờ');
    } else {
      const newId = Math.max(...schedule.map(s => s.id), 0) + 1;
      const newItem: ScheduleItem = { id: newId, alarmTime: alarmTimeStr, note, enabled: true };
      const updated = [...schedule, newItem];
      setSchedule(updated);
      saveScheduleToFirebase(updated);
      // Lưu note mới vào AsyncStorage
      const updatedNotes = { ...localNotes, [alarmTimeStr]: note };
      saveLocalNotes(updatedNotes);
      showSuccess('Thành công', 'Đã thêm hẹn giờ');
    }
    setShowModal(false);
    setNote('');
    setAlarmHour(7);
    setAlarmMinute(0);
  };

  const bottomSheetTarget = schedule.find(s => s.id === bottomSheetTargetId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Hẹn giờ</Text>
          <Text style={styles.headerSubtitle}>Chuông báo tiết học</Text>
        </View>
        {/* <Image source={require('../../assets/images/ctu.png')} style={styles.headerLogo} resizeMode="contain" /> */}
      </View>

      <ScrollView
        contentContainerStyle={styles.scheduleListContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {schedule.length > 0 ? (
          schedule.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.cardContainer,
                item.enabled ? styles.cardEnabled : styles.cardDisabled,
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => openEditModal(item)}
              onLongPress={() => openBottomSheet(item.id)}
              delayLongPress={350}
            >
              <View style={[styles.timeColumn, !item.enabled && styles.timeColumnDisabled]}>
                <Text style={[styles.timeText, !item.enabled && styles.timeTextDisabled]}>
                  {item.alarmTime.split(':')[0]}
                </Text>
                <Text style={[styles.timeSep, !item.enabled && styles.timeTextDisabled]}>:</Text>
                <Text style={[styles.timeText, !item.enabled && styles.timeTextDisabled]}>
                  {item.alarmTime.split(':')[1]}
                </Text>
              </View>

              <View style={styles.noteColumn}>
                {item.note ? (
                  <Text style={[styles.noteText, !item.enabled && styles.noteTextDisabled]}>
                    {item.note}
                  </Text>
                ) : (
                  <Text style={[styles.notePlaceholder, !item.enabled && styles.noteTextDisabled]}>
                    Không có ghi chú
                  </Text>
                )}
              </View>

              <View style={styles.switchColumn}>
                <CustomSwitch
                  value={item.enabled}
                  onValueChange={() => {
                    const updated = schedule.map(s =>
                      s.id === item.id ? { ...s, enabled: !s.enabled } : s
                    );
                    setSchedule(updated);
                    saveScheduleToFirebase(updated);
                  }}
                  activeColor="#00AFEF"
                  inactiveColor="#C8D3E8"
                />
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome6 name="bell-slash" size={40} color="#CBD5E0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Chưa có hẹn giờ nào</Text>
            <Text style={styles.emptySubText}>Nhấn + để thêm hẹn giờ mới</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
        <FontAwesome6 name="plus" size={20} color="#ffffff" />
      </TouchableOpacity>

      {/* BOTTOM SHEET */}
      <Modal visible={showBottomSheet} transparent animationType="none" onRequestClose={closeBottomSheet}>
        <Pressable style={styles.bottomSheetOverlay} onPress={closeBottomSheet}>
          <Animated.View
            style={[styles.bottomSheetContainer, { transform: [{ translateY: bottomSheetAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.bottomSheetHandle} />

              {bottomSheetTarget && (
                <View style={styles.bsInfoSimple}>
                  <Text style={styles.bsInfoTime}>{bottomSheetTarget.alarmTime}</Text>
                  <Text style={bottomSheetTarget.note ? styles.bsInfoNote : styles.bsInfoNotePlaceholder}>
                    {bottomSheetTarget.note || 'Không có ghi chú'}
                  </Text>
                </View>
              )}

              <View style={styles.bottomSheetDivider} />

              {!showConfirmDelete ? (
                <>
                  <TouchableOpacity
                    style={styles.bottomSheetDeleteBtn}
                    activeOpacity={0.7}
                    onPress={() => setShowConfirmDelete(true)}
                  >
                    <FontAwesome6 name="trash" size={17} color="#DC2626" />
                    <Text style={styles.bottomSheetDeleteText}>Xóa hẹn giờ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.confirmDeleteSection}>
                  <View style={styles.confirmIconRow}>
                    <View style={styles.confirmIconCircle}>
                      <FontAwesome6 name="trash" size={15} color="#DC2626" />
                    </View>
                    <Text style={styles.confirmDeleteTitle}>Xóa giờ hẹn này?</Text>
                  </View>
                  <Text style={styles.confirmDeleteSub}>Thao tác này không thể hoàn tác</Text>
                  <View style={styles.confirmDeleteBtnRow}>
                    <TouchableOpacity
                      style={styles.confirmCancelBtn}
                      activeOpacity={0.7}
                      onPress={() => setShowConfirmDelete(false)}
                    >
                      <Text style={styles.confirmCancelBtnText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmDeleteBtn}
                      activeOpacity={0.7}
                      onPress={() => bottomSheetTargetId !== null && handleDeleteItem(bottomSheetTargetId)}
                    >
                      <FontAwesome6 name="trash" size={13} color="#ffffff" />
                      <Text style={styles.confirmDeleteBtnText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* MODAL THÊM / CHỈNH SỬA */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {isEditMode ? 'CHỈNH SỬA' : 'THÊM HẸN GIỜ'}
              </Text>
            </View>

            <View style={styles.modalFormContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Ghi chú</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Nhập ghi chú"
                  placeholderTextColor="#A0AEC0"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Chọn thời gian</Text>
                <View style={styles.timePickerContainer}>
                  <View style={styles.timePickerCol}>
                    <Text style={styles.timePickerLabel}>GIỜ</Text>
                    <View style={styles.timePickerBox}>
                      <ScrollPicker
                        options={Array.from({ length: 24 }, (_, i) => i)}
                        selectedValue={alarmHour}
                        onValueChange={setAlarmHour}
                      />
                    </View>
                  </View>
                  <Text style={styles.timePickerSeparator}>:</Text>
                  <View style={styles.timePickerCol}>
                    <Text style={styles.timePickerLabel}>PHÚT</Text>
                    <View style={styles.timePickerBox}>
                      <ScrollPicker
                        options={Array.from({ length: 60 }, (_, i) => i)}
                        selectedValue={alarmMinute}
                        onValueChange={setAlarmMinute}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.modalBottomActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.modalBottomButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalBottomButtonTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.modalBottomButton}
                onPress={handleSubmit}
              >
                <Text style={styles.modalBottomButtonTextSubmit}>Xong</Text>
              </TouchableOpacity>
            </View>

          </Pressable>

          <FeedbackModal
            visible={feedbackModal.visible}
            type={feedbackModal.type}
            title={feedbackModal.title}
            message={feedbackModal.message}
            onDismiss={hideFeedback}
          />
        </Pressable>
      </Modal>

      {!showModal && (
        <FeedbackModal
          visible={feedbackModal.visible}
          type={feedbackModal.type}
          title={feedbackModal.title}
          message={feedbackModal.message}
          onDismiss={hideFeedback}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4FA' },

  header: {
    backgroundColor: '#1F5CA9',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', color: '#ffffff' },
  headerLogo: { width: 80, height: 80, marginLeft: 12 },

  scheduleListContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  cardContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 20,
    marginBottom: 10,
    minHeight: 72,
  },
  cardEnabled: { backgroundColor: '#1F5CA9' },
  cardDisabled: { backgroundColor: '#DDE4F0' },

  timeColumn: {
    width: 80,
    backgroundColor: '#FFF200',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 1,
    flexShrink: 0,
    alignSelf: 'stretch',
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
  },
  timeColumnDisabled: {
    backgroundColor: '#C8D3E8',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F5CA9',
    letterSpacing: 0,
    lineHeight: 28,
  },
  timeSep: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F5CA9',
    lineHeight: 28,
    marginBottom: 2,
  },
  timeTextDisabled: {
    color: '#7A8FAD',
  },

  noteColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 21,
  },
  notePlaceholder: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  noteTextDisabled: {
    color: '#8899B0',
  },

  switchColumn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: { fontSize: 16, color: '#A0AEC0', fontWeight: '600' },
  emptySubText: { fontSize: 13, color: '#CBD5E0', marginTop: 6 },

  fab: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    marginLeft: -27.5,
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#fff200',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── BOTTOM SHEET ──
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },

  bsInfoSimple: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  bsInfoTime: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1F5CA9',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bsInfoNote: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A5568',
  },
  bsInfoNotePlaceholder: {
    fontSize: 15,
    fontWeight: '400',
    color: '#A0AEC0',
    fontStyle: 'italic',
  },

  bottomSheetDivider: {
    height: 1,
    backgroundColor: '#F0F4F8',
    marginBottom: 16,
  },
  bottomSheetDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  bottomSheetDeleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  confirmDeleteSection: {
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  confirmIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  confirmIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  confirmDeleteSub: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
    paddingLeft: 44,
    lineHeight: 18,
  },
  confirmDeleteBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
  },

  // ── MODAL ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '92%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F5CA9',
    letterSpacing: 0.5,
  },
  modalFormContent: { padding: 20, paddingBottom: 10 },
  modalSection: { marginBottom: 16 },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  timePickerCol: { flex: 1, alignItems: 'center' },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  timePickerBox: {
    height: 150,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerSeparator: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F5CA9',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#F8FAFC',
    fontWeight: '500',
    color: '#000000',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalBottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 5,
    backgroundColor: '#FFFFFF',
  },
  modalBottomButton: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBottomButtonTextCancel: { fontSize: 16, fontWeight: '700', color: '#000000' },
  modalBottomButtonTextSubmit: { fontSize: 16, fontWeight: '700', color: '#1F5CA9' },
} as any);
