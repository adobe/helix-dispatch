/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

module.exports = {
  root: true,
  overrides: [

    // === JavaScript rules ====================================================

    {
      files: [
        '**/*.js',
        'bin/*',
      ],
      extends: '@adobe/helix',
    },

    // === TypeScript rules ====================================================

    {
      files: [
        '**/*.ts',
      ],
      parser: '@typescript-eslint/parser',
      plugins: [
        '@typescript-eslint',
      ],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {},
      },
      globals: {
        BigInt64Array: 'readonly',
        BigUint64Array: 'readonly',
        __non_webpack_require__: 'readonly',
      },

      // === General rules =========================================================

      rules: {
        // Omitted semicolons are hugely popular, yet within the compiler it makes
        // sense to be better safe than sorry.
        semi: 'error',

        // Our code bases uses 2 spaces for indentation, and we enforce it here so
        // files don't mix spaces, tabs or different indentation levels.
        indent: ['error', 2, {
          SwitchCase: 1,
          VariableDeclarator: 'first',
          offsetTernaryExpressions: true,
          ignoredNodes: [ // FIXME: something's odd here
            'ConditionalExpression > *',
            'ConditionalExpression > * > *',
            'ConditionalExpression > * > * > *',
          ],
        }],

        // This is mostly visual style, making comments look uniform.
        'spaced-comment': ['error', 'always', {
          markers: ['/'], // triple-slash
          exceptions: ['/'], // all slashes
        }],

        // This tends to be annoying as it encourages developers to make everything
        // that is never reassigned a 'const', sometimes semantically incorrect so,
        // typically leading to huge diffs in follow-up PRs modifying affected code.
        'prefer-const': 'off',

        // It is perfectly fine to declare top-level variables with `var`, yet this
        // rule doesn't provide configuration options that would help.
        'no-var': 'off',

        // Quite often, dealing with multiple related cases at once or otherwise
        // falling through is exactly the point of using a switch.
        'no-fallthrough': 'off',

        // Typical false-positives here are `do { ... } while (true)` statements or
        // similar, but the only option provided here is not checking any loops.
        'no-constant-condition': ['error', { checkLoops: false }],

        // Functions are nested in blocks occasionally, and there haven't been any
        // problems with this so far, so turning the check off.
        'no-inner-declarations': 'off',

        // Quite common in scenarios where an iteration starts at `current = this`.
        '@typescript-eslint/no-this-alias': 'off',

        // Disabled here, but enabled again for JavaScript files.
        'no-unused-vars': 'off',

        // Enforcing to remove function parameters on stubs makes code less
        // maintainable, so we instead allow unused function parameters.
        '@typescript-eslint/no-unused-vars': [
          'warn', {
            vars: 'local',
            varsIgnorePattern: '^[A-Z](?:From|To)?$', // ignore type params
            args: 'none',
            ignoreRestSiblings: false,
          },
        ],
      },
    },

    // === AssemblyScript rules (extends TypeScript rules) =====================

    {
      files: [
        'fastly/assembly/**/*.ts',
      ],
      rules: {
        // Namespaces are quite useful in AssemblyScript
        '@typescript-eslint/no-namespace': 'off',

        // There is actually codegen difference here
        '@typescript-eslint/no-array-constructor': 'off',

        // Sometimes it can't be avoided to add a @ts-ignore
        '@typescript-eslint/ban-ts-comment': 'off',

        // Utilized to achieve portability in some cases
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
};
