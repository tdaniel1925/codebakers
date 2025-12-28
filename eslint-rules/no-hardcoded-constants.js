/**
 * ESLint Rule: no-hardcoded-constants
 *
 * Prevents hardcoding business values that should come from constants.
 * This ensures consistency across the entire codebase.
 *
 * BAD:  <span>$49/month</span>
 * GOOD: <span>${PRICING.PRO.MONTHLY}/month</span>
 *
 * BAD:  const days = 7;
 * GOOD: const days = TRIAL.ANONYMOUS_DAYS;
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce usage of centralized constants instead of hardcoded values',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      hardcodedPrice: 'Hardcoded price "{{value}}" detected. Use PRICING.{{plan}}.MONTHLY from @/lib/constants instead.',
      hardcodedTrialDays: 'Hardcoded trial days "{{value}}" detected. Use TRIAL.{{constant}} from @/lib/constants instead.',
      hardcodedModuleCount: 'Hardcoded module count "{{value}}" detected. Use MODULES.COUNT from @/lib/constants instead.',
      hardcodedPriceString: 'Price string "{{value}}" detected. Use template with PRICING constant instead.',
    },
    schema: [],
  },

  create(context) {
    // Known pricing values to check
    const PRICING_VALUES = {
      49: 'PRO',
      490: 'PRO (yearly)',
      149: 'TEAM',
      1490: 'TEAM (yearly)',
      349: 'AGENCY',
      3490: 'AGENCY (yearly)',
    };

    // Trial day values
    const TRIAL_VALUES = {
      7: 'ANONYMOUS_DAYS or EXTENDED_DAYS',
      14: 'TOTAL_DAYS',
    };

    // Module count
    const MODULE_COUNT = 40;

    // Price string patterns
    const PRICE_PATTERNS = [
      /\$49/,
      /\$149/,
      /\$349/,
      /49\/mo/i,
      /149\/mo/i,
      /349\/mo/i,
    ];

    // Check if we're in a constants file (allow definitions there)
    function isConstantsFile(filename) {
      return filename.includes('constants.ts') || filename.includes('constants.js');
    }

    // Check if this is a test file
    function isTestFile(filename) {
      return filename.includes('.test.') || filename.includes('.spec.') || filename.includes('__tests__');
    }

    return {
      // Check numeric literals
      Literal(node) {
        const filename = context.getFilename();

        // Skip constants file and test files
        if (isConstantsFile(filename) || isTestFile(filename)) {
          return;
        }

        // Only check numbers
        if (typeof node.value !== 'number') {
          return;
        }

        const value = node.value;

        // Check for pricing values
        if (PRICING_VALUES[value]) {
          // Check context - allow in arithmetic expressions that aren't pricing related
          const parent = node.parent;

          // If it's part of a price context (assignment to price-related variable, JSX, etc.)
          if (isPricingContext(node)) {
            context.report({
              node,
              messageId: 'hardcodedPrice',
              data: { value, plan: PRICING_VALUES[value] },
            });
          }
        }

        // Check for trial day values (7 or 14 in trial-related context)
        if (TRIAL_VALUES[value] && isTrialContext(node)) {
          context.report({
            node,
            messageId: 'hardcodedTrialDays',
            data: { value, constant: TRIAL_VALUES[value] },
          });
        }

        // Check for module count (40)
        if (value === MODULE_COUNT && isModuleContext(node)) {
          context.report({
            node,
            messageId: 'hardcodedModuleCount',
            data: { value },
          });
        }
      },

      // Check string literals for price patterns
      TemplateLiteral(node) {
        const filename = context.getFilename();
        if (isConstantsFile(filename) || isTestFile(filename)) {
          return;
        }

        // Check quasis (template literal parts)
        for (const quasi of node.quasis) {
          const text = quasi.value.raw;
          for (const pattern of PRICE_PATTERNS) {
            if (pattern.test(text)) {
              context.report({
                node,
                messageId: 'hardcodedPriceString',
                data: { value: text.match(pattern)[0] },
              });
              break;
            }
          }
        }
      },

      // Check JSX text for price patterns
      JSXText(node) {
        const filename = context.getFilename();
        if (isConstantsFile(filename) || isTestFile(filename)) {
          return;
        }

        const text = node.value;
        for (const pattern of PRICE_PATTERNS) {
          if (pattern.test(text)) {
            context.report({
              node,
              messageId: 'hardcodedPriceString',
              data: { value: text.match(pattern)[0] },
            });
            break;
          }
        }
      },
    };

    // Helper to check if number is in a pricing context
    function isPricingContext(node) {
      let current = node;
      while (current.parent) {
        const parent = current.parent;

        // Check variable names
        if (parent.type === 'VariableDeclarator' && parent.id.name) {
          const name = parent.id.name.toLowerCase();
          if (name.includes('price') || name.includes('cost') || name.includes('amount')) {
            return true;
          }
        }

        // Check object property names
        if (parent.type === 'Property' && parent.key.name) {
          const name = parent.key.name.toLowerCase();
          if (name.includes('price') || name.includes('cost') || name.includes('amount') || name.includes('monthly') || name.includes('yearly')) {
            return true;
          }
        }

        // Check JSX attributes
        if (parent.type === 'JSXAttribute') {
          return true;
        }

        // Check JSX expressions
        if (parent.type === 'JSXExpressionContainer') {
          return true;
        }

        current = parent;
      }
      return false;
    }

    // Helper to check if number is in a trial context
    function isTrialContext(node) {
      let current = node;
      while (current.parent) {
        const parent = current.parent;

        // Check variable names
        if (parent.type === 'VariableDeclarator' && parent.id.name) {
          const name = parent.id.name.toLowerCase();
          if (name.includes('trial') || name.includes('days') || name.includes('expir')) {
            return true;
          }
        }

        // Check object property names
        if (parent.type === 'Property' && parent.key.name) {
          const name = parent.key.name.toLowerCase();
          if (name.includes('trial') || name.includes('days') || name.includes('expir')) {
            return true;
          }
        }

        current = parent;
      }
      return false;
    }

    // Helper to check if number is in a module context
    function isModuleContext(node) {
      let current = node;
      while (current.parent) {
        const parent = current.parent;

        // Check variable names
        if (parent.type === 'VariableDeclarator' && parent.id.name) {
          const name = parent.id.name.toLowerCase();
          if (name.includes('module') || name.includes('pattern')) {
            return true;
          }
        }

        // Check if in JSX text that mentions "modules"
        if (parent.type === 'JSXExpressionContainer') {
          const grandparent = parent.parent;
          if (grandparent && grandparent.type === 'JSXElement') {
            return true; // In JSX, likely UI display
          }
        }

        current = parent;
      }
      return false;
    }
  },
};
