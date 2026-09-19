/**
 * DeriveService Provider
 * 
 * Factory and accessor for IDeriveService.
 * Returns MockDeriveService by default for local development, tests, and demo flows.
 * Switches to RemoteDeriveService when EXPO_PUBLIC_USE_REMOTE_SERVICE is set to 'true'.
 */

import type { IDeriveService } from '../contracts/DeriveService.ts';
import { publicEnvironment } from '../config/environment.ts';
import { MockDeriveService } from './mock/MockDeriveService.ts';
import { RemoteDeriveService } from './remote/RemoteDeriveService.ts';

let serviceInstance: IDeriveService | null = null;

export function getDeriveService(): IDeriveService {
  if (!serviceInstance) {
    serviceInstance = publicEnvironment.useRemoteService
      ? new RemoteDeriveService()
      : new MockDeriveService();
  }
  return serviceInstance;
}

export function isRemoteServiceEnabled(): boolean {
  if (serviceInstance) {
    return serviceInstance instanceof RemoteDeriveService;
  }
  return publicEnvironment.useRemoteService;
}

/**
 * Reset service instance (useful for test isolation)
 */
export function setDeriveService(service: IDeriveService | null) {
  serviceInstance = service;
}

export * from '../contracts/DeriveService.ts';
export * from '../domain/types.ts';
