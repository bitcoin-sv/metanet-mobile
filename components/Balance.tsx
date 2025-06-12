import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';
import { sdk } from '@bsv/wallet-toolbox-mobile';
import AmountDisplay from './AmountDisplay';
import AppLogo from './AppLogo';

export default function Balance() {
    const { colors } = useTheme();
    const { managers, adminOriginator } = useWallet();
    const [accountBalance, setAccountBalance] = React.useState(0);
    const [balanceLoading, setBalanceLoading] = React.useState(false);

    const refreshBalance = useCallback(async () => {
        try {
          if (!managers?.permissionsManager) {
            return
          }
          setBalanceLoading(true)
    
          // Fetch the first page
          const { totalOutputs } = await managers?.permissionsManager?.listOutputs({ basket: sdk.specOpWalletBalance }, adminOriginator)
    
          const total = totalOutputs ?? 0
          setAccountBalance(total)
          setBalanceLoading(false)
        } catch (e) {
          setBalanceLoading(false)
        }
      }, [managers, adminOriginator])

    useEffect(() => {
    refreshBalance()
    }, [refreshBalance])

    return (
        <View style={[componentStyles.container, { backgroundColor: colors.paperBackground }]}>
            <Text style={[componentStyles.sectionTitle, { color: colors.textPrimary }]}>you have</Text>
            {balanceLoading ? <View style={componentStyles.loadingContainer}><AppLogo size={50} rotate /></View> : <Text onPress={refreshBalance} style={[componentStyles.balance, { color: colors.textPrimary }]}><AmountDisplay abbreviate>{accountBalance}</AmountDisplay></Text>}
        </View>
    );
};

const componentStyles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 12
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center'
    },
    balance: {
        fontSize: 30,
        fontWeight: 'bold',
        textAlign: 'center'
    }
}); 