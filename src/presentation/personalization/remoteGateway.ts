import { getFreeSkinProfile, saveFreeSkinProfile, getPersonalFit } from '../../services/remote/freePersonalFit.ts';
import { createLivePersonalizationGateway } from './liveGateway.ts';

/** Used only by the local free shell after S-FREE-1 has a verified Auth session. */
export const remotePersonalizationGateway = createLivePersonalizationGateway({
  getFreeSkinProfile, saveFreeSkinProfile, getPersonalFit,
});
