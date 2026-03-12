package securityforensics.ja3;

import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;

/**
 * Tracks identity reuse across accounts.
 * Answers: "How many different accounts have used this JA3 / device / IP?"
 *
 * NOTE: In-memory only. On restart counts reset.
 * For production: replace with MongoDB/Redis persistence.
 */
@Component
public class IdentityProfileStore {

    // ja3 → set of accountIds that used it
    private final ConcurrentHashMap<String, Set<String>> ja3Accounts = new ConcurrentHashMap<>();

    // deviceHash → set of accountIds
    private final ConcurrentHashMap<String, Set<String>> deviceAccounts = new ConcurrentHashMap<>();

    // ip → set of accountIds
    private final ConcurrentHashMap<String, Set<String>> ipAccounts = new ConcurrentHashMap<>();

    // Track first-seen (for isNew flags)
    private final Set<String> seenJa3     = ConcurrentHashMap.newKeySet();
    private final Set<String> seenDevices = ConcurrentHashMap.newKeySet();
    private final Set<String> seenIps     = ConcurrentHashMap.newKeySet();

    /**
     * Record an identity event and return forensic signals.
     */
    public IdentityForensicResult record(String accountId, String ja3,
                                         String deviceHash, String ip,
                                         String geoCountry, String accountGeoCountry) {

        boolean isNewJa3    = ja3 != null && seenJa3.add(ja3);
        boolean isNewDevice = deviceHash != null && seenDevices.add(deviceHash);
        boolean isNewIp     = ip != null && seenIps.add(ip);

        // Update profile sets
        if (ja3 != null && accountId != null) {
            ja3Accounts.computeIfAbsent(ja3, k -> ConcurrentHashMap.newKeySet()).add(accountId);
        }
        if (deviceHash != null && accountId != null) {
            deviceAccounts.computeIfAbsent(deviceHash, k -> ConcurrentHashMap.newKeySet()).add(accountId);
        }
        if (ip != null && accountId != null) {
            ipAccounts.computeIfAbsent(ip, k -> ConcurrentHashMap.newKeySet()).add(accountId);
        }

        int ja3ReuseCount    = ja3 != null ? ja3Accounts.getOrDefault(ja3, Set.of()).size() : 0;
        int deviceReuseCount = deviceHash != null ? deviceAccounts.getOrDefault(deviceHash, Set.of()).size() : 0;
        int ipReuseCount     = ip != null ? ipAccounts.getOrDefault(ip, Set.of()).size() : 0;

        // Geo mismatch: account's known country vs current request country
        boolean geoMismatch = accountGeoCountry != null && geoCountry != null
                && !accountGeoCountry.equalsIgnoreCase(geoCountry);

        return new IdentityForensicResult(
                ja3ReuseCount,
                deviceReuseCount,
                ipReuseCount,
                geoMismatch,
                isNewDevice,
                isNewJa3
        );
    }
}