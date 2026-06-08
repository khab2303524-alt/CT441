import WheelPicker, { withVirtualized } from '@quidone/react-native-wheel-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const VirtualizedWheelPicker = withVirtualized(WheelPicker);

interface ScrollPickerProps {
  options: (string | number)[];
  selectedValue: string | number;
  onValueChange: (value: any) => void;
  itemHeight?: number;
  visibleItems?: number;
}

const REPEATS = 21;
const CENTER = Math.floor(REPEATS / 2); // = 10

export default function ScrollPicker({
  options,
  selectedValue,
  onValueChange,
  itemHeight = 50,
  visibleItems = 3,
}: ScrollPickerProps) {
  const optLen = options.length;

  const data = useMemo(
    () =>
      Array.from({ length: REPEATS }, (_, block) =>
        options.map((opt, origIdx) => ({
          value: block * optLen + origIdx,
          label:
            typeof opt === 'number'
              ? String(opt).padStart(2, '0')
              : String(opt),
        }))
      ).flat(),
    [options]
  );

  const origIdx = options.indexOf(selectedValue);
  const initialPickerValue = CENTER * optLen + (origIdx === -1 ? 0 : origIdx);
  const [pickerValue, setPickerValue] = useState(initialPickerValue);

  const isUserChange = useRef(false);

  useEffect(() => {
    if (isUserChange.current) {
      isUserChange.current = false;
      return;
    }
    const idx = options.indexOf(selectedValue);
    if (idx !== -1) {
      setPickerValue(CENTER * optLen + idx);
    }
  }, [selectedValue]);

  const handleValueChanged = useCallback(
    ({ item }: { item: { value: number; label: string } }) => {
      isUserChange.current = true;
      setPickerValue(item.value);
      const realIdx = item.value % optLen;
      onValueChange(options[realIdx]);
    },
    [options, optLen, onValueChange]
  );

  // TỰ TÍNH TRẠNG THÁI ACTIVE: So sánh item.value với pickerValue hiện tại của bánh xe
  const renderItem = useCallback(({ item }: { item: any }) => {
    const isCurrentActive = item.value === pickerValue;

    return (
      <View style={[styles.itemContainer, { height: itemHeight }]}>
        <Text
          style={[
            styles.itemText,
            isCurrentActive ? styles.activeText : styles.inactiveText
          ]}
        >
          {item.label}
        </Text>
      </View>
    );
  }, [itemHeight, pickerValue]); // Cần theo dõi pickerValue ở đây để render lại khi cuộn

  return (
    <VirtualizedWheelPicker
      data={data}
      value={pickerValue}
      onValueChanged={handleValueChanged}
      itemHeight={itemHeight}
      visibleItemCount={visibleItems}
      width={75}
      style={{ height: itemHeight * visibleItems }}
      enableScrollByTapOnItem
      renderItem={renderItem as any}
    /> as any
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  itemText: {
    fontFamily: 'System',
    fontVariant: ['tabular-nums'],
  },
  // BÂY GIỜ BẠN CÓ THỂ CHỈNH THOẢI MÁI THEO Ý MUỐN:

  // 1. Số được chọn ở chính giữa
  activeText: {
    fontSize: 24,          // Cỡ chữ số giữa to nổi bật
    fontWeight: '900',     // Chữ đậm nét
    color: '#1F5CA9',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  // 2. Các số mờ xung quanh khi chưa được chọn
  inactiveText: {
    fontSize: 24,          // Cỡ chữ nhỏ hơn số giữa
    fontWeight: '900',     // Chữ mảnh hơn
    color: '#1F5CA9',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  }
});