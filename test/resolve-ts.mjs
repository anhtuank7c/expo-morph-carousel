// Lets Node run the TypeScript sources directly in tests: `import './policy'`
// (written for Metro and tsc, without an extension) resolves to `./policy.ts`.
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, next) {
      try {
        return await next(specifier, context);
      } catch (error) {
        if (specifier.startsWith('.') && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
          return next(specifier + '.ts', context);
        }
        throw error;
      }
    }
  `)}`,
);
