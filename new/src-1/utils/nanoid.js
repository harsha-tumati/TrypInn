// src/utils/nanoid.js
// Simple nano-ID generator (no external dep needed)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function nanoid(size = 21) {
    let id = '';
    for (let i = 0; i < size; i++) {
        id += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    return id;
}
