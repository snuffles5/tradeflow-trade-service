import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';

function cleanGlobals(globalsObj) {
    return Object.fromEntries(
        Object.entries(globalsObj).map(([key, value]) => [key.trim(), value])
    );
}

const cleanedBrowserGlobals = cleanGlobals(globals.browser);

export default [
    js.configs.recommended,
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
            // Use the cleaned globals here
            globals: {
                ...cleanedBrowserGlobals,
                process: 'readonly',
            },
        },
        plugins: {
            react: reactPlugin,
        },
        rules: {
            // Disable rule requiring React in scope (since you're using the automatic JSX runtime)
            'react/react-in-jsx-scope': 'off',
            // Warn (or ignore) unused vars that match "React" to prevent false positives
            'no-unused-vars': ['warn', {varsIgnorePattern: '^React$'}],
        },

        settings: {
            react: {
                version: 'detect',
                runtime: 'automatic',
            },
        },
    },
];
