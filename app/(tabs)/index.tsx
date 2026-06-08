import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
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
import { CustomAlert } from '../../components/customalert';
import { CustomSwitch } from '../../components/customswitch';
import ScrollPicker from '../../components/scrollpicker';
import { db } from '../../config/firebaseConfig';
import { useCustomAlert, useESPConnection } from '../../hooks';

const RESET_TIER = { tiernumber: '', endHour: 7, endMinute: 50, break: 'Không' };

interface ScheduleItem {
  id: number;
  tiernumber: number;
  startTime: string;
  endTime: string;
  break: string;
  enabled: boolean;
}

export default function ScheduleScreen() {
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [newTier, setNewTier] = useState(RESET_TIER);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [endHour, setEndHour] = useState(7);
  const [endMinute, setEndMinute] = useState(50);
  const [selectedTierNumber, setSelectedTierNumber] = useState(1);
  const [alertVisible, setAlertVisible] = useState(false);
  
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { currentAlert, showSuccess, showError } = useCustomAlert();

  useESPConnection();

  useEffect(() => {
    if (currentAlert) {
      setAlertVisible(true);
    }
  }, [currentAlert]);

  useEffect(() => {
    const alarmRef = ref(db, 'DongHo/dsBaoThuc');
    const unsubscribe = onValue(alarmRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedSchedule: ScheduleItem[] = [];

        Object.keys(data).forEach((key) => {
          const cleanKey = key.replace(/\//g, '');

          if (cleanKey && cleanKey.includes('BaoThuc')) {
            const alarm = data[key];
            if (alarm && typeof alarm.gio === 'number' && typeof alarm.phut === 'number') {
              let tierNum = alarm.tier;
              if (!tierNum) {
                const match = cleanKey.match(/\d+/);
                tierNum = match ? parseInt(match[0], 10) : loadedSchedule.length + 1;
              }
              const idNum = tierNum;

              const formattedEndTime = `${String(alarm.gio).padStart(2, '0')}:${String(alarm.phut).padStart(2, '0')}`;

              let startH = alarm.gio;
              let startM = alarm.phut - 50;
              if (startM < 0) {
                startH -= 1;
                startM += 60;
              }
              if (startH < 0) {
                startH += 24;
              }
              const formattedStartTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

              loadedSchedule.push({
                id: idNum,
                tiernumber: tierNum,
                startTime: formattedStartTime,
                endTime: formattedEndTime,
                break: alarm.break || 'Không',
                enabled: alarm.active ?? false,
              });
            }
          }
        });

        setSchedule(loadedSchedule.sort((a, b) => a.tiernumber - b.tiernumber));
      } else {
        setSchedule([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveScheduleToFirebase = (updatedList: ScheduleItem[]) => {
    const alarmObjects: any = {};
    const sortedList = [...updatedList].sort((a, b) => a.tiernumber - b.tiernumber);

    sortedList.forEach((item) => {
      const [hours, minutes] = item.endTime.split(':');
      const keyName = `BaoThuc${item.tiernumber}`;

      alarmObjects[keyName] = {
        active: item.enabled,
        gio: parseInt(hours, 10) || 0,
        phut: parseInt(minutes, 10) || 0,
        break: item.break,
        tier: item.tiernumber
      };
    });

    set(ref(db, 'DongHo/dsBaoThuc'), alarmObjects)
      .catch((error) => showError('Lỗi Firebase', error.message));
  };

  const calculateStartTime = (hours: number, minutes: number) => {
    let startHours = hours;
    let startMinutes = minutes - 50;

    if (startMinutes < 0) {
      startHours -= 1;
      startMinutes += 60;
    }
    if (startHours < 0) {
      startHours += 24;
    }

    return `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`;
  };

  const handlePressCard = (id: number) => {
    if (expandedItemId === id) {
      setExpandedItemId(null);
      setConfirmDeleteId(null); 
    } else {
      setExpandedItemId(id);
      setConfirmDeleteId(null);
    }
  };

  const handleCloseAllExtensions = () => {
    if (expandedItemId !== null) {
      setExpandedItemId(null);
      setConfirmDeleteId(null);
    }
  };

  const onSelectEditAction = (item: ScheduleItem) => {
    setExpandedItemId(null); 
    setConfirmDeleteId(null);
    const [endHours, endMinutes] = item.endTime.split(':').map(Number);
    setEndHour(endHours);
    setEndMinute(endMinutes);
    setNewTier({
      tiernumber: String(item.tiernumber),
      endHour: endHours,
      endMinute: endMinutes,
      break: item.break,
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleDeleteItem = (id: number) => {
    const updated = schedule.filter(item => item.id !== id);
    setSchedule(updated);
    saveScheduleToFirebase(updated);

    setExpandedItemId(null);
    setConfirmDeleteId(null);
    showSuccess('Thành công', 'Đã xóa hẹn giờ');
  };

  const handleSubmitNewTier = () => {
    if (!selectedTierNumber) {
      showError('Lỗi', 'Vui lòng chọn số tiết');
      return;
    }

    const tierNum = selectedTierNumber;
    const isDuplicate = schedule.some(item => item.tiernumber === tierNum);
    if (isDuplicate) {
      showError('Lỗi', 'Số tiết này đã tồn tại! Vui lòng chọn lại');
      return;
    }

    const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    const startTimeStr = calculateStartTime(endHour, endMinute);

    const newId = Math.max(...schedule.map(s => s.id), 0) + 1;
    const newNotification: ScheduleItem = {
      id: newId,
      tiernumber: tierNum,
      startTime: startTimeStr,
      endTime: endTimeStr,
      break: newTier.break,
      enabled: true,
    };

    const updated = [...schedule, newNotification];
    setSchedule(updated);
    saveScheduleToFirebase(updated);
    setShowModal(false);
    setNewTier(RESET_TIER);
    setEndHour(7);
    setEndMinute(50);
  };

  const handleSubmitEditTier = () => {
    if (!newTier.tiernumber) {
      showError('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    const targetItem = schedule.find(item => String(item.tiernumber) === newTier.tiernumber || item.startTime === calculateStartTime(endHour, endMinute)); 
    const targetId = targetItem ? targetItem.id : 0;

    const tierNum = parseInt(newTier.tiernumber, 10);
    const isDuplicate = schedule.some(item =>
      item.tiernumber === tierNum && item.id !== targetId
    );
    if (isDuplicate) {
      showError('Lỗi', 'Số tiết này đã tồn tại! Vui lòng nhập lại');
      return;
    }

    const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    const startTimeStr = calculateStartTime(endHour, endMinute);

    const updated = schedule.map(item =>
      item.id === targetId
        ? {
          ...item,
          tiernumber: tierNum,
          startTime: startTimeStr,
          endTime: endTimeStr,
          break: newTier.break,
        }
        : item
    );

    setSchedule(updated);
    saveScheduleToFirebase(updated);

    setShowModal(false);
    setIsEditMode(false);
    setNewTier(RESET_TIER);
    setEndHour(7);
    setEndMinute(50);
    showSuccess('Thành công', 'Đã cập nhật hẹn giờ');
  };

  return (
    <View style={styles.container}>
      <CustomAlert visible={alertVisible} alert={currentAlert} onDismiss={() => setAlertVisible(false)} />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Hẹn giờ</Text>
          <Text style={styles.headerSubtitle}>Phân bố tiết học - Đại học Cần Thơ</Text>
        </View>
        <Image source={require('../../assets/images/ctu.png')} style={styles.headerLogo} resizeMode="contain" />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scheduleListContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onTouchStart={handleCloseAllExtensions}
      >
        {schedule.length > 0 ? (
          schedule.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const isConfirmingDelete = confirmDeleteId === item.id;
            
            return (
              <Pressable 
                key={item.id} 
                style={styles.cardContainer} 
                onTouchStart={(e) => e.stopPropagation()}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.tierCardRow}>
                  <TouchableOpacity
                    style={styles.tierCardLeftPressable}
                    activeOpacity={0.7}
                    onPress={() => handlePressCard(item.id)}
                  >
                    <View style={styles.tierNumber}>
                      <Text style={[styles.tierNumberText, !item.enabled && styles.textDisabledColor]}>
                        Tiết {item.tiernumber}
                      </Text>
                    </View>
                    <View style={styles.tierInfo}>
                      <Text style={[styles.tierTime, !item.enabled && styles.textDisabledOpacity]}>
                        {item.startTime} - {item.endTime}
                      </Text>
                      <Text style={[styles.tierBreak, !item.enabled && styles.textDisabledOpacity]}>
                        Thời gian nghỉ: {item.break}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.switchContainer}>
                    <CustomSwitch
                      value={item.enabled}
                      onValueChange={() => {
                        const updated = schedule.map(s => s.id === item.id ? { ...s, enabled: !s.enabled } : s);
                        setSchedule(updated);
                        saveScheduleToFirebase(updated);
                      }}
                      trackColor={{ false: '#D1D5DB', true: '#00AFEF' }}
                      thumbColor={item.enabled ? '#ffffff' : '#F3F4F6'}
                    />
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.expandedActionsContainer}>
                    <View style={[styles.originalActionsRow, isConfirmingDelete && { opacity: 0 }]}>
                      <TouchableOpacity 
                        style={styles.halfActionButton} 
                        onPress={() => setConfirmDeleteId(item.id)}
                        activeOpacity={0.6}
                      >
                        <FontAwesome6 name="trash" size={19} color="#E53E3E" />
                        <Text style={styles.actionButtonTextDelete}>Xóa tiết học</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.halfActionButton} 
                        onPress={() => onSelectEditAction(item)}
                        activeOpacity={0.6}
                      >
                        <FontAwesome6 name="pen-to-square" size={19} color="#1F5CA9" />
                        <Text style={styles.actionButtonTextEdit}>Chỉnh sửa</Text>
                      </TouchableOpacity>
                    </View>

                    {isConfirmingDelete && (
                      <View style={styles.confirmDeleteWrapper}>
                        <Text style={styles.confirmDeleteText}>Xóa tiết học này?</Text>
                        <View style={styles.confirmDeleteButtonsRow}>
                          <TouchableOpacity 
                            style={styles.confirmCancelButton} 
                            onPress={() => setConfirmDeleteId(null)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.confirmCancelButtonText}>Hủy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.confirmSubmitButton} 
                            onPress={() => handleDeleteItem(item.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.confirmSubmitButtonText}>Xóa</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyStateContainer} onTouchStart={(e) => e.stopPropagation()}>
            <Text style={styles.emptyText}>Không có tiết học nào</Text>
          </View>
        )}
      </ScrollView>

      {/* NÚT FAB THÊM MỚI */}
      <TouchableOpacity style={styles.fab} onPress={() => { setIsEditMode(false); setNewTier(RESET_TIER); setSelectedTierNumber(1); setShowModal(true); }} activeOpacity={0.85}>
        <FontAwesome6 name="plus" size={20} color="#ffffff" />
      </TouchableOpacity>

      {/* MODAL INPUT SCHEDULE */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{isEditMode ? 'CHỈNH SỬA' : 'THÊM MỚI'}</Text>
            </View>
            
            <View style={styles.modalFormContent}>
              <View style={styles.modalRowSection}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.modalLabel}>Tiết học</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={isEditMode ? newTier.tiernumber : String(selectedTierNumber)}
                    onChangeText={(t) => isEditMode ? setNewTier({ ...newTier, tiernumber: t }) : setSelectedTierNumber(parseInt(t, 10) || 0)}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.modalLabel}>Thời gian nghỉ</Text>
                  <View style={styles.breakTimeGroup}>
                    <TouchableOpacity style={[styles.breakTimeButton, newTier.break === 'Không' && styles.breakTimeButtonActive]} onPress={() => setNewTier({ ...newTier, break: 'Không' })}>
                      <Text style={[styles.breakTimeButtonText, newTier.break === 'Không' && styles.breakTimeButtonTextActive]}>Không</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.breakTimeButton, newTier.break === '10 phút' && styles.breakTimeButtonActive]} onPress={() => setNewTier({ ...newTier, break: '10 phút' })}>
                      <Text style={[styles.breakTimeButtonText, newTier.break === '10 phút' && styles.breakTimeButtonTextActive]}>10 phút</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* KHU VỰC CHỈNH GIỜ ĐÃ ĐỒNG BỘ - ĐÃ FIX THÊM STYLE modalSection */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Giờ kết thúc</Text>
                
                {/* ĐỒNG BỘ PICKER CONTAINER (2 CỘT GIỜ : PHÚT) */}
                <View style={styles.timePickerContainer}>
                  <View style={styles.timePickerCol}>
                    <Text style={styles.timePickerLabel}>GIỜ</Text>
                    <View style={styles.timePickerBox}>
                      <ScrollPicker 
                        options={Array.from({ length: 24 }, (_, i) => i)} 
                        selectedValue={endHour} 
                        onValueChange={setEndHour} 
                      />
                    </View>
                  </View>

                  <Text style={styles.timePickerSeparator}>:</Text>

                  <View style={styles.timePickerCol}>
                    <Text style={styles.timePickerLabel}>PHÚT</Text>
                    <View style={styles.timePickerBox}>
                      <ScrollPicker 
                        options={Array.from({ length: 60 }, (_, i) => i)} 
                        selectedValue={endMinute} 
                        onValueChange={setEndMinute} 
                      />
                    </View>
                  </View>
                </View>

                {/* ĐỒNG BỘ BOX XEM TRƯỚC */}
                <View style={styles.timeDisplayContainer}>
                  <View style={styles.timeDisplayBox}>
                    <Text style={styles.timeDisplayBoxLabel}>Bắt đầu</Text>
                    <Text style={styles.timeDisplayBoxValue}>{calculateStartTime(endHour, endMinute)}</Text>
                  </View>
                  <View style={styles.timeDisplayBox}>
                    <Text style={styles.timeDisplayBoxLabel}>Kết thúc</Text>
                    <Text style={styles.timeDisplayBoxValue}>{`${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`}</Text>
                  </View>
                </View>

              </View>
            </View>
            
            <View style={styles.modalBottomActions}>
              <TouchableOpacity activeOpacity={0.7} style={styles.modalBottomButton} onPress={() => setShowModal(false)}>
                <Text style={styles.modalBottomButtonTextCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.modalBottomButton} onPress={isEditMode ? handleSubmitEditTier : handleSubmitNewTier}>
                <Text style={styles.modalBottomButtonTextSubmit}>Xong</Text>
              </TouchableOpacity>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { 
    backgroundColor: '#1F5CA9', 
    paddingVertical: 15, 
    paddingHorizontal: 20, 
    paddingTop: 50, 
    // borderBottomLeftRadius: 20, 
    // borderBottomRightRadius: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', color: '#ffffff' },
  headerLogo: { width: 80, height: 80, marginLeft: 12 },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    left: '50%', 
    marginLeft: -27.5, 
    width: 55, 
    height: 55, 
    borderRadius: 22, 
    backgroundColor: '#FFF200', 
    alignItems: 'center', 
    justifyContent: 'center',
    // Thêm phần này để tạo bóng nhẹ
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8, // Độ nổi trên Android
  },
  scheduleListContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
  
  cardContainer: {
    backgroundColor: '#1F5CA9', 
    borderRadius: 18, 
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tierCardRow: { flexDirection: 'row', alignItems: 'stretch' },
  tierCardLeftPressable: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  switchContainer: { justifyContent: 'center', alignItems: 'center', paddingLeft: 8, paddingRight: 16 },
  textDisabledColor: { color: '#7E8B9B' },
  textDisabledOpacity: { opacity: 0.38 },
  tierNumber: { backgroundColor: '#FFF200', paddingVertical: 14, paddingHorizontal: 14, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  tierNumberText: { fontSize: 14, fontWeight: '700', color: '#1F5CA9' },
  tierInfo: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  tierTime: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  tierBreak: { fontSize: 12, color: '#ffffff', fontWeight: '500' },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#1F5CA9', fontWeight: '600' },

  expandedActionsContainer: { position: 'relative', backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 20, minHeight: 58, width: '100%' },
  originalActionsRow: { flexDirection: 'row', width: '100%' },
  halfActionButton: { flex: 1, paddingVertical: 6, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4 },
  actionButtonTextDelete: { fontSize: 12, fontWeight: '600', color: '#E53E3E', marginTop: 2 },
  actionButtonTextEdit: { fontSize: 12, fontWeight: '600', color: '#1F5CA9', marginTop: 2 },

  confirmDeleteWrapper: { position: 'absolute', top: 12, bottom: 12, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' },
  confirmDeleteText: { fontSize: 14, fontWeight: '600', color: '#000000' },
  confirmDeleteButtonsRow: { flexDirection: 'row', gap: 6 },
  confirmCancelButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  confirmCancelButtonText: { fontSize: 13, fontWeight: '700', color: '#000000' },
  confirmSubmitButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffffff' },
  confirmSubmitButtonText: { fontSize: 13, fontWeight: '700', color: '#E53E3E' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, width: '92%', maxWidth: 380, overflow: 'hidden' },
  modalHeader: { paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F0F4F8', alignItems: 'center' },
  modalHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#1A202C', letterSpacing: 0.5 },
  modalFormContent: { padding: 20, paddingBottom: 10 },
  
  // KHẮC PHỤC LỖI THIẾU CLASS STYLE TRÊN SCREENSHOT
  modalSection: { marginBottom: 8 }, 
  
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#F8FAFC', fontWeight: '600', color: '#1A202C' },
  modalRowSection: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  breakTimeGroup: { flexDirection: 'row', gap: 8, flex: 1 },
  breakTimeButton: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  breakTimeButtonActive: { backgroundColor: '#1F5CA9', borderColor: '#1F5CA9' },
  breakTimeButtonText: { fontSize: 14, color: '#000000', fontWeight: '700' },
  breakTimeButtonTextActive: { color: '#ffffff', fontWeight: '700' },
  
  // --- STYLE TIME PICKER ĐỒNG BỘ ---
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
    marginBottom: 16,
  },
  timePickerCol: {
    flex: 1,
    alignItems: 'center',
  },
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
  timeDisplayContainer: { flexDirection: 'row', gap: 10 },
  timeDisplayBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  timeDisplayBoxLabel: { fontSize: 14, fontWeight: '700', color: '#000000', marginBottom: 4 },
  timeDisplayBoxValue: { fontSize: 20, fontWeight: '900', color: '#1F5CA9', letterSpacing: 0.5 },

  modalBottomActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20, paddingTop: 10, backgroundColor: '#FFFFFF' },
  modalBottomButton: { paddingVertical: 12, paddingHorizontal: 16 },
  modalBottomButtonTextCancel: { fontSize: 16, fontWeight: '700', color: '#000000' },
  modalBottomButtonTextSubmit: { fontSize: 16, fontWeight: '700', color: '#1F5CA9' }
} as any);