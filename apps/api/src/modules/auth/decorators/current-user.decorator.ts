import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../../common/types/authenticated-request';

/**
 * Injects the authenticated caller's JWT payload (see
 * {@link AuthenticatedUser}) into a controller method parameter. Only
 * meaningful behind the global `JwtAuthGuard` (i.e. not on `@Public()`
 * routes, where it would be `undefined`).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
