/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authRules from "../lib/authRules.js";
import type * as lib_documents from "../lib/documents.js";
import type * as lib_functionBuilders from "../lib/functionBuilders.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_logRows from "../lib/logRows.js";
import type * as lib_routineLogAggregate from "../lib/routineLogAggregate.js";
import type * as lib_validate from "../lib/validate.js";
import type * as rateLimits from "../rateLimits.js";
import type * as routineLogs from "../routineLogs.js";
import type * as routines from "../routines.js";
import type * as shared_convexJwt from "../shared/convexJwt.js";
import type * as shared_durations from "../shared/durations.js";
import type * as shared_errorCodes from "../shared/errorCodes.js";
import type * as shared_goalRules from "../shared/goalRules.js";
import type * as shared_intervals from "../shared/intervals.js";
import type * as shared_limits from "../shared/limits.js";
import type * as shared_localTime from "../shared/localTime.js";
import type * as shared_ownerEmail from "../shared/ownerEmail.js";
import type * as shared_showAt from "../shared/showAt.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "lib/auth": typeof lib_auth;
  "lib/authRules": typeof lib_authRules;
  "lib/documents": typeof lib_documents;
  "lib/functionBuilders": typeof lib_functionBuilders;
  "lib/log": typeof lib_log;
  "lib/logRows": typeof lib_logRows;
  "lib/routineLogAggregate": typeof lib_routineLogAggregate;
  "lib/validate": typeof lib_validate;
  rateLimits: typeof rateLimits;
  routineLogs: typeof routineLogs;
  routines: typeof routines;
  "shared/convexJwt": typeof shared_convexJwt;
  "shared/durations": typeof shared_durations;
  "shared/errorCodes": typeof shared_errorCodes;
  "shared/goalRules": typeof shared_goalRules;
  "shared/intervals": typeof shared_intervals;
  "shared/limits": typeof shared_limits;
  "shared/localTime": typeof shared_localTime;
  "shared/ownerEmail": typeof shared_ownerEmail;
  "shared/showAt": typeof shared_showAt;
  tasks: typeof tasks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  routineLogAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"routineLogAggregate">;
};
