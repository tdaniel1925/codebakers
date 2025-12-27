import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

/**
 * Device fingerprinting for zero-friction trial system
 * Creates a stable, unique identifier for each device to prevent trial abuse
 */

export interface DeviceFingerprint {
  machineId: string;
  deviceHash: string;
  platform: string;
  hostname: string;
}

/**
 * Get a stable machine identifier based on OS
 * - Windows: MachineGuid from registry
 * - macOS: IOPlatformUUID from system
 * - Linux: /etc/machine-id
 */
function getMachineId(): string {
  try {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: Use MachineGuid from registry
      const output = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } else if (platform === 'darwin') {
      // macOS: Use hardware UUID
      const output = execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID',
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"(.+)"/);
      if (match && match[1]) {
        return match[1];
      }
    } else {
      // Linux: Use machine-id
      const output = execSync('cat /etc/machine-id', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output.trim();
    }
  } catch {
    // Fallback handled below
  }

  // Fallback: Create a stable hash from hostname + username + home directory
  // This is less reliable but works when we can't access system IDs
  const fallbackData = [
    os.hostname(),
    os.userInfo().username,
    os.homedir(),
    os.platform(),
    os.arch(),
  ].join('|');

  return crypto.createHash('sha256').update(fallbackData).digest('hex').slice(0, 36);
}

/**
 * Get a complete device fingerprint
 * The deviceHash is the primary identifier used for trial tracking
 */
export function getDeviceFingerprint(): DeviceFingerprint {
  const machineId = getMachineId();

  // Collect stable machine characteristics
  const fingerprintData = {
    machineId,
    hostname: os.hostname(),
    username: os.userInfo().username,
    platform: os.platform(),
    arch: os.arch(),
    cpuModel: os.cpus()[0]?.model || 'unknown',
    totalMemory: Math.floor(os.totalmem() / (1024 * 1024 * 1024)), // GB rounded
    homeDir: os.homedir(),
  };

  // Create a stable hash from all characteristics
  const deviceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprintData))
    .digest('hex');

  return {
    machineId,
    deviceHash,
    platform: os.platform(),
    hostname: os.hostname(),
  };
}

/**
 * Validate that we can create a fingerprint
 * Used for diagnostics
 */
export function canCreateFingerprint(): { success: boolean; error?: string } {
  try {
    const fp = getDeviceFingerprint();
    if (fp.deviceHash && fp.deviceHash.length === 64) {
      return { success: true };
    }
    return { success: false, error: 'Invalid fingerprint generated' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
