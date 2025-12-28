/**
 * ESLint Rule: enforce-service-layer
 *
 * Prevents direct database operations outside of service files.
 * All data mutations must go through the service layer to ensure
 * side effects are properly handled.
 *
 * BAD:  await db.insert(users).values({ ... })
 * GOOD: await UserService.create({ ... })
 *
 * This rule allows db operations in:
 * - Service files (*-service.ts, *Service.ts)
 * - Migration files
 * - Seed files
 * - Test files
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce usage of service layer for database operations',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      directDbInsert: 'Direct db.insert() is not allowed. Use the appropriate Service class instead (e.g., UserService.create()).',
      directDbUpdate: 'Direct db.update() is not allowed. Use the appropriate Service class instead (e.g., UserService.update()).',
      directDbDelete: 'Direct db.delete() is not allowed. Use the appropriate Service class instead (e.g., UserService.delete()).',
      directDbMutation: 'Direct database mutation is not allowed outside service files. Move this to a Service class to ensure side effects are handled.',
    },
    schema: [],
  },

  create(context) {
    // Files where direct db operations are allowed
    function isAllowedFile(filename) {
      const normalized = filename.toLowerCase().replace(/\\/g, '/');

      // Service files
      if (normalized.includes('-service.') || normalized.includes('service.ts') || normalized.includes('service.js')) {
        return true;
      }

      // Migration files
      if (normalized.includes('/migrations/') || normalized.includes('migrate')) {
        return true;
      }

      // Seed files
      if (normalized.includes('/seed') || normalized.includes('.seed.')) {
        return true;
      }

      // Test files
      if (normalized.includes('.test.') || normalized.includes('.spec.') || normalized.includes('__tests__')) {
        return true;
      }

      // Scripts folder
      if (normalized.includes('/scripts/')) {
        return true;
      }

      return false;
    }

    // Mutation methods to check
    const MUTATION_METHODS = ['insert', 'update', 'delete'];

    return {
      // Check for db.insert(), db.update(), db.delete() calls
      CallExpression(node) {
        const filename = context.getFilename();

        // Skip allowed files
        if (isAllowedFile(filename)) {
          return;
        }

        // Check if this is a member expression (something.method())
        if (node.callee.type !== 'MemberExpression') {
          return;
        }

        const callee = node.callee;
        const object = callee.object;
        const property = callee.property;

        // Check if it's db.something()
        if (object.type === 'Identifier' && object.name === 'db') {
          const methodName = property.name || property.value;

          if (MUTATION_METHODS.includes(methodName)) {
            const messageId = `directDb${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`;
            context.report({
              node,
              messageId: MUTATION_METHODS.includes(methodName) ? messageId : 'directDbMutation',
            });
          }
        }

        // Also check chained calls like db.insert(table).values(...)
        // The object might be a call expression itself
        if (object.type === 'CallExpression' && object.callee.type === 'MemberExpression') {
          const innerObject = object.callee.object;
          const innerProperty = object.callee.property;

          if (innerObject.type === 'Identifier' && innerObject.name === 'db') {
            const methodName = innerProperty.name || innerProperty.value;

            if (MUTATION_METHODS.includes(methodName)) {
              const messageId = `directDb${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`;
              context.report({
                node: object,
                messageId,
              });
            }
          }
        }
      },
    };
  },
};
