import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native';

interface CustomSwitchProps {
  value: boolean;
  onValueChange: () => void;
  trackColor?: { false: string; true: string };
  thumbColor?: string;
  style?: ViewStyle | ViewStyle[];
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CustomSwitch: React.FC<CustomSwitchProps> = ({
  value,
  onValueChange,
  trackColor = { false: '#E0E0E0', true: '#00AFEF' },
  thumbColor = '#ffffff',
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  // Track rộng 32px, Thumb rộng 20px. Chiều cao track 15px, Thumb 20px.
  // Khi tắt/bật, nút tròn tự động nhô ra ngoài lề trái/phải đều nhau 2.5px
  // khớp hoàn toàn với độ nhô lên/xuống theo chiều dọc giúp nút tròn cân đối tuyệt đối.
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-2.5, 14.5],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [trackColor.false, trackColor.true],
  });

  return (
    <AnimatedPressable
      onPress={onValueChange}
      style={[styles.track, { backgroundColor } as any, style]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
            backgroundColor: thumbColor,
          },
        ]}
      />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 32,          // Thu ngắn chiều rộng từ 36 xuống 32
    height: 15,         // Tăng chiều cao từ 14 lên 15 giúp thanh nền dày dặn hơn
    borderRadius: 7.5,  // Bo tròn mượt mà theo chiều cao mới (15 / 2)
    justifyContent: 'center',
    overflow: 'visible', // Cho phép nút tròn hiển thị nổi hẳn lên trên thanh nền
  },
  thumb: {
    width: 20,          // Tăng kích thước nút tròn thêm 2px (từ 18 lên 20)
    height: 20,         // Tăng kích thước nút tròn thêm 2px (từ 18 lên 20)
    borderRadius: 10,   // Bo tròn hoàn hảo (20 / 2)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,       // Tạo độ nổi khối đổ bóng rõ nét
  },
});