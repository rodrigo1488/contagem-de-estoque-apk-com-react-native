import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface LicenseErrorScreenProps {
    errorMessage: string;
    errorTitle?: string;
}

export default function LicenseErrorScreen({ errorMessage, errorTitle = '⚠️ LICENÇA INVÁLIDA' }: LicenseErrorScreenProps) {

    const handleContact = () => {
        const message = encodeURIComponent(`Olá! Preciso de ajuda com minha licença.\n\nErro: ${errorMessage}`);
        Linking.openURL(`https://wa.me/5511999999999?text=${message}`);
    };

    const getIcon = () => {
        if (errorTitle.includes('VENCIDA')) return '⏰';
        if (errorTitle.includes('SUSPENSA')) return '🚫';
        if (errorTitle.includes('SERIAL')) return '❓';
        if (errorTitle.includes('ACESSOS')) return '👥';
        return '⚠️';
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.icon}>{getIcon()}</Text>

                <Text style={styles.title}>{errorTitle}</Text>

                <Text style={styles.message}>{errorMessage}</Text>

                <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
                    <IconSymbol name="paperplane.fill" size={20} color="#FFF" />
                    <Text style={styles.contactButtonText}>Entrar em Contato</Text>
                </TouchableOpacity>

                <Text style={styles.helpText}>
                    Entre em contato com o suporte para renovar ou resolver problemas com sua licença.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30
    },
    icon: {
        fontSize: 80,
        marginBottom: 20
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF3B30',
        marginBottom: 15,
        textAlign: 'center'
    },
    message: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24
    },
    contactButton: {
        backgroundColor: '#25D366',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
        gap: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4
    },
    contactButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold'
    },
    helpText: {
        marginTop: 30,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20
    }
});
