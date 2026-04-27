package com.synapseedge.cortex.mesh

import android.util.Base64
import android.util.Log
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * EncryptionUtils — AES-256-GCM encryption for mesh relay transit security.
 *
 * All field task data is encrypted before transmission over the Nearby
 * Connections API. This ensures confidentiality even if someone within
 * Bluetooth/Wi-Fi range intercepts the P2P traffic.
 *
 * Why AES-256-GCM specifically:
 * - **AES-256**: Military-grade encryption, sufficient for sensitive crisis data
 * - **GCM mode**: Provides both confidentiality AND integrity (authenticated encryption)
 * - **No CBC**: GCM doesn't require padding, preventing padding oracle attacks
 *
 * Key derivation:
 * The encryption key is derived from a pre-shared key (PSK) using PBKDF2
 * with SHA-256. In production, the PSK would be derived from organizational
 * credentials distributed during volunteer onboarding.
 *
 * Wire format:
 * ```
 * [12 bytes IV][N bytes ciphertext + 16 bytes GCM auth tag]
 * ```
 *
 * @param preSharedKey The organization-distributed pre-shared key
 */
class EncryptionUtils(preSharedKey: String) {

    companion object {
        private const val TAG = "EncryptionUtils"

        // AES-256-GCM parameters
        private const val ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_ALGORITHM = "AES"
        private const val IV_LENGTH_BYTES = 12   // Standard GCM IV length
        private const val TAG_LENGTH_BITS = 128  // Standard GCM auth tag length
        private const val KEY_LENGTH_BITS = 256  // AES-256

        // PBKDF2 key derivation parameters
        private const val KDF_ALGORITHM = "PBKDF2WithHmacSHA256"
        private const val KDF_ITERATIONS = 100_000  // OWASP recommended minimum
        private const val KDF_SALT = "synapse-edge-cortex-v1" // Static salt (acceptable for PSK)
    }

    /** Derived AES-256 key from the pre-shared key */
    private val secretKey: SecretKeySpec

    /** Cryptographically secure random number generator for IVs */
    private val secureRandom = SecureRandom()

    init {
        // Derive a 256-bit key from the PSK using PBKDF2
        val factory = SecretKeyFactory.getInstance(KDF_ALGORITHM)
        val spec = PBEKeySpec(
            preSharedKey.toCharArray(),
            KDF_SALT.toByteArray(),
            KDF_ITERATIONS,
            KEY_LENGTH_BITS
        )
        val derivedKey = factory.generateSecret(spec)
        secretKey = SecretKeySpec(derivedKey.encoded, KEY_ALGORITHM)

        Log.d(TAG, "✓ Encryption key derived (AES-256-GCM, PBKDF2 $KDF_ITERATIONS iterations)")
    }

    /**
     * Encrypt a plaintext string using AES-256-GCM.
     *
     * Generates a fresh random IV for each encryption operation to ensure
     * semantic security (same plaintext encrypted twice produces different
     * ciphertext).
     *
     * @param plaintext The string to encrypt (typically JSON)
     * @return Byte array: [12-byte IV][ciphertext + auth tag]
     */
    fun encrypt(plaintext: String): ByteArray {
        // Generate a fresh random IV for this encryption
        val iv = ByteArray(IV_LENGTH_BYTES)
        secureRandom.nextBytes(iv)

        // Initialize cipher for encryption
        val cipher = Cipher.getInstance(ALGORITHM)
        val gcmSpec = GCMParameterSpec(TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

        // Encrypt the plaintext
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        // Prepend IV to ciphertext for transmission
        // Wire format: [IV (12 bytes)][ciphertext + GCM tag (N + 16 bytes)]
        val output = ByteArray(IV_LENGTH_BYTES + ciphertext.size)
        System.arraycopy(iv, 0, output, 0, IV_LENGTH_BYTES)
        System.arraycopy(ciphertext, 0, output, IV_LENGTH_BYTES, ciphertext.size)

        return output
    }

    /**
     * Decrypt a ciphertext byte array using AES-256-GCM.
     *
     * Extracts the IV from the first 12 bytes, then decrypts and verifies
     * the GCM authentication tag to ensure data integrity.
     *
     * @param data Byte array: [12-byte IV][ciphertext + auth tag]
     * @return Decrypted plaintext string
     * @throws javax.crypto.AEADBadTagException if the data was tampered with
     */
    fun decrypt(data: ByteArray): String {
        // Extract IV from first 12 bytes
        val iv = data.copyOfRange(0, IV_LENGTH_BYTES)
        val ciphertext = data.copyOfRange(IV_LENGTH_BYTES, data.size)

        // Initialize cipher for decryption
        val cipher = Cipher.getInstance(ALGORITHM)
        val gcmSpec = GCMParameterSpec(TAG_LENGTH_BITS, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

        // Decrypt and verify GCM auth tag
        val plaintext = cipher.doFinal(ciphertext)
        return String(plaintext, Charsets.UTF_8)
    }

    /**
     * Encrypt to Base64 string (convenience for JSON embedding).
     *
     * @param plaintext The string to encrypt
     * @return Base64-encoded encrypted data
     */
    fun encryptToBase64(plaintext: String): String {
        val encrypted = encrypt(plaintext)
        return Base64.encodeToString(encrypted, Base64.NO_WRAP)
    }

    /**
     * Decrypt from Base64 string (convenience for JSON parsing).
     *
     * @param base64Data Base64-encoded encrypted data
     * @return Decrypted plaintext string
     */
    fun decryptFromBase64(base64Data: String): String {
        val data = Base64.decode(base64Data, Base64.NO_WRAP)
        return decrypt(data)
    }
}
