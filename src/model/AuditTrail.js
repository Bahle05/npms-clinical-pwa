/**
 * Computes SHA-256 hex digest using Web Crypto API with deterministic pure-JS SHA-256 fallback
 * so both browser/PWA and Node/Vitest environments produce identical cryptographic hashes.
 */
export async function sha256Hex(message) {
  const text = String(message ?? '');
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return fallbackSha256(text);
}

function fallbackSha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export function serializeCanonicalAuditPayload(entry) {
  return [
    entry.PrevHash || 'GENESIS',
    entry.Ts || 0,
    entry.ActorStaffID || entry.StaffID || '',
    entry.ActionType || entry.Action || '',
    entry.PatientID || '',
    entry.Outcome || 'SUCCESS',
    entry.TransactionDetails || entry.Detail || ''
  ].join('|');
}

export class AuditTrail {
  static async createChainedEntry(rawEntry, previousEntry = null) {
    const Ts = rawEntry.Ts || Date.now();
    const Time = rawEntry.Time || new Date(Ts).toISOString().slice(0, 16).replace('T', ' ');
    const PrevHash = previousEntry ? previousEntry.IntegrityHash : 'GENESIS';
    const entry = {
      LogID: rawEntry.LogID || `A-${Ts}-${Math.random().toString(36).slice(2, 6)}`,
      ActorStaffID: rawEntry.ActorStaffID || rawEntry.StaffID || 'SYSTEM',
      StaffID: rawEntry.StaffID || rawEntry.ActorStaffID || 'SYSTEM',
      PatientID: rawEntry.PatientID || '-',
      ActionType: rawEntry.ActionType || rawEntry.Action || 'Clinical Action',
      Action: rawEntry.Action || rawEntry.ActionType || 'Clinical Action',
      Outcome: rawEntry.Outcome || 'SUCCESS',
      TransactionDetails: rawEntry.TransactionDetails || rawEntry.Detail || '',
      Detail: rawEntry.Detail || rawEntry.TransactionDetails || '',
      LoggedTimestamp: Time,
      Time,
      Ts,
      TerminalIPAddress: rawEntry.TerminalIPAddress || '127.0.0.1 (Clinic-Terminal)',
      PrevHash
    };
    entry.IntegrityHash = await sha256Hex(serializeCanonicalAuditPayload(entry));
    return entry;
  }

  static async verifyIntegrityHash(entries = []) {
    const sorted = [...entries].sort((a, b) => (a.Ts || 0) - (b.Ts || 0));
    let expectedPrev = 'GENESIS';
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      if ((item.PrevHash || 'GENESIS') !== expectedPrev) {
        return {
          valid: false,
          checkedCount: i + 1,
          brokenAtIndex: i,
          brokenLogID: item.LogID,
          reason: `Chain link mismatch at entry #${i + 1} (${item.LogID}): expected PrevHash ${expectedPrev.slice(0, 12)}... but found ${(item.PrevHash || '').slice(0, 12)}...`
        };
      }
      const recomputed = await sha256Hex(serializeCanonicalAuditPayload(item));
      if (recomputed !== item.IntegrityHash) {
        return {
          valid: false,
          checkedCount: i + 1,
          brokenAtIndex: i,
          brokenLogID: item.LogID,
          reason: `Tampering detected at entry #${i + 1} (${item.LogID}): recomputed SHA-256 hash does not match stored IntegrityHash.`
        };
      }
      expectedPrev = item.IntegrityHash;
    }
    return {
      valid: true,
      checkedCount: sorted.length,
      headHash: expectedPrev,
      reason: sorted.length
        ? `All ${sorted.length} audit entries verified intact against SHA-256 hash chain.`
        : 'Audit log is empty (GENESIS state verified).'
    };
  }

  static exportRegulatoryLog(entries = []) {
    const headers = [
      'LogID',
      'LoggedTimestamp',
      'ActorStaffID',
      'ActionType',
      'PatientID',
      'Outcome',
      'TransactionDetails',
      'TerminalIPAddress',
      'PrevHash',
      'IntegrityHash'
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = entries.map((e) =>
      [
        e.LogID,
        e.LoggedTimestamp || e.Time,
        e.ActorStaffID || e.StaffID,
        e.ActionType || e.Action,
        e.PatientID,
        e.Outcome,
        e.TransactionDetails || e.Detail,
        e.TerminalIPAddress || '127.0.0.1',
        e.PrevHash,
        e.IntegrityHash
      ]
        .map(esc)
        .join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }
}