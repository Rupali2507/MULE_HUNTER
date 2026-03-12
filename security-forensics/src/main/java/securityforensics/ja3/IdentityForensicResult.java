package securityforensics.ja3;

/**
 * Output of the Identity Forensic step.
 * Matches architecture doc exactly:
 * {
 *   "ja3ReuseCount": 8,
 *   "deviceReuseCount": 6,
 *   "ipReuseCount": 3,
 *   "geoMismatch": false,
 *   "isNewDevice": false,
 *   "isNewJa3": true
 * }
 */
public class IdentityForensicResult {

    public final int ja3ReuseCount;
    public final int deviceReuseCount;
    public final int ipReuseCount;
    public final boolean geoMismatch;
    public final boolean isNewDevice;
    public final boolean isNewJa3;

    public IdentityForensicResult(int ja3ReuseCount, int deviceReuseCount, int ipReuseCount,
                                   boolean geoMismatch, boolean isNewDevice, boolean isNewJa3) {
        this.ja3ReuseCount    = ja3ReuseCount;
        this.deviceReuseCount = deviceReuseCount;
        this.ipReuseCount     = ipReuseCount;
        this.geoMismatch      = geoMismatch;
        this.isNewDevice      = isNewDevice;
        this.isNewJa3         = isNewJa3;
    }
}