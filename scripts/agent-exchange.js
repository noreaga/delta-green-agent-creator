// @ts-nocheck

export const AGENT_EXCHANGE_KIND = 'delta-green-agent';
export const AGENT_EXCHANGE_VERSION = 1;
export const AGENT_CODE_PREFIX = 'DGAC1:';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function clonePortable(value) {
    return JSON.parse(JSON.stringify(value));
}

export function createAgentExchange(data, metadata = {}) {
    return {
        kind: AGENT_EXCHANGE_KIND,
        schemaVersion: AGENT_EXCHANGE_VERSION,
        exportedAt: new Date().toISOString(),
        generator: {
            id: 'delta-green-agent-creator',
            version: metadata.moduleVersion ?? 'unknown',
        },
        agent: clonePortable(data),
    };
}

export function stringifyAgentExchange(exchange) {
    return JSON.stringify(exchange, null, 2);
}

export function encodeAgentCode(exchange) {
    return `${AGENT_CODE_PREFIX}${bytesToBase64(encoder.encode(JSON.stringify(exchange)))}`;
}

export function parseAgentExchange(input) {
    const source = String(input ?? '').trim();
    if (!source) throw new Error('Paste an Agent Code or provide an Agent JSON file.');

    let parsed;
    try {
        if (source.startsWith(AGENT_CODE_PREFIX)) {
            const encoded = source.slice(AGENT_CODE_PREFIX.length).replace(/\s+/g, '');
            parsed = JSON.parse(decoder.decode(base64ToBytes(encoded)));
        } else {
            parsed = JSON.parse(source);
        }
    } catch (error) {
        throw new Error('This is not a valid DGAC Agent Code or JSON file.');
    }

    if (!parsed || parsed.kind !== AGENT_EXCHANGE_KIND) {
        throw new Error('This file is not a DGAC Agent Exchange file.');
    }
    if (parsed.schemaVersion !== AGENT_EXCHANGE_VERSION) {
        throw new Error(`Unsupported Agent Exchange version: ${parsed.schemaVersion ?? 'unknown'}.`);
    }
    if (!parsed.agent || typeof parsed.agent !== 'object' || Array.isArray(parsed.agent)) {
        throw new Error('The Agent Exchange file does not contain Agent data.');
    }
    return parsed;
}

export function sanitizeFilename(value) {
    const safe = String(value || 'Delta Green Agent')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return safe || 'Delta Green Agent';
}

export function downloadAgentExchange(exchange, filename) {
    const blob = new Blob([stringifyAgentExchange(exchange)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFilename(filename)}.dgac.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
