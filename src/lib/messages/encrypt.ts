import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // bytes

function getKey() {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string')
  }
  return Buffer.from(keyHex, 'hex')
}

export function encryptToken(plain: string): string {
  if (!plain) return ''

  const iv = crypto.randomBytes(IV_LENGTH)
  const key = getKey()

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])

  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null

  const [ivHex, dataHex] = encrypted.split(':')
  if (!ivHex || !dataHex) return null

  try {
    const iv = Buffer.from(ivHex, 'hex')
    const key = getKey()
    const encryptedBuf = Buffer.from(dataHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    const decrypted = Buffer.concat([
      decipher.update(encryptedBuf),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    // Wrong ENCRYPTION_KEY or corrupt ciphertext — treat as missing.
    return null
  }
}

