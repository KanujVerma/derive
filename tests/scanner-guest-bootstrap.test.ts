import assert from 'node:assert/strict';
import test from 'node:test';
import {componentHarness,textContent} from './ux-profile-render.ts';

function rootHarness(failure=false) {
  let starts=0;const routes:string[]=[];
  const store=(state:any)=>Object.assign((selector:any)=>selector(state),{getState:()=>state,subscribe:()=>()=>{}});
  const auth=store({status:'SIGNED_OUT',sessionUserId:null}),free=store({status:'IDLE',userId:null,access:null,reset(){}});
  const customerController={getState:()=>({ownerId:null,status:'idle',context:null}),subscribe:()=>()=>{},load:async()=>{}};
  const modules:any={
    'expo-router':{useRouter:()=>({replace:(route:string)=>routes.push(route)}),useSegments:()=>['index'],useGlobalSearchParams:()=>({}),Stack:Object.assign('Stack',{Protected:'Protected',Screen:'Screen'})},
    'expo-status-bar':{StatusBar:'StatusBar'},
    '@/src/config/environment':{publicEnvironment:{buildFlavor:'production',supabaseUrl:'https://snojlbqovlawewwqbviz.supabase.co',scannerReleaseEnabled:true}},
    '../config/environment.ts':{publicEnvironment:{buildFlavor:'production',supabaseUrl:'https://snojlbqovlawewwqbviz.supabase.co',scannerReleaseEnabled:true}},
    '@/src/services/DeriveService':{isRemoteServiceEnabled:()=>true},
    '@/src/stores/authStore':{useAuthStore:auth},
    '@/src/stores/freeAccessStore':{useFreeAccessStore:free},
    '@/src/stores/onboardingStore':{useOnboardingStore:store({isCompleted:false})},
    '@/src/stores/bootstrapStore':{useBootstrapStore:store({status:'UNRESOLVED'})},
    '@/src/stores/scannerEntryStore':{useScannerEntryStore:store({ownerId:null,profileIntroHandled:false,setOwner(){}})},
    '@/src/presentation/personal-decision/customerGateway':{customerController,currentCustomerOwner:()=>null,ownerPinnedLegacyGateway:{clear(){}}},
    '@/src/presentation/personal-decision/customerController':{bindCustomerOwnerLifecycle:()=>()=>{}},
    '@/src/components/ui/KeyboardDoneBar':{KeyboardDoneBar:'KeyboardDoneBar'},
    '@/src/components/check/part-one/PartOneLabelCapture':{initializePartOneDraftCache(){}},
    '@/src/services/deriveClient':{refreshCustomerBootstrap(){},resolveCustomerBootstrap(){}},
    '@/src/services/supabase':{startAuthAutoRefresh(){},stopAuthAutoRefresh(){}},
    '@/src/services/remote/freeAccess':{getFreeAccessState:async()=>{throw Error('must not request access without owner')}},
    '@/src/services/authClient':{getCurrentSession:async()=>null,subscribeToAuth:()=>({unsubscribe(){}}),ensureLocalAnonymousSession:async()=>{starts++;if(failure)throw Error('hosted anonymous disabled');return 'guest';}},
  };
  const h=componentHarness('app/_layout.tsx','default',{}, {modules,effects:true,developmentRuntime:false});
  return {h,routes,starts:()=>starts};
}
// Catches a missing hosted call site or routing to login before guest startup finishes.
test('hosted root starts guest bootstrap and does not route to password login', async()=>{
  const {h,routes,starts}=rootHarness();h.render();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(starts(),1);assert(!routes.includes('/(auth)/login'));
});
// Catches an automatic retry loop or granting tabs after a failed guest creation.
test('hosted disabled guest Auth shows retry and does not create a retry loop', async()=>{
  const {h,starts}=rootHarness(true);h.render();await new Promise(resolve=>setImmediate(resolve));
  assert.match(textContent(h.render()),/could not connect/);assert.equal(starts(),1);
  const retry=h.render().find(node=>node.type==='Pressable'&&node.props.accessibilityRole==='button');assert(retry);retry.props.onPress();h.render();await new Promise(resolve=>setImmediate(resolve));assert.equal(starts(),2);
});
