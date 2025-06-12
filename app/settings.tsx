import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, ThemeMode } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '@/context/WalletContext';

export default function SettingsScreen() {
  const { colors, mode, setThemeMode } = useTheme();
  const styles = useThemeStyles();
  const { updateSettings, settings, logout } = useWallet();
  
  // Handle theme mode change
  const handleThemeChange = async (newMode: ThemeMode) => {
    setThemeMode(newMode);
    
    // Also update in wallet settings if available
    if (updateSettings && settings) {
      await updateSettings({
        ...settings,
        theme: {
          ...settings.theme,
          mode: newMode
        }
      });
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>
          <Text style={styles.title}>Settings</Text>
          
          {/* Theme Section */}
          <View style={styles.card}>
            <Text style={[styles.text, { fontWeight: 'bold', fontSize: 18, marginBottom: 15 }]}>
              Appearance
            </Text>
            
            <Text style={[styles.textSecondary, { marginBottom: 10 }]}>
              Choose your preferred theme mode
            </Text>
            
            {/* Light Mode Option */}
            <TouchableOpacity 
              style={[styles.row, { padding: 15, borderRadius: 8, backgroundColor: mode === 'light' ? colors.secondary + '20' : 'transparent' }]}
              onPress={() => handleThemeChange('light')}
            >
              <View style={[styles.row, { flex: 1 }]}>
                <Ionicons name="sunny-outline" size={24} color={colors.textPrimary} style={{ marginRight: 10 }} />
                <Text style={styles.text}>Light</Text>
              </View>
              {mode === 'light' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
              )}
            </TouchableOpacity>
            
            {/* Dark Mode Option */}
            <TouchableOpacity 
              style={[styles.row, { padding: 15, borderRadius: 8, backgroundColor: mode === 'dark' ? colors.secondary + '20' : 'transparent' }]}
              onPress={() => handleThemeChange('dark')}
            >
              <View style={[styles.row, { flex: 1 }]}>
                <Ionicons name="moon-outline" size={24} color={colors.textPrimary} style={{ marginRight: 10 }} />
                <Text style={styles.text}>Dark</Text>
              </View>
              {mode === 'dark' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
              )}
            </TouchableOpacity>
            
            {/* System Mode Option */}
            <TouchableOpacity 
              style={[styles.row, { padding: 15, borderRadius: 8, backgroundColor: mode === 'system' ? colors.secondary + '20' : 'transparent' }]}
              onPress={() => handleThemeChange('system')}
            >
              <View style={[styles.row, { flex: 1 }]}>
                <Ionicons name="phone-portrait-outline" size={24} color={colors.textPrimary} style={{ marginRight: 10 }} />
                <Text style={styles.text}>System Default</Text>
              </View>
              {mode === 'system' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.secondary} />
              )}
            </TouchableOpacity>
          </View>
          
          {/* Account Section */}
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={[styles.text, { fontWeight: 'bold', fontSize: 18, marginBottom: 15 }]}>
              Account
            </Text>
            
            <TouchableOpacity 
              style={[styles.row, { padding: 15, borderRadius: 8, backgroundColor: colors.error + '20' }]}
              onPress={logout}
            >
              <View style={[styles.row, { flex: 1 }]}>
                <Ionicons name="log-out-outline" size={24} color={colors.error} style={{ marginRight: 10 }} />
                <Text style={[styles.text, { color: colors.error }]}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Other Settings Sections can be added here */}
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles are provided by useThemeStyles hook
