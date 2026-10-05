import React from 'react';
import {usePartThreeCheck} from '../../src/components/check/part-three/usePartThreeCheck';
export function RecoveryProbe(props:Parameters<typeof usePartThreeCheck>[0]) {
 return React.createElement('RecoveryProbe',{check:usePartThreeCheck(props)});
}
