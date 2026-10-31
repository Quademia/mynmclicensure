// lib/auth/types.ts — types the sign-in card (a client component) shares
// with the server, kept apart from the server modules it must not import
// (AGENTS.md: a client component never imports a module that reaches
// next/headers).

/** The three ways in on the sign-in card (01.16). */
export type SignInDoor = 'password' | 'google' | 'link';
