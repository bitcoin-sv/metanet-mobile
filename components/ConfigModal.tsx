import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet, WABConfig } from '@/context/WalletContext';

interface ConfigModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfigured: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ visible, onDismiss, onConfigured }) => {
  // Access theme
  const { colors, isDark } = useTheme();
  const styles = useThemeStyles();
  const { 
    finalizeConfig, 
    managers, 
    setConfigStatus, 
    selectedWabUrl, 
    selectedStorageUrl, 
    selectedMethod, 
    selectedNetwork,
    setWalletBuilt
  } = useWallet();
  
  // State for configuration
  const [wabUrl, setWabUrl] = useState<string>(selectedWabUrl);
  const [wabInfo, setWabInfo] = useState<{
    supportedAuthMethods: string[];
    faucetEnabled: boolean;
    faucetAmount: number;
  } | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [method, setMethod] = useState<WABConfig['method']>(selectedMethod);
  const [network, setNetwork] = useState<WABConfig['network']>(selectedNetwork);
  const [storageUrl, setStorageUrl] = useState<string>(selectedStorageUrl);
  const [backupConfig, setBackupConfig] = useState<WABConfig>();
  
  // Validation
  const isUrlValid = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  const isFormValid = () => {
    return isUrlValid(wabUrl) && isUrlValid(storageUrl);
  };
  
  // Fetch wallet configuration info
  const fetchWalletConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch(`${wabUrl}/info`);
      if (!res.ok) {
        throw new Error(`Failed to fetch info: ${res.status}`);
      }
      const info = await res.json();
      setWabInfo(info);
      
      // Auto-select the first supported authentication method if available
      if (info.supportedAuthMethods && info.supportedAuthMethods.length > 0) {
        setMethod(info.supportedAuthMethods[0]);
      }
    } catch (error: any) {
      console.error('Error fetching wallet config:', error);
      Alert.alert('Error', 'Could not fetch wallet configuration: ' + error.message);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Auto-fetch wallet configuration info when component mounts
  useEffect(() => {
    if (visible && !wabInfo && !managers?.walletManager?.authenticated) {
      fetchWalletConfig();
    }
  }, [visible]);

  // Force the manager to use the "presentation-key-and-password" flow
  useEffect(() => {
    if (managers?.walletManager) {
      managers.walletManager.authenticationMode = 'presentation-key-and-password';
    }
  }, [managers?.walletManager]);

  const layAwayCurrentConfig = () => {
    setWalletBuilt(false);
    setBackupConfig({
      wabUrl,
      wabInfo,
      method,
      network,
      storageUrl
    });
    if (managers?.walletManager) {
      delete managers.walletManager;
    }
    if (managers?.permissionsManager) {
      delete managers.permissionsManager;
    }
    if (managers?.settingsManager) {
      delete managers.settingsManager;
    }
  };

  const resetCurrentConfig = useCallback(() => {
    if (backupConfig) {
      finalizeConfig(backupConfig);
    }
  }, [backupConfig, finalizeConfig]);

  // Handle save and continue
  const handleSaveConfig = () => {
    if (!isFormValid()) {
      Alert.alert('Invalid Configuration', 'Please ensure both URLs are valid.');
      return;
    }

    layAwayCurrentConfig();
    
    // Construct the WAB config
    const wabConfig: WABConfig = {
      wabUrl,
      wabInfo,
      method,
      network,
      storageUrl
    };
    
    // Save the configuration
    const success = finalizeConfig(wabConfig);
    if (success) {
      setConfigStatus('configured');
      console.log('Configuration saved successfully');
      onConfigured();
      onDismiss();
    } else {
      Alert.alert('Configuration Error', 'Failed to save configuration. Please try again.');
      resetCurrentConfig();
    }
  };
  
  // Handle cancellation
  const handleCancel = () => {
    setConfigStatus('configured');
    resetCurrentConfig();
    onDismiss();
  };
  
  // Render a selectable chip
  const renderChip = (label: string, labelSelected: string, onPress: Function) => (
    <TouchableOpacity
      style={[
        styles.row,
        {
          padding: 12,
          borderRadius: 20,
          marginRight: 10,
          marginBottom: 5,
          backgroundColor: labelSelected === label ? colors.secondary : colors.inputBackground,
          borderWidth: 1,
          borderColor: labelSelected === label ? colors.secondary : colors.inputBorder,
        }
      ]}
      onPress={() => onPress(label)}
    >
      {labelSelected === label && (
        <Ionicons 
          name="checkmark-circle" 
          size={18} 
          color={isDark ? colors.background : colors.buttonText} 
          style={{ marginRight: 6 }}
        />
      )}
      <Text style={[styles.text, { color: labelSelected === label ? (isDark ? colors.background : colors.buttonText) : colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={[{ 
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.inputBorder
        }]}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={[styles.text, { color: colors.secondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Configuration</Text>
          <TouchableOpacity onPress={handleSaveConfig} disabled={!isFormValid()}>
            <Text style={[styles.text, { color: isFormValid() ? colors.secondary : colors.textSecondary }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>            
            {/* WAB Configuration */}
            <View style={styles.card}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                Wallet Authentication Backend (WAB)
              </Text>
              <Text style={[styles.textSecondary, { marginBottom: 15 }]}>
                Provides 2 of 3 backup and recovery functionality for your root key.
              </Text>
              
              {isLoadingConfig && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.secondary} />
                </View>
              )}
              
              <Text style={styles.inputLabel}>WAB URL</Text>
              <View style={styles.input}>
                <TextInput
                  style={styles.inputText}
                  value={wabUrl}
                  onChangeText={setWabUrl}
                  placeholder="Enter WAB URL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.button, { marginTop: 10 }]}
                onPress={fetchWalletConfig}
                disabled={isLoadingConfig}
              >
                <Text style={styles.buttonText}>Refresh Info</Text>
              </TouchableOpacity>
              
              {/* Phone Verification Service */}
              <Text style={[styles.inputLabel, { marginTop: 15 }]}>
                Service which will be used to verify your phone number
              </Text>
              <View style={[styles.row, { flexWrap: 'wrap', marginVertical: 10 }]}>
                {renderChip('Twilio', method, setMethod)}
                {renderChip('Persona', method, setMethod)}
              </View>
            </View>
            
            {/* Network Configuration */}
            <View style={[styles.card, { marginTop: 15 }]}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                BSV Network
              </Text>
              
              <View style={[styles.row, { flexWrap: 'wrap', marginVertical: 10 }]}>
                {renderChip('main', network, setNetwork)}
                {renderChip('test', network, setNetwork)}
              </View>
            </View>
            
            {/* Storage Configuration */}
            <View style={[styles.card, { marginTop: 15 }]}>
              <Text style={[styles.text, { fontWeight: 'bold', fontSize: 16, marginBottom: 10 }]}>
                Wallet Storage Provider
              </Text>
              <Text style={[styles.textSecondary, { marginBottom: 15 }]}>
                Used for your transactions and metadata storage.
              </Text>
              
              <Text style={styles.inputLabel}>Storage URL</Text>
              <View style={styles.input}>
                <TextInput
                  style={styles.inputText}
                  value={storageUrl}
                  onChangeText={setStorageUrl}
                  placeholder="Enter Storage URL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ConfigModal;
