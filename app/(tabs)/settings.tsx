import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function App() {
    // Hàm xử lý khi người dùng bấm nút
    const handlePress = () => {
        Alert.alert('Thông báo', 'Bạn vừa bấm vào nút!');
    };

    return (
        <View style={styles.container}>
            {/* Tiêu đề chính */}
            <Text style={styles.title}>Chào mừng đến với Expo!</Text>

            {/* Đoạn mô tả */}
            <Text style={styles.subtitle}>Đây là màn hình cơ bản đầu tiên của bạn.</Text>

            {/* Nút bấm tùy chỉnh */}
            <TouchableOpacity style={styles.button} onPress={handlePress}>
                <Text style={styles.buttonText}>Bấm vào đây</Text>
            </TouchableOpacity>
        </View>
    );
}

// Định dạng giao diện (CSS-in-JS)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});