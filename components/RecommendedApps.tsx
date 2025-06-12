import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, TextInput } from 'react-native';
import Fuse from 'fuse.js';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';

interface App {
  domain: string;
  appName: string;
  appIconImageUrl?: string;
}

const defaultApps: App[] = [
    { domain: 'https://p2pmnee.atx.systems', appName: 'P2PMNEE', appIconImageUrl: 'https://p2pmnee.atx.systems/p2m.png' },
    { domain: 'https://metanetstatus.lovable.app', appName: 'Metanet Status', appIconImageUrl: 'https://metanetstatus.lovable.app/favicon.ico' },
    { domain: 'https://todo.metanet.app', appName: 'My ToDo List', appIconImageUrl: 'https://todo.metanet.app/favicon.ico' },
    { domain: 'https://peerpay.babbage.systems', appName: 'PeerPay', appIconImageUrl: 'https://peerpay.babbage.systems/favicon.ico' },
    { domain: 'https://mountaintops.net', appName: 'Mountaintops', appIconImageUrl: 'https://mountaintops.net/favicon.ico' },
    { domain: 'https://metanetacademy.com', appName: 'Metanet Academy', appIconImageUrl: 'https://metanetacademy.com/favicon.ico' },
    { domain: 'https://coinflip.babbage.systems', appName: 'Coinflip Friend', appIconImageUrl: 'https://coinflip.babbage.systems/favicon.ico' }
];

export const RecommendedApps = ({ setStartingUrl }: { setStartingUrl: (url: string) => void }) => {
  const { colors } = useTheme();
  const { recentApps } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter out duplicates by domain, clean app names, and limit to 20 items
  const allApps = [...defaultApps, ...recentApps].reduce((acc: App[], current) => {
    // Check if we already have an app with this domain
    const domainExists = acc.find(app => app.domain === current.domain);
    if (!domainExists) {
      // Clean up appName if it's a URL
      const cleanedApp = {
        ...current,
        appName: current.appName?.startsWith('http://') || current.appName?.startsWith('https://') ? 
          current.appName.replace(/^https?:\/\//, '') : current.appName
      };
      acc.push(cleanedApp);
    }
    return acc;
  }, []);
  
  // Set up Fuse for fuzzy search
  const fuse = useMemo(() => {
    const options = {
      keys: ['appName', 'domain'],
      threshold: 0.4, // Lower threshold means more strict matching
      includeScore: true
    };
    return new Fuse(allApps, options);
  }, [allApps]);
  
  // Filter apps based on search query
  const apps = useMemo(() => {
    if (!searchQuery.trim()) return allApps;
    
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [fuse, searchQuery, allApps]);

  const renderAppItem = ({ item }: { item: App }) => (
    <TouchableOpacity 
      style={componentStyles.appItem} 
      onPress={() => setStartingUrl(item.domain)}
    >
      {item.appIconImageUrl ? (
        <Image 
          source={{ uri: item.appIconImageUrl }} 
          style={componentStyles.appIcon} 
          defaultSource={{ uri: item.domain + '/favicon.ico' }}
        />
      ) : (
        <View style={[componentStyles.placeholderIcon, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.background, fontSize: 16 }}>{item.appName.charAt(0)}</Text>
        </View>
      )}
      <Text style={[componentStyles.appTitle, { color: colors.textPrimary }]}>{item.appName}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[componentStyles.container, { backgroundColor: colors.paperBackground }]}>
      <Text style={[componentStyles.sectionTitle, { color: colors.textPrimary }]}>Bookmarks</Text>
      
      <View style={componentStyles.searchContainer}>
        <TextInput
          style={[componentStyles.searchInput, { 
            color: colors.textPrimary,
            backgroundColor: colors.inputBackground || colors.background,
            borderColor: colors.inputBorder
          }]}
          placeholder="Search bookmarks..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <FlatList
        data={apps}
        renderItem={renderAppItem}
        keyExtractor={(item) => item.domain}
        numColumns={3}
        key="grid"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const componentStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  appItem: {
    alignItems: 'center',
    marginBottom: 16,
    flex: 1,
    margin: 4,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginBottom: 8,
  },
  placeholderIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 14,
    textAlign: 'center',
  }
});