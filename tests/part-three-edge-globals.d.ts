/** Narrow compile-time declarations for the local Edge composition. Actual
 * Request/Auth/SQL execution is independently exercised by the smoke suite. */
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
declare const EdgeRuntime:{waitUntil(work:Promise<unknown>):void};
