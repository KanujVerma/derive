/**
 * app/(tabs)/scan.tsx — Redirect shim
 *
 * C1: The canonical Scan implementation has moved to app/shop/scan.tsx.
 * This file keeps the route /(tabs)/scan alive as a redirect to /(tabs)/shop
 * so any deep links or legacy references degrade gracefully.
 *
 * There is ONE scanner implementation: app/shop/scan.tsx.
 * Do not add scanner logic here.
 */
import { Redirect } from 'expo-router';

export default function ScanRedirect() {
  return <Redirect href="/(tabs)/shop" />;
}
