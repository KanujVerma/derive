import { Text, View } from 'react-native';

// TypeScript fallback. Metro resolves the .native/.web implementation first.
export default function ScanditBarcodeLab() {
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>Scandit evaluation requires a native development build.</Text></View>;
}
