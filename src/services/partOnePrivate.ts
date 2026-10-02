import { supabase } from './supabase';
import { PART_ONE_ENABLED } from './partOne';
import { createPartOnePrivateTransport } from './partOnePrivateClient';
export { PartOnePrivateConflict } from './partOnePrivateClient';
export type { PartOnePrivateTransport } from './partOnePrivateClient';
/** Real-user retention is OFF. Both exact-local development and explicit evaluation are required. */
export const PART_ONE_PRIVATE_ENABLED = PART_ONE_ENABLED && process.env.EXPO_PUBLIC_PART_ONE_PRIVATE_EVALUATION === 'true';
export const partOnePrivateTransport=createPartOnePrivateTransport({
 enabled:()=>PART_ONE_PRIVATE_ENABLED && supabase!==null,
 invoke:async(path,options)=>{if(!supabase)throw new Error('private_capture_disabled');return supabase.functions.invoke(path,options);},
});
