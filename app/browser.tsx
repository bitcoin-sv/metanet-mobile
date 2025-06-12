import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import Modal from 'react-native-modal';
import { GestureHandlerRootView, Swipeable, State } from 'react-native-gesture-handler';
import { useTheme } from '@/context/theme/ThemeContext';
import { useWallet } from '@/context/WalletContext';
import { WalletInterface } from '@bsv/sdk';
import { RecommendedApps } from '@/components/RecommendedApps';
import Balance from '@/components/Balance';
import { router } from 'expo-router'

// ---------- Constants ----------
const kNEW_TAB_URL = 'new-tab-page';
const kGOOGLE_PREFIX = 'https://www.google.com/search?q=';

// ---------- Types ----------
type Tab = {
  id: number;
  url: string;
  title: string;
  webviewRef: React.RefObject<WebView<any>>;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
};

// ---------- Main Component ----------
export default function Browser() {
  /* ---------- theme / context ---------- */
  const { colors, isDark } = useTheme();
  const { managers } = useWallet();
  const [wallet, setWallet] = useState<WalletInterface | undefined>(undefined);

  /* ---------- tab state ---------- */
  const nextTabId = useRef(1);
  const [tabs, setTabs] = useState<Tab[]>(() => [
    createTab(kNEW_TAB_URL),
  ]);
  const [activeTabId, setActiveTabId] = useState<number>(1);
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId)!, [tabs, activeTabId]);

  /* ---------- UI & animation state ---------- */
  const insets = useSafeAreaInsets();
  const addressEditing = useRef(false);
  const [addressText, setAddressText] = useState<string>(kNEW_TAB_URL);
  const [showTabOverview, setShowTabOverview] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;            // 0 hidden … 1 shown

  const addressInputRef = useRef<TextInput>(null);
  const [addressFocused, setAddressFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  /* ---------- side‑effects ---------- */
  useEffect(() => {
    if (managers?.walletManager?.authenticated) setWallet(managers.walletManager);
  }, [managers]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* ---------- helper: create a new tab ---------- */
  function createTab(url: string): Tab {
    return {
      id: nextTabId.current++,
      url,
      title: 'New Tab',
      webviewRef: React.createRef<WebView>() as React.RefObject<WebView<any>>,
      canGoBack: false,
      canGoForward: false,
      isLoading: true,
    };
  }

  /* ---------- handle address submit ---------- */
  const onAddressSubmit = () => {
    let entry = addressText.trim();
    const isProbablyUrl = /^([a-z]+:\/\/|www\.|([A-Za-z0-9\-]+\.)+[A-Za-z]{2,})(\/|$)/i.test(entry);

    if (entry === '') entry = kNEW_TAB_URL;
    else if (!isProbablyUrl) entry = kGOOGLE_PREFIX + encodeURIComponent(entry);
    else if (!/^[a-z]+:\/\//i.test(entry)) entry = 'https://' + entry;

    updateActiveTab({ url: entry });
    addressEditing.current = false;
  };

  /* ---------- navigation ---------- */
  const navBack  = () => activeTab.webviewRef.current?.goBack();
  const navFwd   = () => activeTab.webviewRef.current?.goForward();
  const navReloadOrStop = () =>
    activeTab.isLoading
      ? activeTab.webviewRef.current?.stopLoading()
      : activeTab.webviewRef.current?.reload();

  /* ---------- tab helpers ---------- */
  function updateActiveTab(patch: Partial<Tab>) {
    setTabs(tabs =>
      tabs.map(t => (t.id === activeTabId ? { ...t, ...patch } : t)),
    );
  }
  function closeTab(id: number) {
    setTabs(tabs => {
      const filtered = tabs.filter(t => t.id !== id);
      if (filtered.length === 0) filtered.push(createTab(kNEW_TAB_URL));
      if (!filtered.find(t => t.id === activeTabId))
        setActiveTabId(filtered[filtered.length - 1].id);
      return filtered;
    });
  }
  function newTab() {
    const t = createTab(kNEW_TAB_URL);
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
    setShowTabOverview(false);
  }

  /* ---------- WebView message plumbing (kept from your code) ---------- */
  // -- injected JS to capture logs (unchanged) --
  const injectedJavaScript = `...${/* ⬅️ place your original injected JS here  */''}`;

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {

      const sendResponseToWebView = (id: string, result: any) => {
        try {
          console.log("sending... ", id, result);
          // if (!activeTab.webviewRef.current) return;
          console.log("webviewRef.current");
          
          // Create a message in the format expected by XDM
          const message = {
            type: 'CWI',
            id,
            isInvocation: false,
            result,
            status: 'ok'
          };
          
          // Send the message to the WebView using injectJavaScript
          function getInjectableJSMessage(message: any = {}) {
            const messageString = JSON.stringify(message)
            return `
              (function() {
                window.dispatchEvent(new MessageEvent('message', {
                  data: JSON.stringify(${messageString})
                }));
              })();
            `;
          }
          activeTab.webviewRef.current?.injectJavaScript(
            getInjectableJSMessage(message)
          );
          console.info('TRANSMITTED', { message });
        } catch (error) {
          console.error('Error sending message to WebView:', error);
        }
      };

      let msg
      try {
        msg = JSON.parse(event.nativeEvent.data);
        
        // Handle console logs from the WebView
        if (msg.type === 'CONSOLE') {
          const newLog = {
            method: msg.method,
            args: msg.args,
            timestamp: Date.now()
          };
          
          // Log to React Native console with appropriate method
          switch (msg.method) {
            case 'log':
              console.log('[WebView]', ...msg.args);
              break;
            case 'warn':
              console.warn('[WebView]', ...msg.args);
              break;
            case 'error':
              console.error('[WebView]', ...msg.args);
              break;
            case 'info':
              console.info('[WebView]', ...msg.args);
              break;
            case 'debug':
              console.debug('[WebView]', ...msg.args);
              break;
          }
          
          // Keep the last 50 logs
          setConsoleLogs(prevLogs => [
            newLog,
            ...prevLogs.slice(0, 49)
          ]);
          
          return;
        }
        
        // Handle API calls
        const origin = activeTab.url.replace(/^https?:\/\//, '').split('/')[0];
        
        console.log(msg.call, msg.args, origin);

        let response: any;
        switch(msg.call) {
          case 'getPublicKey':
            response = await wallet?.getPublicKey(msg?.args || {}, origin)
            break;
          case 'revealCounterpartyKeyLinkage':
            response = await wallet?.revealCounterpartyKeyLinkage(msg?.args || {}, origin)
            break;
          case 'revealSpecificKeyLinkage':
            response = await wallet?.revealSpecificKeyLinkage(msg?.args || {}, origin)
            break;
          case 'encrypt':
            response = await wallet?.encrypt(msg?.args || {}, origin)
            break;
          case 'decrypt':
            response = await wallet?.decrypt(msg?.args || {}, origin)
            break;
          case 'createHmac':
            response = await wallet?.createHmac(msg?.args || {}, origin)
            break;
          case 'verifyHmac':
            response = await wallet?.verifyHmac(msg?.args || {}, origin)
            break;
          case 'createSignature':
            response = await wallet?.createSignature(msg?.args || {}, origin)
            break;
          case 'verifySignature':
            response = await wallet?.verifySignature(msg?.args || {}, origin)
            break;
          case 'createAction':
            response = await wallet?.createAction(msg?.args || {}, origin)
            break;
          case 'signAction':
            response = await wallet?.signAction(msg?.args || {}, origin)
            break;
          case 'abortAction':
            response = await wallet?.abortAction(msg?.args || {}, origin)
            break;
          case 'listActions':
            response = await wallet?.listActions(msg?.args || {}, origin)
            break;
          case 'internalizeAction':
            response = await wallet?.internalizeAction(msg?.args || {}, origin)
            break;
          case 'listOutputs':
            response = await wallet?.listOutputs(msg?.args || {}, origin)
            break;
          case 'relinquishOutput':
            response = await wallet?.relinquishOutput(msg?.args || {}, origin)
            break;
          case 'acquireCertificate':
            response = await wallet?.acquireCertificate(msg?.args || {}, origin)
            break;
          case 'listCertificates':
            response = await wallet?.listCertificates(msg?.args || {}, origin)
            break;
          case 'proveCertificate':
            response = await wallet?.proveCertificate(msg?.args || {}, origin)
            break;
          case 'relinquishCertificate':
            response = await wallet?.relinquishCertificate(msg?.args || {}, origin)
            break;
          case 'discoverByIdentityKey':
            response = await wallet?.discoverByIdentityKey(msg?.args || {}, origin)
            break;
          case 'isAuthenticated':
            response = await wallet?.isAuthenticated({}, origin)
            break;
          case 'waitForAuthentication':
            response = await wallet?.waitForAuthentication({}, origin)
            break;
          case 'getHeight':
            response = await wallet?.getHeight({}, origin)
            break;
          case 'getHeaderForHeight':
            response = await wallet?.getHeaderForHeight(msg?.args || {}, origin)
            break;
          case 'discoverByAttributes':
            response = await wallet?.discoverByAttributes(msg?.args || {}, origin)
            break;
          case 'getNetwork':
            response = await wallet?.getNetwork({}, origin)
            break;
          case 'getVersion':
          default:
            response = await wallet?.getVersion({}, origin)
            break;
        }
        sendResponseToWebView(msg.id, response)
      } catch (error) {
        console.error('Error handling WebView message:', error, msg);
      }
    },
    [activeTab.url, activeTab.webviewRef, wallet]
  );

  const handleNavStateChange = (navState: WebViewNavigation) => {
    updateActiveTab({
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
      isLoading: navState.loading,
      url: navState.url,
      title: navState.title || navState.url,
    });
    if (!addressEditing.current) setAddressText(navState.url);
  };

  /* ---------- share ---------- */
  const shareCurrent = async () => {
    try {
      await Share.share({ message: activeTab.url });
    } catch (err) {
      console.warn('Share cancelled/failed', err);
    }
  };

  /* ---------- info drawer animation ---------- */
  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: showInfoDrawer ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [drawerAnim, showInfoDrawer]);

  const showAddressBar = !keyboardVisible || addressFocused;
  const showBottomBar  = !keyboardVisible && !addressFocused;

  /* ---------- render ---------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {addressFocused && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.backdrop}/>
        </TouchableWithoutFeedback>
      )}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          // keyboardVerticalOffset={insets.top}
        >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.inputBackground }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* ---------- WebView or New‑Tab placeholder ---------- */}
        {activeTab.url === kNEW_TAB_URL ? (
          <RecommendedApps setStartingUrl={(url) => updateActiveTab({ url })} />
        ) : (
          <WebView
            ref={activeTab.webviewRef}
            source={{ uri: activeTab.url }}
            originWhitelist={['*']}
            onMessage={handleMessage}
            injectedJavaScript={injectedJavaScript}
            onNavigationStateChange={handleNavStateChange}
            javaScriptEnabled
            domStorageEnabled
            containerStyle={{ backgroundColor: colors.background }}
            style={{ flex: 1 }}
          />
        )}

        {/* ---------- Address Bar ---------- */}
        {showAddressBar && (
          <View
            style={[
              styles.addressBar,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                paddingTop: 12,
              }
            ]}>
            {/* Info / Page settings */}
            {!addressFocused && (
              <TouchableOpacity onPress={() => setShowInfoDrawer(true)}>
                <Text style={styles.addressButton}>ℹ︎</Text>
              </TouchableOpacity>
            )}

            {/* TextInput (expands full width while editing) */}
            <TextInput
              ref={addressInputRef}
              value={addressText === 'new-tab-page' ? '' : addressText}
              onChangeText={setAddressText}
              onFocus={() => {
                addressEditing.current = true;
                setAddressFocused(true);
                // select all after focus
                setTimeout(() => {
                  addressInputRef.current?.setNativeProps({
                    selection: { start: 0, end: addressText.length }
                  });
                }, 0);
              }}
              onBlur={() => {
                addressEditing.current = false;
                setAddressFocused(false);
              }}
              onSubmitEditing={onAddressSubmit}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              style={[
                styles.addressInput,
                {
                  flex: 1,
                  backgroundColor: colors.background,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Search or enter site name"
              placeholderTextColor={colors.textSecondary}
            />

            {/* Reload / Stop button (depends on loading) */}
            <TouchableOpacity onPress={addressFocused ? () => setAddressText('') : navReloadOrStop}>
              <Text style={styles.addressButton}>
                {addressFocused ? '✕' : (activeTab.isLoading ? '✕' : '↻')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---------- Bottom Toolbar ---------- */}
        {showBottomBar && (
          <View
            style={[
              styles.bottomBar,
              { backgroundColor: colors.inputBackground, paddingBottom: insets.bottom },
            ]}>
            <ToolbarButton icon="←" onPress={navBack} disabled={!activeTab.canGoBack} />
            <ToolbarButton icon="→" onPress={navFwd} disabled={!activeTab.canGoForward} />
            <ToolbarButton icon="⇪" onPress={shareCurrent} />
            <ToolbarButton icon="★" onPress={() => { /* TODO: bookmarks */ }} />
            <ToolbarButton icon="▒" onPress={() => setShowTabOverview(true)} />
          </View>
        )}

        {/* ---------- Tab Overview (Modal) ---------- */}
        <Modal
          isVisible={showTabOverview}
          style={styles.modal}
          onBackdropPress={() => setShowTabOverview(false)}
          animationIn="zoomInDown"
          animationOut="zoomOutUp"
          useNativeDriver>
          <View style={[styles.tabOverviewContainer, { backgroundColor: colors.background }]}>
            <FlatList
              data={tabs}
              numColumns={2}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <Swipeable
                  onSwipeableRightOpen={() => closeTab(item.id)}
                  renderRightActions={() => (
                    <View style={[styles.swipeDelete, { backgroundColor: '#ff3b30' }]}>
                      <Text style={styles.swipeDeleteText}>✕</Text>
                    </View>
                  )}>
                  <Pressable
                    style={styles.tabPreview}
                    onPress={() => {
                      setActiveTabId(item.id);
                      setShowTabOverview(false);
                    }}>
                    <Text numberOfLines={2} style={{ color: colors.textPrimary }}>
                      {item.title}
                    </Text>
                  </Pressable>
                </Swipeable>
              )}
              ListFooterComponent={
                <Pressable style={styles.tabPreview} onPress={newTab}>
                  <Text style={[styles.plus, { color: colors.textPrimary }]}>＋</Text>
                </Pressable>
              }
            />
          </View>
        </Modal>

        {/* ---------- Info Drawer ---------- */}
        <Modal
            isVisible={showInfoDrawer}
            onBackdropPress={() => setShowInfoDrawer(false)}
            swipeDirection="down"
            onSwipeComplete={() => setShowInfoDrawer(false)}
            style={{ margin: 0, justifyContent: 'flex-end' }}
          >
          <Animated.View
              style={[styles.infoDrawer, {
                backgroundColor: colors.background,
                transform: [{ translateY: drawerAnim.interpolate({
                  inputRange: [0, 260 + insets.bottom],
                  outputRange: [0, 260 + insets.bottom],
                  extrapolate: 'clamp',
                }) }]
              }]}
            >
            <Pressable style={styles.drawerHandle} onPress={() => setShowInfoDrawer(false)}>
              <View style={styles.handleBar} />
            </Pressable>
            <Balance />
            <Pressable onPress={() => {
              router.push('/identity')
              setShowInfoDrawer(false)
            }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Identity</Text>
              </Pressable>
              <Pressable onPress={() => {
                router.push('/trust')
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Trust Network</Text>
              </Pressable>
              <Pressable onPress={() => {
                router.push('/settings')
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Settings</Text>
              </Pressable>
              <Pressable onPress={() => {
                router.push('/security')
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Security</Text>
              </Pressable>
              <Pressable onPress={() => {
                // TODO
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Add Bookmark</Text>
              </Pressable>
              <Pressable onPress={() => {
                // TODO: Logic for adding to the device homescreen in React Native
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Add to Device Homescreen</Text>
              </Pressable>
              <Pressable onPress={() => {
                updateActiveTab({ url: 'new-tab-page' })
                setAddressText('new-tab-page')
                setShowInfoDrawer(false)
              }} style={styles.drawerItem}>
                <Text style={[styles.drawerLabel, { color: colors.textPrimary }]}>Back to Homepage</Text>
              </Pressable>
          </Animated.View>
        </Modal>
      </SafeAreaView>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </GestureHandlerRootView>
  );
}

/* ---------- Toolbar Helper ---------- */
const ToolbarButton = ({
  icon,
  onPress,
  disabled,
}: {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity style={styles.toolbarButton} onPress={onPress} disabled={disabled}>
    <Text style={[styles.toolbarIcon, disabled && { opacity: 0.3 }]}>{icon}</Text>
  </TouchableOpacity>
);

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addressInput: {
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    borderRadius: 6,
    fontSize: 15,
  },
  addressButton: { fontSize: 18, marginHorizontal: 6, color: '#fff' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarButton: { padding: 6 },
  toolbarIcon: { fontSize: 20, color: '#fff' },
  modal: { margin: 0, justifyContent: 'center', alignItems: 'center' },
  tabOverviewContainer: {
    width: '95%',
    height: '85%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabPreview: {
    width: Dimensions.get('window').width * 0.38,
    height: 160,
    margin: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: { fontSize: 40, fontWeight: '200' },
  swipeDelete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    marginVertical: 10,
    borderRadius: 10,
  },
  swipeDeleteText: { color: '#fff', fontSize: 24 },
  infoDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 10,
    paddingBottom: 32
  },
  drawerHandle: { alignItems: 'center', padding: 10 },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
  },
  drawerItem: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  drawerLabel: { fontSize: 17 },
});
